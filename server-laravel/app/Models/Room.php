<?php

namespace App\Models;

use App\Casts\PostgresTextArray;
use App\Models\Concerns\HasUuid;
use App\Models\Concerns\SerializesCamelCase;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class Room extends Model
{
    use HasUuid, SerializesCamelCase;

    protected $fillable = ['name', 'capacity', 'location', 'facilities', 'is_active', 'image_path', 'image_mime'];

    protected $hidden = ['image_path', 'image_mime'];

    protected $appends = ['image_url'];

    protected function casts(): array
    {
        return ['facilities' => PostgresTextArray::class, 'is_active' => 'boolean'];
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? "/rooms/{$this->id}/image" : null;
    }
}
