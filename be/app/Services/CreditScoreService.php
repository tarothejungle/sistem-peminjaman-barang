<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\ResourceType;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\User;
use App\Models\UserCreditEvent;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Applies the borrower credibility score to PEMOHON item and vehicle loans only.
 *
 * The score starts at 100 (see UserCreditEvent::STARTING_SCORE) and moves by a
 * flat delta per returned item loan: -5 when the return lands after the due
 * moment, +5 when it lands on or before it. Room bookings never affect the
 * score. A single loan can therefore never push the score past MAXIMUM_SCORE
 * (100), and the database floor stops it from going negative.
 */
final class CreditScoreService
{
    /**
     * Records the credibility movement for a returned loan.
     *
     * Returns null when the booking already produced an event, which makes the
     * call safe to repeat (confirm-finished replays, retries after a timeout).
     */
    public function recordReturn(Booking $booking, CarbonImmutable $returnedAt): ?UserCreditEvent
    {
        if ($booking->resource_type !== ResourceType::ITEM) {
            return null;
        }

        return DB::transaction(function () use ($booking, $returnedAt): ?UserCreditEvent {
            if (UserCreditEvent::query()->where('booking_id', $booking->id)->exists()) {
                return null;
            }

            $user = User::query()->lockForUpdate()->find($booking->user_id);
            if (! $user || $user->role !== Role::PEMOHON) {
                return null;
            }

            $due = $booking->alternative_end_time ?? $booking->end_time;
            $onTime = $returnedAt->lessThanOrEqualTo($due);
            $delta = $onTime ? UserCreditEvent::ON_TIME_DELTA : UserCreditEvent::LATE_DELTA;
            $current = (int) ($user->credit_score ?? UserCreditEvent::STARTING_SCORE);
            $scoreAfter = min(UserCreditEvent::MAXIMUM_SCORE, max(0, $current + $delta));

            $user->update(['credit_score' => $scoreAfter]);

            return UserCreditEvent::create([
                'user_id' => $user->id,
                'booking_id' => $booking->id,
                'delta' => $delta,
                'score_after' => $scoreAfter,
                'reason' => $onTime ? UserCreditEvent::REASON_ON_TIME : UserCreditEvent::REASON_LATE,
            ]);
        });
    }

    /**
     * Projects the score movement a return at $returnedAt would produce, so the
     * UI can explain the consequence before the borrower commits.
     *
     * @return array{onTime: bool, delta: int, dueAt: CarbonImmutable, message: string}|null
     */
    public function preview(Booking $booking, CarbonImmutable $returnedAt): ?array
    {
        if ($booking->resource_type !== ResourceType::ITEM) {
            return null;
        }

        $due = $booking->alternative_end_time ?? $booking->end_time;
        $onTime = $returnedAt->lessThanOrEqualTo($due);
        $delta = $onTime ? UserCreditEvent::ON_TIME_DELTA : UserCreditEvent::LATE_DELTA;

        return [
            'onTime' => $onTime,
            'delta' => $delta,
            'dueAt' => $due,
            'message' => $onTime
                ? 'Pengembalian tepat waktu: skor kredibilitas +'.UserCreditEvent::ON_TIME_DELTA.'.'
                : 'Pengembalian melewati jatuh tempo: skor kredibilitas '.UserCreditEvent::LATE_DELTA.'.',
        ];
    }
}
