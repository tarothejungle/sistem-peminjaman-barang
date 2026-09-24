<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasUuid;
use App\Models\Concerns\SerializesCamelCase;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Append-only ledger for borrower credibility points.
 *
 * A booking may only ever produce one row (the booking_id unique index), which
 * is what keeps the score from being adjusted twice if a return is replayed.
 */
final class UserCreditEvent extends Model
{
    use HasUuid, SerializesCamelCase;

    public const REASON_ON_TIME = 'RETURNED_ON_TIME';

    public const REASON_LATE = 'RETURNED_LATE';

    public const ON_TIME_DELTA = 5;

    public const LATE_DELTA = -5;

    public const STARTING_SCORE = 100;

    /** The score is capped here: on-time returns cannot push a borrower past a perfect record. */
    public const MAXIMUM_SCORE = 100;

    protected $fillable = ['user_id', 'booking_id', 'delta', 'score_after', 'reason'];

    protected function casts(): array
    {
        return ['delta' => 'integer', 'score_after' => 'integer'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
