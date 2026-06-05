<?php

$configuredProxies = array_filter(array_map(
    'trim',
    explode(',', (string) env('TRUSTED_PROXIES', '')),
));

return [
    'proxies' => $configuredProxies === [] ? null : array_values($configuredProxies),
];
