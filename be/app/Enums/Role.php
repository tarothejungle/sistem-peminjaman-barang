<?php

declare(strict_types=1);

namespace App\Enums;

enum Role: string
{
    case PEMOHON = 'PEMOHON';
    case PJ_RUANGAN = 'PJ_RUANGAN';
    case KABAG_UMUM = 'KABAG_UMUM';
    case KASUBAG_UMUM = 'KASUBAG_UMUM';

    /**
     * Roles holding full system administration rights.
     *
     * @return list<self>
     */
    public static function administrators(): array
    {
        return [self::KABAG_UMUM, self::KASUBAG_UMUM];
    }

    /**
     * Roles allowed to act on the approval queue.
     *
     * KABAG_UMUM is a monitoring (read-only) role, so approving and rejecting
     * bookings stay with KASUBAG_UMUM.
     *
     * @return list<self>
     */
    public static function approvers(): array
    {
        return [self::KASUBAG_UMUM];
    }

    public function isAdministrator(): bool
    {
        return in_array($this, self::administrators(), true);
    }
}
