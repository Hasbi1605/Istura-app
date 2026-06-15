<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schedule_overrides', function (Blueprint $table) {
            $table->string('short_notice_mode', 16)->nullable()->after('note');
            $table->timestamp('short_notice_closes_at')->nullable()->after('short_notice_mode');
            $table->unsignedSmallInteger('short_notice_capacity')->nullable()->after('short_notice_closes_at');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->string('source', 16)->default('public')->after('code')->index();
            $table->foreignId('created_by_admin_id')->nullable()->after('source')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by_admin_id');
            $table->dropIndex(['source']);
            $table->dropColumn('source');
        });

        Schema::table('schedule_overrides', function (Blueprint $table) {
            $table->dropColumn(['short_notice_mode', 'short_notice_closes_at', 'short_notice_capacity']);
        });
    }
};
