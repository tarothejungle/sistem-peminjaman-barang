<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Services\JwtService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Kelola Ruangan / Kelola Barang is available to administrators and PJ Ruangan.
 * PEMOHON stays read-only and anonymous callers stay locked out.
 */
final class ResourceManagementAuthorizationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('rooms', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->unsignedInteger('capacity');
            $table->string('location');
            $table->text('facilities')->default('{}');
            $table->boolean('is_active')->default(true);
            $table->string('image_path')->nullable();
            $table->string('image_mime')->nullable();
            $table->timestamps();
        });
        Schema::create('items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->unsignedInteger('total_stock');
            $table->string('category');
            $table->boolean('is_active')->default(true);
            $table->string('image_path')->nullable();
            $table->string('image_mime')->nullable();
            $table->timestamps();
        });
    }

    public function test_pj_ruangan_can_create_update_and_deactivate_a_room(): void
    {
        $token = $this->token(Role::PJ_RUANGAN);
        $payload = ['name' => 'Ruang Rapat B', 'capacity' => 15, 'location' => 'Lantai 3', 'facilities' => ['AC', 'Proyektor']];

        $roomId = $this->withToken($token)->postJson('/api/v1/rooms', $payload)
            ->assertCreated()
            ->assertJsonPath('data.name', 'Ruang Rapat B')
            ->json('data.id');

        $this->withToken($token)->putJson("/api/v1/rooms/{$roomId}", ['capacity' => 24])
            ->assertOk()
            ->assertJsonPath('data.capacity', 24);

        $this->withToken($token)->deleteJson("/api/v1/rooms/{$roomId}")
            ->assertOk()
            ->assertJsonPath('data.isActive', false);
    }

    public function test_pj_ruangan_can_create_and_update_an_item(): void
    {
        $token = $this->token(Role::PJ_RUANGAN);

        $itemId = $this->withToken($token)->postJson('/api/v1/items', ['name' => 'Kursi Lipat', 'category' => 'Furnitur', 'totalStock' => 40])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Kursi Lipat')
            ->json('data.id');

        $this->withToken($token)->putJson("/api/v1/items/{$itemId}", ['totalStock' => 55])
            ->assertOk()
            ->assertJsonPath('data.totalStock', 55);
    }

    public function test_pemohon_cannot_mutate_rooms_or_items_and_anonymous_is_rejected(): void
    {
        $roomPayload = ['name' => 'Ruang Rapat C', 'capacity' => 10, 'location' => 'Lantai 1', 'facilities' => ['AC']];
        $itemPayload = ['name' => 'Meja', 'category' => 'Furnitur', 'totalStock' => 5];
        $roomId = (string) Str::uuid();

        $this->postJson('/api/v1/rooms', $roomPayload)->assertUnauthorized();
        $this->postJson('/api/v1/items', $itemPayload)->assertUnauthorized();

        $pemohon = $this->token(Role::PEMOHON);
        $this->withToken($pemohon)->postJson('/api/v1/rooms', $roomPayload)->assertForbidden();
        $this->withToken($pemohon)->putJson("/api/v1/rooms/{$roomId}", ['capacity' => 2])->assertForbidden();
        $this->withToken($pemohon)->deleteJson("/api/v1/rooms/{$roomId}")->assertForbidden();
        $this->withToken($pemohon)->postJson('/api/v1/items', $itemPayload)->assertForbidden();
    }

    private function token(Role $role): string
    {
        return app(JwtService::class)->access((string) Str::uuid(), $role);
    }
}
