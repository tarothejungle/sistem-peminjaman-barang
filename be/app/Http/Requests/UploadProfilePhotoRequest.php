<?php

declare(strict_types=1);

namespace App\Http\Requests;

final class UploadProfilePhotoRequest extends StrictRequest
{
    public function rules(): array
    {
        return [
            'image' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp', 'max:2048'],
        ];
    }

    protected function allowedFields(): array
    {
        return ['image'];
    }
}
