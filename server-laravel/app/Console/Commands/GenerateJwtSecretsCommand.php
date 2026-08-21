<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

final class GenerateJwtSecretsCommand extends Command
{
    protected $signature = 'auth:generate-secrets {--force : Replace existing JWT secrets}';

    protected $description = 'Generate independent JWT signing secrets in the local environment file';

    public function handle(): int
    {
        $path = base_path('.env');
        $contents = is_file($path) ? file_get_contents($path) : false;
        if (! is_string($contents)) {
            $this->error('File .env tidak ditemukan.');

            return self::FAILURE;
        }

        foreach (['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as $key) {
            if (! $this->option('force') && preg_match("/^{$key}=([^\r\n]+)$/m", $contents, $match) && ! str_contains(strtolower($match[1]), 'replace-')) {
                continue;
            }
            $value = bin2hex(random_bytes(32));
            $replacement = "{$key}={$value}";
            $contents = preg_match("/^{$key}=.*$/m", $contents)
                ? preg_replace("/^{$key}=.*$/m", $replacement, $contents)
                : rtrim($contents).PHP_EOL.$replacement.PHP_EOL;
        }

        file_put_contents($path, $contents, LOCK_EX);
        $this->components->info('JWT secrets generated. Values were not printed.');
        $this->callSilent('config:clear');

        return self::SUCCESS;
    }
}
