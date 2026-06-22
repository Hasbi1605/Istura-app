<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('feedbacks', function (Blueprint $table) {
            $table->string('visitor_name', 120)->nullable()->after('code');
            $table->string('gender', 16)->nullable()->after('visitor_name');
            $table->unsignedSmallInteger('age')->nullable()->after('gender');
            $table->string('origin', 160)->nullable()->after('age');
        });
    }

    public function down(): void
    {
        Schema::table('feedbacks', function (Blueprint $table) {
            $table->dropColumn([
                'visitor_name',
                'gender',
                'age',
                'origin',
            ]);
        });
    }
};
