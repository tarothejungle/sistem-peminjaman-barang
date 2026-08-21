<?php

namespace App\Enums;

enum Role: string
{
    case PEMOHON = 'PEMOHON';
    case PJ_RUANGAN = 'PJ_RUANGAN';
    case KABAG_UMUM = 'KABAG_UMUM';
}
