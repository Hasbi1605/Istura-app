<?php

namespace App\Http\Resources;

use App\Models\User;
use App\Services\IndonesianDate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'roleLabel' => match ($this->role) {
                User::ROLE_SUPER_ADMIN => 'Super Admin',
                User::ROLE_ADMIN => 'Admin',
                User::ROLE_VIEWER => 'Viewer',
            },
            'status' => $this->email_verified_at ? 'Aktif' : 'Nonaktif',
            'lastLogin' => $this->last_login_at ? IndonesianDate::submittedAt($this->last_login_at) : null,
            'twoFactorEnabled' => $this->two_factor_confirmed_at !== null,
        ];
    }
}
