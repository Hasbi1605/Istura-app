<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('open_feedbacks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('open_event_id')->constrained('open_events')->cascadeOnDelete();
            $table->foreignId('open_event_day_id')->constrained('open_event_days')->cascadeOnDelete();

            // Identity for dedup (NIK + phone). NIK encrypted at rest, hashed for
            // lookup; WhatsApp normalized. One feedback per NIK and per phone/day.
            $table->text('nik_encrypted');
            $table->string('nik_masked');
            $table->string('nik_hash');
            $table->string('whatsapp');
            $table->string('whatsapp_normalized')->nullable();

            // Visitor profile (same questionnaire as the rombongan feedback).
            $table->string('visitor_name', 120)->nullable();
            $table->string('gender', 16)->nullable();
            $table->unsignedSmallInteger('age')->nullable();
            $table->string('origin', 160)->nullable();

            // Ratings (1-5). rating is the derived 4-dimension average.
            $table->unsignedTinyInteger('rating');
            $table->unsignedTinyInteger('booking_ease');
            $table->unsignedTinyInteger('service');
            $table->unsignedTinyInteger('guide_quality')->nullable();
            $table->unsignedTinyInteger('facility_comfort')->nullable();
            $table->unsignedTinyInteger('recommend');
            $table->boolean('visited_before')->nullable();
            $table->string('discovery_source', 40)->nullable();
            $table->string('discovery_source_other', 120)->nullable();
            $table->json('highlights');
            $table->json('improvements');
            $table->text('comment')->nullable();
            $table->boolean('allow_publish')->default(false);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            // One feedback per NIK per day and per phone per day.
            $table->unique(['open_event_day_id', 'nik_hash'], 'open_feedback_day_nik_unique');
            $table->unique(['open_event_day_id', 'whatsapp_normalized'], 'open_feedback_day_wa_unique');
            $table->index(['open_event_id', 'open_event_day_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('open_feedbacks');
    }
};
