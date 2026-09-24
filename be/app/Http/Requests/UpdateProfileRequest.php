<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

final class UpdateProfileRequest extends StrictRequest
{
    public function rules(): array
    {
        $userId = $this->attributes->get('auth_user_id');

        return [
            'fullName' => ['sometimes', 'string', 'regex:/\S/', 'max:100'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'phoneNumber' => ['required', 'string', 'regex:/^\+?[0-9][0-9\s-]{7,18}$/', 'max:20'],
        ];
    }

    protected function allowedFields(): array
    {
        return ['fullName', 'email', 'phoneNumber'];
    }
}
