<?php

return [
    'access_secret' => env('JWT_ACCESS_SECRET'),
    'refresh_secret' => env('JWT_REFRESH_SECRET'),
    'issuer' => env('JWT_ISSUER', 'sistem-peminjaman-barang'),
    'audience' => env('JWT_AUDIENCE', 'sistem-peminjaman-barang-api'),
    'access_ttl' => 900,
    'refresh_ttl' => 604800,
];
