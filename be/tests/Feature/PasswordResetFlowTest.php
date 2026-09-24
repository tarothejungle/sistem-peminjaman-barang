<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Mail\PasswordResetMail;
use App\Models\AuthSession;
use App\Models\PasswordResetToken;
use App\Models\User;
use App\Services\AuthSessionService;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

final class PasswordResetFlowTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('full_name', 100);
            $table->string('username', 50)->unique();
            $table->string('email')->unique();
            $table->string('password_hash');
            $table->string('role');
            $table->timestamps();
        });
        Schema::create('auth_sessions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('refresh_token_hash')->unique();
            $table->timestamp('last_activity_at');
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });
        Schema::create('login_activities', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('auth_session_id')->unique();
            $table->timestamp('logged_in_at');
            $table->timestamps();
        });
        Schema::create('password_reset_tokens', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamp('created_at');
        });

        $this->user = User::query()->create([
            'full_name' => 'Pemohon Reset',
            'username' => 'pemohon.reset',
            'email' => 'reset@example.test',
            'password_hash' => Hash::make('OldPassword123!'),
            'role' => Role::PEMOHON,
        ]);

        Mail::fake();
    }

    public function test_forgot_password_sends_link_and_stores_only_a_hash(): void
    {
        $this->assertTrue(is_subclass_of(PasswordResetMail::class, ShouldBeEncrypted::class));
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'RESET@EXAMPLE.TEST'])
            ->assertOk()
            ->assertJsonStructure(['data' => ['message']]);

        Mail::assertSent(PasswordResetMail::class, fn (PasswordResetMail $mail): bool => $mail->hasTo('reset@example.test'));

        $record = PasswordResetToken::query()->firstOrFail();
        $this->assertSame($this->user->id, $record->user_id);
        $this->assertSame(64, strlen($record->token_hash));
        $this->assertNull($record->used_at);
        $this->assertTrue($record->expires_at->isFuture());
    }

    public function test_forgot_password_does_not_reveal_whether_the_email_exists(): void
    {
        $known = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'reset@example.test']);
        $unknown = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'tidak-ada@example.test']);

        $known->assertOk();
        $unknown->assertOk();
        $this->assertSame($known->json('data.message'), $unknown->json('data.message'));
        $this->assertSame(1, PasswordResetToken::query()->count());
    }

    public function test_reset_password_rotates_credentials_and_revokes_sessions(): void
    {
        $session = app(AuthSessionService::class)->create($this->user);
        $this->assertSame(1, AuthSession::query()->whereNull('revoked_at')->count());

        $token = $this->issueToken();

        $this->postJson('/api/v1/auth/reset-password/verify', ['token' => $token])
            ->assertOk()
            ->assertJsonPath('data.valid', true);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'password' => 'BrandNewPassword123!',
            'password_confirmation' => 'BrandNewPassword123!',
        ])->assertOk();

        $this->assertTrue(Hash::check('BrandNewPassword123!', $this->user->refresh()->password_hash));
        $this->assertSame(0, AuthSession::query()->whereNull('revoked_at')->count());
        $this->assertNotNull(PasswordResetToken::query()->firstOrFail()->used_at);
        $this->assertNotNull($session['refreshToken']);

        // New password logs in, old one does not.
        $this->postJson('/api/v1/auth/login', ['username' => 'pemohon.reset', 'password' => 'BrandNewPassword123!'])->assertOk();
        $this->postJson('/api/v1/auth/login', ['username' => 'pemohon.reset', 'password' => 'OldPassword123!'])->assertUnauthorized();
    }

    public function test_reset_token_is_single_use(): void
    {
        $token = $this->issueToken();

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'password' => 'FirstRotation123!',
            'password_confirmation' => 'FirstRotation123!',
        ])->assertOk();

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'password' => 'SecondRotation123!',
            'password_confirmation' => 'SecondRotation123!',
        ])->assertStatus(422)
            ->assertJsonPath('error.message', 'Tautan reset password tidak valid atau sudah kedaluwarsa');

        $this->assertTrue(Hash::check('FirstRotation123!', $this->user->refresh()->password_hash));
    }

    public function test_expired_and_unknown_tokens_are_rejected(): void
    {
        $token = $this->issueToken();
        PasswordResetToken::query()->update(['expires_at' => now()->subMinute()]);

        $this->postJson('/api/v1/auth/reset-password/verify', ['token' => $token])->assertOk()->assertJsonPath('data.valid', false);
        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'password' => 'AnyPassword123!',
            'password_confirmation' => 'AnyPassword123!',
        ])->assertStatus(422);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => str_repeat('a', 64),
            'password' => 'AnyPassword123!',
            'password_confirmation' => 'AnyPassword123!',
        ])->assertStatus(422);

        // Malformed tokens fail validation before hitting the database.
        $this->postJson('/api/v1/auth/reset-password', [
            'token' => 'short-token',
            'password' => 'AnyPassword123!',
            'password_confirmation' => 'AnyPassword123!',
        ])->assertBadRequest();
    }

    public function test_requesting_a_new_link_coexists_with_previous_token(): void
    {
        $first = $this->issueToken();
        $second = $this->issueToken();

        $this->postJson('/api/v1/auth/reset-password/verify', ['token' => $first])->assertJsonPath('data.valid', true);
        $this->postJson('/api/v1/auth/reset-password/verify', ['token' => $second])->assertJsonPath('data.valid', true);
    }

    public function test_reset_endpoint_rejects_unknown_fields_and_weak_passwords(): void
    {
        $token = $this->issueToken();

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'password' => 'short',
            'password_confirmation' => 'short',
        ])->assertBadRequest();

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'password' => 'ValidPassword123!',
            'password_confirmation' => 'DifferentPassword123!',
        ])->assertBadRequest();

        $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'reset@example.test',
            'role' => Role::KABAG_UMUM->value,
        ])->assertBadRequest();
    }

    /**
     * Triggers the real request flow and extracts the plaintext token from the
     * emailed link, mirroring what a user would click.
     */
    private function issueToken(): string
    {
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'reset@example.test'])->assertOk();

        $token = null;
        Mail::assertSent(PasswordResetMail::class, function (PasswordResetMail $mail) use (&$token): bool {
            parse_str((string) parse_url($mail->resetUrl, PHP_URL_FRAGMENT), $query);
            $token = $query['token'] ?? null;

            return true;
        });

        $this->assertIsString($token);

        return $token;
    }

    public function test_reset_consumes_all_outstanding_links(): void
    {
        $first = $this->issueToken();
        Mail::fake();
        $second = $this->issueToken();
        $this->assertNotSame($first, $second);
        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $second,
            'password' => 'NewSecurePassword123!',
            'password_confirmation' => 'NewSecurePassword123!',
        ])->assertOk();
        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $first,
            'password' => 'AttackerPassword123!',
            'password_confirmation' => 'AttackerPassword123!',
        ])->assertStatus(422);
    }

    public function test_password_change_invalidates_reset_links_and_real_sessions(): void
    {
        $token = $this->issueToken();
        $session = app(AuthSessionService::class)->create($this->user);
        $this->withToken($session['accessToken'])->patchJson('/api/v1/auth/password', [
            'currentPassword' => 'OldPassword123!',
            'newPassword' => 'NewSecurePassword123!',
            'newPassword_confirmation' => 'NewSecurePassword123!',
        ])->assertOk();
        $this->withToken($session['accessToken'])->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->postJson('/api/v1/auth/reset-password/verify', ['token' => $token])->assertJsonPath('data.valid', false);
    }

    public function test_admin_password_change_revokes_target_sessions_and_links(): void
    {
        $reset = $this->issueToken();
        $session = app(AuthSessionService::class)->create($this->user);
        $admin = User::query()->create([
            'full_name' => 'Administrator', 'username' => 'admin.reset',
            'email' => 'admin.reset@example.test', 'password_hash' => Hash::make('AdminPassword123!'),
            'role' => Role::KABAG_UMUM,
        ]);
        $adminSession = app(AuthSessionService::class)->create($admin);
        $this->withToken($adminSession['accessToken'])->putJson('/api/v1/users/'.$this->user->id, [
            'password' => 'ManagedPassword123!',
        ])->assertOk();
        $this->assertTrue(Hash::check('ManagedPassword123!', $this->user->refresh()->password_hash));
        $this->withToken($session['accessToken'])->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->postJson('/api/v1/auth/reset-password/verify', ['token' => $reset])->assertJsonPath('data.valid', false);
    }
}
