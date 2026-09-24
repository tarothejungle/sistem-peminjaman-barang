<?php

declare(strict_types=1);

namespace App\Enums;

enum ResourceType: string
{
    case ROOM = 'ROOM';
    case ITEM = 'ITEM';
}
