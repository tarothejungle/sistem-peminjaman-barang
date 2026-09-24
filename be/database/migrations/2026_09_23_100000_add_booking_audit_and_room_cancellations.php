<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table): void {
            $table->uuid('pj_reviewed_by')->nullable();
            $table->string('pj_reviewer_name', 100)->nullable();
            $table->uuid('kasubag_reviewed_by')->nullable();
            $table->string('kasubag_reviewer_name', 100)->nullable();
            $table->uuid('rejected_by')->nullable();
            $table->string('rejected_by_name', 100)->nullable();
        });

        Schema::create('room_booking_cancellations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('booking_id')->unique();
            $table->uuid('room_id')->nullable();
            $table->uuid('requested_by');
            $table->string('requested_by_name', 100);
            $table->string('room_name', 100);
            $table->string('work_unit', 150);
            $table->string('responsible_name', 100);
            $table->dateTime('booking_start_time');
            $table->dateTime('booking_end_time');
            $table->text('reason');
            $table->timestamps();

            $table->foreign('booking_id')->references('id')->on('bookings')->restrictOnDelete();
            $table->index(['created_at', 'booking_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('room_booking_cancellations');

        Schema::table('bookings', function (Blueprint $table): void {
            $table->dropColumn([
                'pj_reviewed_by',
                'pj_reviewer_name',
                'kasubag_reviewed_by',
                'kasubag_reviewer_name',
                'rejected_by',
                'rejected_by_name',
            ]);
        });
    }
};
