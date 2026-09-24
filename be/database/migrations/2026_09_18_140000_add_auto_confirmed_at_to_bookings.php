<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Room bookings are closed automatically when the borrower never confirms.
 *
 * auto_confirmed_at records that the system — not the borrower — completed the
 * booking, so the audit trail stays honest while returned_at keeps carrying the
 * moment the room actually became free again.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('bookings', 'auto_confirmed_at')) {
            Schema::table('bookings', function (Blueprint $table): void {
                $table->timestamp('auto_confirmed_at', 3)->nullable()->after('returned_at');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('bookings', 'auto_confirmed_at')) {
            Schema::table('bookings', function (Blueprint $table): void {
                $table->dropColumn('auto_confirmed_at');
            });
        }
    }
};
