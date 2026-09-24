# Instruksi Agent — Sistem Peminjaman Ruang Rapat & Kendaraan

Dokumen ini dibaca Codex pada setiap sesi di repo ini. Aturan kerja lengkap ada di `docs/AGENT-RULES.md`.

## 0. Codebase memory dulu, baru kerja (wajib)

Setiap permintaan baru dari user **wajib** dimulai dengan preflight `codebase-memory` sebelum menyusun rencana, menjawab pertanyaan tentang kode, atau mengubah file:

1. Cek/segarkan indeks project ini (`D-laragon-www-sistem-peminjaman-barang`).
2. Telusuri graf sesuai kebutuhan: `search_graph` (cari simbol), `trace_path` (pemanggil/dipanggil), `get_code_snippet` (isi kode), `get_file_outline`, `get_architecture`, `search_code` (literal).
3. Baru kerjakan permintaannya, dan dasarkan keputusan pada temuan graf (bukan tebakan).

`auto_index` dan `auto_watch` sudah `true`, jadi indeks ikut tersegarkan otomatis saat tool graf dipanggil.

### Kalau MCP codebase-memory sedang mati

Server MCP `codebase-memory` tidak bisa jalan di dalam sandbox Codex: prosesnya berjalan sebagai `codexsandboxoffline` yang tidak punya akses ke cache `%USERPROFILE%\.cache\codebase-memory-mcp`, sementara tool ini menolak jalan bila cache-nya tidak privat. Gejalanya: `/mcp` merah dan setiap panggilan tool graf menjawab `Transport closed`.

Fallback resminya CLI (jalankan **di luar sandbox**, yaitu lewat approval/escalated):

```powershell
& 'C:\Users\Muhammad Arfan\AppData\Roaming\npm\node_modules\codebase-memory-mcp\bin\codebase-memory-mcp.exe' cli --quiet index_status --project D-laragon-www-sistem-peminjaman-barang
```

Ganti `index_status` dengan tool lain memakai flag yang sama seperti skema MCP, contoh:

```powershell
& '...\codebase-memory-mcp.exe' cli --quiet search_graph --project D-laragon-www-sistem-peminjaman-barang --query "autoConfirmExpiredRoomBookings"
& '...\codebase-memory-mcp.exe' cli --quiet trace_path --project D-laragon-www-sistem-peminjaman-barang --function-name relocateMainRoomBooking
```

Tambahkan `--json` untuk envelope mentah, `--format json` untuk keluaran terstruktur.

## 1. Verifikasi sebelum menyatakan selesai

```bash
cd be
php artisan test                 # PHPUnit
vendor/bin/pint --test           # format check

cd ../fe
npm run lint                     # oxlint
npm test                         # vitest
npm run build                    # tsc -b && vite build
```

Catatan: `npm run build` menulis ke `be/public/app`, jadi jangan dijalankan bersamaan dengan `php artisan test` (`emptyOutDir` menghapus aset yang dipakai `SingleServerFrontendTest`).

## 2. Catatan teknis repo

- Tulis file dengan UTF-8 **tanpa BOM** dan line ending **LF**; BOM merusak routing PHP.
- Jangan menambah role/status/endpoint baru tanpa mengecek `be/app/Enums/`, `be/routes/api.php`, dan `be/database/migrations/`.
- Aturan gaya, kontrak response, dan larangan lain ada di `docs/AGENT-RULES.md`.