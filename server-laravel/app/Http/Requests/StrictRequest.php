<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\ValidationException;

abstract class StrictRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $unknown = array_diff(array_keys($this->all()), $this->allowedFields());
        if ($unknown !== []) {
            throw ValidationException::withMessages(['body' => ['Field tidak dikenal: '.implode(', ', $unknown)]]);
        }
    }

    abstract protected function allowedFields(): array;
}
