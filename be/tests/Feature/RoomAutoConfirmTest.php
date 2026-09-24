<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\ResourceType;
use App\Enums\Role;
use App\Models\Booking;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Room bookings whose borrower never confirms are closed by the scheduled
 * bookings:auto-confirm-rooms command, using BOOKING_ROOM_AUTO_CONFIRM_MINUTES.
 */
final class RoomAutoConfirmTest extends TestCase
{
    private string $userId;

    private string $roomId;

    protected function setUp(): void
    {
        parent::setUp();

        config(['jwt.booking_room_auto_confirm_minutes' => 60]);

        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('role');
            $table->integer('credit_score')->default(100);
        });
        $this->userId = (string) Str::uuid();
        DB::table('users')->insert([
            ['id' => $this->userId, 'role' => Role::PEMOHON->value, 'credit_score' => 100],
        ]);

        Schema::create('rooms', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->boolean('is_active')->default(true);
        });
        $this->roomId = (string) Str::uuid();
        DB::table('rooms')->insert(['id' => $this->roomId, 'name' => 'Ruang Rapat A', 'is_active' => true]);

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
            $table->dateTime('alternative_start_time')->nullable();
            $table->dateTime('alternative_end_time')->nullable();
            $table->text('purpose');
            $table->string('status');
            $table->dateTime('returned_at')->nullable();
            $table->dateTime('auto_confirmed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('user_credit_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('booking_id')->nullable()->unique();
            $table->integer('delta');
            $table->integer('score_after');
            $table->string('reason', 50);
            $table->timestamps();
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

        // Auto-confirm prints local wording, so the operational timezone is read.
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
        DB::table('room_booking_settings')->insert([
            'id' => 1,
            'start_time' => '08:00:00',
            'end_time' => '16:00:00',
            'morning_start_time' => '08:00:00',
            'morning_end_time' => '12:00:00',
            'afternoon_start_time' => '13:00:00',
            'afternoon_end_time' => '16:00:00',
            'timezone' => 'Asia/Jakarta',
        ]);
    }

    public function test_room_booking_past_the_grace_period_is_closed_automatically(): void
    {
        $end = now()->subHours(2);
        $bookingId = $this->roomBooking(BookingStatus::APPROVED, $end);

        Artisan::call('bookings:auto-confirm-rooms');

        $booking = Booking::find($bookingId);
        $this->assertSame(BookingStatus::COMPLETED, $booking->status);
        // The room became free at its scheduled end, so that is the recorded finish.
        $this->assertSame($end->toDateTimeString(), $booking->returned_at->toDateTimeString());
        $this->assertNotNull($booking->auto_confirmed_at);

        $this->assertDatabaseCount('user_credit_events', 0);
        $this->assertSame(100, (int) DB::table('users')->where('id', $this->userId)->value('credit_score'));

        $this->assertDatabaseHas('user_notifications', [
            'booking_id' => $bookingId,
            'user_id' => $this->userId,
            'type' => 'BOOKING_AUTO_CONFIRMED',
        ]);
    }

    public function test_room_booking_inside_the_grace_period_is_left_untouched(): void
    {
        $bookingId = $this->roomBooking(BookingStatus::APPROVED, now()->subMinutes(10));

        Artisan::call('bookings:auto-confirm-rooms');

        $booking = Booking::find($bookingId);
        $this->assertSame(BookingStatus::APPROVED, $booking->status);
        $this->assertNull($booking->returned_at);
        $this->assertNull($booking->auto_confirmed_at);
        $this->assertDatabaseCount('user_credit_events', 0);
    }

    public function test_item_bookings_are_never_auto_confirmed(): void
    {
        $bookingId = (string) Str::uuid();
        DB::table('bookings')->insert([
            'id' => $bookingId,
            'user_id' => $this->userId,
            'resource_type' => ResourceType::ITEM->value,
            'start_time' => now()->subHours(3),
            'end_time' => now()->subHours(2),
            'purpose' => 'Peminjaman barang',
            'status' => BookingStatus::APPROVED->value,
        ]);

        Artisan::call('bookings:auto-confirm-rooms');

        $this->assertSame(BookingStatus::APPROVED, Booking::find($bookingId)->status);
        $this->assertDatabaseCount('user_credit_events', 0);
    }

    public function test_the_grace_period_can_be_switched_off(): void
    {
        config(['jwt.booking_room_auto_confirm_minutes' => 0]);
        $bookingId = $this->roomBooking(BookingStatus::APPROVED, now()->subDay());

        Artisan::call('bookings:auto-confirm-rooms');

        $this->assertSame(BookingStatus::APPROVED, Booking::find($bookingId)->status);
    }

    public function test_dry_run_counts_without_writing(): void
    {
        $bookingId = $this->roomBooking(BookingStatus::APPROVED, now()->subHours(2));

        Artisan::call('bookings:auto-confirm-rooms', ['--dry-run' => true]);

        $this->assertStringContainsString('1 peminjaman ruang memenuhi syarat', Artisan::output());
        $booking = Booking::find($bookingId);
        $this->assertSame(BookingStatus::APPROVED, $booking->status);
        $this->assertNull($booking->auto_confirmed_at);
    }

    public function test_an_already_finished_booking_is_not_touched_twice(): void
    {
        $end = now()->subHours(2);
        $bookingId = $this->roomBooking(BookingStatus::COMPLETED, $end, $end);

        Artisan::call('bookings:auto-confirm-rooms');

        $booking = Booking::find($bookingId);
        $this->assertNull($booking->auto_confirmed_at);
        $this->assertDatabaseCount('user_credit_events', 0);
    }

    public function test_the_scheduled_alternative_window_decides_the_deadline(): void
    {
        $alternativeEnd = now()->subHours(3);
        $bookingId = $this->roomBooking(BookingStatus::APPROVED, now()->subDay(), null, $alternativeEnd);

        Artisan::call('bookings:auto-confirm-rooms');

        $booking = Booking::find($bookingId);
        $this->assertSame(BookingStatus::COMPLETED, $booking->status);
        $this->assertSame($alternativeEnd->toDateTimeString(), $booking->returned_at->toDateTimeString());
    }

    private function roomBooking(
        BookingStatus $status,
        \DateTimeInterface $end,
        ?\DateTimeInterface $returnedAt = null,
        ?\DateTimeInterface $alternativeEnd = null,
    ): string {
        $bookingId = (string) Str::uuid();
        DB::table('bookings')->insert([
            'id' => $bookingId,
            'user_id' => $this->userId,
            'resource_type' => ResourceType::ROOM->value,
            'room_id' => $this->roomId,
            'responsible_name' => 'Pemohon',
            'phone_number' => '081234567890',
            'work_unit' => 'Biro Umum',
            'start_time' => now()->subDay(),
            'end_time' => $end,
            'alternative_start_time' => $alternativeEnd ? now()->subDay() : null,
            'alternative_end_time' => $alternativeEnd,
            'purpose' => 'Rapat koordinasi',
            'status' => $status->value,
            'returned_at' => $returnedAt,
        ]);

        return $bookingId;
    }
}
