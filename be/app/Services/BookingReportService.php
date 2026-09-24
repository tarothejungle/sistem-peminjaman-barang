<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\ResourceType;
use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\UserCreditEvent;
use Carbon\CarbonImmutable;

/**
 * Builds the rows behind "Laporan Peminjaman" so the .xlsx and .pdf exports can
 * never disagree about columns, ordering, or wording.
 */
final class BookingReportService
{
    /** @var list<string> */
    public const COLUMNS = [
        'No',
        'ID Peminjaman',
        'Nama Peminjam',
        'No. Telepon',
        'Unit Kerja',
        'Jenis',
        'Kendaraan / Ruangan',
        'Tanggal Pinjam',
        'Tanggal Kembali',
        'Surat Tugas',
        'Status',
        'Kembali Aktual',
        'Poin Kredibilitas Kendaraan',
    ];

    public function __construct(private readonly RoomBookingScheduleService $schedule) {}

    /**
     * @param  array{status?: string|null, from?: string|null, to?: string|null}  $filters
     * @return array{generatedAt: CarbonImmutable, timezone: string, filters: array<string, string>, columns: list<string>, rows: list<list<string>>}
     */
    public function collect(array $filters): array
    {
        $timezone = $this->schedule->settings()->timezone;
        $query = Booking::query()
            ->with(['room', 'alternativeRoom', 'bookingItems.item', 'user'])
            ->orderBy('start_time');

        if (! empty($filters['status'])) {
            $query->where('status', (string) $filters['status']);
        }
        if (! empty($filters['from'])) {
            $query->where('start_time', '>=', CarbonImmutable::createFromFormat('Y-m-d', (string) $filters['from'], $timezone)->startOfDay()->utc());
        }
        if (! empty($filters['to'])) {
            $query->where('start_time', '<=', CarbonImmutable::createFromFormat('Y-m-d', (string) $filters['to'], $timezone)->endOfDay()->utc());
        }

        $bookings = $query->get();
        $itemBookingIds = $bookings
            ->filter(fn (Booking $booking): bool => $booking->resource_type === ResourceType::ITEM)
            ->pluck('id')
            ->all();
        $credits = UserCreditEvent::query()
            ->whereIn('booking_id', $itemBookingIds)
            ->pluck('delta', 'booking_id');

        $rows = [];
        foreach ($bookings->values() as $index => $booking) {
            $rows[] = $this->row($index + 1, $booking, $timezone, $credits[$booking->id] ?? null);
        }

        return [
            'generatedAt' => CarbonImmutable::now($timezone),
            'timezone' => $timezone,
            'filters' => $this->describeFilters($filters),
            'columns' => self::COLUMNS,
            'rows' => $rows,
        ];
    }

    /** @return list<string> */
    private function row(int $number, Booking $booking, string $timezone, ?int $creditDelta): array
    {
        $start = ($booking->alternative_start_time ?? $booking->start_time)->setTimezone($timezone);
        $end = ($booking->alternative_end_time ?? $booking->end_time)->setTimezone($timezone);
        $returnedAt = $booking->returned_at?->setTimezone($timezone);

        return [
            (string) $number,
            $booking->id,
            $booking->responsible_name !== '' ? $booking->responsible_name : ($booking->user?->full_name ?? '-'),
            $booking->phone_number !== '' ? $booking->phone_number : '-',
            $booking->work_unit ?: '-',
            $booking->resource_type === ResourceType::ROOM ? 'Ruang Rapat' : 'Kendaraan',
            $this->resourceName($booking),
            $start->format('d/m/Y H:i'),
            $end->format('d/m/Y H:i'),
            $booking->document_original_name ? 'Terlampir' : 'Tidak ada',
            $booking->status->label(),
            $returnedAt ? $returnedAt->format('d/m/Y H:i') : '-',
            $creditDelta === null ? '-' : ($creditDelta > 0 ? '+'.$creditDelta : (string) $creditDelta),
        ];
    }

    private function resourceName(Booking $booking): string
    {
        if ($booking->resource_type === ResourceType::ROOM) {
            return ($booking->alternative_room_id ? $booking->alternativeRoom?->name : null)
                ?? $booking->room?->name
                ?? 'Ruang rapat';
        }

        if ($booking->bookingItems->isEmpty()) {
            return 'Kendaraan';
        }

        return $booking->bookingItems
            ->map(function (BookingItem $bookingItem): string {
                $label = ($bookingItem->item?->name ?? 'Kendaraan').' ('.$bookingItem->quantity.')';
                $plate = $bookingItem->item?->plate_number;

                return $plate ? $label.' - '.$plate : $label;
            })
            ->implode(', ');
    }

    /**
     * @param  array{status?: string|null, from?: string|null, to?: string|null}  $filters
     * @return array<string, string>
     */
    private function describeFilters(array $filters): array
    {
        $status = 'Semua status';
        if (! empty($filters['status'])) {
            $status = BookingStatus::from((string) $filters['status'])->label();
        }

        $period = 'Semua tanggal';
        $from = $filters['from'] ?? null;
        $to = $filters['to'] ?? null;
        if ($from && $to) {
            $period = $from.' s/d '.$to;
        } elseif ($from) {
            $period = 'Sejak '.$from;
        } elseif ($to) {
            $period = 'Sampai '.$to;
        }

        return ['Status' => $status, 'Periode' => $period];
    }
}
