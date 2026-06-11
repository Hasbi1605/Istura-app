<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('feedbacks', function (Blueprint $table) {
            $table->unsignedTinyInteger('guide_quality')->nullable()->after('service');
            $table->unsignedTinyInteger('facility_comfort')->nullable()->after('guide_quality');
            $table->boolean('visited_before')->nullable()->after('recommend');
            $table->string('discovery_source', 40)->nullable()->after('visited_before');
            $table->string('discovery_source_other', 120)->nullable()->after('discovery_source');
        });
    }

    public function down(): void
    {
        Schema::table('feedbacks', function (Blueprint $table) {
            $table->dropColumn([
                'guide_quality',
                'facility_comfort',
                'visited_before',
                'discovery_source',
                'discovery_source_other',
            ]);
        });
    }
};
