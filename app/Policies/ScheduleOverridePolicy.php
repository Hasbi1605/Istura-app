<?php

namespace App\Policies;

use App\Models\ScheduleOverride;
use App\Models\User;

class ScheduleOverridePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function update(User $user, ?ScheduleOverride $scheduleOverride = null): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, ?ScheduleOverride $scheduleOverride = null): bool
    {
        return $user->isAdmin();
    }
}
