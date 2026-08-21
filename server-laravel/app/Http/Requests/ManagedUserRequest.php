<?php

namespace App\Http\Requests;

final class ManagedUserRequest extends StrictRequest
{
    public function rules(): array
    {
        $creating = $this->isMethod('post');

        return [
            'fullName' => [$creating ? 'required' : 'sometimes', 'string', 'regex:/\S/', 'max:100'],
            'email' => [$creating ? 'required' : 'sometimes', 'email', 'max:255'],
            'password' => [$creating ? 'required' : 'sometimes', 'string', 'min:8'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            if (! $this->isMethod('post') && $this->all() === []) {
                $validator->errors()->add('body', 'Minimal satu field harus diisi');
            }

            if (is_string($this->password) && strlen($this->password) > 72) {
                $validator->errors()->add('password', 'Password maksimal 72 byte');
            }
        });
    }

    protected function allowedFields(): array
    {
        return ['fullName', 'email', 'password'];
    }
}
