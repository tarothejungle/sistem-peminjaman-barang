<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\RoomBookingSlot;
use Illuminate\Validation\Rule;

final class WorkflowRequest extends StrictRequest
{
    public function rules(): array
    {
        $rules = [
            'status' => ['sometimes', 'string'],
            'approvalNotes' => ['sometimes', 'nullable', 'string', 'min:3', 'max:1000'],
            'rejectionReason' => ['sometimes', 'nullable', 'string', 'min:3', 'max:1000'],
            'inspectionNotes' => ['sometimes', 'nullable', 'string', 'min:3', 'max:1000'],
            'alternativeStartTime' => ['sometimes', 'nullable', 'date'],
            'alternativeEndTime' => ['sometimes', 'nullable', 'date', 'after:alternativeStartTime'],
            'alternativeRoomId' => ['sometimes', 'nullable', 'uuid'],
            'alternativeDate' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'alternativeRoomSlot' => ['sometimes', 'nullable', Rule::enum(RoomBookingSlot::class)],
        ];

        return array_intersect_key($rules, array_flip($this->allowedFields()));
    }

    protected function allowedFields(): array
    {
        return match ($this->route()?->getActionMethod()) {
            'pjReview' => ['status', 'approvalNotes', 'rejectionReason'],
            'pjConfirm' => ['status', 'approvalNotes'],
            'pjInspect' => ['status', 'inspectionNotes'],
            'kabagApprove' => ['status', 'approvalNotes', 'rejectionReason'],
            'alternative' => ['alternativeStartTime', 'alternativeEndTime', 'alternativeRoomId', 'alternativeDate', 'alternativeRoomSlot'],
            default => [],
        };
    }
}
