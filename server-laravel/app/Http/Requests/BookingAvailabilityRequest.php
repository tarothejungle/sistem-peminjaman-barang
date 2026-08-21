<?php

namespace App\Http\Requests;

use App\Enums\RoomBookingSlot;
use Illuminate\Validation\Rule;

final class BookingAvailabilityRequest extends StrictRequest
{
    public function rules(): array
    {
        return [
            'resourceType' => ['required', Rule::in(['ROOM', 'ITEM'])],
            'roomId' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', 'uuid'],
            'startDate' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', 'date_format:Y-m-d'],
            'endDate' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', 'date_format:Y-m-d', 'after_or_equal:startDate'],
            'roomSlot' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', Rule::enum(RoomBookingSlot::class)],
            'bookingId' => ['sometimes', 'uuid'],
            'itemId' => ['required_if:resourceType,ITEM', 'prohibited_if:resourceType,ROOM', 'uuid'],
            'quantity' => ['required_if:resourceType,ITEM', 'prohibited_if:resourceType,ROOM', 'integer', 'min:1'],
            'startTime' => ['required_if:resourceType,ITEM', 'prohibited_if:resourceType,ROOM', 'date', 'regex:/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/'],
            'endTime' => ['required_if:resourceType,ITEM', 'prohibited_if:resourceType,ROOM', 'date', 'regex:/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/', 'after:startTime'],
        ];
    }

    protected function allowedFields(): array
    {
        return ['resourceType', 'roomId', 'startDate', 'endDate', 'roomSlot', 'bookingId', 'itemId', 'quantity', 'startTime', 'endTime'];
    }
}
