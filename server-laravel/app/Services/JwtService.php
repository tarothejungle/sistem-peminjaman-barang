<?php

namespace App\Services;

use App\Enums\Role;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use RuntimeException;
use stdClass;

final class JwtService
{
    public function access(string $subject, Role $role, string $sessionId = 'test-session'): string
    {
        return $this->encode($subject, 'access', config('jwt.access_ttl'), ['role' => $role->value, 'sid' => $sessionId]);
    }

    public function refresh(string $subject, string $sessionId, string $tokenId): string
    {
        return $this->encode($subject, 'refresh', config('jwt.refresh_ttl'), ['sid' => $sessionId, 'jti' => $tokenId]);
    }

    public function decode(string $token, string $type): stdClass
    {
        $secret = $this->secret($type);
        $payload = JWT::decode($token, new Key($secret, 'HS256'));

        if (($payload->iss ?? null) !== config('jwt.issuer') || ($payload->aud ?? null) !== config('jwt.audience') || ($payload->type ?? null) !== $type || ! isset($payload->sub, $payload->sid)) {
            throw new RuntimeException('Invalid JWT claims');
        }

        if (($type === 'access' && Role::tryFrom($payload->role ?? '') === null) || ($type === 'refresh' && ! isset($payload->jti))) {
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
        $otherSecret = config($type === 'access' ? 'jwt.refresh_secret' : 'jwt.access_secret');
        $placeholders = ['change-me', 'replace-me', 'your-secret', 'secret-key'];
        if (! is_string($secret) || strlen($secret) < 32 || $secret === $otherSecret || collect($placeholders)->contains(fn (string $value): bool => str_contains(strtolower($secret), $value))) {
            throw new RuntimeException('JWT secret must contain at least 32 characters');
        }

        return $secret;
    }
}
