<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Requests\ChangePasswordRequest;
use App\Http\Requests\ForgotPasswordRequest;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\ResetPasswordRequest;
use App\Http\Requests\VerifyResetTokenRequest;
use App\Models\PasswordResetToken;
use App\Models\User;
use App\Services\AuthSessionService;
use App\Services\PasswordResetService;
use App\Services\TurnstileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

final class AuthController extends Controller
{
    public function __construct(
        private readonly AuthSessionService $sessions,
        private readonly PasswordResetService $passwordResets,
        private readonly ?TurnstileService $turnstile = null,
    ) {}

    public function config(): JsonResponse
    {
        return response()->json(['data' => [
            'turnstileEnabled' => (bool) config('services.turnstile.enabled'),
            'turnstileSiteKey' => config('services.turnstile.enabled') ? config('services.turnstile.site_key') : null,
        ]]);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $data = $request->validated();
        ($this->turnstile ?? app(TurnstileService::class))->verify($data['captchaToken'] ?? null, $request->ip());
        $user = User::query()->whereRaw('LOWER(username) = ?', [strtolower($data['username'])])->first();
        $passwordMatches = Hash::check($data['password'], $user?->password_hash ?? '$2y$12$UyU86mYdUOPdELxk9sUOuO0WvLxJjIhHleXb0U971A0vY0cC4d1He');
        if (! $user || ! $passwordMatches) {
            throw new ApiException('Username atau password salah', 401);
        }

        $tokens = $this->sessions->create($user, recordLogin: true);

        return $this->withRefreshCookie(response()->json(['data' => [
            'accessToken' => $tokens['accessToken'],
            'inactivityTimeoutSeconds' => $tokens['inactivityTimeoutSeconds'],
            'activityHeartbeatSeconds' => $tokens['activityHeartbeatSeconds'],
        ]]), $tokens['refreshToken']);
    }

    /**
     * Starts the reset flow. The response is intentionally identical whether or
     * not the email exists so it cannot be used to enumerate accounts.
     */
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $this->passwordResets->request($request->validated()['email'], $request->ip());

        return response()->json(['data' => [
            'message' => 'Jika email terdaftar, tautan reset password telah dikirim. Silakan periksa kotak masuk Anda.',
        ]]);
    }

    public function verifyResetToken(VerifyResetTokenRequest $request): JsonResponse
    {
        return response()->json(['data' => [
            'valid' => $this->passwordResets->tokenIsValid($request->validated()['token']),
        ]]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $data = $request->validated();
        if (! $this->passwordResets->reset($data['token'], $data['password'])) {
            throw new ApiException('Tautan reset password tidak valid atau sudah kedaluwarsa', 422);
        }

        return response()->json(['data' => ['message' => 'Password berhasil diubah. Silakan masuk kembali.']]);
    }

    public function refresh(Request $request): JsonResponse
    {
        $tokens = $this->sessions->rotate((string) $request->cookie('refreshToken'));

        return $this->withRefreshCookie(response()->json(['data' => [
            'accessToken' => $tokens['accessToken'],
            'inactivityTimeoutSeconds' => $tokens['inactivityTimeoutSeconds'],
            'activityHeartbeatSeconds' => $tokens['activityHeartbeatSeconds'],
        ]]), $tokens['refreshToken']);
    }

    public function logout(Request $request): Response
    {
        $this->sessions->revokeFromRefreshToken($request->cookie('refreshToken'));

        return response()->noContent()->withCookie(Cookie::create('refreshToken')->withExpires(1)->withHttpOnly(true)->withSameSite('strict')->withPath('/api/v1/auth')->withSecure(config('jwt.refresh_cookie_secure')));
    }

    public function activity(Request $request): JsonResponse
    {
        $data = $this->sessions->touch((string) $request->attributes->get('auth_session_id'));

        return response()->json(['data' => $data]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = User::find($request->attributes->get('auth_user_id'));
        if (! $user) {
            throw new ApiException('Pengguna tidak ditemukan', 404);
        }

        return response()->json(['data' => $user]);
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = User::find($request->attributes->get('auth_user_id'));
        if (! $user) {
            throw new ApiException('Pengguna tidak ditemukan', 404);
        }

        $data = $request->validated();
        if (! Hash::check($data['currentPassword'], $user->password_hash)) {
            throw new ApiException('Password saat ini tidak sesuai', 422);
        }

        DB::transaction(function () use ($user, $data): void {
            $lockedUser = User::query()->lockForUpdate()->findOrFail($user->id);
            if (! Hash::check($data['currentPassword'], $lockedUser->password_hash)) {
                throw new ApiException('Password saat ini tidak sesuai', 422);
            }
            $lockedUser->update(['password_hash' => Hash::make($data['newPassword'])]);
            PasswordResetToken::query()->where('user_id', $user->id)->whereNull('used_at')->update(['used_at' => now()]);
            $this->sessions->revokeAllForUser($user->id);
        });

        return response()->json(['data' => ['message' => 'Password berhasil diubah']]);
    }

    private function withRefreshCookie(JsonResponse $response, string $token): JsonResponse
    {
        $cookie = Cookie::create('refreshToken')
            ->withValue($token)
            ->withExpires(now()->addSeconds(config('jwt.refresh_ttl')))
            ->withPath('/api/v1/auth')
            ->withSecure(config('jwt.refresh_cookie_secure'))
            ->withHttpOnly(true)
            ->withSameSite('strict');

        return $response->withCookie($cookie);
    }
}
