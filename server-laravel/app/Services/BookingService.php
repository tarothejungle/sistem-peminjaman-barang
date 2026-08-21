<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\ResourceType;
use App\Enums\RoomBookingSlot;
use App\Exceptions\ApiException;
use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Item;
use App\Models\Room;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

final class BookingService
{
    private const OVERLAP_STATUSES = [
        BookingStatus::PENDING_PJ_REVIEW->value,
        BookingStatus::PENDING_KABAG_APPROVAL->value,
        BookingStatus::APPROVED->value,
        BookingStatus::ALTERNATIVE_OFFERED->value,
        BookingStatus::CONFIRMED->value,
        BookingStatus::PREPARING->value,
        BookingStatus::IN_USE->value,
        BookingStatus::FINISHED_PENDING_INSPECTION->value,
    ];

    public function __construct(private readonly ?RoomBookingScheduleService $schedule = null) {}

    public function create(string $userId, array $data): Booking
    {
        $type = ResourceType::from($data['resourceType']);
        [$start, $end] = $type === ResourceType::ROOM
            ? $this->roomSchedule()->range($data['startDate'], $data['endDate'], RoomBookingSlot::from($data['roomSlot']))
            : [CarbonImmutable::parse($data['startTime']), CarbonImmutable::parse($data['endTime'])];
        if ($start->isPast()) {
            throw new ApiException('Waktu peminjaman tidak boleh di masa lalu', 400);
        }

        $documentData = isset($data['document']) && $data['document'] instanceof UploadedFile
            ? $this->storeDocument($data['document'])
            : [];

        try {
            return $this->transaction(function () use ($userId, $data, $start, $end, $type, $documentData): Booking {
                if ($type === ResourceType::ROOM) {
                    if (! Room::whereKey($data['roomId'])->where('is_active', true)->exists()) {
                        throw new ApiException('Ruang rapat tidak ditemukan atau tidak aktif', 404);
                    }
                    $this->assertRoomAvailable($data['roomId'], $start, $end);
                } else {
                    $data['items'] = $this->normalizeItems($data['items']);
                    $this->assertItemsAvailable($data['items'], $start, $end);
                }

                $booking = Booking::create(array_merge(['user_id' => $userId, 'resource_type' => $type, 'room_id' => $data['roomId'] ?? null, 'start_time' => $start, 'end_time' => $end, 'purpose' => trim($data['purpose']), 'status' => BookingStatus::PENDING_PJ_REVIEW], $documentData));
                foreach ($data['items'] ?? [] as $item) {
                    BookingItem::create(['booking_id' => $booking->id, 'item_id' => $item['itemId'], 'quantity' => $item['quantity']]);
                }

                return $this->load($booking);
            });
        } catch (Throwable $exception) {
            if (isset($documentData['document_path'])) {
                Storage::disk('local')->delete($documentData['document_path']);
            }
            throw $exception;
        }
    }

    public function updatePending(string $id, string $userId, array $data): Booking
    {
        $type = ResourceType::from($data['resourceType']);
        [$start, $end] = $type === ResourceType::ROOM
            ? $this->roomSchedule()->range($data['startDate'], $data['endDate'], RoomBookingSlot::from($data['roomSlot']))
            : [CarbonImmutable::parse($data['startTime']), CarbonImmutable::parse($data['endTime'])];
        if ($start->isPast()) {
            throw new ApiException('Waktu peminjaman tidak boleh di masa lalu', 400);
        }

        $documentData = isset($data['document']) && $data['document'] instanceof UploadedFile
            ? $this->storeDocument($data['document'])
            : [];
        $oldDocumentPath = null;

        try {
            $booking = $this->transaction(function () use ($id, $userId, $data, $type, $start, $end, $documentData, &$oldDocumentPath): Booking {
                $booking = Booking::with('bookingItems')->lockForUpdate()->find($id);
                if (! $booking || $booking->user_id !== $userId) {
                    throw new ApiException('Pengajuan tidak ditemukan', 404);
                }
                if ($booking->status !== BookingStatus::PENDING_PJ_REVIEW) {
                    throw new ApiException('Pengajuan hanya dapat diubah selama menunggu pemeriksaan PJ', 409);
                }

                if ($type === ResourceType::ROOM) {
                    if (! Room::whereKey($data['roomId'])->where('is_active', true)->exists()) {
                        throw new ApiException('Ruang rapat tidak ditemukan atau tidak aktif', 404);
                    }
                    $this->assertRoomAvailable($data['roomId'], $start, $end, $booking->id);
                } else {
                    $data['items'] = $this->normalizeItems($data['items']);
                    $this->assertItemsAvailable($data['items'], $start, $end, $booking->id);
                }

                $multiDayRoom = $type === ResourceType::ROOM && $data['startDate'] !== $data['endDate'];
                if ($multiDayRoom && $documentData === [] && ! $booking->document_path) {
                    throw new ApiException('Data tidak valid', 400, ['document' => ['Surat resmi PDF wajib dilampirkan untuk peminjaman lebih dari satu hari']]);
                }

                $keepOldDocument = $multiDayRoom && $documentData === [];
                if (! $keepOldDocument && $booking->document_path) {
                    $oldDocumentPath = $booking->document_path;
                }
                $documentUpdates = $keepOldDocument ? [] : array_merge([
                    'document_disk' => null,
                    'document_path' => null,
                    'document_original_name' => null,
                    'document_mime' => null,
                    'document_size' => null,
                ], $documentData);

                $booking->update(array_merge([
                    'resource_type' => $type,
                    'room_id' => $data['roomId'] ?? null,
                    'start_time' => $start,
                    'end_time' => $end,
                    'purpose' => trim($data['purpose']),
                ], $documentUpdates));
                $booking->bookingItems()->delete();
                foreach ($data['items'] ?? [] as $item) {
                    BookingItem::create(['booking_id' => $booking->id, 'item_id' => $item['itemId'], 'quantity' => $item['quantity']]);
                }

                return $this->load($booking);
            });
        } catch (Throwable $exception) {
            if (isset($documentData['document_path'])) {
                Storage::disk('local')->delete($documentData['document_path']);
            }
            throw $exception;
        }

        if ($oldDocumentPath) {
            Storage::disk('local')->delete($oldDocumentPath);
        }

        return $booking;
    }

    public function deletePending(string $id, string $userId): void
    {
        $documentPath = $this->transaction(function () use ($id, $userId): ?string {
            $booking = Booking::lockForUpdate()->find($id);
            if (! $booking || $booking->user_id !== $userId) {
                throw new ApiException('Pengajuan tidak ditemukan', 404);
            }
            if ($booking->status !== BookingStatus::PENDING_PJ_REVIEW) {
                throw new ApiException('Pengajuan hanya dapat dihapus selama menunggu pemeriksaan PJ', 409);
            }

            $documentPath = $booking->document_path;
            $booking->delete();

            return $documentPath;
        });

        if ($documentPath) {
            Storage::disk('local')->delete($documentPath);
        }
    }

    public function confirmFinished(string $id, string $userId): Booking
    {
        return $this->transaction(function () use ($id, $userId): Booking {
            $booking = Booking::lockForUpdate()->find($id);
            if (! $booking || $booking->user_id !== $userId) {
                throw new ApiException('Peminjaman tidak ditemukan', 404);
            }
            if ($booking->status !== BookingStatus::APPROVED) {
                throw new ApiException('Hanya peminjaman yang sudah disetujui dapat dikonfirmasi selesai', 409);
            }
            if ($booking->end_time->isFuture()) {
                throw new ApiException('Peminjaman belum melewati waktu selesai', 409);
            }

            $booking->update(['status' => BookingStatus::COMPLETED]);

            return $this->load($booking);
        });
    }

    public function availability(array $data, ?string $userId = null): array
    {
        $type = ResourceType::from($data['resourceType']);
        [$start, $end] = $type === ResourceType::ROOM
            ? $this->roomSchedule()->range($data['startDate'], $data['endDate'], RoomBookingSlot::from($data['roomSlot']))
            : [CarbonImmutable::parse($data['startTime']), CarbonImmutable::parse($data['endTime'])];

        $exclude = null;
        if (isset($data['bookingId'])) {
            $booking = Booking::find($data['bookingId']);
            if (! $booking || ! $userId || $booking->user_id !== $userId || $booking->status !== BookingStatus::PENDING_PJ_REVIEW) {
                throw new ApiException('Pengajuan tidak ditemukan', 404);
            }
            $exclude = $booking->id;
        }

        if ($type === ResourceType::ROOM) {
            if (! Room::whereKey($data['roomId'])->where('is_active', true)->exists()) {
                throw new ApiException('Ruang rapat tidak ditemukan atau tidak aktif', 404);
            }

            $available = ! $this->roomHasConflict($data['roomId'], $start, $end, $exclude);

            return [
                'available' => $available,
                'remainingStock' => null,
                'message' => $available ? 'Ruangan tersedia pada rentang waktu tersebut' : 'Ruangan sedang dipinjam pada rentang waktu tersebut',
            ];
        }

        $item = Item::whereKey($data['itemId'])->where('is_active', true)->first();
        if (! $item) {
            throw new ApiException('Barang tidak ditemukan atau tidak aktif', 404);
        }
        $reserved = $this->reservedItemQuantity($item->id, $start, $end, $exclude);
        $remaining = max(0, $item->total_stock - $reserved);
        $available = $data['quantity'] <= $remaining;

        return [
            'available' => $available,
            'remainingStock' => $remaining,
            'message' => $available ? "Tersedia {$remaining} unit pada rentang waktu tersebut" : "Stok tersisa {$remaining} unit pada rentang waktu tersebut",
        ];
    }

    public function availabilitySummary(): array
    {
        $now = now();
        $bookings = Booking::query()
            ->with('bookingItems:id,booking_id,item_id,quantity')
            ->where('status', BookingStatus::APPROVED->value)
            ->orderBy('start_time')
            ->get(['id', 'resource_type', 'room_id', 'start_time', 'end_time']);

        $rooms = [];
        $items = [];
        foreach ($bookings as $booking) {
            if ($booking->resource_type === ResourceType::ROOM && $booking->room_id) {
                $state = $booking->end_time <= $now ? 'AWAITING_CONFIRMATION' : ($booking->start_time <= $now ? 'IN_USE' : 'RESERVED');
                $priority = ['RESERVED' => 1, 'AWAITING_CONFIRMATION' => 2, 'IN_USE' => 3];
                $currentState = $rooms[$booking->room_id]['state'] ?? null;
                if ($currentState && $priority[$currentState] >= $priority[$state]) {
                    continue;
                }
                $rooms[$booking->room_id] = [
                    'resourceId' => $booking->room_id,
                    'state' => $state,
                    'startTime' => $booking->start_time,
                    'endTime' => $booking->end_time,
                ];
            }

            foreach ($booking->bookingItems as $bookingItem) {
                $itemId = $bookingItem->item_id;
                $current = $items[$itemId] ?? [
                    'resourceId' => $itemId,
                    'reservedNow' => 0,
                    'awaitingConfirmation' => 0,
                    'nextStartTime' => null,
                    'nextEndTime' => null,
                    'nextReservedQuantity' => 0,
                ];
                if ($booking->end_time <= $now) {
                    $current['awaitingConfirmation'] += $bookingItem->quantity;
                    $current['reservedNow'] += $bookingItem->quantity;
                } elseif ($booking->start_time <= $now) {
                    $current['reservedNow'] += $bookingItem->quantity;
                } elseif ($current['nextStartTime'] === null || $booking->start_time->lt($current['nextStartTime'])) {
                    $current['nextStartTime'] = $booking->start_time;
                    $current['nextEndTime'] = $booking->end_time;
                    $current['nextReservedQuantity'] = $bookingItem->quantity;
                } elseif ($booking->start_time->equalTo($current['nextStartTime'])) {
                    $current['nextReservedQuantity'] += $bookingItem->quantity;
                    if ($booking->end_time->gt($current['nextEndTime'])) {
                        $current['nextEndTime'] = $booking->end_time;
                    }
                }
                $items[$itemId] = $current;
            }
        }

        return ['rooms' => array_values($rooms), 'items' => array_values($items), 'checkedAt' => $now];
    }

    public function transition(string $id, BookingStatus $expected, BookingStatus $next, array $data = []): Booking
    {
        return $this->transaction(function () use ($id, $expected, $next, $data): Booking {
            $booking = Booking::with('bookingItems')->lockForUpdate()->find($id) ?? throw new ApiException('Peminjaman tidak ditemukan', 404);
            if ($booking->status !== $expected) {
                throw new ApiException('Status peminjaman tidak sesuai dengan tahap proses', 409);
            }
            if ($next === BookingStatus::APPROVED) {
                $this->assertAvailable($booking);
            }
            $map = ['approvalNotes' => 'approval_notes', 'inspectionNotes' => 'inspection_notes', 'rejectionReason' => 'rejection_reason', 'alternativeStartTime' => 'alternative_start_time', 'alternativeEndTime' => 'alternative_end_time'];
            $updates = ['status' => $next];
            foreach ($map as $input => $column) {
                if (array_key_exists($input, $data)) {
                    $updates[$column] = $data[$input];
                }
            }
            $booking->update($updates);

            return $this->load($booking);
        });
    }

    public function normalizeItems(array $items): array
    {
        $normalized = [];
        foreach ($items as $item) {
            $normalized[$item['itemId']] = ($normalized[$item['itemId']] ?? 0) + $item['quantity'];
        }

        return collect($normalized)->map(fn (int $quantity, string $itemId): array => compact('itemId', 'quantity'))->values()->all();
    }

    public static function overlapStatuses(): array
    {
        return self::OVERLAP_STATUSES;
    }

    private function assertAvailable(Booking $booking): void
    {
        if ($booking->resource_type === ResourceType::ROOM) {
            $this->assertRoomAvailable($booking->room_id, $booking->start_time, $booking->end_time, $booking->id);
        } else {
            $items = $booking->bookingItems->map(fn (BookingItem $item): array => ['itemId' => $item->item_id, 'quantity' => $item->quantity])->all();
            $this->assertItemsAvailable($items, $booking->start_time, $booking->end_time, $booking->id);
        }
    }

    private function assertRoomAvailable(string $roomId, $start, $end, ?string $exclude = null): void
    {
        if ($this->roomHasConflict($roomId, $start, $end, $exclude)) {
            throw new ApiException('Ruangan sudah terisi pada rentang waktu tersebut.', 409);
        }
    }

    private function roomHasConflict(string $roomId, $start, $end, ?string $exclude = null): bool
    {
        $query = Booking::where('room_id', $roomId)->whereIn('status', self::OVERLAP_STATUSES)->where('start_time', '<', $end)->where('end_time', '>', $start);
        if ($exclude) {
            $query->whereKeyNot($exclude);
        }

        return $query->exists();
    }

    private function assertItemsAvailable(array $requested, $start, $end, ?string $exclude = null): void
    {
        $ids = array_column($requested, 'itemId');
        $items = Item::whereIn('id', $ids)->where('is_active', true)->get();
        if ($items->count() !== count($ids)) {
            throw new ApiException('Barang tidak ditemukan atau tidak aktif', 404);
        }
        $reserved = BookingItem::query()->select('item_id', DB::raw('SUM(quantity) AS reserved'))->whereIn('item_id', $ids)->whereHas('booking', function ($query) use ($start, $end, $exclude): void {
            $query->whereIn('status', self::OVERLAP_STATUSES)->where('start_time', '<', $end)->where('end_time', '>', $start);
            if ($exclude) {
                $query->whereKeyNot($exclude);
            }
        })->groupBy('item_id')->pluck('reserved', 'item_id');
        $quantities = collect($requested)->pluck('quantity', 'itemId');
        foreach ($items as $item) {
            if ($quantities[$item->id] > $item->total_stock - (int) ($reserved[$item->id] ?? 0)) {
                throw new ApiException("Stok {$item->name} tidak mencukupi pada rentang waktu tersebut", 409);
            }
        }
    }

    private function reservedItemQuantity(string $itemId, $start, $end, ?string $exclude = null): int
    {
        return (int) BookingItem::query()->where('item_id', $itemId)->whereHas('booking', function ($query) use ($start, $end, $exclude): void {
            $query->whereIn('status', self::OVERLAP_STATUSES)->where('start_time', '<', $end)->where('end_time', '>', $start);
            if ($exclude) {
                $query->whereKeyNot($exclude);
            }
        })->sum('quantity');
    }

    private function storeDocument(UploadedFile $document): array
    {
        $path = 'booking-documents/'.Str::uuid().'.pdf';
        if (! Storage::disk('local')->put($path, $document->getContent())) {
            throw new ApiException('Surat resmi gagal disimpan', 500);
        }

        return [
            'document_disk' => 'local',
            'document_path' => $path,
            'document_original_name' => mb_substr($document->getClientOriginalName(), 0, 255),
            'document_mime' => 'application/pdf',
            'document_size' => $document->getSize(),
        ];
    }

    private function roomSchedule(): RoomBookingScheduleService
    {
        return $this->schedule ?? app(RoomBookingScheduleService::class);
    }

    private function transaction(callable $operation): mixed
    {
        for ($attempt = 1; $attempt <= 3; $attempt++) {
            try {
                return DB::transaction(function () use ($operation) {
                    if (DB::getDriverName() === 'pgsql') {
                        DB::statement('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
                    }

                    return $operation();
                });
            } catch (QueryException $exception) {
                if (! in_array($exception->getCode(), ['40001', '40P01'], true)) {
                    throw $exception;
                }
                if ($attempt === 3) {
                    throw new ApiException('Ketersediaan berubah, silakan periksa dan ajukan kembali', 409);
                }
                usleep(50_000 * $attempt);
            }
        }
        throw new ApiException('Transaksi peminjaman gagal, silakan coba lagi', 409);
    }

    private function load(Booking $booking): Booking
    {
        return $booking->refresh()->load(['room', 'bookingItems.item']);
    }
}
