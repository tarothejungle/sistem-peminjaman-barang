<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Admin-authored notices shown to borrowers.
 *
 * One row is one notice. `audience_role` holds a Role value or "ALL" so the same
 * table can carry the credibility-score briefing today and any later notice for
 * other roles without a schema change.
 */
return new class extends Migration
{
    /** Fixed id keeps the seeded briefing idempotent across re-runs. */
    private const SEEDED_CREDIBILITY_NOTICE = 'a7c1f0e2-5b4d-4c9a-9f31-2e6d8b7a4c10';

    public function up(): void
    {
        if (! Schema::hasTable('attention_messages')) {
            Schema::create('attention_messages', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->string('title', 150);
                $table->text('message');
                $table->string('audience_role', 30)->default('PEMOHON');
                $table->boolean('is_active')->default(true);
                $table->boolean('show_on_login')->default(true);
                $table->integer('sort_order')->default(0);
                $table->uuid('created_by')->nullable();
                $table->timestamps(3);
                $table->index(['audience_role', 'is_active'], 'attention_messages_audience_idx');
                $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            });
        }

        DB::table('attention_messages')->insertOrIgnore([
            'id' => self::SEEDED_CREDIBILITY_NOTICE,
            'title' => 'Skor Kredibilitas Peminjaman Kendaraan',
            'message' => implode("\n\n", [
                'Mulai sekarang, setiap peminjaman kendaraan yang Anda ajukan tercatat dalam skor kredibilitas.',
                'Skor awal Anda 100. Kembalikan kendaraan tepat waktu dan skor bertambah 5 poin. Terlambat mengembalikan, skor berkurang 5 poin. Skor tertinggi tetap 100 dan tidak akan pernah turun di bawah 0.',
                'Mohon kembalikan kendaraan sesuai jadwal yang disetujui, karena skor ini menjadi salah satu pertimbangan untuk pengajuan Anda berikutnya.',
            ]),
            'audience_role' => 'PEMOHON',
            'is_active' => true,
            'show_on_login' => true,
            'sort_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('attention_messages');
    }
};
