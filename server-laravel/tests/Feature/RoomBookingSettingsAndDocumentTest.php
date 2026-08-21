<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\ResourceType;
use App\Enums\Role;
use App\Enums\RoomBookingSlot;
use App\Services\JwtService;
use App\Services\RoomBookingScheduleService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

final class RoomBookingSettingsAndDocumentTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('bookings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('resource_type');
            $table->uuid('room_id')->nullable();
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

    public function test_only_kabag_can_update_room_booking_hours(): void
    {
        $payload = [
            'morningStartTime' => '08:00',
            'morningEndTime' => '12:00',
            'afternoonStartTime' => '13:00',
            'afternoonEndTime' => '16:00',
            'fullDayStartTime' => '08:00',
            'fullDayEndTime' => '16:00',
        ];

        $this->putJson('/api/v1/room-booking-settings', $payload)->assertUnauthorized();
        $this->withToken($this->token(Role::PEMOHON))->putJson('/api/v1/room-booking-settings', $payload)->assertForbidden();
        $this->withToken($this->token(Role::PJ_RUANGAN))->putJson('/api/v1/room-booking-settings', $payload)->assertForbidden();
        $this->withToken($this->token(Role::KABAG_UMUM))->putJson('/api/v1/room-booking-settings', array_merge($payload, ['afternoonStartTime' => '11:00']))
            ->assertBadRequest()
            ->assertJsonPath('error.details.afternoonStartTime.0', 'The afternoon start time field must be a date after or equal to morning end time.');

        $this->withToken($this->token(Role::KABAG_UMUM))->putJson('/api/v1/room-booking-settings', $payload)
            ->assertOk()
            ->assertJsonPath('data.morningStartTime', '08:00:00')
            ->assertJsonPath('data.afternoonEndTime', '16:00:00');
    }

    public function test_room_schedule_builds_each_configured_slot_in_jakarta_timezone(): void
    {
        $schedule = app(RoomBookingScheduleService::class);
        $date = now('Asia/Jakarta')->addDays(2)->format('Y-m-d');

        [$morningStart, $morningEnd] = $schedule->range($date, $date, RoomBookingSlot::MORNING);
        [$afternoonStart, $afternoonEnd] = $schedule->range($date, $date, RoomBookingSlot::AFTERNOON);
        [$fullDayStart, $fullDayEnd] = $schedule->range($date, $date, RoomBookingSlot::FULL_DAY);

        $this->assertSame('08:00', $morningStart->setTimezone('Asia/Jakarta')->format('H:i'));
        $this->assertSame('12:00', $morningEnd->setTimezone('Asia/Jakarta')->format('H:i'));
        $this->assertSame('13:00', $afternoonStart->setTimezone('Asia/Jakarta')->format('H:i'));
        $this->assertSame('16:00', $afternoonEnd->setTimezone('Asia/Jakarta')->format('H:i'));
        $this->assertSame('08:00', $fullDayStart->setTimezone('Asia/Jakarta')->format('H:i'));
        $this->assertSame('16:00', $fullDayEnd->setTimezone('Asia/Jakarta')->format('H:i'));
    }

    public function test_multi_day_room_booking_requires_a_valid_pdf_before_database_access(): void
    {
        $payload = [
            'resourceType' => ResourceType::ROOM->value,
            'roomId' => (string) Str::uuid(),
            'startDate' => now()->addDay()->format('Y-m-d'),
            'endDate' => now()->addDays(2)->format('Y-m-d'),
            'roomSlot' => 'FULL_DAY',
            'purpose' => 'Rapat koordinasi lintas hari',
        ];

        $this->withToken($this->token(Role::PEMOHON))->postJson('/api/v1/bookings', $payload)
            ->assertBadRequest()
            ->assertJsonPath('error.details.document.0', 'Surat resmi PDF wajib dilampirkan untuk peminjaman lebih dari satu hari');

        $payload['document'] = UploadedFile::fake()->createWithContent('surat.pdf', 'not-a-real-pdf');
        $this->withToken($this->token(Role::PEMOHON))->post('/api/v1/bookings', $payload, ['Accept' => 'application/json'])
            ->assertBadRequest()
            ->assertJsonPath('error.message', 'Data tidak valid');
    }

    public function test_room_booking_rejects_invalid_slot_and_non_full_day_multi_day_range(): void
    {
        $payload = [
            'resourceType' => ResourceType::ROOM->value,
            'roomId' => (string) Str::uuid(),
            'startDate' => now()->addDay()->format('Y-m-d'),
            'endDate' => now()->addDay()->format('Y-m-d'),
            'roomSlot' => 'CUSTOM',
            'purpose' => 'Rapat koordinasi',
        ];

        $this->withToken($this->token(Role::PEMOHON))->postJson('/api/v1/bookings', $payload)
            ->assertBadRequest()
            ->assertJsonPath('error.message', 'Data tidak valid');

        $payload['roomSlot'] = 'MORNING';
        $payload['endDate'] = now()->addDays(2)->format('Y-m-d');
        $payload['document'] = UploadedFile::fake()->createWithContent('surat.pdf', '%PDF-valid');

        $this->withToken($this->token(Role::PEMOHON))->post('/api/v1/bookings', $payload, ['Accept' => 'application/json'])
            ->assertBadRequest()
            ->assertJsonPath('error.details.roomSlot.0', 'Peminjaman lebih dari satu hari wajib menggunakan kategori sehari penuh');
    }

    public function test_document_download_is_private_and_role_scoped(): void
    {
        Storage::fake('local');
        $ownerId = (string) Str::uuid();
        $bookingId = (string) Str::uuid();
        $path = 'booking-documents/'.Str::uuid().'.pdf';
        Storage::disk('local')->put($path, '%PDF-private');
        DB::table('bookings')->insert([
            'id' => $bookingId,
            'user_id' => $ownerId,
            'resource_type' => ResourceType::ROOM->value,
            'room_id' => Str::uuid(),
            'start_time' => now()->addDay(),
            'end_time' => now()->addDays(2),
            'purpose' => 'Rapat resmi',
            'status' => BookingStatus::PENDING_PJ_REVIEW->value,
            'document_disk' => 'local',
            'document_path' => $path,
            'document_original_name' => 'surat-resmi.pdf',
            'document_mime' => 'application/pdf',
            'document_size' => 12,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $url = "/api/v1/bookings/{$bookingId}/document";
        $this->get($url)->assertUnauthorized();
        $this->withToken($this->token(Role::PEMOHON))->get($url)->assertNotFound();
        $this->withToken(app(JwtService::class)->access($ownerId, Role::PEMOHON))->get($url)->assertOk()->assertHeader('x-content-type-options', 'nosniff');
        $this->withToken($this->token(Role::PJ_RUANGAN))->get($url)->assertOk();
        $this->withToken($this->token(Role::KABAG_UMUM))->get($url)->assertOk();
    }

    private function token(Role $role): string
    {
        return app(JwtService::class)->access((string) Str::uuid(), $role);
    }
}
