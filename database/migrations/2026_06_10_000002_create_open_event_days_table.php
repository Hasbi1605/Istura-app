<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('open_event_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('open_event_id')->constrained('open_events')->cascadeOnDelete();
            $table->date('date');
            $table->unsignedInteger('quota_override')->nullable();
            $table->string('whatsapp_group_url')->nullable();
            $table->dateTime('opens_at')->nullable();
            $table->boolean('is_open')->default(false);
            $table->timestamps();

            $table->unique(['open_event_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('open_event_days');
    }
};
