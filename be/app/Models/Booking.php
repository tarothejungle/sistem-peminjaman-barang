<?php

declare(strict_types=1);

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

    protected $fillable = ['user_id', 'resource_type', 'room_id', 'responsible_name', 'phone_number', 'work_unit', 'start_time', 'end_time', 'purpose', 'status', 'returned_at', 'auto_confirmed_at', 'alternative_room_id', 'alternative_start_time', 'alternative_end_time', 'approval_notes', 'inspection_notes', 'rejection_reason', 'pj_reviewed_by', 'pj_reviewer_name', 'kasubag_reviewed_by', 'kasubag_reviewer_name', 'rejected_by', 'rejected_by_name', 'document_disk', 'document_path', 'document_original_name', 'document_mime', 'document_size', 'surat_tugas_disk', 'surat_tugas_path', 'surat_tugas_original_name', 'surat_tugas_mime', 'surat_tugas_size'];

    /** Private storage details never leave the server; the UI gets the file name only. */
    protected $hidden = ['document_disk', 'document_path', 'document_mime', 'surat_tugas_disk', 'surat_tugas_path', 'surat_tugas_mime'];

    protected function casts(): array
    {
        return [
            'resource_type' => ResourceType::class,
            'status' => BookingStatus::class,
            'returned_at' => 'datetime',
            'auto_confirmed_at' => 'datetime',
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

    public function alternativeRoom(): BelongsTo
    {
        return $this->belongsTo(Room::class, 'alternative_room_id');
    }

    public function bookingItems(): HasMany
    {
        return $this->hasMany(BookingItem::class);
    }
}
