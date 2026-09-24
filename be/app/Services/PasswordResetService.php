<?php

declare(strict_types=1);

namespace App\Services;

use App\Mail\PasswordResetMail;
use App\Models\PasswordResetToken;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Issues and consumes single-use password reset tokens.
 *
 * Only the SHA-256 hash of a token is persisted; the plaintext value exists just
 * long enough to be embedded in the outgoing email link.
 */
final class PasswordResetService
{
    private const TOKEN_BYTES = 32;

    private const DUMMY_PASSWORD_HASH = '$2y$12$UyU86mYdUOPdELxk9sUOuO0WvLxJjIhHleXb0U971A0vY0cC4d1He';

    private const MAX_OUTSTANDING_TOKENS = 5;

    public function __construct(private readonly AuthSessionService $sessions) {}

    /**
     * Creates a reset token for the account owning the email and mails the link.
     *
     * Always returns silently so callers cannot use the response to enumerate
     * which email addresses are registered.
     */
    public function request(string $email, ?string $ipAddress = null): void
    {
        $normalized = strtolower(trim($email));
        Hash::check('dummy-not-used', self::DUMMY_PASSWORD_HASH);
        $user = User::query()->whereRaw('LOWER(email) = ?', [$normalized])->first();

        if (! $user) {
            Log::info('Password reset requested for unknown email.', ['ip' => $ipAddress]);

            return;
        }

        $token = bin2hex(random_bytes(self::TOKEN_BYTES));

        DB::transaction(function () use ($user, $token): void {
            PasswordResetToken::query()->create([
                'user_id' => $user->id,
                'token_hash' => $this->hash($token),
                'expires_at' => now()->addMinutes($this->ttlMinutes()),
                'created_at' => now(),
            ]);
            $excessIds = PasswordResetToken::query()
                ->where('user_id', $user->id)
                ->whereNull('used_at')
                ->orderByDesc('created_at')
                ->limit(100)
                ->pluck('id')
                ->slice(self::MAX_OUTSTANDING_TOKENS);
            if ($excessIds->isNotEmpty()) {
                PasswordResetToken::query()->whereIn('id', $excessIds)->delete();
            }
        });

        $mail = new PasswordResetMail(
            fullName: $user->full_name,
            username: $user->username,
            resetUrl: $this->resetUrl($token),
            expiresInMinutes: $this->ttlMinutes(),
        );
        if (app()->environment('production')) {
            Mail::to($user->email)->queue($mail);
        } else {
            Mail::to($user->email)->send($mail);
        }
    }

    /**
     * Consumes a reset token and rotates the account password.
     *
     * @return bool False when the token is unknown, expired, or already used.
     */
    public function reset(string $token, string $newPassword): bool
    {
        $userId = DB::transaction(function () use ($token, $newPassword): ?string {
            $candidate = PasswordResetToken::query()->where('token_hash', $this->hash($token))->first();
            if (! $candidate) {
                return null;
            }
            $user = User::query()->lockForUpdate()->find($candidate->user_id);
            $record = PasswordResetToken::query()
                ->where('token_hash', $this->hash($token))
                ->lockForUpdate()
                ->first();

            if (! $record || ! $record->isUsable()) {
                return null;
            }

            if (! $user) {
                return null;
            }

            $user->update(['password_hash' => Hash::make($newPassword)]);
            PasswordResetToken::query()->where('user_id', $user->id)->whereNull('used_at')->update(['used_at' => now()]);
            $this->sessions->revokeAllForUser($user->id);

            return $user->id;
        });

        if ($userId === null) {
            return false;
        }

        return true;
    }

    public function tokenIsValid(string $token): bool
    {
        $record = PasswordResetToken::query()->where('token_hash', $this->hash($token))->first();

        return $record !== null && $record->isUsable();
    }

    private function resetUrl(string $token): string
    {
        $base = rtrim((string) (config('auth.password_reset.frontend_url') ?: config('app.url')), '/');

        return $base.'/reset-password#token='.urlencode($token);
    }

    private function ttlMinutes(): int
    {
        return max(5, (int) config('auth.password_reset.expire_minutes', 60));
    }

    private function hash(string $token): string
    {
        return hash('sha256', $token);
    }
}
