<?php

$appUrl = (string) env('APP_URL', 'http://localhost');
$appScheme = parse_url($appUrl, PHP_URL_SCHEME) ?: 'http';
$appHost = parse_url($appUrl, PHP_URL_HOST) ?: 'localhost';
$appPort = parse_url($appUrl, PHP_URL_PORT);
$defaultOrigin = "{$appScheme}://{$appHost}".($appPort ? ":{$appPort}" : '');
$configuredOrigins = (string) env('CORS_ALLOWED_ORIGINS', '');

$allowedOrigins = array_values(array_unique(array_filter(array_map(
    'trim',
    explode(',', $configuredOrigins !== '' ? $configuredOrigins : $defaultOrigin),
))));

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => $allowedOrigins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => [
        'Accept',
        'Authorization',
        'Content-Type',
        'X-Requested-With',
        'X-XSRF-TOKEN',
    ],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,
];
