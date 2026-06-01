<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->timestamp('rejected_at')->nullable()->after('completed_at');
            $table->index('rejected_at');
        });

        DB::table('bookings')
            ->where('status', 'Rejected')
            ->whereNull('rejected_at')
            ->update(['rejected_at' => DB::raw('updated_at')]);
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex(['rejected_at']);
            $table->dropColumn('rejected_at');
        });
    }
};
