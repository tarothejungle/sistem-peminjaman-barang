<?php

namespace Tests\Feature;

use App\Enums\ResourceType;
use App\Enums\Role;
use App\Models\AttentionMessage;
use App\Services\JwtService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

final class MaintenanceModeAndAttentionMessageTest extends TestCase
{
    private string $pemohonId;

    private string $kasubagId;

    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('role');
            $table->integer('credit_score')->default(100);
            $table->timestamps();
        });
        $this->pemohonId = (string) Str::uuid();
        $this->kasubagId = (string) Str::uuid();
        DB::table('users')->insert([
            ['id' => $this->pemohonId, 'role' => Role::PEMOHON->value, 'created_at' => now(), 'updated_at' => now()],
            ['id' => $this->kasubagId, 'role' => Role::KASUBAG_UMUM->value, 'created_at' => now(), 'updated_at' => now()],
        ]);

        Schema::create('attention_messages', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->text('message');
            $table->string('audience_role');
            $table->boolean('is_active')->default(true);
            $table->string('placement', 20)->default('AFTER_LOGIN');
            $table->integer('sort_order')->default(0);
            $table->uuid('created_by')->nullable();
            $table->timestamps();
        });
        Schema::create('maintenance_settings', function (Blueprint $table): void {
            $table->unsignedSmallInteger('id')->primary();
            $table->boolean('is_enabled')->default(false);
            $table->text('message')->nullable();
            $table->dateTime('estimated_end_at')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();
        });
        Schema::create('items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('category')->default('Kendaraan');
            $table->string('plate_number', 20)->nullable();
            $table->unsignedInteger('total_stock');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
        Schema::create('bookings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('resource_type');
            $table->uuid('room_id')->nullable();
            $table->string('responsible_name')->nullable();
            $table->string('phone_number')->nullable();
            $table->string('work_unit')->nullable();
            $table->dateTime('start_time');
            $table->dateTime('end_time');
            $table->text('purpose');
            $table->string('status');
            $table->string('document_disk')->nullable();
            $table->string('document_path')->nullable();
            $table->string('document_original_name')->nullable();
            $table->string('document_mime')->nullable();
            $table->unsignedBigInteger('document_size')->nullable();
            $table->string('surat_tugas_disk')->nullable();
            $table->string('surat_tugas_path')->nullable();
            $table->string('surat_tugas_original_name')->nullable();
            $table->string('surat_tugas_mime')->nullable();
            $table->unsignedBigInteger('surat_tugas_size')->nullable();
            $table->timestamps();
        });
        Schema::create('booking_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('booking_id');
            $table->uuid('item_id');
            $table->unsignedInteger('quantity');
        });
        Schema::create('user_notifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('booking_id')->nullable();
            $table->string('type');
            $table->string('title');
            $table->text('message');
            $table->dateTime('read_at')->nullable();
            $table->timestamps();
        });
        Schema::create('room_booking_settings', function (Blueprint $table): void {
            $table->unsignedSmallInteger('id')->primary();
            $table->time('start_time');
            $table->time('end_time');
            $table->time('morning_start_time');
            $table->time('morning_end_time');
            $table->time('afternoon_start_time');
            $table->time('afternoon_end_time');
            $table->string('timezone');
            $table->uuid('updated_by')->nullable();
            $table->timestamps();
        });
    }

    public function test_attention_feed_is_scoped_to_the_signed_in_role(): void
    {
        $this->seedMessage('Khusus pemohon', Role::PEMOHON->value, true, AttentionMessage::PLACEMENT_AFTER_LOGIN, 1);
        $this->seedMessage('Untuk semua role', AttentionMessage::AUDIENCE_ALL, true, AttentionMessage::PLACEMENT_AFTER_LOGIN, 2);
        $this->seedMessage('Khusus PJ ruangan', Role::PJ_RUANGAN->value, true, AttentionMessage::PLACEMENT_AFTER_LOGIN, 3);
        $this->seedMessage('Nonaktif', Role::PEMOHON->value, false, AttentionMessage::PLACEMENT_AFTER_LOGIN, 4);
        $this->seedMessage('Tampil sebelum login', Role::PEMOHON->value, true, AttentionMessage::PLACEMENT_BEFORE_LOGIN, 5);

        $response = $this->withToken($this->token(Role::PEMOHON, $this->pemohonId))
            ->getJson('/api/v1/attention-messages')
            ->assertOk();

        $this->assertSame(['Khusus pemohon', 'Untuk semua role'], array_column($response->json('data'), 'title'));
    }

    /** The sign-in page reads these while the site is closed for everyone else. */
    public function test_notices_placed_before_login_are_public_even_during_maintenance(): void
    {
        $this->seedMessage('Sebelum masuk', Role::PEMOHON->value, true, AttentionMessage::PLACEMENT_BEFORE_LOGIN, 1);
        $this->seedMessage('Sesudah masuk', Role::PEMOHON->value, true, AttentionMessage::PLACEMENT_AFTER_LOGIN, 2);
        $this->seedMessage('Sebelum masuk nonaktif', Role::PEMOHON->value, false, AttentionMessage::PLACEMENT_BEFORE_LOGIN, 3);

        DB::table('maintenance_settings')->insert([
            'id' => 1, 'is_enabled' => true, 'message' => 'Mohon maaf, website sedang diperbaiki.',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/attention-messages/public')->assertOk();

        $this->assertSame(['Sebelum masuk'], array_column($response->json('data'), 'title'));
    }

    public function test_only_administrators_manage_attention_messages(): void
    {
        $payload = ['title' => 'Info baru', 'message' => 'Isi informasi baru untuk pengguna.', 'audienceRole' => Role::PEMOHON->value];

        $this->withToken($this->token(Role::PEMOHON, $this->pemohonId))
            ->postJson('/api/v1/attention-messages/manage', $payload)
            ->assertForbidden();

        $created = $this->withToken($this->token(Role::KASUBAG_UMUM, $this->kasubagId))
            ->postJson('/api/v1/attention-messages/manage', $payload)
            ->assertCreated()
            ->json('data');
        $this->assertTrue($created['isActive']);
        $this->assertSame(AttentionMessage::PLACEMENT_AFTER_LOGIN, $created['placement']);

        $this->withToken($this->token(Role::KASUBAG_UMUM, $this->kasubagId))
            ->putJson('/api/v1/attention-messages/manage/'.$created['id'], ['isActive' => false])
            ->assertOk()
            ->assertJsonPath('data.isActive', false);

        $this->withToken($this->token(Role::KASUBAG_UMUM, $this->kasubagId))
            ->deleteJson('/api/v1/attention-messages/manage/'.$created['id'])
            ->assertOk();
        $this->assertDatabaseMissing('attention_messages', ['id' => $created['id']]);
    }

    public function test_maintenance_status_is_public_and_administrator_controlled(): void
    {
        $this->getJson('/api/v1/maintenance')->assertOk()->assertJsonPath('data.isEnabled', false);

        $this->withToken($this->token(Role::PEMOHON, $this->pemohonId))
            ->putJson('/api/v1/maintenance', ['isEnabled' => true])
            ->assertForbidden();

        $this->withToken($this->token(Role::KASUBAG_UMUM, $this->kasubagId))
            ->putJson('/api/v1/maintenance', [
                'isEnabled' => true,
                'message' => 'Sedang perbaikan, mohon tunggu sebentar.',
                'estimatedEndAt' => now()->addHour()->toIso8601String(),
            ])
            ->assertOk()
            ->assertJsonPath('data.isEnabled', true)
            ->assertJsonPath('data.message', 'Sedang perbaikan, mohon tunggu sebentar.');

        $this->withToken($this->token(Role::KASUBAG_UMUM, $this->kasubagId))
            ->putJson('/api/v1/maintenance', ['isEnabled' => false, 'message' => ''])
            ->assertOk()
            ->assertJsonPath('data.isEnabled', false);
        $this->assertStringContainsString('perbaikan', (string) $this->getJson('/api/v1/maintenance')->json('data.message'));
    }

    public function test_enabling_maintenance_demands_a_future_estimated_end(): void
    {
        $token = $this->token(Role::KASUBAG_UMUM, $this->kasubagId);

        $missing = $this->withToken($token)
            ->putJson('/api/v1/maintenance', ['isEnabled' => true, 'message' => 'Sedang perbaikan.'])
            ->assertStatus(400);
        $this->assertArrayHasKey('estimatedEndAt', $missing->json('error.details'));

        $past = $this->withToken($token)
            ->putJson('/api/v1/maintenance', [
                'isEnabled' => true,
                'estimatedEndAt' => now()->subMinute()->toIso8601String(),
            ])
            ->assertStatus(400);
        $this->assertSame('Perkiraan selesai harus waktu yang akan datang.', $past->json('error.details.estimatedEndAt.0'));

        // Switching maintenance off still works without a deadline.
        $this->withToken($token)
            ->putJson('/api/v1/maintenance', ['isEnabled' => false, 'message' => ''])
            ->assertOk()
            ->assertJsonPath('data.isEnabled', false);
    }

    public function test_maintenance_reopens_itself_once_the_estimated_end_has_passed(): void
    {
        $this->withToken($this->token(Role::KASUBAG_UMUM, $this->kasubagId))
            ->putJson('/api/v1/maintenance', [
                'isEnabled' => true,
                'message' => 'Sedang perbaikan sampai jam yang dijanjikan.',
                'estimatedEndAt' => now()->addMinutes(10)->toIso8601String(),
            ])
            ->assertOk();

        $this->withToken($this->token(Role::PEMOHON, $this->pemohonId))
            ->getJson('/api/v1/items')
            ->assertStatus(503);

        // A minute past the announced window the switch closes on its own.
        $this->travel(11)->minutes();

        $this->getJson('/api/v1/maintenance')->assertOk()->assertJsonPath('data.isEnabled', false);
        $this->assertDatabaseHas('maintenance_settings', ['id' => 1, 'is_enabled' => false]);

        $this->withToken($this->token(Role::PEMOHON, $this->pemohonId))
            ->getJson('/api/v1/items')
            ->assertOk();
    }

    public function test_maintenance_closes_the_api_for_borrowers_but_not_for_administrators(): void
    {
        DB::table('maintenance_settings')->insert([
            'id' => 1, 'is_enabled' => true, 'message' => 'Mohon maaf, website sedang diperbaiki.',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->withToken($this->token(Role::PEMOHON, $this->pemohonId))
            ->getJson('/api/v1/items')
            ->assertStatus(503)
            ->assertJsonPath('error.details.code', 'MAINTENANCE');

        $this->withToken($this->token(Role::KASUBAG_UMUM, $this->kasubagId))
            ->getJson('/api/v1/items')
            ->assertOk();
    }

    public function test_a_vehicle_loan_must_carry_its_surat_tugas(): void
    {
        Storage::fake('local');
        $vehicleId = $this->seedItem('Mobil Operasional', 'B 1234 XYZ');
        $projectorId = $this->seedItem('Proyektor', null);
        $payload = [
            'resourceType' => ResourceType::ITEM->value,
            'items' => [['itemId' => $vehicleId, 'quantity' => 1]],
            'startTime' => now()->addDays(2)->toIso8601String(),
            'endTime' => now()->addDays(2)->addHours(2)->toIso8601String(),
            'purpose' => 'Kunjungan lapangan',
            'responsibleName' => 'Budi Santoso',
            'phoneNumber' => '081234567890',
        ];

        $this->withToken($this->token(Role::PEMOHON, $this->pemohonId))
            ->postJson('/api/v1/bookings', $payload)
            ->assertStatus(400)
            ->assertJsonPath('error.details.suratTugas.0', 'Surat Tugas PDF wajib dilampirkan untuk peminjaman kendaraan');

        $created = $this->withToken($this->token(Role::PEMOHON, $this->pemohonId))
            ->post('/api/v1/bookings', array_merge($payload, [
                'suratTugas' => UploadedFile::fake()->createWithContent('surat-tugas.pdf', '%PDF-1.4 surat tugas kendaraan'),
            ]), ['Accept' => 'application/json'])
            ->assertCreated();
        $this->assertSame('surat-tugas.pdf', $created->json('data.suratTugasOriginalName'));

        $this->withToken($this->token(Role::PEMOHON, $this->pemohonId))
            ->get('/api/v1/bookings/'.$created->json('data.id').'/surat-tugas')
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        // Only vehicles carry the obligation; other inventory still books without one.
        $this->withToken($this->token(Role::PEMOHON, $this->pemohonId))
            ->post('/api/v1/bookings', array_merge($payload, [
                'items' => [['itemId' => $projectorId, 'quantity' => 1]],
                'startTime' => now()->addDays(3)->toIso8601String(),
                'endTime' => now()->addDays(3)->addHours(2)->toIso8601String(),
            ]), ['Accept' => 'application/json'])
            ->assertCreated();
    }

    private function seedMessage(string $title, string $audience, bool $isActive, string $placement, int $sortOrder): void
    {
        DB::table('attention_messages')->insert([
            'id' => (string) Str::uuid(),
            'title' => $title,
            'message' => 'Isi informasi untuk pengujian.',
            'audience_role' => $audience,
            'is_active' => $isActive,
            'placement' => $placement,
            'sort_order' => $sortOrder,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedItem(string $name, ?string $plateNumber): string
    {
        $id = (string) Str::uuid();
        DB::table('items')->insert([
            'id' => $id, 'name' => $name, 'category' => 'Kendaraan', 'plate_number' => $plateNumber,
            'total_stock' => 1, 'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);

        return $id;
    }

    private function token(Role $role, string $userId): string
    {
        return app(JwtService::class)->access($userId, $role);
    }
}
