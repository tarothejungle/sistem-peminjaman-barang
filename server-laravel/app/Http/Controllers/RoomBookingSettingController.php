<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateRoomBookingSettingRequest;
use App\Services\RoomBookingScheduleService;
use Illuminate\Http\JsonResponse;

final class RoomBookingSettingController extends Controller
{
    public function __construct(private readonly RoomBookingScheduleService $schedule) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->schedule->settings()]);
    }

    public function update(UpdateRoomBookingSettingRequest $request): JsonResponse
    {
        $data = $request->validated();
        $settings = $this->schedule->settings();
        $settings->update([
            'morning_start_time' => $data['morningStartTime'].':00',
            'morning_end_time' => $data['morningEndTime'].':00',
            'afternoon_start_time' => $data['afternoonStartTime'].':00',
            'afternoon_end_time' => $data['afternoonEndTime'].':00',
            'start_time' => $data['fullDayStartTime'].':00',
            'end_time' => $data['fullDayEndTime'].':00',
            'updated_by' => $request->attributes->get('auth_user_id'),
        ]);

        return response()->json(['data' => $settings->refresh()]);
    }
}
