<?php

$activeIdentityLimit = (int) env('PUBLIC_BOOKING_ACTIVE_IDENTITY_LIMIT', 5);

return [
    'public_active_identity_limit' => max(0, $activeIdentityLimit),
];
