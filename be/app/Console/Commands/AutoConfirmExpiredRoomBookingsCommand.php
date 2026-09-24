<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\BookingService;
use Illuminate\Console\Command;

/**
 * Menutup peminjaman ruang yang pemakainya tidak pernah mengonfirmasi selesai.
 *
 * Batas waktunya diatur lewat BOOKING_ROOM_AUTO_CONFIRM_MINUTES (menit). Nilai 0
 * mematikan fitur ini.
 */
final class AutoConfirmExpiredRoomBookingsCommand extends Command
{
    protected $signature = 'bookings:auto-confirm-rooms {--dry-run : Hitung saja tanpa mengubah data}';

    protected $description = 'Tutup otomatis peminjaman ruang yang melewati batas konfirmasi selesai';

    public function handle(BookingService $bookings): int
    {
        $minutes = (int) config('jwt.booking_room_auto_confirm_minutes', 0);
        if ($minutes <= 0) {
            $this->info('Auto-konfirmasi ruang dinonaktifkan (BOOKING_ROOM_AUTO_CONFIRM_MINUTES=0).');

            return self::SUCCESS;
        }

        if ((bool) $this->option('dry-run')) {
            $this->info($bookings->autoConfirmExpiredRoomBookings(dryRun: true).' peminjaman ruang memenuhi syarat auto-konfirmasi.');

            return self::SUCCESS;
        }

        $completed = $bookings->autoConfirmExpiredRoomBookings();
        $this->info("Auto-konfirmasi selesai: {$completed} peminjaman ruang ditutup otomatis (batas {$minutes} menit).");

        return self::SUCCESS;
    }
}
