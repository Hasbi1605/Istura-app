<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('admin.bookings', function (User $user) {
    return $user->isAdmin();
});
