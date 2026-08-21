<?php

namespace App\Models;

use App\Enums\BookingStatus;
use App\Enums\ResourceType;
use App\Models\Concerns\HasUuid;
use App\Models\Concerns\SerializesCamelCase;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class Booking extends Model
{
    use HasUuid, SerializesCamelCase;

    protected $fillable = ['user_id', 'resource_type', 'room_id', 'start_time', 'end_time', 'purpose', 'status', 'alternative_start_time', 'alternative_end_time', 'approval_notes', 'inspection_notes', 'rejection_reason', 'document_disk', 'document_path', 'document_original_name', 'document_mime', 'document_size'];

    protected $hidden = ['document_disk', 'document_path', 'document_mime'];

    protected function casts(): array
    {
        return [
            'resource_type' => ResourceType::class,
            'status' => BookingStatus::class,
            'start_time' => 'datetime',
            'end_time' => 'datetime',
            'alternative_start_time' => 'datetime',
            'alternative_end_time' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function bookingItems(): HasMany
    {
        return $this->hasMany(BookingItem::class);
    }
}
