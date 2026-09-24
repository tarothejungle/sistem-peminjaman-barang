<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

final class LoginRequest extends StrictRequest
{
    public function rules(): array
    {
        return [
            'username' => ['required', 'string', 'max:50', 'regex:/^[A-Za-z0-9._-]+$/'],
            'password' => ['required', 'string', 'max:72'],
            'captchaToken' => [Rule::requiredIf(config('services.turnstile.enabled')), 'nullable', 'string', 'max:2048'],
        ];
    }

    public function messages(): array
    {
        return [
            'username.regex' => 'Username hanya boleh berisi huruf, angka, titik, garis bawah, dan tanda hubung',
        ];
    }

    protected function allowedFields(): array
    {
        return ['username', 'password', 'captchaToken'];
    }
}
