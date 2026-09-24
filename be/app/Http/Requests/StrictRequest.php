<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Validator;

abstract class StrictRequest extends FormRequest
{
    /**
     * Accepts an ISO-8601 timestamp that carries an explicit timezone offset
     * (Z or ±hh:mm), so the server never has to guess the client's zone.
     */
    protected const ISO8601_DATETIME = 'regex:/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/';

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

    /**
     * Rejects an update that carries no fields at all, so a no-op PATCH/PUT is
     * reported clearly instead of silently succeeding.
     */
    protected function requireAtLeastOneField(Validator $validator, bool $isUpdate): void
    {
        if ($isUpdate && $this->all() === []) {
            $validator->errors()->add('body', 'Minimal satu field harus diisi');
        }
    }

    /**
     * @return list<string>
     */
    abstract protected function allowedFields(): array;
}
