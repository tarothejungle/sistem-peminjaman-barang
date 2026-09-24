<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Closure;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

final class UpdateMaintenanceSettingRequest extends StrictRequest
{
    public function rules(): array
    {
        return [
            'isEnabled' => ['required', 'boolean'],
            // Blank means "use the standard notice", so it is stored as null.
            'message' => ['sometimes', 'nullable', 'string', 'max:2000'],
            // The deadline is what reopens the site by itself, so it is
            // mandatory while the switch is on and has to sit in the future.
            'estimatedEndAt' => [
                Rule::requiredIf(fn (): bool => $this->boolean('isEnabled')),
                'nullable',
                'date',
                self::ISO8601_DATETIME,
                function (string $attribute, mixed $value, Closure $fail): void {
                    if ($value === null || ! $this->boolean('isEnabled')) {
                        return;
                    }

                    if (Carbon::parse((string) $value)->isPast()) {
                        $fail('Perkiraan selesai harus waktu yang akan datang.');
                    }
                },
            ],
        ];
    }

    protected function allowedFields(): array
    {
        return ['isEnabled', 'message', 'estimatedEndAt'];
    }
}
