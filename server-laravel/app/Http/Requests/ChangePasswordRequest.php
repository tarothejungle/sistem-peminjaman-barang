<?php

namespace App\Http\Requests;

final class ChangePasswordRequest extends StrictRequest
{
    public function rules(): array
    {
        return [
            'currentPassword' => ['required', 'string', 'max:72'],
            'newPassword' => ['required', 'string', 'min:8', 'max:72', 'confirmed', 'different:currentPassword'],
        ];
    }

    protected function allowedFields(): array
    {
        return ['currentPassword', 'newPassword', 'newPassword_confirmation'];
    }
}
