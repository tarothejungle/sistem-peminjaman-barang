<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\Role;
use App\Models\Booking;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Support\Str;

final class BookingNotificationService
{
    public function bookingCreated(Booking $booking): void
    {
        $this->createForUsers(
            [$booking->user_id],
            $booking,
            'BOOKING_SUBMITTED',
            'Pengajuan berhasil dikirim',
            'Pengajuan peminjaman Anda berhasil dikirim dan sedang menunggu pemeriksaan PJ Ruangan.',
        );
        $this->createForRoles(
            [Role::PJ_RUANGAN],
            $booking,
            'BOOKING_REVIEW_REQUIRED',
            'Pengajuan baru menunggu pemeriksaan',
            'Terdapat pengajuan peminjaman baru yang perlu diperiksa.',
        );
        $this->createForRoles(
            Role::administrators(),
            $booking,
            'BOOKING_SUBMITTED',
            'Pengajuan baru diterima',
            'Terdapat pengajuan peminjaman baru yang sedang menunggu pemeriksaan PJ Ruangan.',
        );
    }

    public function owner(Booking $booking, string $type, string $title, string $message): void
    {
        $this->createForUsers([$booking->user_id], $booking, $type, $title, $message);
    }

    /** @param list<Role> $roles */
    public function roles(Booking $booking, array $roles, string $type, string $title, string $message): void
    {
        $this->createForRoles($roles, $booking, $type, $title, $message);
    }

    /** @param list<Role> $roles */
    private function createForRoles(array $roles, Booking $booking, string $type, string $title, string $message): void
    {
        $userIds = User::query()->whereIn('role', array_map(fn (Role $role): string => $role->value, $roles))->pluck('id')->all();
        $this->createForUsers($userIds, $booking, $type, $title, $message);
    }

    /** @param list<string> $userIds */
    private function createForUsers(array $userIds, Booking $booking, string $type, string $title, string $message): void
    {
        $now = now();
        $rows = collect($userIds)->unique()->map(fn (string $userId): array => [
            'id' => (string) Str::uuid(),
            'user_id' => $userId,
            'booking_id' => $booking->id,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        if ($rows !== []) {
            UserNotification::query()->insert($rows);
        }
    }
}
