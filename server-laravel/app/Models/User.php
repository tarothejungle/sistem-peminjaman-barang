<?php

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

    protected $fillable = ['full_name', 'email', 'password_hash', 'role'];

    protected $hidden = ['password_hash'];

    protected function casts(): array
    {
        return ['role' => Role::class];
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function authSessions(): HasMany
    {
        return $this->hasMany(AuthSession::class);
    }
}
