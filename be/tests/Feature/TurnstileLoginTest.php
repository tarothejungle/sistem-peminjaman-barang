<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

final class TurnstileLoginTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('full_name');
            $table->string('username')->unique();
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
        $this->user = User::query()->create([
            'full_name' => 'Turnstile User',
            'username' => 'turnstile.user',
            'email' => 'turnstile@example.test',
            'password_hash' => Hash::make('Password123!'),
            'role' => Role::PEMOHON,
        ]);
        config([
            'services.turnstile.enabled' => true,
            'services.turnstile.site_key' => 'public-test-key',
            'services.turnstile.secret_key' => 'private-test-key',
        ]);
    }

    public function test_auth_config_exposes_only_public_turnstile_settings(): void
    {
        $response = $this->getJson('/api/v1/auth/config')
            ->assertOk()
            ->assertJsonPath('data.turnstileEnabled', true)
            ->assertJsonPath('data.turnstileSiteKey', 'public-test-key');

        $this->assertStringNotContainsString('private-test-key', $response->getContent());
    }

    public function test_login_requires_captcha_token_when_turnstile_is_enabled(): void
    {
        $this->postJson('/api/v1/auth/login', [
            'username' => $this->user->username,
            'password' => 'Password123!',
        ])->assertBadRequest()->assertJsonStructure(['error' => ['details' => ['captchaToken']]]);
    }

    public function test_login_rejects_failed_turnstile_verification_before_creating_session(): void
    {
        Http::fake(['*' => Http::response(['success' => false, 'error-codes' => ['invalid-input-response']])]);

        $this->postJson('/api/v1/auth/login', [
            'username' => $this->user->username,
            'password' => 'Password123!',
            'captchaToken' => 'invalid-token',
        ])->assertStatus(422)->assertJsonPath('error.message', 'Verifikasi keamanan gagal. Silakan ulangi verifikasi.');

        $this->assertDatabaseCount('auth_sessions', 0);
    }

    public function test_login_accepts_valid_turnstile_verification(): void
    {
        Http::fake(['*' => Http::response(['success' => true, 'hostname' => 'example.test'])]);

        $this->postJson('/api/v1/auth/login', [
            'username' => $this->user->username,
            'password' => 'Password123!',
            'captchaToken' => 'valid-token',
        ])->assertOk()->assertJsonStructure(['data' => ['accessToken']]);

        Http::assertSent(fn ($request): bool => $request['secret'] === 'private-test-key'
            && $request['response'] === 'valid-token');
        $this->assertDatabaseCount('auth_sessions', 1);
    }
}
