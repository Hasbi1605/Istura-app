<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('open_registrations', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->foreignId('open_event_id')->constrained('open_events')->cascadeOnDelete();
            $table->foreignId('assigned_event_day_id')->nullable()->constrained('open_event_days')->nullOnDelete();
            $table->string('contact_name');
            $table->text('nik_encrypted');
            $table->string('nik_masked');
            $table->string('nik_hash');
            $table->string('whatsapp');
            $table->string('whatsapp_normalized')->nullable();
            $table->json('members')->nullable();
            $table->unsignedSmallInteger('headcount')->default(1);
            $table->string('status')->default('Registered');
            $table->dateTime('registered_at');
            $table->dateTime('cancelled_at')->nullable();
            $table->timestamps();

            $table->index(['open_event_id', 'assigned_event_day_id', 'status'], 'open_reg_event_day_status_idx');
            $table->index(['open_event_id', 'nik_hash']);
            $table->index(['open_event_id', 'whatsapp_normalized']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('open_registrations');
    }
};
