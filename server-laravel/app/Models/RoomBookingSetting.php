<?php

namespace App\Models;

use App\Models\Concerns\SerializesCamelCase;
use Illuminate\Database\Eloquent\Model;

final class RoomBookingSetting extends Model
{
    use SerializesCamelCase;

    public $incrementing = false;

    protected $fillable = [
        'id',
        'start_time',
        'end_time',
        'morning_start_time',
        'morning_end_time',
        'afternoon_start_time',
        'afternoon_end_time',
        'timezone',
        'updated_by',
    ];

    protected $hidden = ['updated_by'];
}
