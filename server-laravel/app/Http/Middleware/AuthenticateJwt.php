<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use App\Exceptions\ApiException;
use App\Services\JwtService;
use Closure;
use Firebase\JWT\ExpiredException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

final class AuthenticateJwt
{
    public function __construct(private readonly JwtService $jwt) {}

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

        $request->attributes->set('auth_user_id', $payload->sub);
        $request->attributes->set('auth_role', Role::from($payload->role));

        return $next($request);
    }
}
