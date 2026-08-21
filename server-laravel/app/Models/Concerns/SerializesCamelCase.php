<?php

namespace App\Models\Concerns;

use DateTimeInterface;
use Illuminate\Support\Str;

trait SerializesCamelCase
{
    protected function serializeDate(DateTimeInterface $date): string
    {
        return $date->format('Y-m-d\\TH:i:s.v\\Z');
    }

    public function toArray(): array
    {
        return collect(parent::toArray())
            ->mapWithKeys(fn ($value, string $key): array => [Str::camel($key) => $value])
            ->all();
    }
}
