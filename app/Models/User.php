<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'phone'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Role accessors mirror the legacy admin shapes from the React app.
     */
    public const ROLE_SUPER_ADMIN = 'super_admin';

    public const ROLE_ADMIN = 'admin';

    public const ROLE_VIEWER = 'viewer';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function isSuperAdmin(): bool
    {
        return $this->isActive() && $this->role === self::ROLE_SUPER_ADMIN;
    }

    /**
     * Can perform mutations (admin actions). Viewer is excluded.
     */
    public function isOperator(): bool
    {
        return $this->isActive() && in_array($this->role, [self::ROLE_SUPER_ADMIN, self::ROLE_ADMIN], true);
    }

    /**
     * Can access the admin panel (includes viewer for read-only).
     */
    public function isAdmin(): bool
    {
        return $this->isActive() && in_array($this->role, [self::ROLE_SUPER_ADMIN, self::ROLE_ADMIN, self::ROLE_VIEWER], true);
    }

    public function isActive(): bool
    {
        return $this->email_verified_at !== null;
    }

    public function isActiveSuperAdmin(): bool
    {
        return $this->isActive() && $this->role === self::ROLE_SUPER_ADMIN;
    }
}
