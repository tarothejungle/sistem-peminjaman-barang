<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\BookingStatus;
use App\Enums\Role;
use App\Exceptions\ApiException;
use App\Http\Requests\BookingAvailabilityRequest;
use App\Http\Requests\CreateBookingRequest;
use App\Http\Requests\UpdateBookingRequest;
use App\Http\Requests\WorkflowRequest;
use App\Models\Booking;
use App\Services\BookingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class BookingController extends Controller
{
    public function __construct(private readonly BookingService $bookings) {}

    public function store(CreateBookingRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->bookings->create($request->attributes->get('auth_user_id'), $request->validated())], 201);
    }

    public function update(UpdateBookingRequest $request, string $id): JsonResponse
    {
        $this->assertUuid($id, 'ID peminjaman tidak valid');

        return response()->json(['data' => $this->bookings->updatePending($id, $request->attributes->get('auth_user_id'), $request->validated())]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->assertUuid($id, 'ID peminjaman tidak valid');
        $this->bookings->deletePending($id, $request->attributes->get('auth_user_id'));

        return response()->json(['data' => ['message' => 'Pengajuan berhasil dihapus']]);
    }

    public function confirmFinished(Request $request, string $id): JsonResponse
    {
        $this->assertUuid($id, 'ID peminjaman tidak valid');
        if ($request->all() !== []) {
            throw new ApiException('Data tidak valid', 400, ['body' => ['Request tidak boleh memiliki data']]);
        }

        return response()->json(['data' => $this->bookings->confirmFinished($id, $request->attributes->get('auth_user_id'))]);
    }

    public function availability(BookingAvailabilityRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->bookings->availability($request->validated(), $request->attributes->get('auth_user_id'))]);
    }

    public function availabilitySummary(): JsonResponse
    {
        return response()->json(['data' => $this->bookings->availabilitySummary()]);
    }

    public function roomDisplay(): JsonResponse
    {
        return response()->json(['data' => $this->bookings->roomDisplay()]);
    }

    public function mine(Request $request): JsonResponse
    {
        $bookings = Booking::with(['room', 'alternativeRoom', 'bookingItems.item'])->where('user_id', $request->attributes->get('auth_user_id'))->latest()->get();
        $this->hideProcessingActorsUnlessManager($bookings, $request->attributes->get('auth_role'));

        return response()->json(['data' => $bookings]);
    }

    public function document(Request $request, string $id): StreamedResponse
    {
        return $this->downloadLetter($request, $id, 'document_path', 'document_original_name', 'surat-peminjaman.pdf', 'Surat peminjaman');
    }

    public function suratTugas(Request $request, string $id): StreamedResponse
    {
        return $this->downloadLetter($request, $id, 'surat_tugas_path', 'surat_tugas_original_name', 'surat-tugas.pdf', 'Surat Tugas');
    }

    /**
     * Both letters live on the private disk, so both are streamed through the
     * same ownership check instead of being reachable by URL.
     */
    private function downloadLetter(Request $request, string $id, string $pathColumn, string $nameColumn, string $fallbackName, string $label): StreamedResponse
    {
        $this->assertUuid($id, 'ID peminjaman tidak valid');
        $booking = Booking::find($id) ?? throw new ApiException('Peminjaman tidak ditemukan', 404);
        $role = $request->attributes->get('auth_role');
        $isOwner = $booking->user_id === $request->attributes->get('auth_user_id');
        $isManager = $role instanceof Role && ($role === Role::PJ_RUANGAN || $role->isAdministrator());
        $path = $booking->{$pathColumn};
        if ((! $isOwner && ! $isManager) || ! $path || ! Storage::disk('local')->exists($path)) {
            throw new ApiException($label.' tidak ditemukan', 404);
        }

        return Storage::disk('local')->download(
            $path,
            basename($booking->{$nameColumn} ?: $fallbackName),
            ['Content-Type' => 'application/pdf', 'X-Content-Type-Options' => 'nosniff'],
        );
    }

    public function index(Request $request): JsonResponse
    {
        $request->validate(['status' => ['sometimes', Rule::enum(BookingStatus::class)]]);
        if (array_diff(array_keys($request->query()), ['status']) !== []) {
            throw new ApiException('Data tidak valid', 400, ['status' => ['Parameter tidak dikenal']]);
        }
        $query = Booking::with(['room', 'alternativeRoom', 'bookingItems.item', 'user:id,full_name,email,role'])->latest();
        if ($request->query('status')) {
            $query->where('status', $request->query('status'));
        }

        $bookings = $query->get();
        $this->hideProcessingActorsUnlessManager($bookings, $request->attributes->get('auth_role'));

        return response()->json(['data' => $bookings]);
    }

    public function pjReview(WorkflowRequest $request, string $id): JsonResponse
    {
        $this->assertUuid($id, 'ID peminjaman tidak valid');
        $data = $request->validated();
        $status = BookingStatus::tryFrom($data['status'] ?? BookingStatus::PREPARING->value);
        if ($status !== null && ! in_array($status, [BookingStatus::PREPARING, BookingStatus::REJECTED], true)) {
            throw new ApiException('Data tidak valid', 400, ['status' => ['Status tidak valid']]);
        }
        if ($status === BookingStatus::REJECTED && empty($data['rejectionReason'])) {
            throw new ApiException('Data tidak valid', 400, ['rejectionReason' => ['Alasan penolakan wajib diisi']]);
        }

        return response()->json(['data' => $this->bookings->transition($id, BookingStatus::PENDING_PJ_REVIEW, $status ?? BookingStatus::PREPARING, $data, $request->attributes->get('auth_user_id'))]);
    }

    public function kabagApprove(WorkflowRequest $request, string $id): JsonResponse
    {
        $this->assertUuid($id, 'ID peminjaman tidak valid');
        $data = $request->validated();
        $status = BookingStatus::tryFrom($data['status'] ?? '');
        if (! in_array($status, [BookingStatus::APPROVED, BookingStatus::REJECTED], true)) {
            throw new ApiException('Data tidak valid', 400, ['status' => ['Status tidak valid']]);
        }
        if ($status === BookingStatus::REJECTED && empty($data['rejectionReason'])) {
            throw new ApiException('Data tidak valid', 400, ['rejectionReason' => ['Alasan penolakan wajib diisi']]);
        }

        return response()->json(['data' => $this->bookings->transition($id, BookingStatus::PENDING_KABAG_APPROVAL, $status, $data, $request->attributes->get('auth_user_id'))]);
    }

    public function alternative(WorkflowRequest $request, string $id): JsonResponse
    {
        $this->assertUuid($id, 'ID peminjaman tidak valid');
        $data = $request->validated();
        $hasSlot = ! empty($data['alternativeDate']) && ! empty($data['alternativeRoomSlot']);
        $hasRange = ! empty($data['alternativeStartTime']) && ! empty($data['alternativeEndTime']);
        if (empty($data['alternativeRoomId']) || (! $hasSlot && ! $hasRange)) {
            throw new ApiException('Data tidak valid', 400, ['alternativeRoomId' => ['Ruang, tanggal, dan kategori jam alternatif wajib diisi']]);
        }

        return response()->json(['data' => $this->bookings->relocateMainRoomBooking($id, $data, $request->attributes->get('auth_user_id'), $request->attributes->get('auth_role'))]);
    }

    public function pjConfirm(WorkflowRequest $request, string $id): JsonResponse
    {
        $this->assertUuid($id, 'ID peminjaman tidak valid');
        $data = $request->validated();

        return response()->json(['data' => $this->bookings->transition($id, BookingStatus::PREPARING, BookingStatus::PENDING_KABAG_APPROVAL, $data, $request->attributes->get('auth_user_id'))]);
    }

    public function pjInspect(WorkflowRequest $request, string $id): JsonResponse
    {
        $this->assertUuid($id, 'ID peminjaman tidak valid');
        $data = $request->validated();
        if (isset($data['status']) && $data['status'] !== BookingStatus::COMPLETED->value) {
            throw new ApiException('Data tidak valid', 400, ['status' => ['Status tidak valid']]);
        }

        return response()->json(['data' => $this->bookings->transition($id, BookingStatus::FINISHED_PENDING_INSPECTION, BookingStatus::COMPLETED, $data, $request->attributes->get('auth_user_id'))]);
    }

    private function hideProcessingActorsUnlessManager(iterable $bookings, mixed $role): void
    {
        if (in_array($role, [Role::PJ_RUANGAN, Role::KASUBAG_UMUM], true)) {
            return;
        }

        foreach ($bookings as $booking) {
            $booking->makeHidden([
                'pj_reviewed_by',
                'pj_reviewer_name',
                'kasubag_reviewed_by',
                'kasubag_reviewer_name',
                'rejected_by',
                'rejected_by_name',
            ]);
        }
    }
}
