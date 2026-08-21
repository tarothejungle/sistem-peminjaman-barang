<?php

namespace App\Services;

use App\Enums\Role;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use RuntimeException;
use stdClass;

final class JwtService
{
    public function access(string $subject, Role $role): string
    {
        return $this->encode($subject, 'access', config('jwt.access_ttl'), ['role' => $role->value]);
    }

    public function refresh(string $subject): string
    {
        return $this->encode($subject, 'refresh', config('jwt.refresh_ttl'));
    }

    public function decode(string $token, string $type): stdClass
    {
        $secret = $this->secret($type);
        $payload = JWT::decode($token, new Key($secret, 'HS256'));

        if (($payload->iss ?? null) !== config('jwt.issuer') || ($payload->aud ?? null) !== config('jwt.audience') || ($payload->type ?? null) !== $type || ! isset($payload->sub)) {
            throw new RuntimeException('Invalid JWT claims');
        }

        if ($type === 'access' && Role::tryFrom($payload->role ?? '') === null) {
            throw new RuntimeException('Invalid JWT role');
        }

        return $payload;
    }

    private function encode(string $subject, string $type, int $ttl, array $claims = []): string
    {
        $now = time();

        return JWT::encode([...$claims, 'iss' => config('jwt.issuer'), 'aud' => config('jwt.audience'), 'sub' => $subject, 'type' => $type, 'iat' => $now, 'exp' => $now + $ttl], $this->secret($type), 'HS256');
    }

    private function secret(string $type): string
    {
        $secret = config($type === 'access' ? 'jwt.access_secret' : 'jwt.refresh_secret');
        if (! is_string($secret) || strlen($secret) < 32) {
            throw new RuntimeException('JWT secret must contain at least 32 characters');
        }

        return $secret;
    }
}
