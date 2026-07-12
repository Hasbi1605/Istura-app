<?php

namespace App\Policies;

use App\Models\OpenEvent;
use App\Models\User;

class OpenEventPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function view(User $user, OpenEvent $event): bool
    {
        return $user->isAdmin();
    }

    public function create(User $user): bool
    {
        return $user->isOperator();
    }

    public function update(User $user, OpenEvent $event): bool
    {
        return $user->isOperator();
    }

    public function delete(User $user, OpenEvent $event): bool
    {
        return $user->isOperator();
    }
}
