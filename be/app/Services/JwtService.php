<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\Role;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use RuntimeException;
use stdClass;

final class JwtService
{
    /**
     * Placeholder values shipped in example env files. A secret that contains
     * any of them was almost certainly never rotated for the environment.
     */
    private const SECRET_PLACEHOLDERS = ['change-me', 'replace-me', 'your-secret', 'secret-key'];

    public function access(string $subject, Role $role, string $sessionId = 'test-session'): string
    {
        return $this->encode($subject, 'access', (int) config('jwt.access_ttl'), ['role' => $role->value, 'sid' => $sessionId]);
    }

    public function refresh(string $subject, string $sessionId, string $tokenId): string
    {
        return $this->encode($subject, 'refresh', (int) config('jwt.refresh_ttl'), ['sid' => $sessionId, 'jti' => $tokenId]);
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

    /**
     * A secret is unsafe when it is missing, shorter than 32 characters, or
     * still contains one of the shipped placeholder values.
     */
    public static function isWeakSecret(mixed $secret): bool
    {
        return ! is_string($secret)
            || strlen($secret) < 32
            || collect(self::SECRET_PLACEHOLDERS)->contains(fn (string $placeholder): bool => str_contains(strtolower($secret), $placeholder));
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
        if (self::isWeakSecret($secret) || $secret === $otherSecret) {
            throw new RuntimeException('JWT secret must contain at least 32 characters');
        }

        return $secret;
    }
}
