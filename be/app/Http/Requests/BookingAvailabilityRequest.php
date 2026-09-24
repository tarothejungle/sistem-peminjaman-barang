<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\ResourceType;
use App\Enums\RoomBookingSlot;
use Illuminate\Validation\Rule;

final class BookingAvailabilityRequest extends StrictRequest
{
    public function rules(): array
    {
        return [
            'resourceType' => ['required', Rule::enum(ResourceType::class)],
            'roomId' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', 'uuid'],
            'startDate' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', 'date_format:Y-m-d'],
            'endDate' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', 'date_format:Y-m-d', 'after_or_equal:startDate'],
            'roomSlot' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', Rule::enum(RoomBookingSlot::class)],
            'bookingId' => ['sometimes', 'uuid'],
            'itemId' => ['required_if:resourceType,ITEM', 'prohibited_if:resourceType,ROOM', 'uuid'],
            'quantity' => ['required_if:resourceType,ITEM', 'prohibited_if:resourceType,ROOM', 'integer', 'min:1'],
            'startTime' => ['required_if:resourceType,ITEM', 'prohibited_if:resourceType,ROOM', 'date', self::ISO8601_DATETIME],
            'endTime' => ['required_if:resourceType,ITEM', 'prohibited_if:resourceType,ROOM', 'date', self::ISO8601_DATETIME, 'after:startTime'],
        ];
    }

    protected function allowedFields(): array
    {
        return ['resourceType', 'roomId', 'startDate', 'endDate', 'roomSlot', 'bookingId', 'itemId', 'quantity', 'startTime', 'endTime'];
    }
}
