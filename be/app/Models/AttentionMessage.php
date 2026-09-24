<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\Role;
use App\Models\Concerns\HasUuid;
use App\Models\Concerns\SerializesCamelCase;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A notice written by an administrator and shown to a role after login.
 *
 * `audience_role` carries a Role value or "ALL", so a briefing aimed at
 * borrowers and a future notice aimed at room managers use the same table.
 */
final class AttentionMessage extends Model
{
    use HasUuid, SerializesCamelCase;

    public const AUDIENCE_ALL = 'ALL';

    public const PLACEMENT_AFTER_LOGIN = 'AFTER_LOGIN';

    public const PLACEMENT_BEFORE_LOGIN = 'BEFORE_LOGIN';

    /** Every role, plus "ALL" for a notice addressed to the whole office. */
    public static function audiences(): array
    {
        return [...array_map(fn (Role $role): string => $role->value, Role::cases()), self::AUDIENCE_ALL];
    }

    /** Where the notice is allowed to appear. */
    public static function placements(): array
    {
        return [self::PLACEMENT_AFTER_LOGIN, self::PLACEMENT_BEFORE_LOGIN];
    }

    protected $fillable = ['id', 'title', 'message', 'audience_role', 'placement', 'is_active', 'sort_order', 'created_by'];

    protected $hidden = ['created_by'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'sort_order' => 'integer'];
    }

    /** The notices a signed-in role actually sees in its post-login dialog. */
    public function scopeVisibleTo(Builder $query, Role $role): Builder
    {
        return $query->where('is_active', true)
            ->where('placement', self::PLACEMENT_AFTER_LOGIN)
            ->whereIn('audience_role', [self::AUDIENCE_ALL, $role->value]);
    }

    /**
     * Notices shown on the sign-in page. The visitor has no role yet, so the
     * audience filter deliberately does not apply here.
     */
    public function scopeVisibleBeforeLogin(Builder $query): Builder
    {
        return $query->where('is_active', true)->where('placement', self::PLACEMENT_BEFORE_LOGIN);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
