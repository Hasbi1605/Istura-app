<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('national_holidays', function (Blueprint $table) {
            $table->id();
            $table->date('date')->unique();
            $table->unsignedSmallInteger('year')->index();
            $table->string('name');
            $table->string('type', 32);
            $table->boolean('tentative')->default(false);
            $table->string('source', 100);
            $table->string('source_url', 500);
            $table->timestamp('provider_updated_at')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->string('checksum', 64);
            $table->timestamps();

            $table->index(['year', 'date']);
            $table->index(['source', 'year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('national_holidays');
    }
};
