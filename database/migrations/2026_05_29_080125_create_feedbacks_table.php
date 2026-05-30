<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feedbacks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->nullable()->constrained('bookings')->nullOnDelete();
            $table->string('code')->index(); // ISTURA-2026-0000 (denormalized for export)
            $table->unsignedTinyInteger('rating');
            $table->unsignedTinyInteger('booking_ease');
            $table->unsignedTinyInteger('service');
            $table->unsignedTinyInteger('recommend');
            $table->json('highlights');
            $table->json('improvements');
            $table->text('comment')->nullable();
            $table->boolean('allow_publish')->default(false);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feedbacks');
    }
};
