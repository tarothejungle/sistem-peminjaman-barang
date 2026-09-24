<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The borrower's "Surat Tugas" (assignment letter) for a vehicle loan.
 *
 * Stored exactly like the room's official letter: private disk, never a public
 * URL, served through an authorized endpoint. Kept in its own column set so the
 * room letter (`document_*`) and the vehicle letter can coexist and be told
 * apart in the UI.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table): void {
            if (! Schema::hasColumn('bookings', 'surat_tugas_disk')) {
                $table->string('surat_tugas_disk', 50)->nullable();
            }
            if (! Schema::hasColumn('bookings', 'surat_tugas_path')) {
                $table->string('surat_tugas_path', 500)->nullable();
            }
            if (! Schema::hasColumn('bookings', 'surat_tugas_original_name')) {
                $table->string('surat_tugas_original_name', 255)->nullable();
            }
            if (! Schema::hasColumn('bookings', 'surat_tugas_mime')) {
                $table->string('surat_tugas_mime', 100)->nullable();
            }
            if (! Schema::hasColumn('bookings', 'surat_tugas_size')) {
                $table->bigInteger('surat_tugas_size')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table): void {
            foreach (['surat_tugas_disk', 'surat_tugas_path', 'surat_tugas_original_name', 'surat_tugas_mime', 'surat_tugas_size'] as $column) {
                if (Schema::hasColumn('bookings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
