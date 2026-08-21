<?php

namespace Tests\Feature;

use App\Http\Controllers\AuthController;
use App\Services\AuthSessionService;
use Illuminate\Http\JsonResponse;
use Tests\TestCase;

final class ApiBoundaryTest extends TestCase
{
    public function test_protected_route_requires_bearer_token(): void
    {
        $this->getJson('/api/v1/rooms')
            ->assertUnauthorized()
            ->assertExactJson(['error' => ['message' => 'Token autentikasi diperlukan']]);
    }

    public function test_unknown_route_uses_error_envelope(): void
    {
        $this->getJson('/api/v1/not-found')
            ->assertNotFound()
            ->assertExactJson(['error' => ['message' => 'Route tidak ditemukan']]);
    }

    public function test_self_registration_endpoint_is_not_available(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'fullName' => 'Valid Name',
            'email' => 'valid@example.test',
            'password' => 'password123',
        ])->assertNotFound()->assertExactJson(['error' => ['message' => 'Route tidak ditemukan']]);
    }

    public function test_refresh_cookie_expires_after_seven_days(): void
    {
        $controller = new AuthController(app(AuthSessionService::class));
        $method = new \ReflectionMethod($controller, 'withRefreshCookie');
        $response = $method->invoke($controller, new JsonResponse(['data' => []]), 'refresh-token');
        $cookie = $response->headers->getCookies()[0];

        $this->assertSame('refreshToken', $cookie->getName());
        $this->assertSame('/api/v1/auth', $cookie->getPath());
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertSame('strict', $cookie->getSameSite());
        $this->assertGreaterThan(6 * 24 * 60 * 60, $cookie->getExpiresTime() - time());
    }
}
