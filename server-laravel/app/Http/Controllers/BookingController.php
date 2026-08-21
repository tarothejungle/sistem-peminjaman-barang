<?php

namespace App\Http\Controllers;

use App\Enums\BookingStatus;
use App\Exceptions\ApiException;
use App\Http\Requests\BookingAvailabilityRequest;
use App\Http\Requests\BookingStatusRequest;
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
        $this->assertUuid($id);

        return response()->json(['data' => $this->bookings->updatePending($id, $request->attributes->get('auth_user_id'), $request->validated())]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->assertUuid($id);
        $this->bookings->deletePending($id, $request->attributes->get('auth_user_id'));

        return response()->json(['data' => ['message' => 'Pengajuan berhasil dihapus']]);
    }

    public function confirmFinished(Request $request, string $id): JsonResponse
    {
        $this->assertUuid($id);
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

    public function mine(Request $request): JsonResponse
    {
        return response()->json(['data' => Booking::with(['room', 'bookingItems.item'])->where('user_id', $request->attributes->get('auth_user_id'))->latest()->get()]);
    }

    public function document(Request $request, string $id): StreamedResponse
    {
        $this->assertUuid($id);
        $booking = Booking::find($id) ?? throw new ApiException('Peminjaman tidak ditemukan', 404);
        $role = $request->attributes->get('auth_role');
        $isOwner = $booking->user_id === $request->attributes->get('auth_user_id');
        $isManager = in_array($role?->value, ['PJ_RUANGAN', 'KABAG_UMUM'], true);
        if (! $isOwner && ! $isManager) {
            throw new ApiException('Surat peminjaman tidak ditemukan', 404);
        }
        if (! $booking->document_path || ! Storage::disk('local')->exists($booking->document_path)) {
            throw new ApiException('Surat peminjaman tidak ditemukan', 404);
        }

        return Storage::disk('local')->download(
            $booking->document_path,
            basename($booking->document_original_name ?: 'surat-peminjaman.pdf'),
            ['Content-Type' => 'application/pdf', 'X-Content-Type-Options' => 'nosniff'],
        );
    }

    public function index(Request $request): JsonResponse
    {
        $request->validate(['status' => ['sometimes', Rule::enum(BookingStatus::class)]]);
        if (array_diff(array_keys($request->query()), ['status']) !== []) {
            throw new ApiException('Data tidak valid', 400, ['status' => ['Parameter tidak dikenal']]);
        }
        $query = Booking::with(['room', 'bookingItems.item', 'user:id,full_name,email,role'])->latest();
        if ($request->query('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json(['data' => $query->get()]);
    }

    public function pendingCount(Request $request): JsonResponse
    {
        $role = $request->attributes->get('auth_role');
        $statuses = $role?->value === 'PJ_RUANGAN'
            ? [BookingStatus::PENDING_PJ_REVIEW->value, BookingStatus::PREPARING->value]
            : [BookingStatus::PENDING_KABAG_APPROVAL->value];

        return response()->json(['data' => ['count' => Booking::whereIn('status', $statuses)->count()]]);
    }

    public function status(BookingStatusRequest $request, string $id): JsonResponse
    {
        $this->assertUuid($id);
        $status = BookingStatus::from($request->validated('status'));
        if (in_array($status, [BookingStatus::PENDING_PJ_REVIEW, BookingStatus::PREPARING, BookingStatus::PENDING_KABAG_APPROVAL, BookingStatus::APPROVED, BookingStatus::REJECTED], true)) {
            throw new ApiException('Status hanya dapat diubah melalui tahap alur kerja yang sesuai', 400);
        }

        return response()->json(['data' => $this->bookings->updateStatus($id, $status, $request->validated())]);
    }

    public function pjReview(WorkflowRequest $request, string $id): JsonResponse
    {
        $this->assertUuid($id);
        $data = $request->validated();
        $status = BookingStatus::tryFrom($data['status'] ?? BookingStatus::PREPARING->value);
        if (! in_array($status, [BookingStatus::PREPARING, BookingStatus::REJECTED], true)) {
            throw new ApiException('Data tidak valid', 400, ['status' => ['Status tidak valid']]);
        }
        if ($status === BookingStatus::REJECTED && empty($data['rejectionReason'])) {
            throw new ApiException('Data tidak valid', 400, ['rejectionReason' => ['Alasan penolakan wajib diisi']]);
        }

        return response()->json(['data' => $this->bookings->transition($id, BookingStatus::PENDING_PJ_REVIEW, $status, $data)]);
    }

    public function kabagApprove(WorkflowRequest $request, string $id): JsonResponse
    {
        $this->assertUuid($id);
        $data = $request->validated();
        $status = BookingStatus::tryFrom($data['status'] ?? '');
        if (! in_array($status, [BookingStatus::APPROVED, BookingStatus::REJECTED, BookingStatus::ALTERNATIVE_OFFERED], true)) {
            throw new ApiException('Data tidak valid', 400, ['status' => ['Status tidak valid']]);
        }
        if ($status === BookingStatus::REJECTED && empty($data['rejectionReason'])) {
            throw new ApiException('Data tidak valid', 400, ['rejectionReason' => ['Alasan penolakan wajib diisi']]);
        }
        if ($status === BookingStatus::ALTERNATIVE_OFFERED && (empty($data['alternativeStartTime']) || empty($data['alternativeEndTime']))) {
            throw new ApiException('Data tidak valid', 400, ['alternativeStartTime' => ['Waktu alternatif wajib diisi']]);
        }

        return response()->json(['data' => $this->bookings->transition($id, BookingStatus::PENDING_KABAG_APPROVAL, $status, $data)]);
    }

    public function pjConfirm(WorkflowRequest $request, string $id): JsonResponse
    {
        $this->assertUuid($id);
        $data = $request->validated();
        if (isset($data['status']) && $data['status'] !== BookingStatus::PENDING_KABAG_APPROVAL->value) {
            throw new ApiException('Data tidak valid', 400, ['status' => ['Status tidak valid']]);
        }

        return response()->json(['data' => $this->bookings->transition($id, BookingStatus::PREPARING, BookingStatus::PENDING_KABAG_APPROVAL, $data)]);
    }

    public function pjInspect(WorkflowRequest $request, string $id): JsonResponse
    {
        $this->assertUuid($id);
        $data = $request->validated();
        if (isset($data['status']) && $data['status'] !== BookingStatus::COMPLETED->value) {
            throw new ApiException('Data tidak valid', 400, ['status' => ['Status tidak valid']]);
        }

        return response()->json(['data' => $this->bookings->transition($id, BookingStatus::FINISHED_PENDING_INSPECTION, BookingStatus::COMPLETED, $data)]);
    }

    private function assertUuid(string $id): void
    {
        if (! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $id)) {
            throw new ApiException('ID peminjaman tidak valid', 400);
        }
    }
}
