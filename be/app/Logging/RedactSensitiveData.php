<?php

declare(strict_types=1);

namespace App\Logging;

use Monolog\LogRecord;

final class RedactSensitiveData
{
    public function __invoke($logger): void
    {
        foreach ($logger->getHandlers() as $handler) {
            $handler->pushProcessor(function (LogRecord $record): LogRecord {
                $context = $this->redact($record->context);
                $extra = $this->redact($record->extra);

                return $record->with(message: $this->redact($record->message), context: $context, extra: $extra);
            });
        }
    }

    private function redact(mixed $value): mixed
    {
        if ($value instanceof \Throwable) {
            return ['class' => $value::class, 'code' => $value->getCode()];
        }
        if (is_array($value)) {
            $redacted = [];
            foreach ($value as $key => $item) {
                $redacted[$key] = is_string($key) && $this->isSensitiveKey($key)
                    ? '[redacted]'
                    : $this->redact($item);
            }

            return $redacted;
        }

        if (is_string($value)) {
            $value = (string) preg_replace('/\$2[aby]\$\d{2}\$[.\/A-Za-z0-9]{53}/', '[redacted-bcrypt]', $value);
            $value = (string) preg_replace('/reset-password[#?][^\\s"\']*token=[^\\s"\']+/i', 'reset-password [redacted-token]', $value);
            $value = (string) preg_replace('/Bearer\\s+[A-Za-z0-9\\-_.=]+/i', 'Bearer [redacted]', $value);

            return $value;
        }

        return $value;
    }

    private function isSensitiveKey(string $key): bool
    {
        $normalized = strtolower($key);

        return str_contains($normalized, 'password')
            || str_contains($normalized, 'token')
            || str_contains($normalized, 'secret')
            || str_contains($normalized, 'authorization')
            || $normalized === 'cookie'
            || str_contains($normalized, 'email')
            || str_contains($normalized, 'phone');
    }
}
