<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\CancelRoomBookingRequest;
use App\Services\RoomBookingCancellationService;
use Illuminate\Http\JsonResponse;

final class RoomBookingCancellationController extends Controller
{
    public function __construct(private readonly RoomBookingCancellationService $cancellations) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->cancellations->history()]);
    }

    public function options(): JsonResponse
    {
        return response()->json(['data' => $this->cancellations->options()]);
    }

    public function store(CancelRoomBookingRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->cancellations->cancel(
                $request->attributes->get('auth_user_id'),
                $request->validated(),
            ),
        ], 201);
    }
}
