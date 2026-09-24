<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

final class TurnstileService
{
    public function verify(?string $token, ?string $ipAddress): void
    {
        if (! config('services.turnstile.enabled')) {
            return;
        }

        try {
            $response = Http::asForm()->timeout(5)->post((string) config('services.turnstile.verify_url'), array_filter([
                'secret' => config('services.turnstile.secret_key'),
                'response' => $token,
                'remoteip' => $ipAddress,
            ]));
        } catch (Throwable $exception) {
            Log::warning('Turnstile verification request failed', ['exception' => $exception::class]);
            throw new ApiException('Layanan verifikasi keamanan tidak tersedia. Silakan coba kembali.', 503);
        }

        if (! $response->successful()) {
            Log::warning('Turnstile verification returned an HTTP error', ['status' => $response->status()]);
            throw new ApiException('Layanan verifikasi keamanan tidak tersedia. Silakan coba kembali.', 503);
        }

        if ($response->json('success') !== true) {
            Log::notice('Turnstile rejected a login attempt', ['errorCodes' => $response->json('error-codes', [])]);
            throw new ApiException('Verifikasi keamanan gagal. Silakan ulangi verifikasi.', 422);
        }
    }
}
