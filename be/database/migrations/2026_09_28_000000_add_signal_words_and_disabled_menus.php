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
        if (! Schema::hasColumn('attention_messages', 'signal_word')) {
            Schema::table('attention_messages', function (Blueprint $table): void {
                $table->string('signal_word', 20)->default('NOTICE')->after('message');
            });
        }

        if (! Schema::hasTable('disabled_menus')) {
            Schema::create('disabled_menus', function (Blueprint $table): void {
                $table->string('menu_key', 80)->primary();
                $table->boolean('is_disabled')->default(false);
                $table->uuid('updated_by')->nullable();
                $table->timestamps(3);
                $table->foreign('updated_by')->references('id')->on('users')->nullOnDelete();
            });
        }

        $legacyMessage = implode("\n\n", [
            'Mulai sekarang, setiap peminjaman kendaraan yang Anda ajukan tercatat dalam skor kredibilitas.',
            'Skor awal Anda 100. Kembalikan kendaraan tepat waktu dan skor bertambah 5 poin. Terlambat mengembalikan, skor berkurang 5 poin. Skor tertinggi tetap 100 dan tidak akan pernah turun di bawah 0.',
            'Mohon kembalikan kendaraan sesuai jadwal yang disetujui, karena skor ini menjadi salah satu pertimbangan untuk pengajuan Anda berikutnya.',
        ]);

        DB::table('attention_messages')
            ->where('id', 'a7c1f0e2-5b4d-4c9a-9f31-2e6d8b7a4c10')
            ->where('title', 'Skor Kredibilitas Peminjaman Kendaraan')
            ->where('message', $legacyMessage)
            ->update([
                'title' => 'Skor Kredibilitas Peminjaman',
                'message' => implode("\n\n", [
                    'Setiap peminjaman ruang rapat dan kendaraan yang Anda ajukan tercatat dalam skor kredibilitas.',
                    'Skor awal Anda 100. Selesaikan peminjaman sesuai ketentuan dan skor bertambah 5 poin. Keterlambatan atau peminjaman ruang yang harus ditutup otomatis akan mengurangi skor 5 poin. Skor tertinggi tetap 100 dan tidak akan pernah turun di bawah 0.',
                    'Mohon gunakan fasilitas sesuai jadwal yang disetujui, karena skor ini menjadi salah satu pertimbangan untuk pengajuan Anda berikutnya.',
                ]),
                'signal_word' => 'NOTICE',
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('disabled_menus');

        if (Schema::hasColumn('attention_messages', 'signal_word')) {
            Schema::table('attention_messages', function (Blueprint $table): void {
                $table->dropColumn('signal_word');
            });
        }
    }
};
