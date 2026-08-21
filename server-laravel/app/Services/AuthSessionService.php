<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AuthSession;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class AuthSessionService
{
    public function __construct(private readonly JwtService $jwt) {}

    public function create(User $user): array
    {
        return DB::transaction(function () use ($user): array {
            $session = AuthSession::query()->create([
                'user_id' => $user->id,
                'refresh_token_hash' => hash('sha256', (string) Str::uuid()),
                'last_activity_at' => now(),
                'expires_at' => now()->addSeconds(config('jwt.refresh_ttl')),
            ]);
            $refreshToken = $this->jwt->refresh($user->id, $session->id, (string) Str::uuid());
            $session->update(['refresh_token_hash' => $this->hash($refreshToken)]);

            return $this->tokens($user, $session, $refreshToken);
        });
    }

    public function rotate(string $refreshToken): array
    {
        try {
            $payload = $this->jwt->decode($refreshToken, 'refresh');
        } catch (\Throwable) {
            throw new ApiException('Refresh token tidak valid', 401);
        }

        $result = DB::transaction(function () use ($payload, $refreshToken): array {
            $session = AuthSession::query()->with('user')->lockForUpdate()->find($payload->sid ?? '');
            $this->assertActive($session);
            if (! hash_equals($session->refresh_token_hash, $this->hash($refreshToken))) {
                $session->update(['revoked_at' => now()]);

                return ['replayed' => true];
            }

            $next = $this->jwt->refresh($session->user_id, $session->id, (string) Str::uuid());
            $session->update([
                'refresh_token_hash' => $this->hash($next),
                'last_activity_at' => now(),
            ]);

            return $this->tokens($session->user, $session, $next);
        });

        if ($result['replayed'] ?? false) {
            throw new ApiException('Refresh token tidak valid', 401);
        }

        return $result;
    }

    public function authenticate(string $sessionId): AuthSession
    {
        $session = AuthSession::query()->with('user')->find($sessionId);
        $this->assertActive($session);

        return $session;
    }

    public function touch(string $sessionId): array
    {
        $session = $this->authenticate($sessionId);
        $writeInterval = max(1, (int) config('jwt.activity_write_interval_seconds'));
        if ($session->last_activity_at->lte(now()->subSeconds($writeInterval))) {
            $session->update(['last_activity_at' => now()]);
        }

        return [
            'accessToken' => $this->jwt->access($session->user_id, $session->user->role, $session->id),
        ];
    }

    public function revokeFromRefreshToken(?string $refreshToken): void
    {
        if (! $refreshToken) {
            return;
        }
        try {
            $payload = $this->jwt->decode($refreshToken, 'refresh');
            AuthSession::query()->whereKey($payload->sid ?? '')->update(['revoked_at' => now()]);
        } catch (\Throwable) {
            // Logout remains idempotent for invalid or expired cookies.
        }
    }

    public function revokeAllForUser(string $userId): void
    {
        AuthSession::query()->where('user_id', $userId)->whereNull('revoked_at')->update(['revoked_at' => now()]);
    }

    private function assertActive(?AuthSession $session): void
    {
        if (! $session || ! $session->user || $session->revoked_at || $session->expires_at->isPast()) {
            throw new ApiException('Sesi tidak valid', 401, ['code' => 'SESSION_INVALID']);
        }
        if ($session->last_activity_at->addSeconds(config('jwt.inactivity_ttl'))->isPast()) {
            $session->update(['revoked_at' => now()]);
            throw new ApiException('Sesi berakhir karena tidak ada aktivitas', 401, ['code' => 'SESSION_INACTIVE']);
        }
    }

    private function tokens(User $user, AuthSession $session, string $refreshToken): array
    {
        return [
            'accessToken' => $this->jwt->access($user->id, $user->role, $session->id),
            'refreshToken' => $refreshToken,
            'inactivityTimeoutSeconds' => (int) config('jwt.inactivity_ttl'),
            'activityHeartbeatSeconds' => max(1, (int) config('jwt.activity_write_interval_seconds')),
        ];
    }

    private function hash(string $token): string
    {
        return hash('sha256', $token);
    }
}
