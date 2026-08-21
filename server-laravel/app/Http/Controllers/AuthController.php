<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Requests\ChangePasswordRequest;
use App\Http\Requests\LoginRequest;
use App\Models\User;
use App\Services\JwtService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

final class AuthController extends Controller
{
    public function __construct(private readonly JwtService $jwt) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $data = $request->validated();
        $user = User::where('email', strtolower($data['email']))->first();
        if (! $user || ! Hash::check($data['password'], $user->password_hash)) {
            throw new ApiException('Email atau password salah', 401);
        }

        return $this->withRefreshCookie(response()->json(['data' => ['accessToken' => $this->jwt->access($user->id, $user->role)]]), $this->jwt->refresh($user->id));
    }

    public function refresh(Request $request): JsonResponse
    {
        try {
            $payload = $this->jwt->decode((string) $request->cookie('refreshToken'), 'refresh');
            $user = User::find($payload->sub);
        } catch (Throwable) {
            throw new ApiException('Refresh token tidak valid', 401);
        }
        if (! $user) {
            throw new ApiException('Refresh token tidak valid', 401);
        }

        return response()->json(['data' => ['accessToken' => $this->jwt->access($user->id, $user->role)]]);
    }

    public function logout(): Response
    {
        return response()->noContent()->withCookie(Cookie::create('refreshToken')->withExpires(1)->withHttpOnly(true)->withSameSite('strict')->withPath('/api/v1/auth')->withSecure(app()->isProduction()));
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

        return response()->json(['data' => ['message' => 'Password berhasil diubah']]);
    }

    private function withRefreshCookie(JsonResponse $response, string $token): JsonResponse
    {
        $cookie = Cookie::create('refreshToken')
            ->withValue($token)
            ->withExpires(now()->addDays(7))
            ->withPath('/api/v1/auth')
            ->withSecure(app()->isProduction())
            ->withHttpOnly(true)
            ->withSameSite('strict');

        return $response->withCookie($cookie);
    }
}
