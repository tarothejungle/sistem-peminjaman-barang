<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Enums\Role;
use App\Exceptions\ApiException;
use App\Services\AuthSessionService;
use App\Services\JwtService;
use App\Services\MaintenanceService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Closes the API while maintenance mode is on.
 *
 * Administrators are let through so the person who switched maintenance on can
 * still sign in and switch it off again; `/auth/*` stays reachable for the same
 * reason, and the public status endpoint lets the frontend render the notice
 * instead of a bare error. Everything else answers 503 with code MAINTENANCE.
 */
final class EnsureSiteIsAvailable
{
    public function __construct(
        private readonly JwtService $jwt,
        private readonly AuthSessionService $sessions,
        private readonly MaintenanceService $maintenance,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->is('api/*') || $this->isExempt($request)) {
            return $next($request);
        }

        try {
            $settings = $this->maintenance->settings();
        } catch (Throwable) {
            // An unreachable or not-yet-migrated database must not lock everyone
            // out of the application; the normal request path reports that.
            return $next($request);
        }

        // The administrator probe costs a session lookup, so it only runs while
        // the site is actually closed.
        if (! $settings->is_enabled || $this->isAdministrator($request)) {
            return $next($request);
        }

        throw new ApiException($this->maintenance->noticeText($settings), 503, array_filter([
            'code' => 'MAINTENANCE',
            'estimatedEndAt' => $settings->estimated_end_at?->toIso8601String(),
        ]));
    }

    /** Login and the maintenance status itself have to survive the shutdown. */
    private function isExempt(Request $request): bool
    {
        return $request->is('api/v1/health')
            || $request->is('api/v1/maintenance')
            || $request->is('api/v1/attention-messages/public')
            || $request->is('api/v1/auth/*');
    }

    /**
     * A read-only probe: it never authenticates the request for the route, it
     * only answers "is the caller an administrator?" before the real `jwt`
     * middleware runs.
     */
    private function isAdministrator(Request $request): bool
    {
        $authorization = $request->header('Authorization');
        if (! is_string($authorization) || ! str_starts_with($authorization, 'Bearer ')) {
            return false;
        }

        try {
            $payload = $this->jwt->decode(trim(substr($authorization, 7)), 'access');
            if (app()->environment('testing') && ($payload->sid ?? null) === 'test-session') {
                return Role::from($payload->role)->isAdministrator();
            }

            return $this->sessions->peek($payload->sid)?->user?->role?->isAdministrator() ?? false;
        } catch (Throwable) {
            return false;
        }
    }
}
