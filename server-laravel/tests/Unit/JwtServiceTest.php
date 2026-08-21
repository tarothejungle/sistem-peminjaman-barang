<?php

namespace Tests\Unit;

use App\Enums\Role;
use App\Services\JwtService;
use Tests\TestCase;

final class JwtServiceTest extends TestCase
{
    public function test_access_token_preserves_required_claims(): void
    {
        $service = app(JwtService::class);
        $payload = $service->decode($service->access('user-id', Role::KABAG_UMUM), 'access');

        $this->assertSame('user-id', $payload->sub);
        $this->assertSame('access', $payload->type);
        $this->assertSame('KABAG_UMUM', $payload->role);
        $this->assertSame(config('jwt.issuer'), $payload->iss);
        $this->assertSame(config('jwt.audience'), $payload->aud);
        $this->assertEqualsWithDelta(900, $payload->exp - $payload->iat, 1);
    }

    public function test_refresh_token_has_seven_day_lifetime(): void
    {
        $service = app(JwtService::class);
        $payload = $service->decode($service->refresh('user-id'), 'refresh');

        $this->assertSame('refresh', $payload->type);
        $this->assertEqualsWithDelta(604800, $payload->exp - $payload->iat, 1);
    }
}
