<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Single-row switch that closes the API (and therefore the app) for everyone
 * except administrators, so the site can be worked on without taking the
 * database down.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('maintenance_settings')) {
            Schema::create('maintenance_settings', function (Blueprint $table): void {
                $table->smallInteger('id')->primary();
                $table->boolean('is_enabled')->default(false);
                $table->text('message')->nullable();
                $table->timestamp('estimated_end_at', 3)->nullable();
                $table->uuid('updated_by')->nullable();
                $table->timestamps(3);
                $table->foreign('updated_by')->references('id')->on('users')->nullOnDelete();
            });
        }

        DB::table('maintenance_settings')->insertOrIgnore([
            'id' => 1,
            'is_enabled' => false,
            'message' => null,
            'estimated_end_at' => null,
            'updated_by' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_settings');
    }
};
