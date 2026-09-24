# Laravel Cutover Runbook

## Current Safety State

- Node backend remains in `server/` and stays available on port `5000`.
- Laravel backend lives in `server-laravel/`.
- Laravel development uses `sistem_peminjaman_laravel`, restored from the timestamped backup in `backups/`.
- Laravel now owns the baseline migration in `database/migrations`.
- The baseline safely adopts tables that were previously created by Prisma.

## Start Laravel Locally

Port `8000` is occupied by another Laragon project on this workstation. Use `8010`:

```powershell
php artisan serve --host=127.0.0.1 --port=8010
```

Health check:

```text
GET http://localhost:8010/api/v1/health
```

## Frontend Verification

Set temporarily:

```env
VITE_API_BASE_URL=http://localhost:8010/api/v1
```

Run login, catalog, booking create, PJ review, Kabag approval, PJ confirmation, and inspection flows.

## Production Database Cutover

Only after tests pass against the copy:

1. Stop all booking mutations temporarily.
2. Create a fresh PostgreSQL backup.
3. Point Laravel `DB_DATABASE` to `sistem_peminjaman`.
4. Run `php artisan migrate --force` to register or create the baseline schema.
5. Start Laravel and run read-only smoke tests.
6. Point frontend `VITE_API_BASE_URL` to Laravel.
7. Re-enable mutations and monitor errors, authorization failures, and booking conflicts.

## Rollback

Restore frontend API URL:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

Restart frontend. Node backend and PostgreSQL schema remain compatible because Laravel does not migrate the database during this phase.

## Verification Commands

```powershell
php artisan route:list --path=api/v1
php artisan test
vendor\bin\pint --test
composer audit
```
