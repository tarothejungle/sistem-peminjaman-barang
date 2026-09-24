<?php

declare(strict_types=1);

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
        return collect($this->clientAttributes(parent::toArray()))
            ->mapWithKeys(fn ($value, string $key): array => [Str::camel($key) => $value])
            ->all();
    }

    /**
     * Last chance to add or trim attributes before they are camelCased, so a
     * model can keep a column out of the payload without touching serialization.
     */
    protected function clientAttributes(array $attributes): array
    {
        return $attributes;
    }
}
