<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use App\Models\Concerns\SerializesCamelCase;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class Item extends Model
{
    use HasUuid, SerializesCamelCase;

    protected $fillable = ['name', 'total_stock', 'category', 'is_active', 'image_path', 'image_mime'];

    protected $hidden = ['image_path', 'image_mime'];

    protected $appends = ['image_url'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function bookingItems(): HasMany
    {
        return $this->hasMany(BookingItem::class);
    }

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? "/items/{$this->id}/image" : null;
    }
}
