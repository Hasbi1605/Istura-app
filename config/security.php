<?php

$appHost = parse_url((string) env('APP_URL', 'http://localhost'), PHP_URL_HOST);
$extraImageHosts = array_filter(array_map('trim', explode(',', (string) env('PUBLIC_IMAGE_HOSTS', ''))));

return [
    'public_image_hosts' => array_values(array_unique(array_filter([
        $appHost,
        ...$extraImageHosts,
    ]))),
];
