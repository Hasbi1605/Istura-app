<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use InvalidArgumentException;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $directory = json_decode(file_get_contents(database_path('seeders/data/admin_users.json')), true);
        $seedPassword = env('SEED_ADMIN_PASSWORD');

        if (! $seedPassword) {
            $this->command?->warn('SEED_ADMIN_PASSWORD kosong; seed user admin dilewati.');

            return;
        }

        $defaultPassword = Hash::make($seedPassword);
        foreach ($directory as $user) {
            $admin = User::firstOrNew(['email' => $user['email']]);
            $admin->name = $user['name'];
            $admin->password = $defaultPassword;
            $admin->role = $this->mapRole($user['role']);
            $admin->email_verified_at = $user['status'] === 'Aktif' ? now() : null;
            $admin->save();
        }
    }

    private function mapRole(string $label): string
    {
        return match ($label) {
            'Super Admin' => User::ROLE_SUPER_ADMIN,
            'Admin' => User::ROLE_ADMIN,
            default => throw new InvalidArgumentException("Role seed tidak dikenal: {$label}"),
        };
    }
}
