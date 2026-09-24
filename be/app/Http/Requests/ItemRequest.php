<?php

declare(strict_types=1);

namespace App\Http\Requests;

final class ItemRequest extends StrictRequest
{
    public function rules(): array
    {
        $required = $this->isMethod('post') && ! $this->route('id') ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'regex:/\S/', 'max:100'],
            'totalStock' => [$required, 'integer', 'min:0'],
            'category' => [$required, 'string', 'regex:/\S/', 'max:50'],
            // Blank is allowed so the UI can clear a plate; the controller stores null.
            'plateNumber' => ['sometimes', 'nullable', 'string', 'max:20'],
            'image' => ['sometimes', 'file', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp', 'max:5120'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(fn ($validator) => $this->requireAtLeastOneField($validator, (bool) $this->route('id')));
    }

    protected function allowedFields(): array
    {
        return ['name', 'totalStock', 'category', 'plateNumber', 'image'];
    }
}
