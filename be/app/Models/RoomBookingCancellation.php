<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasUuid;
use App\Models\Concerns\SerializesCamelCase;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class RoomBookingCancellation extends Model
{
    use HasUuid, SerializesCamelCase;

    protected $fillable = [
        'booking_id',
        'room_id',
        'requested_by',
        'requested_by_name',
        'room_name',
        'work_unit',
        'responsible_name',
        'purpose',
        'booking_start_time',
        'booking_end_time',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'booking_start_time' => 'datetime',
            'booking_end_time' => 'datetime',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
