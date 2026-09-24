<?php

declare(strict_types=1);

namespace App\Http\Requests;

final class CancelRoomBookingRequest extends StrictRequest
{
    public function rules(): array
    {
        return [
            'bookingId' => ['required', 'uuid'],
            'reason' => ['required', 'string', 'min:3', 'max:1000'],
        ];
    }

    protected function allowedFields(): array
    {
        return ['bookingId', 'reason'];
    }
}
