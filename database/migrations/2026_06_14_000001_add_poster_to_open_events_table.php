<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('open_events', function (Blueprint $table) {
            $table->string('poster_path')->nullable()->after('agreement_text');
        });
    }

    public function down(): void
    {
        Schema::table('open_events', function (Blueprint $table) {
            $table->dropColumn('poster_path');
        });
    }
};
