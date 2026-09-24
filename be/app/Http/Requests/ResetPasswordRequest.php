<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesResetToken;

final class ResetPasswordRequest extends StrictRequest
{
    use ValidatesResetToken;

    public function rules(): array
    {
        return [
            'token' => $this->resetTokenRules(),
            'password' => ['required', 'string', 'min:12', 'max:72', 'confirmed'],
        ];
    }

    public function messages(): array
    {
        return $this->resetTokenMessages();
    }

    protected function allowedFields(): array
    {
        return ['token', 'password', 'password_confirmation'];
    }
}
