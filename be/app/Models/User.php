<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\Role;
use App\Models\Concerns\HasUuid;
use App\Models\Concerns\SerializesCamelCase;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;

final class User extends Authenticatable
{
    use HasUuid, SerializesCamelCase;

    protected $table = 'users';

    protected $fillable = ['full_name', 'username', 'email', 'password_hash', 'role', 'credit_score', 'phone_number', 'profile_image_path', 'profile_image_mime'];

    protected $hidden = ['password_hash', 'profile_image_path', 'profile_image_mime'];

    protected $appends = ['profile_image_url'];

    protected function casts(): array
    {
        return ['role' => Role::class, 'credit_score' => 'integer'];
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function authSessions(): HasMany
    {
        return $this->hasMany(AuthSession::class);
    }

    public function loginActivities(): HasMany
    {
        return $this->hasMany(LoginActivity::class);
    }

    public function passwordResetTokens(): HasMany
    {
        return $this->hasMany(PasswordResetToken::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(UserNotification::class);
    }

    /** Append-only ledger explaining how the credibility score was earned. */
    public function creditEvents(): HasMany
    {
        return $this->hasMany(UserCreditEvent::class);
    }

    /**
     * Administrators, room managers, and department heads carry no credibility
     * score, so it is left out of their payloads instead of being sent as a
     * meaningless default.
     */
    protected function clientAttributes(array $attributes): array
    {
        if (($this->role ?? null) !== Role::PEMOHON) {
            unset($attributes['credit_score']);
        }

        return $attributes;
    }

    public function getProfileImageUrlAttribute(): ?string
    {
        return $this->profile_image_path ? '/profile/photo' : null;
    }
}
