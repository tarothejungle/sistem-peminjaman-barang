<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lets an administrator choose where a notice shows up: after sign-in (the
 * post-login dialog) or on the sign-in page before the visitor authenticates.
 *
 * `placement` replaces `show_on_login`, which only ever expressed the
 * after-login case.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('attention_messages', 'placement')) {
            Schema::table('attention_messages', function (Blueprint $table): void {
                $table->string('placement', 20)->default('AFTER_LOGIN')->after('audience_role');
            });
        }

        if (Schema::hasColumn('attention_messages', 'show_on_login')) {
            Schema::table('attention_messages', function (Blueprint $table): void {
                $table->dropColumn('show_on_login');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('attention_messages', 'show_on_login')) {
            Schema::table('attention_messages', function (Blueprint $table): void {
                $table->boolean('show_on_login')->default(true);
            });
        }

        if (Schema::hasColumn('attention_messages', 'placement')) {
            Schema::table('attention_messages', function (Blueprint $table): void {
                $table->dropColumn('placement');
            });
        }
    }
};
