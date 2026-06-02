<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('users')
            ->whereNotIn('role', [User::ROLE_SUPER_ADMIN, User::ROLE_ADMIN])
            ->update([
                'role' => User::ROLE_ADMIN,
                'email_verified_at' => null,
                'updated_at' => now(),
            ]);

        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default(User::ROLE_ADMIN)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default(User::ROLE_ADMIN)->change();
        });
    }
};
