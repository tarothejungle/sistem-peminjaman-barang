<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

final class PostgresTextArray implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): array
    {
        if (is_array($value)) {
            return $value;
        }

        if ($value === null || $value === '{}') {
            return [];
        }

        return str_getcsv(substr((string) $value, 1, -1), ',', '"', '\\');
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): string
    {
        $escaped = array_map(
            fn (string $item): string => '"'.str_replace(['\\', '"'], ['\\\\', '\\"'], $item).'"',
            $value,
        );

        return '{'.implode(',', $escaped).'}';
    }
}
