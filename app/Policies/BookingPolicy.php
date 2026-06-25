<?php

namespace App\Policies;

use App\Models\Booking;
use App\Models\User;

class BookingPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function view(User $user, Booking $booking): bool
    {
        return $user->isAdmin();
    }

    public function update(User $user, Booking $booking): bool
    {
        return $user->isOperator();
    }

    public function create(User $user): bool
    {
        return $user->isOperator();
    }

    public function delete(User $user, Booking $booking): bool
    {
        return $user->isOperator();
    }

    public function downloadDocument(User $user, Booking $booking): bool
    {
        return $user->isAdmin();
    }
}
