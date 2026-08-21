<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\Role;
use App\Services\JwtService;
use Tests\TestCase;

final class BookingAuthorizationAndRejectionTest extends TestCase
{
    public function test_only_user_role_can_reach_booking_creation_validation(): void
    {
        $this->postJson('/api/v1/bookings', [])->assertUnauthorized();
        $this->withToken($this->token(Role::PJ_RUANGAN))->postJson('/api/v1/bookings', [])->assertForbidden();
        $this->withToken($this->token(Role::KABAG_UMUM))->postJson('/api/v1/bookings', [])->assertForbidden();
        $this->withToken($this->token(Role::PEMOHON))->postJson('/api/v1/bookings', [])
            ->assertBadRequest()
            ->assertJsonPath('error.message', 'Data tidak valid');
    }

    public function test_only_user_role_can_query_strict_availability_endpoint(): void
    {
        $this->getJson('/api/v1/bookings/availability')->assertUnauthorized();
        $this->withToken($this->token(Role::PJ_RUANGAN))->getJson('/api/v1/bookings/availability')->assertForbidden();
        $this->withToken($this->token(Role::KABAG_UMUM))->getJson('/api/v1/bookings/availability')->assertForbidden();
        $this->withToken($this->token(Role::PEMOHON))->getJson('/api/v1/bookings/availability?role=KABAG_UMUM')
            ->assertBadRequest()
            ->assertJsonPath('error.message', 'Data tidak valid');
    }

    public function test_pj_rejection_requires_reason_before_database_access(): void
    {
        $bookingId = fake()->uuid();

        $this->withToken($this->token(Role::PJ_RUANGAN))->patchJson("/api/v1/bookings/{$bookingId}/pj-review", [
            'status' => BookingStatus::REJECTED->value,
        ])->assertBadRequest()
            ->assertJsonPath('error.message', 'Data tidak valid')
            ->assertJsonPath('error.details.rejectionReason.0', 'Alasan penolakan wajib diisi');
    }

    public function test_kabag_rejection_requires_reason_before_database_access(): void
    {
        $bookingId = fake()->uuid();

        $this->withToken($this->token(Role::KABAG_UMUM))->patchJson("/api/v1/bookings/{$bookingId}/kabag-approve", [
            'status' => BookingStatus::REJECTED->value,
        ])->assertBadRequest()
            ->assertJsonPath('error.message', 'Data tidak valid')
            ->assertJsonPath('error.details.rejectionReason.0', 'Alasan penolakan wajib diisi');
    }

    private function token(Role $role): string
    {
        return app(JwtService::class)->access(fake()->uuid(), $role);
    }
}
