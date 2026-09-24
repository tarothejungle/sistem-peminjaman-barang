<?php

namespace Tests\Feature;

use App\Http\Middleware\SecurityHeaders;
use Illuminate\Http\Request;
use Tests\TestCase;

final class SecurityHeadersTest extends TestCase
{
    public function test_legacy_entry_with_data_src_is_authorized_by_csp(): void
    {
        $script = "System.import(document.getElementById('vite-legacy-entry').getAttribute('data-src'))";
        $html = '<script nomodule id="vite-legacy-entry" data-src="/app/assets/index-legacy.js">'.$script.'</script>';
        $response = (new SecurityHeaders)->handle(
            Request::create('/smart-tv'),
            fn () => response($html, 200, ['Content-Type' => 'text/html']),
        );
        $this->assertStringContainsString("'sha256-".base64_encode(hash('sha256', $script, true))."'", $response->headers->get('Content-Security-Policy'));
        $this->assertStringNotContainsString("'unsafe-inline'", explode('script-src ', $response->headers->get('Content-Security-Policy'))[1]);
    }

    public function test_html_and_api_responses_include_security_headers(): void
    {
        $html = $this->get('/nonexistent');
        $html->assertHeader('content-security-policy');
        $html->assertHeader('x-content-type-options', 'nosniff');
        $html->assertHeader('x-frame-options', 'DENY');
        $html->assertHeader('referrer-policy', 'no-referrer');
        $html->assertHeader('permissions-policy');
        $html->assertHeader('cross-origin-opener-policy', 'same-origin');
        $html->assertHeader('cross-origin-resource-policy', 'same-origin');
        $this->assertStringNotContainsString("script-src 'self' data:", $html->headers->get('Content-Security-Policy'));

        $api = $this->getJson('/api/v1/health');
        $api->assertHeader('content-security-policy');
        $api->assertHeader('x-content-type-options', 'nosniff');
        $api->assertHeader('x-frame-options', 'DENY');
        $this->assertStringContainsString('no-store', $api->headers->get('Cache-Control'));
    }

    public function test_health_reports_database_failure_as_service_unavailable(): void
    {
        config(['database.default' => 'unavailable']);

        $this->getJson('/api/v1/health')
            ->assertStatus(503)
            ->assertJsonPath('error.message', 'Database tidak terhubung. Periksa konfigurasi DB pada environment produksi.');
    }
}
