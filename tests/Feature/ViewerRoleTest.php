<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\TwoFactorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ViewerRoleTest extends TestCase
{
    use RefreshDatabase;

    private User $viewer;

    private User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::factory()->create([
            'role' => User::ROLE_SUPER_ADMIN,
            'two_factor_confirmed_at' => now(),
        ]);

        $this->viewer = User::factory()->create([
            'role' => User::ROLE_VIEWER,
            'two_factor_confirmed_at' => now(),
        ]);
    }

    private function actingAsAdminSession(User $user): void
    {
        $this->actingAs($user);
        $this->withHeader('Origin', 'http://localhost');
        $this->withSession([
            'admin_session_started_at' => now()->timestamp,
            TwoFactorService::VERIFIED_USER_ID_SESSION_KEY => $user->id,
        ]);
    }

    // ---- READ access (should all be 200) ----

    public function test_viewer_can_access_dashboard(): void
    {
        $this->actingAsAdminSession($this->viewer);
        $this->getJson('/api/admin/dashboard')->assertOk();
    }

    public function test_viewer_can_list_bookings(): void
    {
        $this->actingAsAdminSession($this->viewer);
        $this->getJson('/api/admin/bookings')->assertOk();
    }

    public function test_viewer_can_view_schedule(): void
    {
        $this->actingAsAdminSession($this->viewer);
        $this->getJson('/api/admin/schedule')->assertOk();
    }

    public function test_viewer_can_view_feedback(): void
    {
        $this->actingAsAdminSession($this->viewer);
        $this->getJson('/api/admin/feedback')->assertOk();
    }

    public function test_viewer_can_view_cms_endpoints(): void
    {
        $this->actingAsAdminSession($this->viewer);
        $this->getJson('/api/admin/cms/faqs')->assertOk();
        $this->getJson('/api/admin/cms/contacts')->assertOk();
        $this->getJson('/api/admin/cms/wa-templates')->assertOk();
        $this->getJson('/api/admin/cms/hero')->assertOk();
        $this->getJson('/api/admin/cms/letter')->assertOk();
        $this->getJson('/api/admin/cms/site-content')->assertOk();
    }

    public function test_viewer_can_view_open_events(): void
    {
        $this->actingAsAdminSession($this->viewer);
        $this->getJson('/api/admin/open-events')->assertOk();
    }

    // ---- MUTATION access (should all be 403) ----

    public function test_viewer_cannot_mutate_bookings(): void
    {
        $this->actingAsAdminSession($this->viewer);
        $this->postJson('/api/admin/bookings/ISTURA-0000/accept')->assertForbidden();
        $this->postJson('/api/admin/bookings/ISTURA-0000/reject')->assertForbidden();
        $this->postJson('/api/admin/bookings/ISTURA-0000/reschedule')->assertForbidden();
        $this->postJson('/api/admin/bookings/ISTURA-0000/complete')->assertForbidden();
    }

    public function test_viewer_cannot_mutate_schedule(): void
    {
        $this->actingAsAdminSession($this->viewer);
        $this->postJson('/api/admin/schedule/slot', [
            'date' => '2026-07-01',
            'time' => '09.00',
            'status' => 'Available',
        ])->assertForbidden();
        $this->postJson('/api/admin/schedule/range', [])->assertForbidden();
    }

    public function test_viewer_cannot_mutate_cms(): void
    {
        $this->actingAsAdminSession($this->viewer);
        $this->putJson('/api/admin/cms/faqs', ['items' => []])->assertForbidden();
        $this->putJson('/api/admin/cms/contacts', [])->assertForbidden();
        $this->putJson('/api/admin/cms/wa-templates', [])->assertForbidden();
        $this->putJson('/api/admin/cms/hero', [])->assertForbidden();
        $this->postJson('/api/admin/cms/letter', [])->assertForbidden();
        $this->putJson('/api/admin/cms/site-content', [])->assertForbidden();
    }

    public function test_viewer_cannot_access_audit_logs(): void
    {
        $this->actingAsAdminSession($this->viewer);
        $this->getJson('/api/admin/audit-logs')->assertForbidden();
    }

    public function test_viewer_cannot_mutate_open_events(): void
    {
        $this->actingAsAdminSession($this->viewer);
        $this->postJson('/api/admin/open-events', [])->assertForbidden();
    }

    public function test_viewer_cannot_manage_users(): void
    {
        $this->actingAsAdminSession($this->viewer);
        $this->getJson('/api/admin/users')->assertForbidden();
    }

    // ---- ROLE creation ----

    public function test_super_admin_can_create_viewer_user(): void
    {
        $this->actingAsAdminSession($this->superAdmin);
        $this->postJson('/api/admin/users', [
            'name' => 'New Viewer',
            'email' => 'viewer-new@istura.test',
            'password' => 'SecurePass123!',
            'role' => 'viewer',
            'status' => 'Aktif',
        ])
            ->assertCreated()
            ->assertJsonPath('data.role', 'viewer')
            ->assertJsonPath('data.roleLabel', 'Viewer');
    }

    // ---- Model method checks ----

    public function test_viewer_is_admin_but_not_operator(): void
    {
        $this->assertTrue($this->viewer->isAdmin());
        $this->assertFalse($this->viewer->isOperator());
        $this->assertFalse($this->viewer->isSuperAdmin());
    }

    public function test_admin_role_is_operator(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
        ]);
        $this->assertTrue($admin->isAdmin());
        $this->assertTrue($admin->isOperator());
        $this->assertFalse($admin->isSuperAdmin());
    }
}
