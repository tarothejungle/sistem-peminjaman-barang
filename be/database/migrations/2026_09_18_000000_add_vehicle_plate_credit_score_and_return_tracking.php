<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Supports the vehicle inventory and the borrower credibility score.
 *
 * - items.plate_number      : nomor polisi for vehicle-type inventory rows.
 * - users.credit_score      : credibility points (starts at 100, floored at 0).
 * - bookings.returned_at    : the moment the borrower confirmed the return.
 * - user_credit_events      : append-only ledger so a score is always explainable
 *                             and a booking can only ever move the score once.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('items', 'plate_number')) {
            Schema::table('items', function (Blueprint $table): void {
                $table->string('plate_number', 20)->nullable()->after('category');
            });
        }

        if (! Schema::hasColumn('users', 'credit_score')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->integer('credit_score')->default(100)->after('role');
            });
        }

        if (! Schema::hasColumn('bookings', 'returned_at')) {
            Schema::table('bookings', function (Blueprint $table): void {
                $table->timestamp('returned_at', 3)->nullable()->after('status');
            });
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                ALTER TABLE users DROP CONSTRAINT IF EXISTS users_credit_score_floor_check;
                ALTER TABLE users ADD CONSTRAINT users_credit_score_floor_check CHECK (credit_score >= 0);
                SQL);
        }

        if (! Schema::hasTable('user_credit_events')) {
            Schema::create('user_credit_events', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->uuid('user_id');
                $table->uuid('booking_id')->nullable()->unique();
                $table->integer('delta');
                $table->integer('score_after');
                $table->string('reason', 50);
                $table->timestamps(3);
                $table->index('user_id');
                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
                $table->foreign('booking_id')->references('id')->on('bookings')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_credit_events');

        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_credit_score_floor_check;');
        }

        if (Schema::hasColumn('bookings', 'returned_at')) {
            Schema::table('bookings', function (Blueprint $table): void {
                $table->dropColumn('returned_at');
            });
        }

        if (Schema::hasColumn('users', 'credit_score')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropColumn('credit_score');
            });
        }

        if (Schema::hasColumn('items', 'plate_number')) {
            Schema::table('items', function (Blueprint $table): void {
                $table->dropColumn('plate_number');
            });
        }
    }
};
