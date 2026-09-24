<?php

declare(strict_types=1);

namespace App\Http\Requests;

final class ForgotPasswordRequest extends StrictRequest
{
    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'max:255'],
        ];
    }

    protected function allowedFields(): array
    {
        return ['email'];
    }
}
