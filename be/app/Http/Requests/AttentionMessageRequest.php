<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\AttentionMessage;
use Illuminate\Validation\Rule;

final class AttentionMessageRequest extends StrictRequest
{
    public function rules(): array
    {
        $creating = ! $this->route('id');
        $required = $creating ? 'required' : 'sometimes';

        return [
            'title' => [$required, 'string', 'regex:/\S/', 'min:3', 'max:150'],
            'message' => [$required, 'string', 'regex:/\S/', 'min:5', 'max:2000'],
            'audienceRole' => [$required, Rule::in(AttentionMessage::audiences())],
            'isActive' => ['sometimes', 'boolean'],
            'placement' => ['sometimes', Rule::in(AttentionMessage::placements())],
            'sortOrder' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(fn ($validator) => $this->requireAtLeastOneField($validator, (bool) $this->route('id')));
    }

    protected function allowedFields(): array
    {
        return ['title', 'message', 'audienceRole', 'isActive', 'placement', 'sortOrder'];
    }
}
