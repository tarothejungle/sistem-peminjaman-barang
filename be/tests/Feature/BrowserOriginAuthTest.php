<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use App\Services\JwtService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

final class BrowserOriginAuthTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.frontend_url' => 'http://localhost:5173']);

        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('full_name');
            $table->string('username')->unique();
            $table->string('email')->unique();
            $table->string('password_hash');
            $table->string('role');
            $table->timestamps();
        });

        $this->user = User::query()->create([
            'full_name' => 'Origin User',
            'username' => 'origin.user',
            'email' => 'origin@example.test',
            'password_hash' => Hash::make('Password123!'),
            'role' => Role::PEMOHON,
        ]);
    }

    public function test_browser_origin_header_is_rejected_on_auth_endpoints(): void
    {
        $token = app(JwtService::class)->access($this->user->id, Role::PEMOHON);
        $this->withToken($token)->postJson('/api/v1/auth/logout', [], [
            'Origin' => 'http://evil.example',
        ])->assertForbidden();
    }

    public function test_same_origin_header_is_accepted(): void
    {
        $token = app(JwtService::class)->access($this->user->id, Role::PEMOHON);
        $this->withToken($token)->postJson('/api/v1/auth/logout', [], [
            'Origin' => 'http://localhost:5173',
        ])->assertSuccessful();
    }

    public function test_origin_requires_matching_scheme_and_port(): void
    {
        foreach (['http://localhost:9999', 'https://localhost:5173', 'null', 'http://localhost.evil.test:5173'] as $origin) {
            $this->postJson('/api/v1/auth/logout', [], ['Origin' => $origin])->assertForbidden();
        }
    }

    public function test_configured_backend_and_local_same_origin_are_accepted(): void
    {
        config(['app.url' => 'https://portal.example.test']);
        $this->postJson('/api/v1/auth/logout', [], ['Origin' => 'https://portal.example.test:443'])->assertSuccessful();
        $this->app->instance('env', 'local');
        $this->postJson('http://127.0.0.1:8010/api/v1/auth/logout', [], ['Origin' => 'http://127.0.0.1:8010'])->assertSuccessful();
        $this->postJson('http://127.0.0.1:8010/api/v1/auth/logout', [], ['Origin' => 'http://127.0.0.1:9999'])->assertForbidden();
    }

    public function test_cross_site_fetch_without_origin_is_rejected(): void
    {
        $this->postJson('/api/v1/auth/logout', [], ['Sec-Fetch-Site' => 'cross-site'])->assertForbidden();
    }
}
