<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\ResourceType;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

final class RoomDisplayTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('room_booking_settings', function (Blueprint $table): void {
            $table->unsignedTinyInteger('id')->primary();
            $table->time('start_time');
            $table->time('end_time');
            $table->time('morning_start_time');
            $table->time('morning_end_time');
            $table->time('afternoon_start_time');
            $table->time('afternoon_end_time');
            $table->string('timezone');
            $table->timestamps();
        });
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
        Schema::create('bookings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('resource_type');
            $table->uuid('room_id')->nullable();
            $table->string('work_unit')->nullable();
            $table->dateTime('start_time');
            $table->dateTime('end_time');
            $table->text('purpose');
            $table->string('status');
            $table->timestamps();
        });
    }

    public function test_public_display_returns_live_room_status_without_borrower_identity(): void
    {
        $roomId = (string) Str::uuid();
        $userId = (string) Str::uuid();
        DB::table('rooms')->insert([
            'id' => $roomId,
            'name' => 'Ruang Rapat Utama',
            'capacity' => 20,
            'location' => 'Lantai 2',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('bookings')->insert([
            'id' => Str::uuid(),
            'user_id' => $userId,
            'resource_type' => ResourceType::ROOM->value,
            'room_id' => $roomId,
            'work_unit' => 'Bagian Umum',
            'start_time' => now()->subMinutes(15),
            'end_time' => now()->addMinutes(45),
            'purpose' => 'Rapat Koordinasi',
            'status' => BookingStatus::APPROVED->value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/display/rooms')
            ->assertOk()
            ->assertJsonPath('data.summary.total', 1)
            ->assertJsonPath('data.summary.inUse', 1)
            ->assertJsonPath('data.rooms.0.name', 'Ruang Rapat Utama')
            ->assertJsonPath('data.rooms.0.state', 'IN_USE')
            ->assertJsonPath('data.rooms.0.currentBooking.workUnit', 'Bagian Umum')
            ->assertJsonPath('data.rooms.0.todayBookings.0.workUnit', 'Bagian Umum')
            ->assertJsonPath('data.rooms.0.currentBooking.purpose', 'Rapat Koordinasi');

        $this->assertStringNotContainsString($userId, $response->getContent());
        $this->assertStringNotContainsString('userId', $response->getContent());
        $this->assertStringNotContainsString('email', $response->getContent());
    }

    public function test_public_display_excludes_inactive_rooms_and_unapproved_bookings(): void
    {
        $activeRoomId = (string) Str::uuid();
        $inactiveRoomId = (string) Str::uuid();
        foreach ([[$activeRoomId, true], [$inactiveRoomId, false]] as [$id, $active]) {
            DB::table('rooms')->insert([
                'id' => $id,
                'name' => $active ? 'Ruang Aktif' : 'Ruang Nonaktif',
                'capacity' => 10,
                'location' => 'Lantai 1',
                'is_active' => $active,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
        DB::table('bookings')->insert([
            'id' => Str::uuid(),
            'user_id' => Str::uuid(),
            'resource_type' => ResourceType::ROOM->value,
            'room_id' => $activeRoomId,
            'start_time' => now()->subMinutes(10),
            'end_time' => now()->addHour(),
            'purpose' => 'Pengajuan Belum Disetujui',
            'status' => BookingStatus::PENDING_KABAG_APPROVAL->value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->getJson('/api/v1/display/rooms')
            ->assertOk()
            ->assertJsonCount(1, 'data.rooms')
            ->assertJsonPath('data.rooms.0.id', $activeRoomId)
            ->assertJsonPath('data.rooms.0.state', 'AVAILABLE')
            ->assertJsonCount(0, 'data.rooms.0.todayBookings');
    }

    public function test_public_display_labels_historical_bookings_without_a_work_unit(): void
    {
        $roomId = (string) Str::uuid();
        DB::table('rooms')->insert([
            'id' => $roomId,
            'name' => 'Ruang Arsip',
            'capacity' => 8,
            'location' => 'Lantai 1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('bookings')->insert([
            'id' => Str::uuid(),
            'user_id' => Str::uuid(),
            'resource_type' => ResourceType::ROOM->value,
            'room_id' => $roomId,
            'work_unit' => null,
            'start_time' => now()->subMinutes(10),
            'end_time' => now()->addHour(),
            'purpose' => 'Rapat Historis',
            'status' => BookingStatus::APPROVED->value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->getJson('/api/v1/display/rooms')
            ->assertOk()
            ->assertJsonPath('data.rooms.0.todayBookings.0.workUnit', 'Unit kerja tidak tersedia');
    }
}
