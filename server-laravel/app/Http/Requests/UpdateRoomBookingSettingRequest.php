<?php

namespace App\Http\Requests;

final class UpdateRoomBookingSettingRequest extends StrictRequest
{
    public function rules(): array
    {
        return [
            'morningStartTime' => ['required', 'date_format:H:i'],
            'morningEndTime' => ['required', 'date_format:H:i', 'after:morningStartTime', 'before_or_equal:afternoonStartTime'],
            'afternoonStartTime' => ['required', 'date_format:H:i', 'after_or_equal:morningEndTime'],
            'afternoonEndTime' => ['required', 'date_format:H:i', 'after:afternoonStartTime'],
            'fullDayStartTime' => ['required', 'date_format:H:i', 'same:morningStartTime'],
            'fullDayEndTime' => ['required', 'date_format:H:i', 'same:afternoonEndTime'],
        ];
    }

    protected function allowedFields(): array
    {
        return ['morningStartTime', 'morningEndTime', 'afternoonStartTime', 'afternoonEndTime', 'fullDayStartTime', 'fullDayEndTime'];
    }
}
