<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use App\Services\JwtService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class UserProfileTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('full_name');
            $table->string('username')->unique();
            $table->string('email')->unique();
            $table->string('password_hash');
            $table->string('role');
            $table->string('phone_number', 20)->nullable();
            $table->string('profile_image_path')->nullable();
            $table->string('profile_image_mime')->nullable();
            $table->timestamps();
        });
        $this->user = User::query()->create([
            'full_name' => 'Pemohon Profil',
            'username' => 'pemohon.profil',
            'email' => 'profil@example.test',
            'password_hash' => Hash::make('Password123!'),
            'role' => Role::PEMOHON,
        ]);
    }

    public function test_user_can_update_only_their_own_phone_number(): void
    {
        $this->patchJson('/api/v1/profile', ['phoneNumber' => '081234567890'])->assertUnauthorized();

        $this->withToken($this->token(Role::PEMOHON))->patchJson('/api/v1/profile', ['phoneNumber' => '0812 3456-7890'])
            ->assertOk()
            ->assertJsonPath('data.phoneNumber', '0812 3456-7890');
        $this->assertDatabaseHas('users', ['id' => $this->user->id, 'phone_number' => '0812 3456-7890']);

        $this->withToken($this->token(Role::PEMOHON))->patchJson('/api/v1/profile', ['phoneNumber' => 'javascript:alert(1)'])
            ->assertBadRequest();
    }

    public function test_room_manager_can_manage_their_own_profile(): void
    {
        $this->withToken($this->token(Role::PJ_RUANGAN))->patchJson('/api/v1/profile', ['phoneNumber' => '+62 81234567890'])
            ->assertOk()
            ->assertJsonPath('data.phoneNumber', '+62 81234567890');
    }

    public function test_kabag_can_update_their_identity_and_phone_number(): void
    {
        $this->user->update(['role' => Role::KABAG_UMUM]);

        $this->withToken($this->token(Role::KABAG_UMUM))->patchJson('/api/v1/profile', [
            'fullName' => 'Kabag Umum Baru',
            'email' => 'kabag.baru@example.test',
            'phoneNumber' => '081234567899',
        ])
            ->assertOk()
            ->assertJsonPath('data.fullName', 'Kabag Umum Baru')
            ->assertJsonPath('data.email', 'kabag.baru@example.test')
            ->assertJsonPath('data.phoneNumber', '081234567899');
    }

    public function test_non_kabag_cannot_change_identity_through_profile(): void
    {
        $this->user->update(['role' => Role::PJ_RUANGAN]);

        $this->withToken($this->token(Role::PJ_RUANGAN))->patchJson('/api/v1/profile', [
            'fullName' => 'Nama Tidak Berubah',
            'email' => 'tidak.berubah@example.test',
            'phoneNumber' => '081234567899',
        ])
            ->assertOk()
            ->assertJsonPath('data.fullName', 'Pemohon Profil')
            ->assertJsonPath('data.email', 'profil@example.test')
            ->assertJsonPath('data.phoneNumber', '081234567899');
    }

    public function test_kasubag_can_update_their_identity_and_phone_number(): void
    {
        $this->user->update(['role' => Role::KASUBAG_UMUM]);

        $this->withToken($this->token(Role::KASUBAG_UMUM))->patchJson('/api/v1/profile', [
            'fullName' => 'Kasubag Umum Baru',
            'email' => 'kasubag.baru@example.test',
            'phoneNumber' => '081200000001',
        ])
            ->assertOk()
            ->assertJsonPath('data.fullName', 'Kasubag Umum Baru')
            ->assertJsonPath('data.email', 'kasubag.baru@example.test')
            ->assertJsonPath('data.phoneNumber', '081200000001');

        $this->assertDatabaseHas('users', [
            'id' => $this->user->id,
            'full_name' => 'Kasubag Umum Baru',
            'email' => 'kasubag.baru@example.test',
        ]);
    }

    public function test_kasubag_can_upload_and_delete_a_profile_photo(): void
    {
        Storage::fake('local');
        $this->user->update(['role' => Role::KASUBAG_UMUM]);
        $token = $this->token(Role::KASUBAG_UMUM);

        $this->withToken($token)->post('/api/v1/profile/photo', ['image' => $this->png('kasubag.png')], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.profileImageUrl', '/profile/photo');

        $this->withToken($token)->deleteJson('/api/v1/profile/photo')
            ->assertOk()
            ->assertJsonPath('data.profileImageUrl', null);
    }

    public function test_user_can_upload_read_replace_and_delete_private_profile_photo(): void
    {
        Storage::fake('local');
        $token = $this->token(Role::PEMOHON);

        $uploaded = $this->withToken($token)->post('/api/v1/profile/photo', ['image' => $this->png('profile.png')], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.profileImageUrl', '/profile/photo');
        $firstPath = User::query()->find($this->user->id)->profile_image_path;
        Storage::disk('local')->assertExists($firstPath);
        $this->withToken($token)->get('/api/v1/profile/photo')->assertOk()->assertHeader('content-type', 'image/png');

        $this->withToken($token)->post('/api/v1/profile/photo', ['image' => $this->png('replacement.png')], ['Accept' => 'application/json'])->assertOk();
        Storage::disk('local')->assertMissing($firstPath);

        $this->withToken($token)->deleteJson('/api/v1/profile/photo')->assertOk()->assertJsonPath('data.profileImageUrl', null);
        $this->withToken($token)->get('/api/v1/profile/photo')->assertNotFound();
        $uploaded->assertJsonMissingPath('data.profileImagePath');
    }

    public function test_kabag_can_upload_private_profile_photo(): void
    {
        Storage::fake('local');
        $this->user->update(['role' => Role::KABAG_UMUM]);

        $this->withToken($this->token(Role::KABAG_UMUM))->post('/api/v1/profile/photo', ['image' => $this->png('kabag.png')], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.profileImageUrl', '/profile/photo');
    }

    public function test_profile_photo_rejects_spoofed_image_content(): void
    {
        Storage::fake('local');
        $fake = UploadedFile::fake()->createWithContent('photo.png', '<?php echo "unsafe";');

        $this->withToken($this->token(Role::PEMOHON))->post('/api/v1/profile/photo', ['image' => $fake], ['Accept' => 'application/json'])
            ->assertBadRequest();
    }

    private function png(string $name): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true));
    }

    private function token(Role $role): string
    {
        return app(JwtService::class)->access($this->user->id, $role);
    }
}
