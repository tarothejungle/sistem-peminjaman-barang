<?php

namespace Tests\Feature;

use Tests\TestCase;

final class SingleServerFrontendTest extends TestCase
{
    public function test_root_serves_built_react_application(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertHeader('Content-Type', 'text/html; charset=UTF-8')
            ->assertSee('<div id="root"></div>', false);
    }

    public function test_react_route_uses_spa_fallback(): void
    {
        $this->get('/dashboard')
            ->assertOk()
            ->assertSee('<div id="root"></div>', false);
    }

    public function test_frontend_assets_reference_the_official_kemnaker_logo(): void
    {
        $this->assertFileExists(public_path('app/index.html'));
        $html = strtolower((string) file_get_contents(public_path('app/index.html')));

        $this->assertStringContainsString('logo-kemnaker-biru.png', $html);
        $this->assertFileExists(public_path('app/logo-kemnaker-biru.png'));
        $this->assertFileExists(public_path('app/logo-kemnaker-putih.png'));
        $this->assertStringNotContainsString('binwasnaker', $html);
    }

    public function test_frontend_assets_do_not_use_data_script_urls(): void
    {
        $assetFiles = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(public_path('app/assets')));
        $sources = [(string) file_get_contents(public_path('app/index.html'))];

        foreach ($assetFiles as $assetFile) {
            if ($assetFile->isFile() && $assetFile->getExtension() === 'js') {
                $sources[] = (string) file_get_contents($assetFile->getPathname());
            }
        }

        foreach ($sources as $source) {
            $this->assertStringNotContainsString('data:text/javascript', $source);
        }
    }

    public function test_unknown_api_route_does_not_return_react(): void
    {
        $this->getJson('/api/v1/unknown')
            ->assertNotFound()
            ->assertExactJson(['error' => ['message' => 'Route tidak ditemukan']]);
    }
}
