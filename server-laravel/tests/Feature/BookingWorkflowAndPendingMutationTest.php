<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\ResourceType;
use App\Enums\Role;
use App\Services\JwtService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

final class BookingWorkflowAndPendingMutationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('rooms', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->boolean('is_active')->default(true);
        });
        Schema::create('items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->unsignedInteger('total_stock');
            $table->boolean('is_active')->default(true);
        });
        Schema::create('bookings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('resource_type');
            $table->uuid('room_id')->nullable();
            $table->dateTime('start_time');
            $table->dateTime('end_time');
            $table->text('purpose');
            $table->string('status');
            $table->dateTime('alternative_start_time')->nullable();
            $table->dateTime('alternative_end_time')->nullable();
            $table->text('approval_notes')->nullable();
            $table->text('inspection_notes')->nullable();
            $table->text('rejection_reason')->nullable();
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
    }

    public function test_workflow_requires_pj_preparation_before_kabag_approval(): void
    {
        $bookingId = $this->booking(BookingStatus::PENDING_PJ_REVIEW);

        $this->withToken($this->token(Role::PJ_RUANGAN))->patchJson("/api/v1/bookings/{$bookingId}/pj-review", [
            'status' => BookingStatus::PREPARING->value,
        ])->assertOk()->assertJsonPath('data.status', BookingStatus::PREPARING->value);

        $this->withToken($this->token(Role::KABAG_UMUM))->patchJson("/api/v1/bookings/{$bookingId}/kabag-approve", [
            'status' => BookingStatus::APPROVED->value,
        ])->assertStatus(409);

        $this->withToken($this->token(Role::PJ_RUANGAN))->patchJson("/api/v1/bookings/{$bookingId}/pj-confirm", [
            'status' => BookingStatus::PENDING_KABAG_APPROVAL->value,
        ])->assertOk()->assertJsonPath('data.status', BookingStatus::PENDING_KABAG_APPROVAL->value);

        $this->withToken($this->token(Role::KABAG_UMUM))->patchJson("/api/v1/bookings/{$bookingId}/kabag-approve", [
            'status' => BookingStatus::APPROVED->value,
        ])->assertOk()->assertJsonPath('data.status', BookingStatus::APPROVED->value);
    }

    public function test_generic_status_endpoint_cannot_bypass_managed_workflow(): void
    {
        $bookingId = (string) Str::uuid();

        $this->withToken($this->token(Role::KABAG_UMUM))->patchJson("/api/v1/bookings/{$bookingId}/status", [
            'status' => BookingStatus::APPROVED->value,
        ])->assertNotFound();
    }

    public function test_owner_can_confirm_approved_booking_only_after_end_time(): void
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
            ->assertJsonPath('data.bookingItems.0.quantity', 2);
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

    private function booking(BookingStatus $status, ?string $userId = null, ?string $documentPath = null): string
    {
        $id = (string) Str::uuid();
        DB::table('bookings')->insert([
            'id' => $id,
            'user_id' => $userId ?? (string) Str::uuid(),
            'resource_type' => ResourceType::ITEM->value,
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
