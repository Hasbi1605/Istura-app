<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $credentials = json_decode(file_get_contents(database_path('seeders/data/admin_credentials.json')), true);
        $directory = json_decode(file_get_contents(database_path('seeders/data/admin_users.json')), true);

        // Primary admin lifted from MOCK_ADMIN_CREDENTIALS in App.tsx.
        foreach ($credentials as $entry) {
            User::updateOrCreate(
                ['email' => $entry['email']],
                [
                    'name' => $entry['name'],
                    'password' => Hash::make($entry['password']),
                    'role' => $this->mapRole($entry['role']),
                    'email_verified_at' => now(),
                ],
            );
        }

        // Secondary admins from MOCK_ADMIN_USERS — mirror the directory shown in
        // the legacy admin/users page. Use a default password so testing is easy.
        $defaultPassword = Hash::make('istura2026');
        foreach ($directory as $user) {
            User::updateOrCreate(
                ['email' => $user['email']],
                [
                    'name' => $user['name'],
                    'password' => $defaultPassword,
                    'role' => $this->mapRole($user['role']),
                    'email_verified_at' => $user['status'] === 'Aktif' ? now() : null,
                ],
            );
        }
    }

    private function mapRole(string $label): string
    {
        return match ($label) {
            'Super Admin' => User::ROLE_SUPER_ADMIN,
            'Admin', 'Operator' => User::ROLE_ADMIN,
            default => User::ROLE_VIEWER,
        };
    }
}
