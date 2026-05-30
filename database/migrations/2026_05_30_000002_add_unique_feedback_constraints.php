<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('feedbacks', function (Blueprint $table) {
            $table->unique('booking_id', 'feedbacks_booking_id_unique');
            $table->unique('code', 'feedbacks_code_unique');
        });
    }

    public function down(): void
    {
        Schema::table('feedbacks', function (Blueprint $table) {
            $table->dropUnique('feedbacks_booking_id_unique');
            $table->dropUnique('feedbacks_code_unique');
        });
    }
};
