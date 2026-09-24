<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Exceptions\ApiException;
use App\Services\JwtService;
use App\Services\ResourceImageService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

final class ResourceImageTest extends TestCase
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

    public function test_resource_photo_rejects_oversized_image_dimensions(): void
    {
        Storage::fake('local');
        $image = UploadedFile::fake()->createWithContent('huge.png', $this->pngContent(10001, 1));

        try {
            app(ResourceImageService::class)->store($image, 'items');
            $this->fail('Oversized image was accepted.');
        } catch (ApiException $exception) {
            $this->assertSame('Dimensi foto terlalu besar', $exception->getMessage());
            $this->assertSame(422, $exception->status);
        }
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    private function png(string $name): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, $this->pngContent(1, 1));
    }

    private function pngContent(int $width, int $height): string
    {
        ob_start();
        $image = imagecreatetruecolor($width, $height);
        imagepng($image);
        imagedestroy($image);

        return (string) ob_get_clean();
    }

    private function token(Role $role): string
    {
        return app(JwtService::class)->access((string) Str::uuid(), $role);
    }
}
