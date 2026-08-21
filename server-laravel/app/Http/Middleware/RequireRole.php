<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RequireRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $role = $request->attributes->get('auth_role');
        if (! $role instanceof Role) {
            throw new ApiException('Autentikasi diperlukan', 401);
        }
        if (! in_array($role->value, $roles, true)) {
            throw new ApiException('Anda tidak memiliki hak akses', 403);
        }

        return $next($request);
    }
}
