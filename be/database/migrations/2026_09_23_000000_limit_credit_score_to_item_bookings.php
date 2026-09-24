<?php

declare(strict_types=1);

use App\Enums\ResourceType;
use App\Enums\Role;
use App\Models\UserCreditEvent;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $itemBookingIds = DB::table('bookings')
                ->select('id')
                ->where('resource_type', ResourceType::ITEM->value);

            DB::table('user_credit_events')
                ->where(function ($query) use ($itemBookingIds): void {
                    $query->whereNull('booking_id')
                        ->orWhereNotIn('booking_id', $itemBookingIds);
                })
                ->delete();

            DB::table('users')
                ->where('role', Role::PEMOHON->value)
                ->orderBy('id')
                ->each(function (object $user): void {
                    $score = UserCreditEvent::STARTING_SCORE;
                    $events = DB::table('user_credit_events')
                        ->where('user_id', $user->id)
                        ->orderBy('created_at')
                        ->orderBy('id')
                        ->get(['id', 'delta']);

                    foreach ($events as $event) {
                        $score = min(UserCreditEvent::MAXIMUM_SCORE, max(0, $score + (int) $event->delta));
                        DB::table('user_credit_events')
                            ->where('id', $event->id)
                            ->update(['score_after' => $score]);
                    }

                    DB::table('users')
                        ->where('id', $user->id)
                        ->update(['credit_score' => $score]);
                });
        });
    }

    public function down(): void {}
};
