<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\ResourceType;
use App\Enums\Role;
use App\Models\Booking;
use App\Services\CreditScoreService;
use App\Services\JwtService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

final class BookingWorkflowAndPendingMutationTest extends TestCase
{
    private string $userId;

    private string $pjId;

    private string $kabagId;

    private string $kasubagId;

    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('full_name')->nullable();
            $table->string('email')->nullable();
            $table->string('role');
            $table->integer('credit_score')->default(100);
            $table->timestamps();
        });
        $this->userId = (string) Str::uuid();
        $this->pjId = (string) Str::uuid();
        $this->kabagId = (string) Str::uuid();
        $this->kasubagId = (string) Str::uuid();
        DB::table('users')->insert([
            ['id' => $this->userId, 'full_name' => 'Pemohon Utama', 'email' => 'pemohon@example.test', 'role' => Role::PEMOHON->value],
            ['id' => $this->pjId, 'full_name' => 'PJ Ruangan Satu', 'email' => 'pj@example.test', 'role' => Role::PJ_RUANGAN->value],
            ['id' => $this->kabagId, 'full_name' => 'Kabag Umum Satu', 'email' => 'kabag@example.test', 'role' => Role::KABAG_UMUM->value],
            ['id' => $this->kasubagId, 'full_name' => 'Kasubag Umum Satu', 'email' => 'kasubag@example.test', 'role' => Role::KASUBAG_UMUM->value],
        ]);

        Schema::create('rooms', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->boolean('is_active')->default(true);
        });
        Schema::create('items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->unsignedInteger('total_stock');
            // Vehicle rows carry a plate, which is what makes the Surat Tugas mandatory.
            $table->string('plate_number', 20)->nullable();
            $table->boolean('is_active')->default(true);
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
            $table->dateTime('returned_at')->nullable();
            $table->dateTime('alternative_start_time')->nullable();
            $table->dateTime('alternative_end_time')->nullable();
            $table->uuid('alternative_room_id')->nullable();
            $table->text('approval_notes')->nullable();
            $table->text('inspection_notes')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->uuid('pj_reviewed_by')->nullable();
            $table->string('pj_reviewer_name')->nullable();
            $table->uuid('kasubag_reviewed_by')->nullable();
            $table->string('kasubag_reviewer_name')->nullable();
            $table->uuid('rejected_by')->nullable();
            $table->string('rejected_by_name')->nullable();
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
        Schema::create('room_booking_cancellations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('booking_id')->unique();
            $table->uuid('room_id')->nullable();
            $table->uuid('requested_by');
            $table->string('requested_by_name');
            $table->string('room_name');
            $table->string('work_unit');
            $table->string('responsible_name');
            $table->text('purpose')->nullable();
            $table->dateTime('booking_start_time');
            $table->dateTime('booking_end_time');
            $table->text('reason');
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
        Schema::create('user_credit_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('booking_id')->nullable()->unique();
            $table->integer('delta');
            $table->integer('score_after');
            $table->string('reason');
            $table->timestamps();
        });
    }

    public function test_new_booking_notifies_owner_room_manager_and_administrators(): void
    {
        $itemId = (string) Str::uuid();
        DB::table('items')->insert(['id' => $itemId, 'name' => 'Proyektor', 'total_stock' => 3, 'is_active' => true]);

        $response = $this->withToken($this->token(Role::PEMOHON, $this->userId))->postJson('/api/v1/bookings', [
            'resourceType' => ResourceType::ITEM->value,
            'items' => [['itemId' => $itemId, 'quantity' => 1]],
            'startTime' => now()->addDays(2)->toIso8601String(),
            'endTime' => now()->addDays(2)->addHours(2)->toIso8601String(),
            'purpose' => 'Rapat koordinasi notifikasi',
            'responsibleName' => 'Pemohon Profil',
            'phoneNumber' => '081234567890',
        ])->assertCreated();
        $bookingId = $response->json('data.id');

        $this->assertDatabaseHas('user_notifications', ['user_id' => $this->userId, 'booking_id' => $bookingId, 'type' => 'BOOKING_SUBMITTED']);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $this->pjId, 'booking_id' => $bookingId, 'type' => 'BOOKING_REVIEW_REQUIRED']);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $this->kabagId, 'booking_id' => $bookingId, 'type' => 'BOOKING_SUBMITTED']);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $this->kasubagId, 'booking_id' => $bookingId, 'type' => 'BOOKING_SUBMITTED']);
        $this->assertSame(4, DB::table('user_notifications')->where('booking_id', $bookingId)->count());

        $this->withToken($this->token(Role::PEMOHON, $this->userId))->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonPath('data.unreadCount', 1)
            ->assertJsonPath('data.notifications.0.type', 'BOOKING_SUBMITTED');
        $this->withToken($this->token(Role::PJ_RUANGAN, $this->pjId))->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonPath('data.unreadCount', 1)
            ->assertJsonPath('data.notifications.0.type', 'BOOKING_REVIEW_REQUIRED');
        $this->withToken($this->token(Role::KABAG_UMUM, $this->kabagId))->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonPath('data.unreadCount', 1)
            ->assertJsonPath('data.notifications.0.type', 'BOOKING_SUBMITTED');
    }

    public function test_workflow_requires_pj_preparation_before_kabag_approval(): void
    {
        $bookingId = $this->booking(BookingStatus::PENDING_PJ_REVIEW);

        $this->withToken($this->token(Role::PJ_RUANGAN, $this->pjId))->patchJson("/api/v1/bookings/{$bookingId}/pj-review", [
            'status' => BookingStatus::PREPARING->value,
        ])->assertOk()->assertJsonPath('data.status', BookingStatus::PREPARING->value);

        $this->withToken($this->token(Role::KASUBAG_UMUM))->patchJson("/api/v1/bookings/{$bookingId}/kabag-approve", [
            'status' => BookingStatus::APPROVED->value,
        ])->assertStatus(409);

        $this->withToken($this->token(Role::PJ_RUANGAN, $this->pjId))->patchJson("/api/v1/bookings/{$bookingId}/pj-confirm", [
            'status' => BookingStatus::PENDING_KABAG_APPROVAL->value,
        ])->assertOk()->assertJsonPath('data.status', BookingStatus::PENDING_KABAG_APPROVAL->value);

        $this->assertDatabaseMissing('user_notifications', ['user_id' => $this->kabagId, 'booking_id' => $bookingId, 'type' => 'BOOKING_APPROVAL_REQUIRED']);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $this->kasubagId, 'booking_id' => $bookingId, 'type' => 'BOOKING_APPROVAL_REQUIRED']);

        $this->withToken($this->token(Role::KASUBAG_UMUM, $this->kasubagId))->patchJson("/api/v1/bookings/{$bookingId}/kabag-approve", [
            'status' => BookingStatus::APPROVED->value,
        ])->assertOk()
            ->assertJsonPath('data.status', BookingStatus::APPROVED->value)
            ->assertJsonPath('data.pjReviewerName', 'PJ Ruangan Satu')
            ->assertJsonPath('data.kasubagReviewerName', 'Kasubag Umum Satu');

        $this->assertDatabaseHas('user_notifications', [
            'booking_id' => $bookingId,
            'type' => 'BOOKING_APPROVED',
        ]);
    }

    public function test_generic_status_endpoint_cannot_bypass_managed_workflow(): void
    {
        $bookingId = (string) Str::uuid();

        $this->withToken($this->token(Role::KABAG_UMUM))->patchJson("/api/v1/bookings/{$bookingId}/status", [
            'status' => BookingStatus::APPROVED->value,
        ])->assertNotFound();
    }

    public function test_owner_can_confirm_only_inside_the_loan_window(): void
    {
        $ownerId = (string) Str::uuid();
        $otherId = (string) Str::uuid();
        $finishedId = $this->booking(BookingStatus::APPROVED, $ownerId);
        DB::table('bookings')->where('id', $finishedId)->update(['start_time' => now()->subHours(2), 'end_time' => now()->subHour()]);
        $futureId = $this->booking(BookingStatus::APPROVED, $ownerId);
        $pendingId = $this->booking(BookingStatus::PENDING_PJ_REVIEW, $ownerId);

        $this->patchJson("/api/v1/bookings/{$finishedId}/confirm-finished")->assertUnauthorized();
        $this->withToken($this->token(Role::KABAG_UMUM))->patchJson("/api/v1/bookings/{$finishedId}/confirm-finished")->assertForbidden();
        $this->withToken($this->token(Role::PEMOHON, $otherId))->patchJson("/api/v1/bookings/{$finishedId}/confirm-finished")->assertNotFound();
        $this->withToken($this->token(Role::PEMOHON, $ownerId))->patchJson("/api/v1/bookings/{$futureId}/confirm-finished")->assertStatus(409);
        $this->withToken($this->token(Role::PEMOHON, $ownerId))->patchJson("/api/v1/bookings/{$pendingId}/confirm-finished")->assertStatus(409);
        $this->withToken($this->token(Role::PEMOHON, $ownerId))->patchJson("/api/v1/bookings/{$finishedId}/confirm-finished", ['status' => 'COMPLETED'])
            ->assertBadRequest();

        $this->withToken($this->token(Role::PEMOHON, $ownerId))->patchJson("/api/v1/bookings/{$finishedId}/confirm-finished")
            ->assertOk()
            ->assertJsonPath('data.status', BookingStatus::COMPLETED->value);
        $this->assertNotNull(DB::table('bookings')->where('id', $finishedId)->value('returned_at'));
    }

    public function test_room_booking_can_only_be_confirmed_after_its_scheduled_end(): void
    {
        $roomId = (string) Str::uuid();
        DB::table('rooms')->insert(['id' => $roomId, 'name' => 'Ruang Rapat Utama', 'is_active' => true]);
        $bookingId = $this->booking(BookingStatus::APPROVED, $this->userId, roomId: $roomId);
        DB::table('bookings')->where('id', $bookingId)->update([
            'start_time' => now()->subHour(),
            'end_time' => now()->addHour(),
        ]);

        $this->withToken($this->token(Role::PEMOHON, $this->userId))->patchJson("/api/v1/bookings/{$bookingId}/confirm-finished")
            ->assertStatus(409)
            ->assertJsonPath('error.message', 'Peminjaman ruang baru dapat dikonfirmasi selesai setelah jam pemakaian berakhir');

        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'status' => BookingStatus::APPROVED->value]);
    }

    public function test_room_booking_completion_does_not_change_the_credibility_score(): void
    {
        $ownerId = (string) Str::uuid();
        $roomId = (string) Str::uuid();
        DB::table('users')->insert(['id' => $ownerId, 'role' => Role::PEMOHON->value, 'credit_score' => 90]);
        DB::table('rooms')->insert(['id' => $roomId, 'name' => 'Ruang Rapat Utama', 'is_active' => true]);
        $bookingId = $this->booking(BookingStatus::APPROVED, $ownerId, null, $roomId);
        DB::table('bookings')->where('id', $bookingId)->update(['start_time' => now()->subHours(2), 'end_time' => now()->subHour()]);
        $booking = Booking::findOrFail($bookingId);

        $this->assertNull(app(CreditScoreService::class)->preview($booking, CarbonImmutable::now()));
        $this->withToken($this->token(Role::PEMOHON, $ownerId))->patchJson("/api/v1/bookings/{$bookingId}/confirm-finished")
            ->assertOk()
            ->assertJsonPath('data.status', BookingStatus::COMPLETED->value);

        $this->assertSame(90, (int) DB::table('users')->where('id', $ownerId)->value('credit_score'));
        $this->assertDatabaseMissing('user_credit_events', ['booking_id' => $bookingId]);
    }

    public function test_returning_an_item_on_time_awards_five_credibility_points(): void
    {
        $ownerId = (string) Str::uuid();
        DB::table('users')->insert(['id' => $ownerId, 'role' => Role::PEMOHON->value, 'credit_score' => 90]);
        $bookingId = $this->booking(BookingStatus::APPROVED, $ownerId);
        DB::table('bookings')->where('id', $bookingId)->update(['start_time' => now()->subHours(2), 'end_time' => now()->addHours(2)]);

        $response = $this->withToken($this->token(Role::PEMOHON, $ownerId))->patchJson("/api/v1/bookings/{$bookingId}/confirm-finished");
        $response->assertOk()->assertJsonPath('data.status', BookingStatus::COMPLETED->value);
        $this->assertNotNull($response->json('data.returnedAt'));

        $this->assertDatabaseHas('user_credit_events', [
            'user_id' => $ownerId,
            'booking_id' => $bookingId,
            'delta' => 5,
            'score_after' => 95,
            'reason' => 'RETURNED_ON_TIME',
        ]);
        $this->assertSame(95, (int) DB::table('users')->where('id', $ownerId)->value('credit_score'));
    }

    public function test_the_credibility_score_is_capped_at_one_hundred(): void
    {
        $ownerId = (string) Str::uuid();
        DB::table('users')->insert(['id' => $ownerId, 'role' => Role::PEMOHON->value, 'credit_score' => 98]);
        $bookingId = $this->booking(BookingStatus::APPROVED, $ownerId);
        DB::table('bookings')->where('id', $bookingId)->update(['start_time' => now()->subHours(2), 'end_time' => now()->addHours(2)]);

        $this->withToken($this->token(Role::PEMOHON, $ownerId))->patchJson("/api/v1/bookings/{$bookingId}/confirm-finished")->assertOk();

        $this->assertSame(100, (int) DB::table('users')->where('id', $ownerId)->value('credit_score'));
        $this->assertDatabaseHas('user_credit_events', ['booking_id' => $bookingId, 'delta' => 5, 'score_after' => 100]);
    }

    public function test_returning_after_the_due_time_deducts_five_credibility_points(): void
    {
        $ownerId = (string) Str::uuid();
        DB::table('users')->insert(['id' => $ownerId, 'role' => Role::PEMOHON->value, 'credit_score' => 100]);
        $bookingId = $this->booking(BookingStatus::APPROVED, $ownerId);
        DB::table('bookings')->where('id', $bookingId)->update(['start_time' => now()->subHours(4), 'end_time' => now()->subHour()]);

        $this->withToken($this->token(Role::PEMOHON, $ownerId))->patchJson("/api/v1/bookings/{$bookingId}/confirm-finished")
            ->assertOk()
            ->assertJsonPath('data.status', BookingStatus::COMPLETED->value);

        $this->assertDatabaseHas('user_credit_events', [
            'user_id' => $ownerId,
            'booking_id' => $bookingId,
            'delta' => -5,
            'score_after' => 95,
            'reason' => 'RETURNED_LATE',
        ]);
        $this->assertSame(95, (int) DB::table('users')->where('id', $ownerId)->value('credit_score'));
    }

    public function test_credibility_score_never_drops_below_zero(): void
    {
        $ownerId = (string) Str::uuid();
        DB::table('users')->insert(['id' => $ownerId, 'role' => Role::PEMOHON->value, 'credit_score' => 3]);
        $bookingId = $this->booking(BookingStatus::APPROVED, $ownerId);
        DB::table('bookings')->where('id', $bookingId)->update(['start_time' => now()->subHours(4), 'end_time' => now()->subHour()]);

        $this->withToken($this->token(Role::PEMOHON, $ownerId))->patchJson("/api/v1/bookings/{$bookingId}/confirm-finished")->assertOk();

        $this->assertSame(0, (int) DB::table('users')->where('id', $ownerId)->value('credit_score'));
        $this->assertDatabaseHas('user_credit_events', ['booking_id' => $bookingId, 'score_after' => 0]);
    }

    public function test_a_booking_moves_the_credibility_score_only_once(): void
    {
        $ownerId = (string) Str::uuid();
        DB::table('users')->insert(['id' => $ownerId, 'role' => Role::PEMOHON->value, 'credit_score' => 90]);
        $bookingId = $this->booking(BookingStatus::APPROVED, $ownerId);
        DB::table('bookings')->where('id', $bookingId)->update(['start_time' => now()->subHours(2), 'end_time' => now()->addHours(2)]);

        $this->withToken($this->token(Role::PEMOHON, $ownerId))->patchJson("/api/v1/bookings/{$bookingId}/confirm-finished")->assertOk();
        $this->assertSame(95, (int) DB::table('users')->where('id', $ownerId)->value('credit_score'));

        $this->assertNull(app(CreditScoreService::class)->recordReturn(Booking::findOrFail($bookingId), CarbonImmutable::now()));
        $this->assertSame(95, (int) DB::table('users')->where('id', $ownerId)->value('credit_score'));
        $this->assertSame(1, DB::table('user_credit_events')->where('booking_id', $bookingId)->count());
    }

    public function test_credit_scope_migration_removes_room_events_and_rebuilds_item_score(): void
    {
        $ownerId = (string) Str::uuid();
        $roomId = (string) Str::uuid();
        DB::table('users')->insert(['id' => $ownerId, 'role' => Role::PEMOHON->value, 'credit_score' => 90]);
        DB::table('rooms')->insert(['id' => $roomId, 'name' => 'Ruang Rapat Utama', 'is_active' => true]);
        $itemBookingId = $this->booking(BookingStatus::COMPLETED, $ownerId);
        $roomBookingId = $this->booking(BookingStatus::COMPLETED, $ownerId, null, $roomId);
        DB::table('user_credit_events')->insert([
            ['id' => (string) Str::uuid(), 'user_id' => $ownerId, 'booking_id' => $itemBookingId, 'delta' => -5, 'score_after' => 95, 'reason' => 'RETURNED_LATE', 'created_at' => now()->subMinute(), 'updated_at' => now()->subMinute()],
            ['id' => (string) Str::uuid(), 'user_id' => $ownerId, 'booking_id' => $roomBookingId, 'delta' => -5, 'score_after' => 90, 'reason' => 'RETURNED_LATE', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $migration = require database_path('migrations/2026_09_23_000000_limit_credit_score_to_item_bookings.php');
        $migration->up();

        $this->assertDatabaseHas('user_credit_events', ['booking_id' => $itemBookingId, 'score_after' => 95]);
        $this->assertDatabaseMissing('user_credit_events', ['booking_id' => $roomBookingId]);
        $this->assertSame(95, (int) DB::table('users')->where('id', $ownerId)->value('credit_score'));
    }

    public function test_only_owner_can_update_pending_booking_and_item_availability_is_rechecked(): void
    {
        $ownerId = (string) Str::uuid();
        $otherId = (string) Str::uuid();
        $bookingId = $this->booking(BookingStatus::PENDING_PJ_REVIEW, $ownerId);
        $itemId = (string) Str::uuid();
        DB::table('items')->insert(['id' => $itemId, 'name' => 'Proyektor', 'total_stock' => 2, 'is_active' => true]);
        $payload = [
            'resourceType' => ResourceType::ITEM->value,
            'items' => [['itemId' => $itemId, 'quantity' => 2]],
            'startTime' => now()->addDays(2)->toIso8601String(),
            'endTime' => now()->addDays(2)->addHours(2)->toIso8601String(),
            'purpose' => 'Rapat koordinasi baru',
            'responsibleName' => 'Budi Santoso',
            'phoneNumber' => '081234567890',
        ];

        $availability = [
            'resourceType' => ResourceType::ITEM->value,
            'itemId' => $itemId,
            'quantity' => 2,
            'startTime' => $payload['startTime'],
            'endTime' => $payload['endTime'],
            'bookingId' => $bookingId,
        ];

        $this->putJson("/api/v1/bookings/{$bookingId}", $payload)->assertUnauthorized();
        $this->withToken($this->token(Role::PEMOHON, $otherId))->getJson('/api/v1/bookings/availability?'.http_build_query($availability))->assertNotFound();
        $this->withToken($this->token(Role::PEMOHON, $ownerId))->getJson('/api/v1/bookings/availability?'.http_build_query($availability))
            ->assertOk()
            ->assertJsonPath('data.available', true);

        $this->withToken($this->token(Role::PJ_RUANGAN))->putJson("/api/v1/bookings/{$bookingId}", $payload)->assertForbidden();
        $this->withToken($this->token(Role::PEMOHON, $otherId))->putJson("/api/v1/bookings/{$bookingId}", $payload)->assertNotFound();

        $this->withToken($this->token(Role::PEMOHON, $ownerId))->putJson("/api/v1/bookings/{$bookingId}", $payload)
            ->assertOk()
            ->assertJsonPath('data.purpose', 'Rapat koordinasi baru')
            ->assertJsonPath('data.responsibleName', 'Budi Santoso')
            ->assertJsonPath('data.bookingItems.0.quantity', 2);
    }

    public function test_administrator_can_offer_an_available_alternative_room_only_for_main_meeting_room(): void
    {
        $mainRoomId = (string) Str::uuid();
        $alternativeRoomId = (string) Str::uuid();
        DB::table('rooms')->insert([
            ['id' => $mainRoomId, 'name' => 'Ruang Rapat Utama', 'is_active' => true],
            ['id' => $alternativeRoomId, 'name' => 'Ruang Rapat Lantai 2', 'is_active' => true],
        ]);
        $bookingId = $this->booking(BookingStatus::PENDING_KABAG_APPROVAL, roomId: $mainRoomId);
        $date = now('Asia/Jakarta')->addDays(3)->format('Y-m-d');

        $this->withToken($this->token(Role::KASUBAG_UMUM))->patchJson("/api/v1/bookings/{$bookingId}/alternative", [
            'alternativeRoomId' => $alternativeRoomId,
            'alternativeDate' => $date,
            'alternativeRoomSlot' => 'FULL_DAY',
        ])->assertOk()
            ->assertJsonPath('data.status', BookingStatus::APPROVED->value)
            ->assertJsonPath('data.alternativeRoom.id', $alternativeRoomId);

        // The server derives the hours from "Pengaturan Jam Ruangan", never the client.
        $stored = DB::table('bookings')->where('id', $bookingId)->first();
        $this->assertSame($date.' 08:00', CarbonImmutable::parse($stored->alternative_start_time)->setTimezone('Asia/Jakarta')->format('Y-m-d H:i'));
        $endDate = CarbonImmutable::createFromFormat('Y-m-d', $date, 'Asia/Jakarta')->addDay()->format('Y-m-d');
        $this->assertSame($endDate.' 16:00', CarbonImmutable::parse($stored->alternative_end_time)->setTimezone('Asia/Jakarta')->format('Y-m-d H:i'));

        $this->assertDatabaseHas('bookings', [
            'id' => $bookingId,
            'alternative_room_id' => $alternativeRoomId,
            'status' => BookingStatus::APPROVED->value,
        ]);
        $this->assertDatabaseHas('user_notifications', ['booking_id' => $bookingId, 'type' => 'BOOKING_RELOCATED']);
    }

    public function test_pj_can_offer_an_alternative_only_after_kasubag_approval(): void
    {
        $mainRoomId = (string) Str::uuid();
        $alternativeRoomId = (string) Str::uuid();
        DB::table('rooms')->insert([
            ['id' => $mainRoomId, 'name' => 'Ruang Rapat Utama', 'is_active' => true],
            ['id' => $alternativeRoomId, 'name' => 'Ruang Rapat Lantai 2', 'is_active' => true],
        ]);
        $pendingId = $this->booking(BookingStatus::PENDING_KABAG_APPROVAL, roomId: $mainRoomId);
        $approvedId = $this->booking(BookingStatus::APPROVED, roomId: $mainRoomId);
        $payload = [
            'alternativeRoomId' => $alternativeRoomId,
            'alternativeDate' => now('Asia/Jakarta')->addDays(3)->format('Y-m-d'),
            'alternativeRoomSlot' => 'FULL_DAY',
        ];

        $this->withToken($this->token(Role::PJ_RUANGAN, $this->pjId))->patchJson("/api/v1/bookings/{$pendingId}/alternative", $payload)
            ->assertStatus(409)
            ->assertJsonPath('error.message', 'PJ Ruangan hanya dapat memberikan alternatif setelah peminjaman disetujui');

        $this->withToken($this->token(Role::PJ_RUANGAN, $this->pjId))->patchJson("/api/v1/bookings/{$approvedId}/alternative", $payload)
            ->assertOk()
            ->assertJsonPath('data.alternativeRoom.id', $alternativeRoomId);
    }

    public function test_alternative_offer_rejects_non_main_room_and_conflicting_room(): void
    {
        $mainRoomId = (string) Str::uuid();
        $otherRoomId = (string) Str::uuid();
        DB::table('rooms')->insert([
            ['id' => $mainRoomId, 'name' => 'Ruang Rapat Utama', 'is_active' => true],
            ['id' => $otherRoomId, 'name' => 'Ruang Rapat Lantai 2', 'is_active' => true],
        ]);
        $date = now('Asia/Jakarta')->addDays(3)->format('Y-m-d');
        $conflictStart = CarbonImmutable::createFromFormat('Y-m-d H:i', $date.' 08:00', 'Asia/Jakarta');
        $conflictingId = $this->booking(BookingStatus::APPROVED, roomId: $otherRoomId);
        DB::table('bookings')->where('id', $conflictingId)->update(['start_time' => $conflictStart->utc(), 'end_time' => $conflictStart->addHours(4)->utc()]);
        $mainBookingId = $this->booking(BookingStatus::PENDING_KABAG_APPROVAL, roomId: $mainRoomId);
        $nonMainBookingId = $this->booking(BookingStatus::PENDING_KABAG_APPROVAL, roomId: $otherRoomId);
        $payload = [
            'alternativeRoomId' => $otherRoomId,
            'alternativeDate' => $date,
            'alternativeRoomSlot' => 'FULL_DAY',
        ];

        $this->withToken($this->token(Role::KASUBAG_UMUM))->patchJson("/api/v1/bookings/{$nonMainBookingId}/alternative", $payload)
            ->assertStatus(409);
        $this->withToken($this->token(Role::KASUBAG_UMUM))->patchJson("/api/v1/bookings/{$mainBookingId}/alternative", $payload)
            ->assertStatus(409);
    }

    public function test_alternative_offer_requires_room_date_and_session(): void
    {
        $mainRoomId = (string) Str::uuid();
        $otherRoomId = (string) Str::uuid();
        DB::table('rooms')->insert([
            ['id' => $mainRoomId, 'name' => 'Ruang Rapat Utama', 'is_active' => true],
            ['id' => $otherRoomId, 'name' => 'Ruang Rapat Lantai 2', 'is_active' => true],
        ]);
        $bookingId = $this->booking(BookingStatus::PENDING_KABAG_APPROVAL, roomId: $mainRoomId);
        $date = now('Asia/Jakarta')->addDays(3)->format('Y-m-d');

        $this->withToken($this->token(Role::KASUBAG_UMUM))->patchJson("/api/v1/bookings/{$bookingId}/alternative", [
            'alternativeRoomId' => $otherRoomId,
            'alternativeDate' => $date,
        ])->assertBadRequest()
            ->assertJsonPath('error.details.alternativeRoomId.0', 'Ruang, tanggal, dan kategori jam alternatif wajib diisi');

        $this->withToken($this->token(Role::KASUBAG_UMUM))->patchJson("/api/v1/bookings/{$bookingId}/alternative", [
            'alternativeRoomId' => $otherRoomId,
            'alternativeDate' => $date,
            'alternativeRoomSlot' => 'CUSTOM',
        ])->assertBadRequest()->assertJsonPath('error.message', 'Data tidak valid');
    }

    public function test_multi_day_alternative_keeps_the_original_day_span_and_requires_the_full_day_session(): void
    {
        $mainRoomId = (string) Str::uuid();
        $alternativeRoomId = (string) Str::uuid();
        DB::table('rooms')->insert([
            ['id' => $mainRoomId, 'name' => 'Ruang Rapat Utama', 'is_active' => true],
            ['id' => $alternativeRoomId, 'name' => 'Ruang Rapat Lantai 2', 'is_active' => true],
        ]);
        $bookingId = $this->booking(BookingStatus::PENDING_KABAG_APPROVAL, roomId: $mainRoomId);
        $originalStart = CarbonImmutable::parse(now('Asia/Jakarta')->addDays(2)->format('Y-m-d').' 08:00', 'Asia/Jakarta');
        DB::table('bookings')->where('id', $bookingId)->update([
            'start_time' => $originalStart->utc(),
            'end_time' => $originalStart->addDays(2)->setTime(16, 0)->utc(),
        ]);
        $date = now('Asia/Jakarta')->addDays(6)->format('Y-m-d');

        // A three-day request cannot be squeezed into a single-day session.
        $this->withToken($this->token(Role::KASUBAG_UMUM))->patchJson("/api/v1/bookings/{$bookingId}/alternative", [
            'alternativeRoomId' => $alternativeRoomId,
            'alternativeDate' => $date,
            'alternativeRoomSlot' => 'MORNING',
        ])->assertBadRequest()
            ->assertJsonPath('error.message', 'Peminjaman lebih dari satu hari wajib menggunakan kategori sehari penuh');

        $this->withToken($this->token(Role::KASUBAG_UMUM))->patchJson("/api/v1/bookings/{$bookingId}/alternative", [
            'alternativeRoomId' => $alternativeRoomId,
            'alternativeDate' => $date,
            'alternativeRoomSlot' => 'FULL_DAY',
        ])->assertOk();

        $stored = DB::table('bookings')->where('id', $bookingId)->first();
        $expectedEnd = CarbonImmutable::createFromFormat('Y-m-d', $date, 'Asia/Jakarta')->addDays(2)->format('Y-m-d');
        $this->assertSame($date.' 08:00', CarbonImmutable::parse($stored->alternative_start_time)->setTimezone('Asia/Jakarta')->format('Y-m-d H:i'));
        $this->assertSame($expectedEnd.' 16:00', CarbonImmutable::parse($stored->alternative_end_time)->setTimezone('Asia/Jakarta')->format('Y-m-d H:i'));
    }

    public function test_alternative_offer_is_rejected_once_the_booking_window_has_passed(): void
    {
        $mainRoomId = (string) Str::uuid();
        $alternativeRoomId = (string) Str::uuid();
        DB::table('rooms')->insert([
            ['id' => $mainRoomId, 'name' => 'Ruang Rapat Utama', 'is_active' => true],
            ['id' => $alternativeRoomId, 'name' => 'Ruang Rapat Lantai 2', 'is_active' => true],
        ]);
        $bookingId = $this->booking(BookingStatus::APPROVED, roomId: $mainRoomId);
        DB::table('bookings')->where('id', $bookingId)->update([
            'start_time' => now()->subDays(2),
            'end_time' => now()->subDay(),
        ]);

        $this->withToken($this->token(Role::KASUBAG_UMUM))->patchJson("/api/v1/bookings/{$bookingId}/alternative", [
            'alternativeRoomId' => $alternativeRoomId,
            'alternativeDate' => now('Asia/Jakarta')->addDays(3)->format('Y-m-d'),
            'alternativeRoomSlot' => 'FULL_DAY',
        ])->assertStatus(409)
            ->assertJsonPath('error.message', 'Masa peminjaman sudah berakhir sehingga alternatif ruangan tidak dapat diberikan');

        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'alternative_room_id' => null]);
    }

    public function test_approved_main_room_booking_can_be_relocated_repeatedly_and_notifies_only_owner(): void
    {
        $ownerId = (string) Str::uuid();
        $otherUserId = (string) Str::uuid();
        $mainRoomId = (string) Str::uuid();
        $firstAlternativeId = (string) Str::uuid();
        $secondAlternativeId = (string) Str::uuid();
        DB::table('rooms')->insert([
            ['id' => $mainRoomId, 'name' => 'Ruang Rapat Utama', 'is_active' => true],
            ['id' => $firstAlternativeId, 'name' => 'Ruang Rapat A', 'is_active' => true],
            ['id' => $secondAlternativeId, 'name' => 'Ruang Rapat B', 'is_active' => true],
        ]);
        $bookingId = $this->booking(BookingStatus::APPROVED, $ownerId, roomId: $mainRoomId);
        $firstDate = now('Asia/Jakarta')->addDays(4)->startOfDay();

        foreach ([$firstAlternativeId, $secondAlternativeId] as $index => $roomId) {
            $this->withToken($this->token(Role::KASUBAG_UMUM))->patchJson("/api/v1/bookings/{$bookingId}/alternative", [
                'alternativeRoomId' => $roomId,
                'alternativeDate' => $firstDate->copy()->addDays($index)->format('Y-m-d'),
                'alternativeRoomSlot' => 'FULL_DAY',
            ])->assertOk()
                ->assertJsonPath('data.status', BookingStatus::APPROVED->value)
                ->assertJsonPath('data.alternativeRoomId', $roomId);
        }

        $this->withToken($this->token(Role::PEMOHON, $ownerId))->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonCount(2, 'data.notifications')
            ->assertJsonPath('data.unreadCount', 2)
            ->assertJsonPath('data.notifications.0.type', 'BOOKING_RELOCATED');
        $this->withToken($this->token(Role::PEMOHON, $otherUserId))->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonCount(0, 'data.notifications');

        $notificationId = DB::table('user_notifications')->where('user_id', $ownerId)->value('id');
        $this->withToken($this->token(Role::PEMOHON, $otherUserId))->patchJson("/api/v1/notifications/{$notificationId}/read")
            ->assertNotFound();
        $this->withToken($this->token(Role::PEMOHON, $ownerId))->patchJson("/api/v1/notifications/{$notificationId}/read")
            ->assertOk();
    }

    public function test_pj_can_cancel_an_approved_room_and_kasubag_receives_history_and_notification(): void
    {
        $roomId = (string) Str::uuid();
        DB::table('rooms')->insert(['id' => $roomId, 'name' => 'Ruang Rapat Utama', 'is_active' => true]);
        $bookingId = $this->booking(BookingStatus::APPROVED, $this->userId, roomId: $roomId);
        DB::table('bookings')->where('id', $bookingId)->update([
            'responsible_name' => 'Budi Santoso',
            'work_unit' => 'Bagian Umum',
        ]);

        $this->withToken($this->token(Role::PEMOHON, $this->userId))->postJson('/api/v1/room-booking-cancellations', [
            'bookingId' => $bookingId,
            'reason' => 'Agenda dibatalkan pimpinan',
        ])->assertForbidden();

        $this->withToken($this->token(Role::PJ_RUANGAN, $this->pjId))->postJson('/api/v1/room-booking-cancellations', [
            'bookingId' => $bookingId,
            'reason' => 'Agenda dibatalkan pimpinan',
        ])->assertCreated()
            ->assertJsonPath('data.roomName', 'Ruang Rapat Utama')
            ->assertJsonPath('data.workUnit', 'Bagian Umum')
            ->assertJsonPath('data.responsibleName', 'Budi Santoso')
            ->assertJsonPath('data.purpose', 'Rapat koordinasi')
            ->assertJsonPath('data.requestedByName', 'PJ Ruangan Satu');

        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'status' => BookingStatus::CANCELLED->value]);
        $this->assertDatabaseHas('user_notifications', [
            'user_id' => $this->kasubagId,
            'booking_id' => $bookingId,
            'type' => 'ROOM_BOOKING_CANCELLED',
        ]);

        $this->withToken($this->token(Role::KASUBAG_UMUM, $this->kasubagId))->getJson('/api/v1/room-booking-cancellations')
            ->assertOk()
            ->assertJsonPath('data.0.bookingId', $bookingId)
            ->assertJsonPath('data.0.purpose', 'Rapat koordinasi')
            ->assertJsonPath('data.0.reason', 'Agenda dibatalkan pimpinan');
    }

    public function test_processing_actor_names_are_visible_only_to_pj_and_kasubag(): void
    {
        $bookingId = $this->booking(BookingStatus::APPROVED, $this->userId);
        DB::table('bookings')->where('id', $bookingId)->update([
            'pj_reviewed_by' => $this->pjId,
            'pj_reviewer_name' => 'PJ Ruangan Satu',
            'kasubag_reviewed_by' => $this->kasubagId,
            'kasubag_reviewer_name' => 'Kasubag Umum Satu',
            'rejected_by' => $this->kasubagId,
            'rejected_by_name' => 'Kasubag Umum Satu',
        ]);

        $this->withToken($this->token(Role::PEMOHON, $this->userId))->getJson('/api/v1/bookings/my')
            ->assertOk()
            ->assertJsonMissingPath('data.0.pjReviewerName')
            ->assertJsonMissingPath('data.0.kasubagReviewerName')
            ->assertJsonMissingPath('data.0.rejectedByName');

        $this->withToken($this->token(Role::KABAG_UMUM, $this->kabagId))->getJson('/api/v1/bookings')
            ->assertOk()
            ->assertJsonMissingPath('data.0.pjReviewerName')
            ->assertJsonMissingPath('data.0.kasubagReviewerName')
            ->assertJsonMissingPath('data.0.rejectedByName');

        foreach ([[Role::PJ_RUANGAN, $this->pjId], [Role::KASUBAG_UMUM, $this->kasubagId]] as [$role, $userId]) {
            $this->withToken($this->token($role, $userId))->getJson('/api/v1/bookings')
                ->assertOk()
                ->assertJsonPath('data.0.pjReviewerName', 'PJ Ruangan Satu')
                ->assertJsonPath('data.0.kasubagReviewerName', 'Kasubag Umum Satu')
                ->assertJsonPath('data.0.rejectedByName', 'Kasubag Umum Satu');
        }
    }

    public function test_pending_delete_checks_owner_and_status_then_removes_private_document(): void
    {
        Storage::fake('local');
        $ownerId = (string) Str::uuid();
        $path = 'booking-documents/'.Str::uuid().'.pdf';
        Storage::disk('local')->put($path, '%PDF-private');
        $pendingId = $this->booking(BookingStatus::PENDING_PJ_REVIEW, $ownerId, $path);
        $processedId = $this->booking(BookingStatus::PREPARING, $ownerId);

        $this->withToken($this->token(Role::PEMOHON))->deleteJson("/api/v1/bookings/{$pendingId}")->assertNotFound();
        $this->withToken($this->token(Role::PEMOHON, $ownerId))->deleteJson("/api/v1/bookings/{$processedId}")->assertStatus(409);
        $this->withToken($this->token(Role::PEMOHON, $ownerId))->deleteJson("/api/v1/bookings/{$pendingId}")
            ->assertOk()
            ->assertJsonPath('data.message', 'Pengajuan berhasil dihapus');

        $this->assertDatabaseMissing('bookings', ['id' => $pendingId]);
        Storage::disk('local')->assertMissing($path);
    }

    private function booking(BookingStatus $status, ?string $userId = null, ?string $documentPath = null, ?string $roomId = null): string
    {
        $id = (string) Str::uuid();
        DB::table('bookings')->insert([
            'id' => $id,
            'user_id' => $userId ?? (string) Str::uuid(),
            'resource_type' => $roomId ? ResourceType::ROOM->value : ResourceType::ITEM->value,
            'room_id' => $roomId,
            'start_time' => now()->addDays(2),
            'end_time' => now()->addDays(2)->addHour(),
            'purpose' => 'Rapat koordinasi',
            'status' => $status->value,
            'document_disk' => $documentPath ? 'local' : null,
            'document_path' => $documentPath,
            'document_original_name' => $documentPath ? 'surat.pdf' : null,
            'document_mime' => $documentPath ? 'application/pdf' : null,
            'document_size' => $documentPath ? 12 : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }

    private function token(Role $role, ?string $userId = null): string
    {
        return app(JwtService::class)->access($userId ?? (string) Str::uuid(), $role);
    }
}
