<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\Role;
use Illuminate\Validation\Rule;

final class ManagedUserRequest extends StrictRequest
{
    public function rules(): array
    {
        $creating = $this->isMethod('post');

        $rules = [
            'fullName' => [$creating ? 'required' : 'sometimes', 'string', 'regex:/\S/', 'max:100'],
            'username' => [
                $creating ? 'required' : 'sometimes',
                'string',
                'min:3',
                'max:50',
                'regex:/^[A-Za-z0-9._-]+$/',
            ],
            'email' => [$creating ? 'required' : 'sometimes', 'email', 'max:255'],
            'password' => [$creating ? 'required' : 'sometimes', 'string', 'min:12'],
        ];

        if ($this->allowsRoleSelection()) {
            $rules['role'] = [
                'sometimes',
                Rule::in(array_map(static fn (Role $role): string => $role->value, Role::administrators())),
            ];
        }

        return $rules;
    }

    public function messages(): array
    {
        return [
            'username.regex' => 'Username hanya boleh berisi huruf, angka, titik, garis bawah, dan tanda hubung',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $this->requireAtLeastOneField($validator, ! $this->isMethod('post'));

            if (is_string($this->password) && strlen($this->password) > 72) {
                $validator->errors()->add('password', 'Password maksimal 72 byte');
            }
        });
    }

    protected function allowedFields(): array
    {
        $fields = ['fullName', 'username', 'email', 'password'];

        if ($this->allowsRoleSelection()) {
            $fields[] = 'role';
        }

        return $fields;
    }

    /**
     * Only the "Data Kabag & Kasubag" endpoints accept a role; the other menus
     * derive the role from the route so it cannot be escalated from the payload.
     */
    private function allowsRoleSelection(): bool
    {
        return $this->routeIs('*department-heads*') || str_contains($this->path(), 'department-heads');
    }
}
