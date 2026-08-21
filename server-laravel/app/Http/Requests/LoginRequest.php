<?php

namespace App\Http\Requests;

final class LoginRequest extends StrictRequest
{
    public function rules(): array
    {
        return ['email' => ['required', 'email', 'max:255'], 'password' => ['required', 'string', 'max:72']];
    }

    protected function allowedFields(): array
    {
        return ['email', 'password'];
    }
}
