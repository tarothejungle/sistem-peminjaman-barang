<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\ResourceType;
use App\Enums\Role;
use App\Services\JwtService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

final class BookingAvailabilitySummaryTest extends TestCase
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
            $table->timestamps();
        });
        Schema::create('booking_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('booking_id');
            $table->uuid('item_id');
            $table->integer('quantity');
        });
    }

    public function test_summary_is_available_to_user_and_kabag_but_excludes_borrower_details(): void
    {
        $this->getJson('/api/v1/bookings/availability-summary')->assertUnauthorized();
        $this->withToken($this->token(Role::PJ_RUANGAN))->getJson('/api/v1/bookings/availability-summary')->assertForbidden();

        $roomId = (string) Str::uuid();
        $itemId = (string) Str::uuid();
        $userId = (string) Str::uuid();
        $roomBookingId = $this->insertBooking($userId, ResourceType::ROOM, $roomId, now()->subMinutes(10), now()->addHour());
        $itemBookingId = $this->insertBooking($userId, ResourceType::ITEM, null, now()->subMinutes(5), now()->addHours(2));
        DB::table('booking_items')->insert(['id' => Str::uuid(), 'booking_id' => $itemBookingId, 'item_id' => $itemId, 'quantity' => 3]);

        $response = $this->withToken($this->token(Role::PEMOHON))->getJson('/api/v1/bookings/availability-summary')
            ->assertOk()
            ->assertJsonPath('data.rooms.0.resourceId', $roomId)
            ->assertJsonPath('data.rooms.0.state', 'IN_USE')
            ->assertJsonPath('data.items.0.resourceId', $itemId)
            ->assertJsonPath('data.items.0.reservedNow', 3);
        $this->withToken($this->token(Role::KABAG_UMUM))->getJson('/api/v1/bookings/availability-summary')
            ->assertOk()
            ->assertJsonPath('data.rooms.0.state', 'IN_USE');

        $content = $response->getContent();
        $this->assertStringNotContainsString($userId, $content);
        $this->assertStringNotContainsString($roomBookingId, $content);
        $this->assertStringNotContainsString('Rahasia peminjaman', $content);
        $this->assertStringNotContainsString('userId', $content);
    }

    public function test_summary_only_tracks_approved_operations_until_owner_confirmation(): void
    {
        $approvedRoom = (string) Str::uuid();
        $pendingRoom = (string) Str::uuid();
        $userId = (string) Str::uuid();
        $this->insertBooking($userId, ResourceType::ROOM, $approvedRoom, now()->subHours(2), now()->subHour());
        $pendingId = $this->insertBooking($userId, ResourceType::ROOM, $pendingRoom, now()->subMinutes(10), now()->addHour());
        DB::table('bookings')->where('id', $pendingId)->update(['status' => BookingStatus::PENDING_KABAG_APPROVAL->value]);

        $response = $this->withToken($this->token(Role::KABAG_UMUM))->getJson('/api/v1/bookings/availability-summary')
            ->assertOk()
            ->assertJsonCount(1, 'data.rooms')
            ->assertJsonPath('data.rooms.0.resourceId', $approvedRoom)
            ->assertJsonPath('data.rooms.0.state', 'AWAITING_CONFIRMATION');

        $this->assertStringNotContainsString($pendingRoom, $response->getContent());
    }

    public function test_current_room_usage_has_priority_over_overdue_confirmation(): void
    {
        $roomId = (string) Str::uuid();
        $userId = (string) Str::uuid();
        $this->insertBooking($userId, ResourceType::ROOM, $roomId, now()->subHours(3), now()->subHours(2));
        $this->insertBooking($userId, ResourceType::ROOM, $roomId, now()->subMinutes(10), now()->addHour());

        $this->withToken($this->token(Role::KABAG_UMUM))->getJson('/api/v1/bookings/availability-summary')
            ->assertOk()
            ->assertJsonCount(1, 'data.rooms')
            ->assertJsonPath('data.rooms.0.state', 'IN_USE');
    }

    private function insertBooking(string $userId, ResourceType $type, ?string $roomId, $start, $end): string
    {
        $id = (string) Str::uuid();
        DB::table('bookings')->insert([
            'id' => $id,
            'user_id' => $userId,
            'resource_type' => $type->value,
            'room_id' => $roomId,
            'start_time' => $start,
            'end_time' => $end,
            'purpose' => 'Rahasia peminjaman',
            'status' => BookingStatus::APPROVED->value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }

    private function token(Role $role): string
    {
        return app(JwtService::class)->access((string) Str::uuid(), $role);
    }
}
