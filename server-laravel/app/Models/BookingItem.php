<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use App\Models\Concerns\SerializesCamelCase;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class BookingItem extends Model
{
    use HasUuid, SerializesCamelCase;

    public $timestamps = false;

    protected $fillable = ['booking_id', 'item_id', 'quantity'];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }
}
