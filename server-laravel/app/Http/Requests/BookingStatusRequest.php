<?php

namespace App\Http\Requests;

use App\Enums\BookingStatus;
use Illuminate\Validation\Rule;

final class BookingStatusRequest extends StrictRequest
{
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::enum(BookingStatus::class), Rule::notIn([BookingStatus::PENDING_PJ_REVIEW->value])],
            'approvalNotes' => ['sometimes', 'nullable', 'string', 'min:3', 'max:1000'],
            'rejectionReason' => ['required_if:status,REJECTED', 'nullable', 'string', 'min:3', 'max:1000'],
            'inspectionNotes' => ['sometimes', 'nullable', 'string', 'min:3', 'max:1000'],
            'alternativeStartTime' => ['sometimes', 'nullable', 'date'],
            'alternativeEndTime' => ['sometimes', 'nullable', 'date', 'after:alternativeStartTime'],
        ];
    }

    protected function allowedFields(): array
    {
        return ['status', 'approvalNotes', 'rejectionReason', 'inspectionNotes', 'alternativeStartTime', 'alternativeEndTime'];
    }
}
