<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE wa_templates MODIFY status_key ENUM('Pending', 'Accepted', 'Rejected', 'Reschedule', 'Completed') NOT NULL");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::table('wa_templates')->where('status_key', 'Pending')->delete();
        DB::statement("ALTER TABLE wa_templates MODIFY status_key ENUM('Accepted', 'Rejected', 'Reschedule', 'Completed') NOT NULL");
    }
};
