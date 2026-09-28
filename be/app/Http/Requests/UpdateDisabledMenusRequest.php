<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Services\DisabledMenuService;
use Illuminate\Validation\Rule;

final class UpdateDisabledMenusRequest extends StrictRequest
{
    public function rules(): array
    {
        return [
            'disabledMenuKeys' => ['required', 'array', 'max:'.count(DisabledMenuService::MENUS)],
            'disabledMenuKeys.*' => ['string', 'distinct', Rule::in(DisabledMenuService::MENUS)],
        ];
    }

    protected function allowedFields(): array
    {
        return ['disabledMenuKeys'];
    }
}
