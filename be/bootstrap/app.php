<?php

use App\Exceptions\ApiException;
use App\Http\Middleware\AuthenticateJwt;
use App\Http\Middleware\EnsureSiteIsAvailable;
use App\Http\Middleware\RequireBrowserOrigin;
use App\Http\Middleware\RequireRole;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'jwt' => AuthenticateJwt::class,
            'role' => RequireRole::class,
            'browser-origin' => RequireBrowserOrigin::class,
        ]);
        // Runs before every API route (and therefore before jwt) so a closed
        // site answers 503 instead of leaking data to signed-in borrowers.
        $middleware->api(prepend: [EnsureSiteIsAvailable::class]);
        $middleware->append(SecurityHeaders::class);
        $middleware->trustProxies(at: array_filter(array_map('trim', explode(',', (string) env('TRUSTED_PROXIES', '')))) ?: null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
        $exceptions->render(function (Throwable $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            if ($exception instanceof ValidationException) {
                return response()->json(['error' => ['message' => 'Data tidak valid', 'details' => $exception->errors()]], 400);
            }

            if ($exception instanceof ApiException) {
                return response()->json(['error' => array_filter([
                    'message' => $exception->getMessage(),
                    'details' => $exception->details,
                ], fn ($value) => $value !== null)], $exception->status);
            }

            if ($exception instanceof ModelNotFoundException) {
                return response()->json(['error' => ['message' => 'Data tidak ditemukan']], 404);
            }

            if ($exception instanceof AuthorizationException) {
                return response()->json(['error' => ['message' => 'Anda tidak memiliki hak akses']], 403);
            }

            // Preserve framework HTTP status codes (404, 405, 413, 429, ...) instead
            // of masking them as 500. Messages are fixed strings so nothing internal leaks.
            if ($exception instanceof HttpExceptionInterface) {
                $status = $exception->getStatusCode();
                $message = match ($status) {
                    404 => 'Route tidak ditemukan',
                    405 => 'Metode HTTP tidak diizinkan',
                    413 => 'Ukuran permintaan terlalu besar',
                    429 => 'Terlalu banyak percobaan. Silakan coba lagi nanti.',
                    default => null,
                };

                if ($message !== null) {
                    return response()->json(['error' => ['message' => $message]], $status);
                }
            }

            report($exception);

            return response()->json(['error' => ['message' => 'Terjadi kesalahan pada server']], 500);
        });
    })->create();
