<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\MaintenanceSetting;

/**
 * Reads and writes the site-wide maintenance switch.
 *
 * The announced deadline is authoritative: reading the row is all it takes to
 * reopen the site once `estimated_end_at` has passed, so nobody has to be awake
 * at the right minute to flip the switch back.
 */
final class MaintenanceService
{
    public const DEFAULT_NOTICE = 'Website sedang dalam perbaikan terjadwal. Kami mohon maaf atas ketidaknyamanannya, silakan coba beberapa saat lagi.';

    public function settings(): MaintenanceSetting
    {
        return $this->closeIfWindowEnded(
            MaintenanceSetting::query()->firstOrCreate(['id' => 1], ['is_enabled' => false]),
        );
    }

    public function isEnabled(): bool
    {
        return (bool) $this->settings()->is_enabled;
    }

    /**
     * The deadline doubles as the schedule: once it passes the switch flips
     * itself off, so a forgotten switch cannot lock the office out overnight.
     */
    private function closeIfWindowEnded(MaintenanceSetting $settings): MaintenanceSetting
    {
        if (! $settings->hasExpired()) {
            return $settings;
        }

        // Conditional write: a request that loses the race still sees the
        // closed switch, and only the winner may report a change.
        MaintenanceSetting::query()
            ->whereKey(1)
            ->where('is_enabled', true)
            ->update(['is_enabled' => false]);

        return $settings->refresh();
    }

    public function update(array $data, string $userId): MaintenanceSetting
    {
        $settings = $this->settings();
        $settings->update([
            'is_enabled' => $data['isEnabled'],
            'message' => array_key_exists('message', $data) && trim((string) $data['message']) !== '' ? trim($data['message']) : null,
            'estimated_end_at' => $data['estimatedEndAt'] ?? null,
            'updated_by' => $userId,
        ]);

        return $settings->refresh();
    }

    /** What visitors read: the administrator's wording, or the standard notice. */
    public function noticeText(MaintenanceSetting $settings): string
    {
        $message = trim((string) $settings->message);

        return $message !== '' ? $message : self::DEFAULT_NOTICE;
    }
}
