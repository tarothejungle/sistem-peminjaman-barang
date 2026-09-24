<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\SerializesCamelCase;
use Illuminate\Database\Eloquent\Model;

/** Single row (id = 1) holding the maintenance switch and its notice text. */
final class MaintenanceSetting extends Model
{
    use SerializesCamelCase;

    public $incrementing = false;

    protected $fillable = ['id', 'is_enabled', 'message', 'estimated_end_at', 'updated_by'];

    protected $hidden = ['updated_by'];

    protected function casts(): array
    {
        return ['is_enabled' => 'boolean', 'estimated_end_at' => 'datetime'];
    }

    /**
     * The switch is on, but the announced window has already closed.
     *
     * A row without an estimate (only possible for rows written before the
     * deadline became mandatory) never expires on its own.
     */
    public function hasExpired(): bool
    {
        return $this->is_enabled
            && $this->estimated_end_at !== null
            && $this->estimated_end_at->isPast();
    }
}
