<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Exceptions\ApiException;
use App\Models\AuthSession;
use App\Models\LoginActivity;
use App\Models\User;
use App\Services\AuthSessionService;
use App\Services\JwtService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

final class AuthSessionSecurityTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('password_reset_tokens', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamp('created_at');
        });
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
            'full_name' => 'Session User',
            'username' => 'session.user',
            'email' => 'session@example.test',
            'password_hash' => Hash::make('Password123!'),
            'role' => Role::PEMOHON,
        ]);
    }

    public function test_login_returns_configured_timeout_and_rotates_refresh_token(): void
    {
        config(['jwt.inactivity_ttl' => 1800]);
        $login = $this->postJson('/api/v1/auth/login', ['username' => $this->user->username, 'password' => 'Password123!'])
            ->assertOk()
            ->assertJsonPath('data.inactivityTimeoutSeconds', 1800);
        $firstCookie = collect($login->headers->getCookies())->first(fn ($cookie) => $cookie->getName() === 'refreshToken');

        $rotated = app(AuthSessionService::class)->rotate($firstCookie->getValue());
        $this->assertNotSame($firstCookie->getValue(), $rotated['refreshToken']);
        $this->expectException(ApiException::class);
        app(AuthSessionService::class)->rotate($firstCookie->getValue());
    }

    public function test_successful_login_is_recorded_and_visible_only_to_administrators(): void
    {
        $this->postJson('/api/v1/auth/login', [
            'username' => $this->user->username,
            'password' => 'WrongPassword123!',
        ])->assertUnauthorized();
        $this->assertSame(0, LoginActivity::query()->count());

        $this->postJson('/api/v1/auth/login', [
            'username' => $this->user->username,
            'password' => 'Password123!',
        ])->assertOk();
        $this->assertDatabaseHas('login_activities', ['user_id' => $this->user->id]);

        $this->getJson('/api/v1/login-activities')->assertUnauthorized();
        $userToken = app(AuthSessionService::class)->create($this->user)['accessToken'];
        $this->withToken($userToken)->getJson('/api/v1/login-activities')->assertForbidden();

        $administrator = User::query()->create([
            'full_name' => 'Administrator',
            'username' => 'administrator',
            'email' => 'administrator@example.test',
            'password_hash' => Hash::make('Password123!'),
            'role' => Role::KASUBAG_UMUM,
        ]);
        $administratorToken = app(AuthSessionService::class)->create($administrator)['accessToken'];
        $this->withToken($administratorToken)->getJson('/api/v1/login-activities')
            ->assertOk()
            ->assertJsonPath('data.summary.loginCount', 1)
            ->assertJsonPath('data.summary.uniqueUserCount', 1)
            ->assertJsonPath('data.activities.0.user.username', $this->user->username)
            ->assertJsonPath('data.activities.0.status', 'ACTIVE')
            ->assertJsonMissingPath('data.activities.0.user.email');
    }

    public function test_prune_command_deletes_only_login_activities_older_than_24_hours(): void
    {
        $oldSession = app(AuthSessionService::class)->create($this->user);
        $recentSession = app(AuthSessionService::class)->create($this->user);
        LoginActivity::query()->create([
            'user_id' => $this->user->id,
            'auth_session_id' => $this->sessionId($oldSession['accessToken']),
            'logged_in_at' => now()->subDay()->subMinute(),
        ]);
        LoginActivity::query()->create([
            'user_id' => $this->user->id,
            'auth_session_id' => $this->sessionId($recentSession['accessToken']),
            'logged_in_at' => now()->subHours(23),
        ]);

        $this->artisan('login-activities:prune')->assertSuccessful();

        $this->assertSame(1, LoginActivity::query()->count());
        $this->assertSame(2, AuthSession::query()->count());
    }

    public function test_inactive_session_is_rejected_for_access_and_refresh(): void
    {
        config(['jwt.inactivity_ttl' => 60]);
        $tokens = app(AuthSessionService::class)->create($this->user);
        AuthSession::query()->whereKey($this->sessionId($tokens['accessToken']))->update(['last_activity_at' => now()->subMinutes(2)]);

        $this->withToken($tokens['accessToken'])->getJson('/api/v1/rooms')
            ->assertUnauthorized()
            ->assertJsonPath('error.details.code', 'SESSION_INACTIVE');
        try {
            app(AuthSessionService::class)->rotate($tokens['refreshToken']);
            $this->fail('Inactive refresh token was accepted.');
        } catch (ApiException $exception) {
            $this->assertSame(401, $exception->status);
        }
    }

    public function test_new_session_is_immediately_valid_for_protected_route(): void
    {
        $tokens = app(AuthSessionService::class)->create($this->user);

        $this->withToken($tokens['accessToken'])->getJson('/api/v1/auth/me')->assertOk();
    }

    public function test_logout_and_password_change_revoke_sessions(): void
    {
        $first = app(AuthSessionService::class)->create($this->user);
        $second = app(AuthSessionService::class)->create($this->user);
        app(AuthSessionService::class)->revokeFromRefreshToken($first['refreshToken']);
        $this->assertNotNull(AuthSession::query()->find($this->sessionId($first['accessToken']))->revoked_at);

        $this->withToken($second['accessToken'])->patchJson('/api/v1/auth/password', [
            'currentPassword' => 'Password123!',
            'newPassword' => 'ChangedPassword123!',
            'newPassword_confirmation' => 'ChangedPassword123!',
        ])->assertOk();
        $this->assertSame(0, AuthSession::query()->whereNull('revoked_at')->count());
    }

    public function test_current_database_role_controls_authorization(): void
    {
        $tokens = app(AuthSessionService::class)->create($this->user);
        $this->user->update(['role' => Role::KABAG_UMUM]);

        $this->withToken($tokens['accessToken'])->getJson('/api/v1/users')->assertOk();
    }

    public function test_activity_heartbeat_updates_last_activity(): void
    {
        config(['jwt.activity_write_interval_seconds' => 1]);
        $tokens = app(AuthSessionService::class)->create($this->user);
        $sessionId = $this->sessionId($tokens['accessToken']);
        AuthSession::query()->whereKey($sessionId)->update(['last_activity_at' => now()->subMinutes(5)]);

        $this->withToken($tokens['accessToken'])->postJson('/api/v1/auth/activity')->assertOk()->assertJsonStructure(['data' => ['accessToken']]);

        $this->assertTrue(AuthSession::query()->find($sessionId)->last_activity_at->gt(now()->subMinute()));
    }

    private function sessionId(string $token): string
    {
        return app(JwtService::class)->decode($token, 'access')->sid;
    }
}
