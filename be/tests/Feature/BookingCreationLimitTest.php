<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\ResourceType;
use App\Enums\Role;
use App\Services\JwtService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

final class BookingCreationLimitTest extends TestCase
{
    private string $userId;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'jwt.booking_max_duration_days' => 7,
            'jwt.booking_max_future_days' => 180,
            'jwt.booking_max_active_per_user' => 2,
        ]);

        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('role');
        });
        $this->userId = (string) Str::uuid();
        DB::table('users')->insert([
            ['id' => $this->userId, 'role' => Role::PEMOHON->value],
        ]);

        Schema::create('items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->unsignedInteger('total_stock');
            // Vehicle rows carry a plate, which is what makes the Surat Tugas mandatory.
            $table->string('plate_number', 20)->nullable();
            $table->boolean('is_active')->default(true);
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
            $table->timestamps();
        });
        Schema::create('booking_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('booking_id');
            $table->uuid('item_id');
            $table->unsignedInteger('quantity');
        });
        // The H-1 lead-time rule reads the operational timezone from here.
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

    public function test_booking_rejects_long_duration_and_distant_future(): void
    {
        $itemId = (string) Str::uuid();
        DB::table('items')->insert(['id' => $itemId, 'name' => 'Proyektor', 'total_stock' => 1, 'is_active' => true]);

        $this->withToken($this->token())->postJson('/api/v1/bookings', [
            'resourceType' => ResourceType::ITEM->value,
            'items' => [['itemId' => $itemId, 'quantity' => 1]],
            'startTime' => CarbonImmutable::now()->addDay()->toIso8601String(),
            'endTime' => CarbonImmutable::now()->addDay()->addDays(8)->toIso8601String(),
            'purpose' => 'Durasi terlalu panjang',
            'responsibleName' => 'Pemohon',
            'phoneNumber' => '081234567890',
        ])->assertUnprocessable();

        $this->withToken($this->token())->postJson('/api/v1/bookings', [
            'resourceType' => ResourceType::ITEM->value,
            'items' => [['itemId' => $itemId, 'quantity' => 1]],
            'startTime' => CarbonImmutable::now()->addMonths(6)->toIso8601String(),
            'endTime' => CarbonImmutable::now()->addMonths(6)->addDay()->toIso8601String(),
            'purpose' => 'Terlalu jauh ke depan',
            'responsibleName' => 'Pemohon',
            'phoneNumber' => '081234567890',
        ])->assertUnprocessable();
    }

    public function test_booking_rejects_when_active_booking_quota_reached(): void
    {
        $itemId = (string) Str::uuid();
        DB::table('items')->insert(['id' => $itemId, 'name' => 'Proyektor', 'total_stock' => 3, 'is_active' => true]);
        foreach ([1, 2] as $i) {
            DB::table('bookings')->insert([
                'id' => (string) Str::uuid(),
                'user_id' => $this->userId,
                'resource_type' => ResourceType::ITEM->value,
                'start_time' => CarbonImmutable::now()->addDays($i),
                'end_time' => CarbonImmutable::now()->addDays($i)->addHour(),
                'purpose' => 'Aktif',
                'status' => BookingStatus::PENDING_PJ_REVIEW->value,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('booking_items')->insert([
                'id' => (string) Str::uuid(),
                'booking_id' => DB::getPdo()->lastInsertId() ?: (string) Str::uuid(),
                'item_id' => $itemId,
                'quantity' => 1,
            ]);
        }

        $this->withToken($this->token())->postJson('/api/v1/bookings', [
            'resourceType' => ResourceType::ITEM->value,
            'items' => [['itemId' => $itemId, 'quantity' => 1]],
            'startTime' => CarbonImmutable::now()->addDays(5)->toIso8601String(),
            'endTime' => CarbonImmutable::now()->addDays(5)->addHour()->toIso8601String(),
            'purpose' => 'Melebihi kuota aktif',
            'responsibleName' => 'Pemohon',
            'phoneNumber' => '081234567890',
        ])->assertStatus(429);
    }

    private function token(): string
    {
        return app(JwtService::class)->access($this->userId, Role::PEMOHON);
    }

    public function test_edit_cannot_bypass_duration_or_future_limits(): void
    {
        $id = (string) Str::uuid();
        DB::table('bookings')->insert([
            'id' => $id, 'user_id' => $this->userId, 'resource_type' => 'ITEM',
            'start_time' => now()->addDay(), 'end_time' => now()->addDay()->addHour(),
            'purpose' => 'Original', 'status' => BookingStatus::PENDING_PJ_REVIEW->value,
        ]);
        foreach ([[1, 9], [200, 201]] as [$start, $end]) {
            $this->withToken($this->token())->putJson('/api/v1/bookings/'.$id, [
                'resourceType' => 'ITEM', 'items' => [['itemId' => (string) Str::uuid(), 'quantity' => 1]],
                'startTime' => now()->addDays($start)->toIso8601String(),
                'endTime' => now()->addDays($end)->toIso8601String(),
                'purpose' => 'Bypass attempt', 'responsibleName' => 'Pemohon', 'phoneNumber' => '081234567890',
            ])->assertUnprocessable();
        }
        $this->assertDatabaseHas('bookings', ['id' => $id, 'purpose' => 'Original']);
    }

    public function test_booking_must_be_requested_at_least_one_day_before_use(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-09-18 09:00:00', 'Asia/Jakarta'));

        $itemId = (string) Str::uuid();
        DB::table('items')->insert(['id' => $itemId, 'name' => 'Mobil Operasional', 'total_stock' => 1, 'is_active' => true]);

        $payload = static function (string $start, string $end) use ($itemId): array {
            return [
                'resourceType' => ResourceType::ITEM->value,
                'items' => [['itemId' => $itemId, 'quantity' => 1]],
                'startTime' => $start,
                'endTime' => $end,
                'purpose' => 'Perjalanan dinas',
                'responsibleName' => 'Pemohon',
                'phoneNumber' => '081234567890',
            ];
        };

        $today = CarbonImmutable::parse('2026-09-18 14:00:00', 'Asia/Jakarta')->toIso8601String();
        $this->withToken($this->token())->postJson('/api/v1/bookings', $payload($today, CarbonImmutable::parse('2026-09-18 16:00:00', 'Asia/Jakarta')->toIso8601String()))
            ->assertStatus(422)
            ->assertJsonPath('error.message', 'Peminjaman harus diajukan minimal H-1 sebelum tanggal pemakaian');
        $this->assertDatabaseCount('bookings', 0);

        $tomorrow = CarbonImmutable::parse('2026-09-19 09:00:00', 'Asia/Jakarta');
        $this->withToken($this->token())->postJson('/api/v1/bookings', $payload($tomorrow->toIso8601String(), $tomorrow->addHours(2)->toIso8601String()))
            ->assertCreated();
    }

    public function test_edit_cannot_drop_below_the_one_day_lead_time(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-09-18 09:00:00', 'Asia/Jakarta'));

        $itemId = (string) Str::uuid();
        DB::table('items')->insert(['id' => $itemId, 'name' => 'Mobil Operasional', 'total_stock' => 1, 'is_active' => true]);
        $id = (string) Str::uuid();
        DB::table('bookings')->insert([
            'id' => $id, 'user_id' => $this->userId, 'resource_type' => 'ITEM',
            'start_time' => CarbonImmutable::parse('2026-09-19 09:00:00', 'Asia/Jakarta'),
            'end_time' => CarbonImmutable::parse('2026-09-19 11:00:00', 'Asia/Jakarta'),
            'purpose' => 'Awal', 'status' => BookingStatus::PENDING_PJ_REVIEW->value,
        ]);

        $this->withToken($this->token())->putJson('/api/v1/bookings/'.$id, [
            'resourceType' => 'ITEM',
            'items' => [['itemId' => $itemId, 'quantity' => 1]],
            'startTime' => CarbonImmutable::parse('2026-09-18 14:00:00', 'Asia/Jakarta')->toIso8601String(),
            'endTime' => CarbonImmutable::parse('2026-09-18 16:00:00', 'Asia/Jakarta')->toIso8601String(),
            'purpose' => 'Dipercepat', 'responsibleName' => 'Pemohon', 'phoneNumber' => '081234567890',
        ])->assertStatus(422);

        $this->assertDatabaseHas('bookings', ['id' => $id, 'purpose' => 'Awal']);
    }
}
