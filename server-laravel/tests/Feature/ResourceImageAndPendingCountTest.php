<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\Role;
use App\Services\JwtService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

final class ResourceImageAndPendingCountTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

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
        Schema::create('bookings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('status');
        });
    }

    public function test_kabag_can_upload_and_replace_private_item_photo(): void
    {
        Storage::fake('local');
        $payload = ['name' => 'Proyektor', 'category' => 'Elektronik', 'totalStock' => 2];
        $payload['image'] = $this->png('awal.png');

        $created = $this->withToken($this->token(Role::KABAG_UMUM))->post('/api/v1/items', $payload, ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Proyektor');
        $itemId = $created->json('data.id');
        $created->assertJsonPath('data.imageUrl', "/items/{$itemId}/image");
        $oldPath = DB::table('items')->where('id', $itemId)->value('image_path');
        Storage::disk('local')->assertExists($oldPath);

        $this->withToken($this->token(Role::KABAG_UMUM))->post("/api/v1/items/{$itemId}", ['image' => $this->png('baru.png')], ['Accept' => 'application/json'])
            ->assertOk();
        Storage::disk('local')->assertMissing($oldPath);

        $this->withToken($this->token(Role::PEMOHON))->get("/api/v1/items/{$itemId}/image")
            ->assertOk()
            ->assertHeader('content-type', 'image/png')
            ->assertHeader('x-content-type-options', 'nosniff');
    }

    public function test_resource_photo_rejects_invalid_file_and_requires_kabag_role(): void
    {
        $payload = ['name' => 'Kamera', 'category' => 'Elektronik', 'totalStock' => 1, 'image' => UploadedFile::fake()->createWithContent('malware.png', '<?php echo 1;')];

        $this->post('/api/v1/items', $payload, ['Accept' => 'application/json'])->assertUnauthorized();
        $this->withToken($this->token(Role::PEMOHON))->post('/api/v1/items', $payload, ['Accept' => 'application/json'])->assertForbidden();
        $this->withToken($this->token(Role::KABAG_UMUM))->post('/api/v1/items', $payload, ['Accept' => 'application/json'])
            ->assertBadRequest()
            ->assertJsonPath('error.message', 'Foto harus berupa JPEG, PNG, atau WebP yang valid');
    }

    public function test_pending_count_is_role_specific_and_manager_only(): void
    {
        foreach ([BookingStatus::PENDING_PJ_REVIEW, BookingStatus::PREPARING, BookingStatus::PENDING_KABAG_APPROVAL, BookingStatus::APPROVED] as $status) {
            DB::table('bookings')->insert(['id' => Str::uuid(), 'status' => $status->value]);
        }

        $this->getJson('/api/v1/bookings/pending-count')->assertUnauthorized();
        $this->withToken($this->token(Role::PEMOHON))->getJson('/api/v1/bookings/pending-count')->assertForbidden();
        $this->withToken($this->token(Role::PJ_RUANGAN))->getJson('/api/v1/bookings/pending-count')->assertOk()->assertJsonPath('data.count', 2);
        $this->withToken($this->token(Role::KABAG_UMUM))->getJson('/api/v1/bookings/pending-count')->assertOk()->assertJsonPath('data.count', 1);
    }

    private function png(string $name): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true));
    }

    private function token(Role $role): string
    {
        return app(JwtService::class)->access((string) Str::uuid(), $role);
    }
}
