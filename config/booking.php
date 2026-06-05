<?php

$activeIdentityLimit = (int) env('PUBLIC_BOOKING_ACTIVE_IDENTITY_LIMIT', 5);
$pendingTtlHours = (int) env('PUBLIC_BOOKING_PENDING_TTL_HOURS', 48);

return [
    'public_active_identity_limit' => max(0, $activeIdentityLimit),
    'pending_ttl_hours' => max(0, $pendingTtlHours),
];
