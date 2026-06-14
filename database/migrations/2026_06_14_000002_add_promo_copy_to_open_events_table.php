<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('open_events', function (Blueprint $table) {
            $table->string('promo_subtitle', 255)->nullable()->after('poster_path');
            $table->string('banner_text', 500)->nullable()->after('promo_subtitle');
        });
    }

    public function down(): void
    {
        Schema::table('open_events', function (Blueprint $table) {
            $table->dropColumn(['promo_subtitle', 'banner_text']);
        });
    }
};
