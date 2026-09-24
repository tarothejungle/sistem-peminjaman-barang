<?php

declare(strict_types=1);

namespace App\Http\Requests;

final class RoomRequest extends StrictRequest
{
    public function rules(): array
    {
        $required = $this->isMethod('post') && ! $this->route('id') ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'regex:/\S/', 'max:100'],
            'capacity' => [$required, 'integer', 'min:1'],
            'location' => [$required, 'string', 'regex:/\S/', 'max:100'],
            'facilities' => [$required, 'array'],
            'facilities.*' => ['string', 'regex:/\S/', 'max:100'],
            'image' => ['sometimes', 'file', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp', 'max:5120'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(fn ($validator) => $this->requireAtLeastOneField($validator, (bool) $this->route('id')));
    }

    protected function allowedFields(): array
    {
        return ['name', 'capacity', 'location', 'facilities', 'image'];
    }
}
