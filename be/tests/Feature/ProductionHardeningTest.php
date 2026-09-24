<?php

namespace Tests\Feature;

use App\Providers\AppServiceProvider;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

final class ProductionHardeningTest extends TestCase
{
    public function test_production_boot_rejects_insecure_mail_and_http_urls(): void
    {
        $this->app['env'] = 'production';
        config([
            'app.env' => 'production',
            'app.debug' => true,
            'jwt.refresh_cookie_secure' => false,
            'mail.default' => 'log',
            'app.url' => 'http://example.test',
            'app.frontend_url' => 'http://example.test',
            'auth.password_reset.frontend_url' => 'http://example.test',
            'database.default' => 'pgsql',
            'database.connections.pgsql.host' => 'database.example.test',
            'database.connections.pgsql.sslmode' => 'prefer',
        ]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Production hardening failed');
        (new AppServiceProvider($this->app))->boot();
    }

    #[DataProvider('supportedPostgresModes')]
    public function test_production_boot_accepts_practical_postgres_ssl_modes(string $host, string $sslMode): void
    {
        $this->app['env'] = 'production';
        config([
            'app.env' => 'production',
            'app.debug' => false,
            'jwt.refresh_cookie_secure' => true,
            'mail.default' => 'smtp',
            'app.url' => 'https://example.test',
            'app.frontend_url' => 'https://example.test',
            'auth.password_reset.frontend_url' => 'https://example.test',
            'database.default' => 'pgsql',
            'database.connections.pgsql.host' => $host,
            'database.connections.pgsql.sslmode' => $sslMode,
        ]);

        (new AppServiceProvider($this->app))->boot();

        $this->assertTrue(true);
    }

    public static function supportedPostgresModes(): array
    {
        return [
            'local PostgreSQL without TLS' => ['127.0.0.1', 'disable'],
            'remote PostgreSQL with encrypted transport' => ['database.example.test', 'require'],
            'remote PostgreSQL with CA verification' => ['database.example.test', 'verify-ca'],
            'remote PostgreSQL with full verification' => ['database.example.test', 'verify-full'],
        ];
    }
}
