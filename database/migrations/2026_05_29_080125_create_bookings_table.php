<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('contact_name');
            $table->text('nik_encrypted'); // Crypt-encrypted full NIK
            $table->string('nik_masked', 32);
            $table->string('whatsapp', 32);
            $table->string('institution');
            $table->unsignedSmallInteger('group_size');
            $table->date('date');
            $table->string('date_label'); // "Jumat, 29 Mei 2026"
            $table->string('time', 5); // "09.00"
            $table->enum('status', ['Pending', 'Accepted', 'Rejected', 'Reschedule', 'Completed'])
                ->default('Pending')
                ->index();
            $table->string('document_path')->nullable();
            $table->string('document_original_name');
            $table->string('feedback_token', 64)->unique();
            $table->timestamp('submitted_at');
            $table->timestamp('completed_at')->nullable();
            $table->text('note')->nullable();
            $table->date('proposed_date')->nullable();
            $table->string('proposed_date_label')->nullable();
            $table->string('proposed_time', 5)->nullable();
            $table->timestamp('proposed_at')->nullable();
            $table->timestamps();

            $table->index(['date', 'time']);
            $table->index(['date', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
