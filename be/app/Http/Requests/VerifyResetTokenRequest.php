<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesResetToken;

final class VerifyResetTokenRequest extends StrictRequest
{
    use ValidatesResetToken;

    public function rules(): array
    {
        return [
            'token' => $this->resetTokenRules(),
        ];
    }

    public function messages(): array
    {
        return $this->resetTokenMessages();
    }

    protected function allowedFields(): array
    {
        return ['token'];
    }
}
