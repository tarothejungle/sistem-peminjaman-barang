<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\ResourceType;
use App\Enums\Role;
use App\Enums\RoomBookingSlot;
use App\Exceptions\ApiException;
use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Item;
use App\Models\Room;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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

    public function __construct(
        private readonly ?RoomBookingScheduleService $schedule = null,
        private readonly ?BookingNotificationService $notificationService = null,
        private readonly ?CreditScoreService $creditService = null,
    ) {}

    public function create(string $userId, array $data): Booking
    {
        $type = ResourceType::from($data['resourceType']);
        [$start, $end] = $this->resolveSchedule($type, $data);
        if ($start->isPast()) {
            throw new ApiException('Waktu peminjaman tidak boleh di masa lalu', 400);
        }

        $documentData = isset($data['document']) && $data['document'] instanceof UploadedFile
            ? $this->storeDocument($data['document'])
            : [];
        $suratTugasData = isset($data['suratTugas']) && $data['suratTugas'] instanceof UploadedFile
            ? $this->storeSuratTugas($data['suratTugas'])
            : [];

        try {
            return $this->transaction(function () use ($userId, $data, $start, $end, $type, $documentData, $suratTugasData): Booking {
                $this->assertBookingLimitsForUser($userId, $start, $end);
                if ($type === ResourceType::ROOM) {
                    if (! Room::whereKey($data['roomId'])->where('is_active', true)->exists()) {
                        throw new ApiException('Ruang rapat tidak ditemukan atau tidak aktif', 404);
                    }
                    $this->assertRoomAvailable($data['roomId'], $start, $end);
                } else {
                    $data['items'] = $this->normalizeItems($data['items']);
                    $this->assertItemsAvailable($data['items'], $start, $end);
                    $this->assertSuratTugasForVehicle($data['items'], $suratTugasData);
                }

                $booking = Booking::create(array_merge(['user_id' => $userId, 'resource_type' => $type, 'room_id' => $data['roomId'] ?? null, 'responsible_name' => trim($data['responsibleName']), 'phone_number' => trim($data['phoneNumber']), 'work_unit' => isset($data['workUnit']) ? trim($data['workUnit']) : null, 'start_time' => $start, 'end_time' => $end, 'purpose' => trim($data['purpose']), 'status' => BookingStatus::PENDING_PJ_REVIEW], $documentData, $suratTugasData));
                foreach ($data['items'] ?? [] as $item) {
                    BookingItem::create(['booking_id' => $booking->id, 'item_id' => $item['itemId'], 'quantity' => $item['quantity']]);
                }
                $this->notifications()->bookingCreated($booking);

                return $this->load($booking);
            });
        } catch (Throwable $exception) {
            if (isset($documentData['document_path'])) {
                Storage::disk('local')->delete($documentData['document_path']);
            }
            if (isset($suratTugasData['surat_tugas_path'])) {
                Storage::disk('local')->delete($suratTugasData['surat_tugas_path']);
            }
            throw $exception;
        }
    }

    public function updatePending(string $id, string $userId, array $data): Booking
    {
        $type = ResourceType::from($data['resourceType']);
        [$start, $end] = $this->resolveSchedule($type, $data);
        if ($start->isPast()) {
            throw new ApiException('Waktu peminjaman tidak boleh di masa lalu', 400);
        }

        $documentData = isset($data['document']) && $data['document'] instanceof UploadedFile
            ? $this->storeDocument($data['document'])
            : [];
        $suratTugasData = isset($data['suratTugas']) && $data['suratTugas'] instanceof UploadedFile
            ? $this->storeSuratTugas($data['suratTugas'])
            : [];
        $oldDocumentPath = null;
        $oldSuratTugasPath = null;

        try {
            $booking = $this->transaction(function () use ($id, $userId, $data, $type, $start, $end, $documentData, $suratTugasData, &$oldDocumentPath, &$oldSuratTugasPath): Booking {
                $booking = Booking::with('bookingItems')->lockForUpdate()->find($id);
                if (! $booking || $booking->user_id !== $userId) {
                    throw new ApiException('Pengajuan tidak ditemukan', 404);
                }
                if ($booking->status !== BookingStatus::PENDING_PJ_REVIEW) {
                    throw new ApiException('Pengajuan hanya dapat diubah selama menunggu pemeriksaan PJ', 409);
                }
                $this->assertBookingLimitsForUser($userId, $start, $end, $booking->id);

                if ($type === ResourceType::ROOM) {
                    if (! Room::whereKey($data['roomId'])->where('is_active', true)->exists()) {
                        throw new ApiException('Ruang rapat tidak ditemukan atau tidak aktif', 404);
                    }
                    $this->assertRoomAvailable($data['roomId'], $start, $end, $booking->id);
                } else {
                    $data['items'] = $this->normalizeItems($data['items']);
                    $this->assertItemsAvailable($data['items'], $start, $end, $booking->id);
                    $this->assertSuratTugasForVehicle($data['items'], $suratTugasData, $booking);
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

                if ($suratTugasData !== [] && $booking->surat_tugas_path) {
                    $oldSuratTugasPath = $booking->surat_tugas_path;
                }

                $booking->update(array_merge([
                    'resource_type' => $type,
                    'room_id' => $data['roomId'] ?? null,
                    'responsible_name' => trim($data['responsibleName']),
                    'phone_number' => trim($data['phoneNumber']),
                    'work_unit' => isset($data['workUnit']) ? trim($data['workUnit']) : null,
                    'start_time' => $start,
                    'end_time' => $end,
                    'purpose' => trim($data['purpose']),
                ], $documentUpdates, $suratTugasData));
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
            if (isset($suratTugasData['surat_tugas_path'])) {
                Storage::disk('local')->delete($suratTugasData['surat_tugas_path']);
            }
            throw $exception;
        }

        if ($oldDocumentPath) {
            Storage::disk('local')->delete($oldDocumentPath);
        }
        if ($oldSuratTugasPath) {
            Storage::disk('local')->delete($oldSuratTugasPath);
        }

        return $booking;
    }

    public function deletePending(string $id, string $userId): void
    {
        $paths = $this->transaction(function () use ($id, $userId): array {
            $booking = Booking::lockForUpdate()->find($id);
            if (! $booking || $booking->user_id !== $userId) {
                throw new ApiException('Pengajuan tidak ditemukan', 404);
            }
            if ($booking->status !== BookingStatus::PENDING_PJ_REVIEW) {
                throw new ApiException('Pengajuan hanya dapat dihapus selama menunggu pemeriksaan PJ', 409);
            }

            $paths = array_filter([$booking->document_path, $booking->surat_tugas_path]);
            $booking->delete();

            return $paths;
        });

        foreach ($paths as $path) {
            Storage::disk('local')->delete($path);
        }
    }

    public function confirmFinished(string $id, string $userId): Booking
    {
        return $this->transaction(function () use ($id, $userId): Booking {
            $booking = Booking::lockForUpdate()->find($id);
            if (! $booking || $booking->user_id !== $userId) {
                throw new ApiException('Peminjaman tidak ditemukan', 404);
            }
            if (! in_array($booking->status, [BookingStatus::APPROVED, BookingStatus::IN_USE], true)) {
                throw new ApiException('Hanya peminjaman yang sudah disetujui dapat dikonfirmasi selesai', 409);
            }

            $returnedAt = CarbonImmutable::now();
            $scheduledEnd = ($booking->alternative_end_time ?? $booking->end_time)->toImmutable();
            if ($booking->resource_type === ResourceType::ROOM && $returnedAt->lt($scheduledEnd)) {
                throw new ApiException('Peminjaman ruang baru dapat dikonfirmasi selesai setelah jam pemakaian berakhir', 409);
            }
            if ($booking->resource_type === ResourceType::ITEM && $returnedAt->lt($booking->start_time)) {
                throw new ApiException('Peminjaman belum dimulai sehingga belum dapat dikonfirmasi selesai', 409);
            }

            $booking->update(['status' => BookingStatus::COMPLETED, 'returned_at' => $returnedAt]);
            $this->credits()->recordReturn($booking, $returnedAt);

            return $this->load($booking);
        });
    }

    /**
     * Closes room bookings whose usage window ended without the borrower
     * confirming, honouring BOOKING_ROOM_AUTO_CONFIRM_MINUTES as the grace
     * period. Returns how many bookings were completed.
     *
     * The booking is completed at the moment the room became free again (its
     * scheduled end) rather than at the moment this ran, so the credibility
     * ledger is not charged for a click the system just made unnecessary.
     *
     * @param  bool  $dryRun  count the matching bookings without writing anything
     */
    public function autoConfirmExpiredRoomBookings(?CarbonImmutable $now = null, bool $dryRun = false): int
    {
        $graceMinutes = (int) config('jwt.booking_room_auto_confirm_minutes', 0);
        if ($graceMinutes <= 0) {
            return 0;
        }

        $now ??= CarbonImmutable::now();
        $cutoff = $now->subMinutes($graceMinutes);

        $ids = Booking::query()
            ->where('resource_type', ResourceType::ROOM->value)
            ->whereIn('status', [BookingStatus::APPROVED->value, BookingStatus::IN_USE->value])
            ->whereNull('returned_at')
            ->whereRaw('COALESCE(alternative_end_time, end_time) <= ?', [$cutoff])
            ->orderBy('end_time')
            ->pluck('id');

        if ($dryRun) {
            return $ids->count();
        }

        $timezone = $this->roomSchedule()->settings()->timezone;

        $completed = 0;
        foreach ($ids as $id) {
            if ($this->autoConfirmRoomBooking((string) $id, $now, $timezone)) {
                $completed++;
            }
        }

        return $completed;
    }

    private function autoConfirmRoomBooking(string $id, CarbonImmutable $now, string $timezone): bool
    {
        return $this->transaction(function () use ($id, $now, $timezone): bool {
            $booking = Booking::with('room')->lockForUpdate()->find($id);
            if (! $booking
                || $booking->resource_type !== ResourceType::ROOM
                || $booking->returned_at !== null
                || ! in_array($booking->status, [BookingStatus::APPROVED, BookingStatus::IN_USE], true)) {
                return false;
            }

            $finishedAt = ($booking->alternative_end_time ?? $booking->end_time)->toImmutable();
            $booking->update([
                'status' => BookingStatus::COMPLETED,
                'returned_at' => $finishedAt,
                'auto_confirmed_at' => $now,
            ]);

            $localEnd = $finishedAt->setTimezone($timezone);
            $this->notifications()->owner(
                $booking,
                'BOOKING_AUTO_CONFIRMED',
                'Peminjaman ditutup otomatis',
                'Penggunaan ruang berakhir '.$localEnd->translatedFormat('d F Y').' pukul '.$localEnd->format('H:i').' WIB dan tidak dikonfirmasi dalam batas waktu, sehingga sistem menutup peminjaman ini secara otomatis.',
            );

            return true;
        });
    }

    public function availability(array $data, ?string $userId = null): array
    {
        $type = ResourceType::from($data['resourceType']);
        [$start, $end] = $this->resolveSchedule($type, $data);

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
            throw new ApiException('Kendaraan tidak ditemukan atau tidak aktif', 404);
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
            ->get(['id', 'resource_type', 'room_id', 'start_time', 'end_time', 'alternative_room_id', 'alternative_start_time', 'alternative_end_time']);

        $rooms = [];
        $items = [];
        foreach ($bookings as $booking) {
            if ($booking->resource_type === ResourceType::ROOM && $booking->room_id) {
                $roomId = $booking->alternative_room_id ?? $booking->room_id;
                $start = $booking->alternative_start_time ?? $booking->start_time;
                $end = $booking->alternative_end_time ?? $booking->end_time;
                $state = $end <= $now ? 'AWAITING_CONFIRMATION' : ($start <= $now ? 'IN_USE' : 'RESERVED');
                $priority = ['RESERVED' => 1, 'AWAITING_CONFIRMATION' => 2, 'IN_USE' => 3];
                $currentState = $rooms[$roomId]['state'] ?? null;
                if ($currentState && $priority[$currentState] >= $priority[$state]) {
                    continue;
                }
                $rooms[$roomId] = [
                    'resourceId' => $roomId,
                    'state' => $state,
                    'startTime' => $start,
                    'endTime' => $end,
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

    public function roomDisplay(): array
    {
        $timezone = $this->roomSchedule()->settings()->timezone;
        $now = CarbonImmutable::now($timezone);
        $dayStart = $now->startOfDay()->utc();
        $dayEnd = $now->endOfDay()->utc();
        $rooms = Room::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'capacity', 'location']);
        $bookings = Booking::query()
            ->where('resource_type', ResourceType::ROOM->value)
            ->where('status', BookingStatus::APPROVED->value)
            ->get()
            ->filter(function (Booking $booking) use ($dayStart, $dayEnd): bool {
                $start = $booking->alternative_start_time ?? $booking->start_time;
                $end = $booking->alternative_end_time ?? $booking->end_time;

                $purpose = $booking->purpose;

                return $start->lte($dayEnd) && $end->gte($dayStart) && $purpose !== null && $purpose !== '';
            })
            ->groupBy(fn (Booking $booking): string => $booking->alternative_room_id ?? $booking->room_id);

        $inUse = 0;
        $scheduled = 0;
        $roomData = $rooms->map(function (Room $room) use ($bookings, $now, &$inUse, &$scheduled): array {
            $roomBookings = ($bookings->get($room->id) ?? collect())->sortBy(fn (Booking $booking) => $booking->alternative_start_time ?? $booking->start_time)->values();
            $current = $roomBookings->first(fn (Booking $booking): bool => ($booking->alternative_start_time ?? $booking->start_time)->lte($now) && ($booking->alternative_end_time ?? $booking->end_time)->gt($now));
            $next = $roomBookings->first(fn (Booking $booking): bool => ($booking->alternative_start_time ?? $booking->start_time)->gt($now));
            $publicBookings = $roomBookings
                ->filter(fn (Booking $booking): bool => (bool) ($booking->purpose ?? ''))
                ->map(fn (Booking $booking): array => $this->publicDisplayBooking($booking))
                ->values()
                ->all();
            $todayBookings = $publicBookings;
            if ($current) {
                $inUse++;
            }
            if ($roomBookings->isNotEmpty()) {
                $scheduled++;
            }

            return [
                'id' => $room->id,
                'name' => $room->name,
                'location' => $room->location,
                'capacity' => $room->capacity,
                'state' => $current ? 'IN_USE' : 'AVAILABLE',
                'currentBooking' => $current ? $this->publicDisplayBooking($current) : null,
                'nextBooking' => $next ? $this->publicDisplayBooking($next) : null,
                'todayBookings' => $todayBookings,
            ];
        })->values();

        return [
            'checkedAt' => $now->toIso8601String(),
            'timezone' => $timezone,
            'summary' => [
                'total' => $rooms->count(),
                'available' => $rooms->count() - $inUse,
                'inUse' => $inUse,
                'scheduled' => $scheduled,
            ],
            'rooms' => $roomData,
        ];
    }

    public function transition(string $id, BookingStatus $expected, BookingStatus $next, array $data = [], ?string $actorId = null): Booking
    {
        return $this->transaction(function () use ($id, $expected, $next, $data, $actorId): Booking {
            $booking = Booking::with(['room', 'bookingItems'])->lockForUpdate()->find($id) ?? throw new ApiException('Peminjaman tidak ditemukan', 404);
            if ($booking->status !== $expected) {
                throw new ApiException('Status peminjaman tidak sesuai dengan tahap proses', 409);
            }
            if ($next === BookingStatus::APPROVED) {
                $this->assertAvailable($booking);
            }
            if ($next === BookingStatus::ALTERNATIVE_OFFERED) {
                $this->assertAlternativeOffer($booking, $data);
            }
            $map = ['approvalNotes' => 'approval_notes', 'inspectionNotes' => 'inspection_notes', 'rejectionReason' => 'rejection_reason', 'alternativeRoomId' => 'alternative_room_id', 'alternativeStartTime' => 'alternative_start_time', 'alternativeEndTime' => 'alternative_end_time'];
            $updates = ['status' => $next];
            foreach ($map as $input => $column) {
                if (array_key_exists($input, $data)) {
                    $updates[$column] = $data[$input];
                }
            }
            if ($actorId !== null) {
                $actorName = User::query()->whereKey($actorId)->value('full_name') ?: 'Akun tidak tersedia';
                if ($expected === BookingStatus::PENDING_PJ_REVIEW) {
                    $updates['pj_reviewed_by'] = $actorId;
                    $updates['pj_reviewer_name'] = $actorName;
                }
                if ($expected === BookingStatus::PENDING_KABAG_APPROVAL) {
                    $updates['kasubag_reviewed_by'] = $actorId;
                    $updates['kasubag_reviewer_name'] = $actorName;
                }
                if ($next === BookingStatus::REJECTED) {
                    $updates['rejected_by'] = $actorId;
                    $updates['rejected_by_name'] = $actorName;
                }
            }
            $booking->update($updates);
            if ($next === BookingStatus::APPROVED) {
                $this->notifications()->owner($booking, 'BOOKING_APPROVED', 'Peminjaman disetujui', 'Pengajuan peminjaman Anda telah disetujui.');
                Log::info('Booking approved', ['booking_id' => $booking->id, 'user_id' => $booking->user_id]);
            } elseif ($next === BookingStatus::REJECTED) {
                $this->notifications()->owner($booking, 'BOOKING_REJECTED', 'Peminjaman ditolak', 'Pengajuan peminjaman Anda ditolak. Buka Status Peminjaman untuk melihat alasannya.');
            } elseif ($next === BookingStatus::PREPARING) {
                $this->notifications()->owner($booking, 'BOOKING_IN_REVIEW', 'Pengajuan sedang diproses', 'Pengajuan Anda telah diperiksa PJ Ruangan dan sedang dipersiapkan.');
            } elseif ($next === BookingStatus::PENDING_KABAG_APPROVAL) {
                $this->notifications()->owner($booking, 'BOOKING_FORWARDED', 'Pengajuan diteruskan', 'Pengajuan Anda telah diteruskan untuk persetujuan Kasubag Umum.');
                $this->notifications()->roles($booking, Role::approvers(), 'BOOKING_APPROVAL_REQUIRED', 'Pengajuan menunggu persetujuan', 'Terdapat pengajuan peminjaman yang perlu disetujui atau ditolak.');
            }

            return $this->load($booking);
        });
    }

    public function relocateMainRoomBooking(string $id, array $data, string $actorId, Role $actorRole): Booking
    {
        return $this->transaction(function () use ($id, $data, $actorId, $actorRole): Booking {
            $booking = Booking::with(['room', 'bookingItems'])->lockForUpdate()->find($id)
                ?? throw new ApiException('Peminjaman tidak ditemukan', 404);
            if (! in_array($booking->status, [BookingStatus::PENDING_KABAG_APPROVAL, BookingStatus::APPROVED], true)) {
                throw new ApiException('Alternatif hanya dapat diberikan saat menunggu persetujuan atau setelah disetujui', 409);
            }
            if ($actorRole === Role::PJ_RUANGAN && $booking->status !== BookingStatus::APPROVED) {
                throw new ApiException('PJ Ruangan hanya dapat memberikan alternatif setelah peminjaman disetujui', 409);
            }
            // The offer belongs to the loan window: once the room is no longer reserved the booking is closed business.
            if (($booking->alternative_end_time ?? $booking->end_time)->isPast()) {
                throw new ApiException('Masa peminjaman sudah berakhir sehingga alternatif ruangan tidak dapat diberikan', 409);
            }
            $data = $this->normalizeAlternativeSchedule($booking, $data);
            $this->assertAlternativeOffer($booking, $data);
            $room = Room::findOrFail($data['alternativeRoomId']);
            $updates = [
                'status' => BookingStatus::APPROVED,
                'alternative_room_id' => $room->id,
                'alternative_start_time' => $data['alternativeStartTime'],
                'alternative_end_time' => $data['alternativeEndTime'],
            ];
            if ($booking->status === BookingStatus::PENDING_KABAG_APPROVAL) {
                $updates['kasubag_reviewed_by'] = $actorId;
                $updates['kasubag_reviewer_name'] = User::query()->whereKey($actorId)->value('full_name') ?: 'Akun tidak tersedia';
            }
            $booking->update($updates);
            $start = CarbonImmutable::parse($data['alternativeStartTime'])->setTimezone(config('app.timezone', 'Asia/Jakarta'));
            $end = CarbonImmutable::parse($data['alternativeEndTime'])->setTimezone(config('app.timezone', 'Asia/Jakarta'));
            $this->notifications()->owner(
                $booking,
                'BOOKING_RELOCATED',
                'Lokasi peminjaman diperbarui',
                "Peminjaman Anda dialihkan ke {$room->name} pada {$start->translatedFormat('d F Y')} jam {$start->format('H:i')}-{$end->format('H:i')} WIB.",
            );
            Log::info('Approved booking relocated', [
                'booking_id' => $booking->id,
                'user_id' => $booking->user_id,
                'alternative_room_id' => $room->id,
            ]);

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
            $this->assertRoomAvailable(
                $booking->alternative_room_id ?? $booking->room_id,
                $booking->alternative_start_time ?? $booking->start_time,
                $booking->alternative_end_time ?? $booking->end_time,
                $booking->id,
            );
        } else {
            $items = $booking->bookingItems->map(fn (BookingItem $item): array => ['itemId' => $item->item_id, 'quantity' => $item->quantity])->all();
            $this->assertItemsAvailable($items, $booking->start_time, $booking->end_time, $booking->id);
        }
    }

    /**
     * Resolves an alternative offer expressed as date + configured session into
     * concrete UTC timestamps.
     *
     * Administrators pick a room, a date, and one of the sessions registered in
     * "Pengaturan Jam Ruangan"; the server derives the timestamps so a client can
     * never submit hours outside the configured sessions. A relocated booking
     * keeps the day span of the original request, so a multi-day booking stays
     * multi-day and therefore still has to use the full-day session.
     */
    private function normalizeAlternativeSchedule(Booking $booking, array $data): array
    {
        $date = $data['alternativeDate'] ?? null;
        $slot = $data['alternativeRoomSlot'] ?? null;
        if (! is_string($date) || $date === '' || ! is_string($slot) || $slot === '') {
            return $data;
        }

        $timezone = $this->roomSchedule()->settings()->timezone;
        $slotEnum = RoomBookingSlot::from($slot);
        $spanDays = (int) ceil($booking->start_time->copy()->setTimezone($timezone)->startOfDay()
            ->diffInDays($booking->end_time->copy()->setTimezone($timezone)->startOfDay()));
        $endDate = CarbonImmutable::createFromFormat('Y-m-d', $date, $timezone)
            ->addDays(max($slotEnum === RoomBookingSlot::FULL_DAY ? 1 : 0, $spanDays))
            ->format('Y-m-d');

        [$start, $end] = $this->roomSchedule()->range($date, $endDate, $slotEnum);
        $data['alternativeStartTime'] = $start->toIso8601String();
        $data['alternativeEndTime'] = $end->toIso8601String();

        return $data;
    }

    private function assertAlternativeOffer(Booking $booking, array $data): void
    {
        if ($booking->resource_type !== ResourceType::ROOM || mb_strtolower(trim($booking->room?->name ?? '')) !== mb_strtolower('Ruang Rapat Utama')) {
            throw new ApiException('Alternatif ruangan hanya dapat diberikan untuk Ruang Rapat Utama', 409);
        }

        $roomId = $data['alternativeRoomId'] ?? null;
        if (! is_string($roomId) || $roomId === $booking->room_id) {
            throw new ApiException('Ruang rapat alternatif tidak valid', 400, ['alternativeRoomId' => ['Pilih ruang rapat alternatif yang berbeda']]);
        }
        if (! Room::whereKey($roomId)->where('is_active', true)->exists()) {
            throw new ApiException('Ruang rapat alternatif tidak ditemukan atau tidak aktif', 404);
        }

        $start = CarbonImmutable::parse($data['alternativeStartTime']);
        $end = CarbonImmutable::parse($data['alternativeEndTime']);
        if ($start->isPast() || ! $end->gt($start)) {
            throw new ApiException('Jadwal alternatif tidak valid', 400);
        }
        $this->assertRoomAvailable($roomId, $start, $end, $booking->id);
    }

    private function notifications(): BookingNotificationService
    {
        return $this->notificationService ?? app(BookingNotificationService::class);
    }

    private function credits(): CreditScoreService
    {
        return $this->creditService ?? app(CreditScoreService::class);
    }

    private function assertRoomAvailable(string $roomId, $start, $end, ?string $exclude = null): void
    {
        if ($this->roomHasConflict($roomId, $start, $end, $exclude)) {
            throw new ApiException('Ruangan sudah terisi pada rentang waktu tersebut.', 409);
        }
    }

    private function roomHasConflict(string $roomId, $start, $end, ?string $exclude = null): bool
    {
        $query = Booking::whereIn('status', self::OVERLAP_STATUSES)
            ->where(function ($query) use ($roomId, $start, $end): void {
                $query->where(function ($query) use ($roomId, $start, $end): void {
                    $query->whereNull('alternative_room_id')
                        ->where('room_id', $roomId)
                        ->where('start_time', '<', $end)
                        ->where('end_time', '>', $start);
                })->orWhere(function ($query) use ($roomId, $start, $end): void {
                    $query->where('alternative_room_id', $roomId)
                        ->where('alternative_start_time', '<', $end)
                        ->where('alternative_end_time', '>', $start);
                });
            });
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
            throw new ApiException('Kendaraan tidak ditemukan atau tidak aktif', 404);
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

    /**
     * A vehicle may only leave the yard with its Surat Tugas attached. Other
     * inventory is unaffected, and an update that keeps the letter already on
     * file stays valid.
     *
     * @param  list<array{itemId: string, quantity: int}>  $items
     * @param  array<string, mixed>  $suratTugasData
     */
    private function assertSuratTugasForVehicle(array $items, array $suratTugasData, ?Booking $booking = null): void
    {
        if ($suratTugasData !== [] || $booking?->surat_tugas_path) {
            return;
        }
        if (! $this->containsVehicle($items)) {
            return;
        }

        throw new ApiException('Data tidak valid', 400, ['suratTugas' => ['Surat Tugas PDF wajib dilampirkan untuk peminjaman kendaraan']]);
    }

    /** @param list<array{itemId: string, quantity: int}> $items */
    private function containsVehicle(array $items): bool
    {
        $ids = array_values(array_filter(array_column($items, 'itemId'), 'is_string'));

        return $ids !== [] && Item::query()->whereIn('id', $ids)->whereNotNull('plate_number')->exists();
    }

    private function storeSuratTugas(UploadedFile $document): array
    {
        $path = 'surat-tugas/'.Str::uuid().'.pdf';
        if (! Storage::disk('local')->put($path, $document->getContent())) {
            throw new ApiException('Surat Tugas gagal disimpan', 500);
        }

        return [
            'surat_tugas_disk' => 'local',
            'surat_tugas_path' => $path,
            'surat_tugas_original_name' => $this->originalName($document),
            'surat_tugas_mime' => 'application/pdf',
            'surat_tugas_size' => $document->getSize(),
        ];
    }

    /**
     * Uploaded filenames are attacker-controlled, so control characters,
     * quotes, and path separators are dropped before they reach the database or
     * the Content-Disposition header of the download response.
     */
    private function originalName(UploadedFile $document): string
    {
        $name = preg_replace('/[\x00-\x1F\x7F"\\\\\/]/', '', $document->getClientOriginalName()) ?? '';

        return mb_substr(trim($name), 0, 255);
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
            'document_original_name' => $this->originalName($document),
            'document_mime' => 'application/pdf',
            'document_size' => $document->getSize(),
        ];
    }

    private function publicDisplayBooking(Booking $booking): array
    {
        return [
            'workUnit' => $booking->work_unit ?: 'Unit kerja tidak tersedia',
            'startTime' => ($booking->alternative_start_time ?? $booking->start_time)->toIso8601String(),
            'endTime' => ($booking->alternative_end_time ?? $booking->end_time)->toIso8601String(),
            'purpose' => $booking->purpose,
        ];
    }

    private function assertBookingLimitsForUser(string $userId, CarbonImmutable $start, CarbonImmutable $end, ?string $exclude = null): void
    {
        $timezone = $this->roomSchedule()->settings()->timezone;
        $leadTimeThreshold = CarbonImmutable::now($timezone)->startOfDay()->addDay();
        if ($start->setTimezone($timezone)->lt($leadTimeThreshold)) {
            throw new ApiException('Peminjaman harus diajukan minimal H-1 sebelum tanggal pemakaian', 422);
        }

        $maxDurationDays = max(1, (int) config('jwt.booking_max_duration_days', 7));
        $maxFutureDays = max(1, (int) config('jwt.booking_max_future_days', 180));
        $maxActivePerUser = max(1, (int) config('jwt.booking_max_active_per_user', 10));
        $maxEnd = $start->addDays($maxDurationDays);
        if ($end->gt($maxEnd)) {
            throw new ApiException('Durasi peminjaman melebihi batas maksimum', 422);
        }
        $maxFuture = CarbonImmutable::now('UTC')->addDays($maxFutureDays);
        if ($start->gt($maxFuture)) {
            throw new ApiException('Tanggal peminjaman terlalu jauh ke depan', 422);
        }
        $activeCount = Booking::query()
            ->where('user_id', $userId)
            ->when($exclude, fn ($query) => $query->whereKeyNot($exclude))
            ->whereIn('status', array_values(self::OVERLAP_STATUSES))
            ->count();
        if ($activeCount >= $maxActivePerUser) {
            throw new ApiException('Batas peminjaman aktif per pengguna tercapai', 429);
        }
    }

    private function resolveSchedule(ResourceType $type, array $data): array
    {
        return $type === ResourceType::ROOM
            ? $this->roomSchedule()->range($data['startDate'], $data['endDate'], RoomBookingSlot::from($data['roomSlot']))
            : [CarbonImmutable::parse($data['startTime']), CarbonImmutable::parse($data['endTime'])];
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
        return $booking->refresh()->load(['room', 'alternativeRoom', 'bookingItems.item']);
    }
}
