<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('login-activities:prune')
    ->hourly()
    ->name('cleanup-login-activities')
    ->withoutOverlapping();

// Room bookings must not stay "menunggu konfirmasi" forever when the borrower
// forgets to close them; the grace period lives in BOOKING_ROOM_AUTO_CONFIRM_MINUTES.
Schedule::command('bookings:auto-confirm-rooms')
    ->everyMinute()
    ->name('auto-confirm-room-bookings')
    ->withoutOverlapping();
