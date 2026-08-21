<?php

use App\Exceptions\ApiException;
use App\Http\Middleware\AuthenticateJwt;
use App\Http\Middleware\RequireRole;
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
        ]);
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

            if ($exception instanceof HttpExceptionInterface && $exception->getStatusCode() === 404) {
                return response()->json(['error' => ['message' => 'Route tidak ditemukan']], 404);
            }

            report($exception);

            return response()->json(['error' => ['message' => 'Terjadi kesalahan pada server']], 500);
        });
    })->create();
