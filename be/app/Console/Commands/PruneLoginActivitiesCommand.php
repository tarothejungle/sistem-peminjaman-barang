<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\LoginActivity;
use Illuminate\Console\Command;

final class PruneLoginActivitiesCommand extends Command
{
    protected $signature = 'login-activities:prune';

    protected $description = 'Delete login activity audit records older than 24 hours';

    public function handle(): int
    {
        $deleted = LoginActivity::query()->where('logged_in_at', '<', now()->subDay())->delete();
        $this->info("Deleted {$deleted} expired login activities.");

        return self::SUCCESS;
    }
}
