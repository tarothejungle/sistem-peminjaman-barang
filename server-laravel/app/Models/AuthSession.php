<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class AuthSession extends Model
{
    use HasUuid;

    protected $fillable = [
        'user_id',
        'refresh_token_hash',
        'last_activity_at',
        'expires_at',
        'revoked_at',
    ];

    protected $hidden = ['refresh_token_hash'];

    protected function casts(): array
    {
        return [
            'last_activity_at' => 'immutable_datetime',
            'expires_at' => 'immutable_datetime',
            'revoked_at' => 'immutable_datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
