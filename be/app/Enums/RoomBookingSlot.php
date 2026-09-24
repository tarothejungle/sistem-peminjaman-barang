<?php

declare(strict_types=1);

namespace App\Enums;

enum RoomBookingSlot: string
{
    case MORNING = 'MORNING';
    case AFTERNOON = 'AFTERNOON';
    case FULL_DAY = 'FULL_DAY';
}
