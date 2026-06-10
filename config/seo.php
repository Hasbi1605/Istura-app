<?php

$canonicalUrl = rtrim((string) env('PUBLIC_CANONICAL_URL', 'https://www.isturaiky.page'), '/');
$canonicalHost = parse_url($canonicalUrl, PHP_URL_HOST) ?: 'www.isturaiky.page';

return [
    'canonical_url' => $canonicalUrl,
    'canonical_host' => $canonicalHost,
    'redirect_to_canonical' => (bool) env('SEO_REDIRECT_TO_CANONICAL', env('APP_ENV', 'production') === 'production'),
    'redirect_hosts' => array_values(array_unique(array_filter([
        'isturaiky.page',
        env('SEO_REDIRECT_FROM_HOST'),
    ]))),
];
