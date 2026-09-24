<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('room_booking_cancellations', function (Blueprint $table): void {
            $table->text('purpose')->nullable()->after('responsible_name');
        });

        DB::table('room_booking_cancellations')
            ->orderBy('booking_id')
            ->each(function (object $cancellation): void {
                DB::table('room_booking_cancellations')
                    ->where('booking_id', $cancellation->booking_id)
                    ->update([
                        'purpose' => DB::table('bookings')
                            ->where('id', $cancellation->booking_id)
                            ->value('purpose'),
                    ]);
            });
    }

    public function down(): void
    {
        Schema::table('room_booking_cancellations', function (Blueprint $table): void {
            $table->dropColumn('purpose');
        });
    }
};
