<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('open_event_days', function (Blueprint $table) {
            // Shared per-day feedback link token. One link per day == one link
            // per WhatsApp group. Distributed by admin into the group chat.
            $table->string('feedback_token')->nullable()->unique()->after('whatsapp_group_url');
        });

        // Backfill existing days with a unique token so admins can start sharing
        // feedback links immediately after deploy.
        DB::table('open_event_days')->whereNull('feedback_token')->orderBy('id')->each(function ($day) {
            DB::table('open_event_days')
                ->where('id', $day->id)
                ->update(['feedback_token' => 'of_'.rtrim(strtr(base64_encode(random_bytes(20)), '+/', '-_'), '=')]);
        });
    }

    public function down(): void
    {
        Schema::table('open_event_days', function (Blueprint $table) {
            $table->dropUnique(['feedback_token']);
            $table->dropColumn('feedback_token');
        });
    }
};
