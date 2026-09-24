<?php

return [
    'access_secret' => env('JWT_ACCESS_SECRET'),
    'refresh_secret' => env('JWT_REFRESH_SECRET'),
    'issuer' => env('JWT_ISSUER', 'sistem-peminjaman-barang'),
    'audience' => env('JWT_AUDIENCE', 'sistem-peminjaman-barang-api'),
    'access_ttl' => (int) env('JWT_ACCESS_TTL_SECONDS', 900),
    'refresh_ttl' => (int) env('JWT_REFRESH_TTL_SECONDS', 604800),
    'inactivity_ttl' => (int) env('AUTH_INACTIVITY_TIMEOUT_MINUTES') * 60,
    'activity_write_interval_seconds' => (int) env('AUTH_ACTIVITY_WRITE_INTERVAL_SECONDS', 60),
    'refresh_cookie_secure' => filter_var(env('JWT_REFRESH_COOKIE_SECURE', false), FILTER_VALIDATE_BOOL),
    'login_max_attempts' => (int) env('AUTH_LOGIN_MAX_ATTEMPTS', 5),
    'login_account_max_attempts' => (int) env('AUTH_LOGIN_ACCOUNT_MAX_ATTEMPTS', 10),
    'login_decay_seconds' => (int) env('AUTH_LOGIN_DECAY_SECONDS', 60),
    'refresh_max_attempts' => (int) env('AUTH_REFRESH_MAX_ATTEMPTS', 30),
    'password_max_attempts' => (int) env('AUTH_PASSWORD_MAX_ATTEMPTS', 5),
    'booking_create_max_attempts' => (int) env('BOOKING_CREATE_MAX_ATTEMPTS', 5),
    'booking_max_duration_days' => (int) env('BOOKING_MAX_DURATION_DAYS', 7),
    'booking_max_future_days' => (int) env('BOOKING_MAX_FUTURE_DAYS', 180),
    'booking_max_active_per_user' => (int) env('BOOKING_MAX_ACTIVE_PER_USER_COUNT', 10),
    // Menit setelah jam selesai pemakaian ruang sebelum sistem menutup
    // peminjaman sendiri. 0 berarti fitur dimatikan.
    'booking_room_auto_confirm_minutes' => (int) env('BOOKING_ROOM_AUTO_CONFIRM_MINUTES', 0),
];
