<?php

use Illuminate\Http\Response;
use Illuminate\Support\Facades\Route;

Route::get('/{path?}', function (): Response {
    $index = public_path('app/index.html');

    abort_unless(is_file($index), 503, 'Frontend belum dibangun. Jalankan: composer frontend:build');

    return response((string) file_get_contents($index), 200, [
        'Content-Type' => 'text/html; charset=UTF-8',
        'Cache-Control' => 'no-cache, no-store, must-revalidate',
    ]);
})->where('path', '^(?!api(?:/|$)).*');
