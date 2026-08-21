<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        foreach (['access_ttl', 'refresh_ttl', 'inactivity_ttl', 'activity_write_interval_seconds'] as $key) {
            if ((int) config("jwt.{$key}") <= 0) {
                throw new \RuntimeException("JWT configuration {$key} must be a positive integer.");
            }
        }
        if ((int) config('jwt.access_ttl') < (int) config('jwt.inactivity_ttl')) {
            throw new \RuntimeException('JWT_ACCESS_TTL_SECONDS must be greater than or equal to inactivity timeout.');
        }
        $accessSecret = config('jwt.access_secret');
        $refreshSecret = config('jwt.refresh_secret');
        $invalidSecret = static fn ($secret): bool => ! is_string($secret)
            || strlen($secret) < 32
            || collect(['change-me', 'replace-me', 'your-secret', 'secret-key'])
                ->contains(fn (string $placeholder): bool => str_contains(strtolower($secret), $placeholder));
        if ($invalidSecret($accessSecret) || $invalidSecret($refreshSecret) || hash_equals($accessSecret, $refreshSecret)) {
            throw new \RuntimeException('JWT access and refresh secrets must be independent, random values of at least 32 characters.');
        }
        if ($this->app->isProduction() && (config('app.debug') || ! config('jwt.refresh_cookie_secure'))) {
            throw new \RuntimeException('Production requires APP_DEBUG=false and JWT_REFRESH_COOKIE_SECURE=true.');
        }

        RateLimiter::for('auth-login', function (Request $request): array {
            $email = strtolower((string) $request->input('email'));
            $decay = max(1, (int) config('jwt.login_decay_seconds'));

            return [
                Limit::perSecond(max(1, (int) config('jwt.login_max_attempts')), $decay)->by($request->ip().'|'.$email),
            ];
        });
        RateLimiter::for('auth-refresh', fn (Request $request): Limit => Limit::perMinute(max(1, (int) config('jwt.refresh_max_attempts')))->by($request->ip()));
        RateLimiter::for('auth-password', fn (Request $request): Limit => Limit::perMinute(max(1, (int) config('jwt.password_max_attempts')))->by($request->ip().'|'.$request->attributes->get('auth_user_id')));
    }
}
