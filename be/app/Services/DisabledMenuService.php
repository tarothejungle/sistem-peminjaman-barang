<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\DisabledMenu;
use Illuminate\Support\Facades\DB;

final class DisabledMenuService
{
    public const MENUS = [
        'room-booking',
        'vehicle-booking',
        'booking-status',
        'approvals',
        'room-cancellations',
        'reports',
        'department-heads',
        'room-managers',
        'users',
        'room-booking-settings',
        'rooms',
        'vehicles',
        'attention-messages',
        'maintenance',
    ];

    public function disabledKeys(): array
    {
        return DisabledMenu::query()
            ->where('is_disabled', true)
            ->whereIn('menu_key', self::MENUS)
            ->orderBy('menu_key')
            ->pluck('menu_key')
            ->all();
    }

    public function update(array $disabledKeys, string $userId): array
    {
        DB::transaction(function () use ($disabledKeys, $userId): void {
            foreach (self::MENUS as $menuKey) {
                DisabledMenu::query()->updateOrCreate(
                    ['menu_key' => $menuKey],
                    ['is_disabled' => in_array($menuKey, $disabledKeys, true), 'updated_by' => $userId],
                );
            }
        });

        return $this->disabledKeys();
    }
}
