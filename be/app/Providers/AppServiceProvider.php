<?php

declare(strict_types=1);

namespace App\Providers;

use App\Services\JwtService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\DevCommands;
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
        // Frontend React punya package.json sendiri di fe/. Tidak ada Node project
        // di dalam be/, sehingga proses dev vite bawaan tidak bisa dijalankan.
        if ($this->app->runningInConsole()) {
            DevCommands::except('vite');
        }

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
        if (JwtService::isWeakSecret($accessSecret) || JwtService::isWeakSecret($refreshSecret) || hash_equals($accessSecret, $refreshSecret)) {
            throw new \RuntimeException('JWT access and refresh secrets must be independent, random values of at least 32 characters.');
        }
        if ($this->app->isProduction()) {
            $this->assertProductionHardening();
        }
        if (config('services.turnstile.enabled') && (! config('services.turnstile.site_key') || ! config('services.turnstile.secret_key'))) {
            throw new \RuntimeException('Enabled Turnstile requires TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.');
        }

        RateLimiter::for('auth-login', function (Request $request): array {
            $username = strtolower((string) $request->input('username'));
            $decay = max(1, (int) config('jwt.login_decay_seconds'));

            return [
                Limit::perMinute(30)->by('login-ip|'.$request->ip()),
                Limit::perSecond(max(1, (int) config('jwt.login_max_attempts')), $decay)->by($request->ip().'|'.$username),
                Limit::perMinutes(15, max(1, (int) config('jwt.login_account_max_attempts')))->by('account|'.$username),
            ];
        });
        RateLimiter::for('auth-forgot-password', function (Request $request): array {
            $email = strtolower((string) $request->input('email'));

            return [
                Limit::perMinutes(15, 5)->by('ip|'.$request->ip()),
                Limit::perMinutes(15, 3)->by('email|'.$email),
            ];
        });
        RateLimiter::for('auth-reset-password', function (Request $request): Limit {
            return Limit::perMinutes(15, 20)->by('ip|'.$request->ip());
        });
        RateLimiter::for('auth-refresh', function (Request $request): Limit {
            return Limit::perMinute(max(1, (int) config('jwt.refresh_max_attempts')))->by('refresh|'.$request->ip());
        });
        RateLimiter::for('auth-password', function (Request $request): Limit {
            return Limit::perMinute(max(1, (int) config('jwt.password_max_attempts')))->by('password|'.$request->ip().'|'.$request->attributes->get('auth_user_id'));
        });
        RateLimiter::for('booking-create', function (Request $request): Limit {
            return Limit::perMinute(max(1, (int) config('jwt.booking_create_max_attempts')))->by('booking|'.$request->attributes->get('auth_user_id'));
        });
    }

    private function assertProductionHardening(): void
    {
        $failures = [];
        if (config('app.debug')) {
            $failures[] = 'APP_DEBUG=false';
        }
        if (! config('jwt.refresh_cookie_secure')) {
            $failures[] = 'JWT_REFRESH_COOKIE_SECURE=true';
        }
        if (in_array((string) config('mail.default'), ['log', 'array'], true)) {
            $failures[] = 'MAIL_MAILER=smtp or another real transport';
        }
        foreach (['app.url', 'app.frontend_url', 'auth.password_reset.frontend_url'] as $urlKey) {
            $url = (string) config($urlKey);
            if ($url === '' || ! str_starts_with(strtolower($url), 'https://')) {
                $failures[] = strtoupper(str_replace('.', '_', $urlKey)).' must use https://';
            }
        }
        if ((string) config('database.default') === 'pgsql') {
            $host = strtolower(trim((string) config('database.connections.pgsql.host')));
            $sslMode = strtolower(trim((string) config('database.connections.pgsql.sslmode')));
            $localHosts = ['127.0.0.1', 'localhost', '::1'];

            if (! in_array($host, $localHosts, true) && ! in_array($sslMode, ['require', 'verify-ca', 'verify-full'], true)) {
                $failures[] = 'Remote PostgreSQL requires DB_SSLMODE=require, verify-ca, or verify-full';
            }
        }
        if ($failures !== []) {
            throw new \RuntimeException('Production hardening failed: '.implode(', ', $failures).'.');
        }
    }
}
