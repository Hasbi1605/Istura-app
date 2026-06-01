<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PruneAuditLogsTest extends TestCase
{
    use RefreshDatabase;

    public function test_prune_removes_entries_older_than_retention_window(): void
    {
        config(['audit.retention_days' => 30]);

        $old = AuditLog::create([
            'actor_name' => 'Admin',
            'action' => 'Aksi lama',
            'created_at' => now()->subDays(45),
        ]);

        $recent = AuditLog::create([
            'actor_name' => 'Admin',
            'action' => 'Aksi baru',
            'created_at' => now()->subDays(5),
        ]);

        $this->artisan('audit:prune')->assertSuccessful();

        $this->assertDatabaseMissing('audit_logs', ['id' => $old->id]);
        $this->assertDatabaseHas('audit_logs', ['id' => $recent->id]);
    }

    public function test_prune_is_disabled_when_retention_is_zero(): void
    {
        config(['audit.retention_days' => 0]);

        $old = AuditLog::create([
            'actor_name' => 'Admin',
            'action' => 'Aksi lama',
            'created_at' => now()->subDays(400),
        ]);

        $this->artisan('audit:prune')->assertSuccessful();

        $this->assertDatabaseHas('audit_logs', ['id' => $old->id]);
    }

    public function test_days_option_overrides_config(): void
    {
        config(['audit.retention_days' => 365]);

        $entry = AuditLog::create([
            'actor_name' => 'Admin',
            'action' => 'Aksi',
            'created_at' => now()->subDays(10),
        ]);

        $this->artisan('audit:prune', ['--days' => 7])->assertSuccessful();

        $this->assertDatabaseMissing('audit_logs', ['id' => $entry->id]);
    }
}
