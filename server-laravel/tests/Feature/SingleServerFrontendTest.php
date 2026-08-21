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

    public function test_frontend_assets_are_built_without_hardcoded_branding_asset(): void
    {
        $this->assertFileExists(public_path('app/index.html'));
        $this->assertStringNotContainsString('binwasnaker', strtolower((string) file_get_contents(public_path('app/index.html'))));
    }

    public function test_unknown_api_route_does_not_return_react(): void
    {
        $this->getJson('/api/v1/unknown')
            ->assertNotFound()
            ->assertExactJson(['error' => ['message' => 'Route tidak ditemukan']]);
    }
}
