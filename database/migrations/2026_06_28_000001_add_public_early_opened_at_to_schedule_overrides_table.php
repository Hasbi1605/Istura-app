<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schedule_overrides', function (Blueprint $table) {
            $table->timestamp('public_early_opened_at')->nullable()->after('custom');
        });
    }

    public function down(): void
    {
        Schema::table('schedule_overrides', function (Blueprint $table) {
            $table->dropColumn('public_early_opened_at');
        });
    }
};
