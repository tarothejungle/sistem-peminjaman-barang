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

    public function test_binwasnaker_logo_is_served_from_frontend_base_path(): void
    {
        $this->assertFileExists(public_path('app/binwasnaker.jpg'));
        $this->assertGreaterThan(0, filesize(public_path('app/binwasnaker.jpg')));
        $this->assertStringContainsString('/app/binwasnaker.jpg', file_get_contents(public_path('app/assets/'.collect(scandir(public_path('app/assets')))->first(fn (string $file): bool => str_starts_with($file, 'index-') && str_ends_with($file, '.js')))));
    }

    public function test_unknown_api_route_does_not_return_react(): void
    {
        $this->getJson('/api/v1/unknown')
            ->assertNotFound()
            ->assertExactJson(['error' => ['message' => 'Route tidak ditemukan']]);
    }
}
