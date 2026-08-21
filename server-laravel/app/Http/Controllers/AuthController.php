<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Requests\ChangePasswordRequest;
use App\Http\Requests\LoginRequest;
use App\Models\User;
use App\Services\AuthSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

final class AuthController extends Controller
{
    public function __construct(private readonly AuthSessionService $sessions) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $data = $request->validated();
        $user = User::where('email', strtolower($data['email']))->first();
        if (! $user || ! Hash::check($data['password'], $user->password_hash)) {
            throw new ApiException('Email atau password salah', 401);
        }

        $tokens = $this->sessions->create($user);

        return $this->withRefreshCookie(response()->json(['data' => [
            'accessToken' => $tokens['accessToken'],
            'inactivityTimeoutSeconds' => $tokens['inactivityTimeoutSeconds'],
            'activityHeartbeatSeconds' => $tokens['activityHeartbeatSeconds'],
        ]]), $tokens['refreshToken']);
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

        $user->update(['password_hash' => Hash::make($data['newPassword'])]);
        $this->sessions->revokeAllForUser($user->id);

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
