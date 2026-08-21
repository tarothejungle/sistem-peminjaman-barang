<?php

namespace App\Http\Requests;

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
        ];

        return array_intersect_key($rules, array_flip($this->allowedFields()));
    }

    protected function allowedFields(): array
    {
        return match ($this->route()?->getActionMethod()) {
            'pjReview' => ['status', 'approvalNotes', 'rejectionReason'],
            'pjConfirm' => ['status', 'approvalNotes'],
            'pjInspect' => ['status', 'inspectionNotes'],
            default => ['status', 'approvalNotes', 'rejectionReason', 'inspectionNotes', 'alternativeStartTime', 'alternativeEndTime'],
        };
    }
}
