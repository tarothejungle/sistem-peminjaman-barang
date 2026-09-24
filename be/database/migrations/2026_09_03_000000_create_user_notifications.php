<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_notifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('booking_id')->nullable();
            $table->string('type', 50);
            $table->string('title', 150);
            $table->text('message');
            $table->timestamp('read_at', 3)->nullable();
            $table->timestamps(3);

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete()->cascadeOnUpdate();
            $table->foreign('booking_id')->references('id')->on('bookings')->nullOnDelete()->cascadeOnUpdate();
            $table->index(['user_id', 'read_at', 'created_at'], 'user_notifications_inbox_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_notifications');
    }
};
