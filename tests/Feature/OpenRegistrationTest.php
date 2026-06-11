<?php

namespace Tests\Feature;

use App\Models\OpenEvent;
use App\Models\OpenEventDay;
use App\Models\OpenRegistration;
use App\Models\User;
use App\Services\TwoFactorService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OpenRegistrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-08-01 09:00:00', 'Asia/Jakarta'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_public_open_event_returns_null_when_no_active_event(): void
    {
        $this->makeEvent(active: false);

        $this->getJson('/api/public/open-event')
            ->assertOk()
            ->assertJsonPath('data', null);
    }

    public function test_public_open_event_returns_active_event_without_whatsapp_links(): void
    {
        $event = $this->makeActiveEvent();

        $response = $this->getJson('/api/public/open-event')->assertOk();

        $response->assertJsonPath('data.slug', $event->slug);
        $this->assertCount(3, $response->json('data.days'));
        $this->assertSame(100, $response->json('data.days.0.remaining'));

        // WhatsApp links must never appear on public surfaces.
        $this->assertStringNotContainsString('chat.whatsapp.com', json_encode($response->json()));
    }

    public function test_bootstrap_omits_open_event_when_inactive(): void
    {
        $this->makeEvent(active: false);

        $this->getJson('/api/public/bootstrap')
            ->assertOk()
            ->assertJsonPath('data.openEvent', null);
    }

    public function test_public_registration_succeeds_and_returns_group_link(): void
    {
        $event = $this->makeActiveEvent();
        $day = $event->days()->orderBy('date')->first();

        $response = $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])
            ->postJson('/api/public/open-registrations', [
                'contactName' => 'Budi Santoso',
                'nik' => '3374010101010001',
                'whatsapp' => '081234567001',
                'assignedDayId' => $day->id,
                'members' => ['Anak Satu', 'Anak Dua'],
                'agreement' => true,
            ])
            ->assertCreated();

        $response->assertJsonPath('data.headcount', 3);
        $this->assertSame('https://chat.whatsapp.com/group-14', $response->json('data.whatsappGroupUrl'));

        $this->assertDatabaseHas('open_registrations', [
            'open_event_id' => $event->id,
            'assigned_event_day_id' => $day->id,
            'headcount' => 3,
            'status' => 'Registered',
        ]);
    }

    public function test_registration_rejected_when_day_quota_exceeded(): void
    {
        $event = $this->makeActiveEvent();
        $day = $event->days()->orderBy('date')->first();
        $day->update(['quota_override' => 2]);

        $this->postJson('/api/public/open-registrations', [
            'contactName' => 'Penuh Satu',
            'nik' => '3374010101010002',
            'whatsapp' => '081234567002',
            'assignedDayId' => $day->id,
            'members' => ['Teman'],
            'agreement' => true,
        ])->assertCreated();

        // Day now has 2/2; another headcount of 1 should be rejected.
        $this->postJson('/api/public/open-registrations', [
            'contactName' => 'Penuh Dua',
            'nik' => '3374010101010003',
            'whatsapp' => '081234567003',
            'assignedDayId' => $day->id,
            'agreement' => true,
        ])->assertStatus(422);
    }

    public function test_duplicate_nik_is_rejected_and_recoverable_via_lookup(): void
    {
        $event = $this->makeActiveEvent();
        $day = $event->days()->orderBy('date')->first();

        $this->postJson('/api/public/open-registrations', [
            'contactName' => 'Asli',
            'nik' => '3374010101010010',
            'whatsapp' => '081234567010',
            'assignedDayId' => $day->id,
            'agreement' => true,
        ])->assertCreated();

        // Same NIK, different WhatsApp -> rejected.
        $this->postJson('/api/public/open-registrations', [
            'contactName' => 'Duplikat',
            'nik' => '3374010101010010',
            'whatsapp' => '081234567099',
            'assignedDayId' => $day->id,
            'agreement' => true,
        ])->assertStatus(422);

        // Lookup recovers the existing group link.
        $this->postJson('/api/public/open-registrations/lookup', [
            'nik' => '3374010101010010',
        ])
            ->assertOk()
            ->assertJsonPath('data.whatsappGroupUrl', 'https://chat.whatsapp.com/group-14');
    }

    public function test_self_cancel_frees_quota_and_identity(): void
    {
        $event = $this->makeActiveEvent();
        $day = $event->days()->orderBy('date')->first();
        $day->update(['quota_override' => 1]);

        $this->postJson('/api/public/open-registrations', [
            'contactName' => 'Batal',
            'nik' => '3374010101010020',
            'whatsapp' => '081234567020',
            'assignedDayId' => $day->id,
            'agreement' => true,
        ])->assertCreated();

        $this->postJson('/api/public/open-registrations/cancel', [
            'nik' => '3374010101010020',
        ])->assertOk();

        $this->assertDatabaseHas('open_registrations', [
            'open_event_id' => $event->id,
            'status' => 'Cancelled',
        ]);

        // Quota freed: a new registration on the same 1-slot day succeeds.
        $this->postJson('/api/public/open-registrations', [
            'contactName' => 'Pengganti',
            'nik' => '3374010101010021',
            'whatsapp' => '081234567021',
            'assignedDayId' => $day->id,
            'agreement' => true,
        ])->assertCreated();
    }

    public function test_addons_capped_by_event_max(): void
    {
        $event = $this->makeActiveEvent();
        $day = $event->days()->orderBy('date')->first();

        $this->postJson('/api/public/open-registrations', [
            'contactName' => 'Banyak',
            'nik' => '3374010101010030',
            'whatsapp' => '081234567030',
            'assignedDayId' => $day->id,
            'members' => ['A', 'B', 'C', 'D', 'E'],
            'agreement' => true,
        ])->assertStatus(422);
    }

    public function test_admin_create_event_generates_day_rows(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/admin/open-events', [
            'name' => 'Istura Open Kemerdekaan 2026',
            'startDate' => '2026-08-14',
            'endDate' => '2026-08-16',
            'perDayQuota' => 100,
            'maxAddons' => 4,
        ])->assertCreated();

        $eventId = $response->json('data.id');
        $this->assertDatabaseCount('open_event_days', 3);
        $this->assertSame(3, OpenEventDay::where('open_event_id', $eventId)->count());
    }

    public function test_admin_cannot_activate_event_with_open_day_missing_link(): void
    {
        $this->actingAsAdmin();
        $event = $this->makeEvent(active: false);
        $day = $event->days()->orderBy('date')->first();
        $day->update(['is_open' => true, 'whatsapp_group_url' => null]);

        $this->postJson("/api/admin/open-events/{$event->id}/activate")
            ->assertStatus(422);
    }

    public function test_admin_cannot_open_day_without_link(): void
    {
        $this->actingAsAdmin();
        $event = $this->makeEvent(active: false);
        $day = $event->days()->orderBy('date')->first();

        $this->putJson("/api/admin/open-events/{$event->id}/days/{$day->id}", [
            'isOpen' => true,
        ])->assertStatus(422);
    }

    public function test_admin_activate_deactivates_other_events(): void
    {
        $this->actingAsAdmin();
        $first = $this->makeActiveEvent();
        $second = $this->makeEvent(active: false, slugSuffix: '-b');
        foreach ($second->days as $day) {
            $day->update(['is_open' => true, 'whatsapp_group_url' => 'https://chat.whatsapp.com/group-x']);
        }

        $this->postJson("/api/admin/open-events/{$second->id}/activate")->assertOk();

        $this->assertFalse($first->fresh()->is_active);
        $this->assertTrue($second->fresh()->is_active);
    }

    public function test_admin_can_move_registration_with_overbook(): void
    {
        $this->actingAsAdmin();
        $event = $this->makeActiveEvent();
        $days = $event->days()->orderBy('date')->get();
        $from = $days[0];
        $to = $days[1];
        $to->update(['quota_override' => 1]);

        // Fill target day to capacity.
        $blocker = $this->makeRegistration($event, $to, '3374010101019999', '081200000000');

        $mover = $this->makeRegistration($event, $from, '3374010101010040', '081234567040');

        // Without overbook -> rejected.
        $this->postJson("/api/admin/open-events/{$event->id}/registrations/{$mover->code}/move", [
            'dayId' => $to->id,
        ])->assertStatus(422);

        // With overbook + note -> ok.
        $this->postJson("/api/admin/open-events/{$event->id}/registrations/{$mover->code}/move", [
            'dayId' => $to->id,
            'allowOverbook' => true,
            'note' => 'Permintaan khusus',
        ])->assertOk();

        $this->assertSame($to->id, $mover->fresh()->assigned_event_day_id);
        $this->assertNotNull($blocker->fresh());
    }

    public function test_admin_registrations_index_filters_by_day(): void
    {
        $this->actingAsAdmin();
        $event = $this->makeActiveEvent();
        $days = $event->days()->orderBy('date')->get();
        $registered = $this->makeRegistration($event, $days[0], '3374010101010050', '081234567050');
        $cancelled = $this->makeRegistration($event, $days[1], '3374010101010051', '081234567051');
        $cancelled->status = 'Cancelled';
        $cancelled->cancelled_at = now();
        $cancelled->save();

        $response = $this->getJson("/api/admin/open-events/{$event->id}/registrations?dayId={$days[0]->id}")
            ->assertOk();

        $this->assertSame(1, $response->json('meta.total'));
        $this->assertSame(2, $response->json('meta.counts.total'));
        $this->assertSame(1, $response->json('meta.counts.registered'));
        $this->assertSame(1, $response->json('meta.counts.cancelled'));

        $this->getJson("/api/admin/open-events/{$event->id}/registrations?status=Registered")
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.code', $registered->code);

        $this->getJson("/api/admin/open-events/{$event->id}/registrations?status=Cancelled")
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.code', $cancelled->code);
    }

    public function test_admin_export_and_registrations_expose_full_nik(): void
    {
        $this->actingAsAdmin();
        $event = $this->makeActiveEvent();
        $day = $event->days()->orderBy('date')->first();
        $this->makeRegistration($event, $day, '3374010101010060', '081234567060');

        $this->getJson("/api/admin/open-events/{$event->id}/export")
            ->assertOk()
            ->assertJsonPath('data.0.nik', '3374010101010060');

        $this->getJson("/api/admin/open-events/{$event->id}/registrations")
            ->assertOk()
            ->assertJsonPath('data.0.nik', '3374010101010060');
    }

    // ----- helpers -----------------------------------------------------------

    private function makeActiveEvent(): OpenEvent
    {
        $event = $this->makeEvent(active: true);

        $links = ['group-14', 'group-15', 'group-16'];
        foreach ($event->days()->orderBy('date')->get() as $index => $day) {
            $day->update([
                'is_open' => true,
                'whatsapp_group_url' => 'https://chat.whatsapp.com/'.$links[$index],
            ]);
        }

        return $event->fresh('days');
    }

    private function makeEvent(bool $active, string $slugSuffix = ''): OpenEvent
    {
        $event = new OpenEvent;
        $event->name = 'Istura Open Test'.$slugSuffix;
        $event->slug = 'istura-open-test'.$slugSuffix;
        $event->start_date = '2026-08-14';
        $event->end_date = '2026-08-16';
        $event->per_day_quota = 100;
        $event->max_addons = 4;
        $event->assignment_mode = 'self_select';
        $event->release_mode = 'simultaneous';
        $event->is_active = $active;
        $event->save();

        foreach (['2026-08-14', '2026-08-15', '2026-08-16'] as $date) {
            $event->days()->create(['date' => $date, 'is_open' => false]);
        }

        return $event->fresh('days');
    }

    private function makeRegistration(OpenEvent $event, OpenEventDay $day, string $nik, string $whatsapp): OpenRegistration
    {
        $registration = new OpenRegistration;
        $registration->code = 'ISTURA-OPEN-2026-'.substr($nik, -4);
        $registration->open_event_id = $event->id;
        $registration->assigned_event_day_id = $day->id;
        $registration->contact_name = 'Peserta '.substr($nik, -4);
        $registration->nik = $nik;
        $registration->whatsapp = $whatsapp;
        $registration->members = [];
        $registration->headcount = 1;
        $registration->status = 'Registered';
        $registration->registered_at = now();
        $registration->save();

        return $registration->fresh();
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'two_factor_confirmed_at' => now(),
        ]);

        $this->actingAs($admin);
        $this->withHeader('Origin', 'http://localhost');
        $this->withSession([
            'admin_session_started_at' => now()->timestamp,
            TwoFactorService::VERIFIED_USER_ID_SESSION_KEY => $admin->id,
        ]);

        return $admin;
    }
}
