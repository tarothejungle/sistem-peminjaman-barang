<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\ResourceType;
use App\Enums\Role;
use App\Exceptions\ApiException;
use App\Models\Booking;
use App\Models\RoomBookingCancellation;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final class RoomBookingCancellationService
{
    public function __construct(private readonly BookingNotificationService $notifications) {}

    public function options()
    {
        return Booking::query()
            ->with(['room', 'alternativeRoom', 'user:id,full_name,email,role'])
            ->where('resource_type', ResourceType::ROOM->value)
            ->whereIn('status', [BookingStatus::APPROVED->value, BookingStatus::IN_USE->value])
            ->orderBy('start_time')
            ->get();
    }

    public function history()
    {
        return RoomBookingCancellation::query()->latest()->get();
    }

    public function cancel(string $actorId, array $data): RoomBookingCancellation
    {
        return DB::transaction(function () use ($actorId, $data): RoomBookingCancellation {
            $booking = Booking::query()
                ->with(['room', 'alternativeRoom'])
                ->lockForUpdate()
                ->find($data['bookingId']);
            if (! $booking || $booking->resource_type !== ResourceType::ROOM) {
                throw new ApiException('Peminjaman ruang rapat tidak ditemukan', 404);
            }
            if (! in_array($booking->status, [BookingStatus::APPROVED, BookingStatus::IN_USE], true)) {
                throw new ApiException('Hanya peminjaman ruang yang sudah disetujui dan belum selesai yang dapat dibatalkan', 409);
            }
            if (RoomBookingCancellation::query()->where('booking_id', $booking->id)->exists()) {
                throw new ApiException('Peminjaman ruang ini sudah dibatalkan', 409);
            }

            $actorName = User::query()->whereKey($actorId)->value('full_name') ?: 'PJ Ruangan';
            $room = $booking->alternativeRoom ?? $booking->room;
            $start = $booking->alternative_start_time ?? $booking->start_time;
            $end = $booking->alternative_end_time ?? $booking->end_time;

            $cancellation = RoomBookingCancellation::create([
                'booking_id' => $booking->id,
                'room_id' => $room?->id,
                'requested_by' => $actorId,
                'requested_by_name' => $actorName,
                'room_name' => $room?->name ?? 'Ruang rapat',
                'work_unit' => $booking->work_unit ?: 'Unit kerja tidak tersedia',
                'responsible_name' => $booking->responsible_name ?: 'Penanggung jawab tidak tersedia',
                'purpose' => $booking->purpose,
                'booking_start_time' => $start,
                'booking_end_time' => $end,
                'reason' => trim($data['reason']),
            ]);

            $booking->update(['status' => BookingStatus::CANCELLED]);
            $this->notifications->owner(
                $booking,
                'ROOM_BOOKING_CANCELLED',
                'Peminjaman ruang dibatalkan',
                'Peminjaman '.$cancellation->room_name.' dibatalkan oleh '.$actorName.'.',
            );
            $this->notifications->roles(
                $booking,
                [Role::KASUBAG_UMUM],
                'ROOM_BOOKING_CANCELLED',
                'Pembatalan ruang rapat',
                $actorName.' membatalkan peminjaman '.$cancellation->room_name.'.',
            );

            return $cancellation->refresh();
        });
    }
}
