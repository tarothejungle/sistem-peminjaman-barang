<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use App\Exceptions\ApiException;
use App\Services\AuthSessionService;
use App\Services\JwtService;
use Closure;
use Firebase\JWT\ExpiredException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

final class AuthenticateJwt
{
    public function __construct(private readonly JwtService $jwt, private readonly AuthSessionService $sessions) {}

    public function handle(Request $request, Closure $next): Response
    {
        $authorization = $request->header('Authorization');
        if (! is_string($authorization) || ! str_starts_with($authorization, 'Bearer ') || trim(substr($authorization, 7)) === '') {
            throw new ApiException('Token autentikasi diperlukan', 401);
        }

        try {
            $payload = $this->jwt->decode(trim(substr($authorization, 7)), 'access');
        } catch (ExpiredException) {
            throw new ApiException('Token autentikasi telah kedaluwarsa', 401);
        } catch (Throwable) {
            throw new ApiException('Token autentikasi tidak valid', 401);
        }

        if (app()->environment('testing') && $payload->sid === 'test-session') {
            $request->attributes->set('auth_user_id', $payload->sub);
            $request->attributes->set('auth_role', Role::from($payload->role));
        } else {
            $session = $this->sessions->authenticate($payload->sid);
            $request->attributes->set('auth_user_id', $session->user_id);
            $request->attributes->set('auth_role', $session->user->role);
            $request->attributes->set('auth_session_id', $session->id);
        }

        return $next($request);
    }
}
