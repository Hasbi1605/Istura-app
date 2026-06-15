<?php

$appHost = parse_url((string) env('APP_URL', 'http://localhost'), PHP_URL_HOST);
$extraImageHosts = array_filter(array_map('trim', explode(',', (string) env('PUBLIC_IMAGE_HOSTS', ''))));
$defaultDocumentationLinkHosts = ['drive.google.com', 'docs.google.com', 'photos.google.com', 'photos.app.goo.gl'];
$documentationLinkHosts = array_filter(array_map('trim', explode(',', (string) env(
    'DOCUMENTATION_LINK_HOSTS',
    implode(',', $defaultDocumentationLinkHosts),
))));
if ($documentationLinkHosts === []) {
    $documentationLinkHosts = $defaultDocumentationLinkHosts;
}

return [
    'public_image_hosts' => array_values(array_unique(array_filter([
        $appHost,
        ...$extraImageHosts,
    ]))),
    'documentation_link_hosts' => array_values(array_unique(array_map('strtolower', $documentationLinkHosts))),
];
