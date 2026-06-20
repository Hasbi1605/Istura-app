<?php

namespace Tests\Feature;

use App\Events\OpenQuotaUpdated;
use App\Events\ScheduleUpdated;
use App\Models\Booking;
use App\Models\OpenEvent;
use App\Models\OpenEventDay;
use App\Models\OpenRegistration;
use App\Models\User;
use App\Services\ScheduleService;
use App\Services\TwoFactorService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
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

    public function test_public_surfaces_hide_past_active_event_and_reject_registration(): void
    {
        $event = $this->makePastEvent(active: true);
        $day = $event->days()->firstOrFail();

        $this->getJson('/api/public/open-event')
            ->assertOk()
            ->assertJsonPath('data', null);

        $this->getJson('/api/public/bootstrap')
            ->assertOk()
            ->assertJsonPath('data.openEvent', null);

        $this->postJson('/api/public/open-registrations', [
            'contactName' => 'Pendaftar Terlambat',
            'nik' => '3374010101010188',
            'whatsapp' => '081234567188',
            'city' => 'Yogyakarta',
            'assignedDayId' => $day->id,
            'agreement' => true,
        ])->assertNotFound();
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
                'city' => 'Yogyakarta',
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
            'city' => 'Semarang',
            'assignedDayId' => $day->id,
            'members' => ['Teman'],
            'agreement' => true,
        ])->assertCreated();

        // Day now has 2/2; another headcount of 1 should be rejected.
        $this->postJson('/api/public/open-registrations', [
            'contactName' => 'Penuh Dua',
            'nik' => '3374010101010003',
            'whatsapp' => '081234567003',
            'city' => 'Jakarta',
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
            'city' => 'Bandung',
            'assignedDayId' => $day->id,
            'agreement' => true,
        ])->assertCreated();

        // Same NIK, different WhatsApp -> rejected.
        $this->postJson('/api/public/open-registrations', [
            'contactName' => 'Duplikat',
            'nik' => '3374010101010010',
            'whatsapp' => '081234567099',
            'city' => 'Surabaya',
            'assignedDayId' => $day->id,
            'agreement' => true,
        ])->assertStatus(422);

        // Lookup recovers the existing group link (NIK + WhatsApp required).
        $this->postJson('/api/public/open-registrations/lookup', [
            'nik' => '3374010101010010',
            'whatsapp' => '081234567010',
        ])
            ->assertOk()
            ->assertJsonPath('data.whatsappGroupUrl', 'https://chat.whatsapp.com/group-14');
    }

    public function test_lookup_requires_matching_whatsapp(): void
    {
        $event = $this->makeActiveEvent();
        $day = $event->days()->orderBy('date')->first();

        $this->postJson('/api/public/open-registrations', [
            'contactName' => 'Pemilik',
            'nik' => '3374010101010070',
            'whatsapp' => '081234567070',
            'city' => 'Klaten',
            'assignedDayId' => $day->id,
            'agreement' => true,
        ])->assertCreated();

        // Correct NIK but wrong WhatsApp must not reveal the registration.
        $this->postJson('/api/public/open-registrations/lookup', [
            'nik' => '3374010101010070',
            'whatsapp' => '081299999999',
        ])
            ->assertOk()
            ->assertJsonPath('data', null);

        // Matching NIK + WhatsApp returns it.
        $this->postJson('/api/public/open-registrations/lookup', [
            'nik' => '3374010101010070',
            'whatsapp' => '081234567070',
        ])
            ->assertOk()
            ->assertJsonPath('data.whatsappGroupUrl', 'https://chat.whatsapp.com/group-14');

        // Cancel also requires the matching WhatsApp.
        $this->postJson('/api/public/open-registrations/cancel', [
            'nik' => '3374010101010070',
            'whatsapp' => '081299999999',
        ])->assertStatus(404);
    }

    public function test_lookup_and_self_cancel_stay_available_after_registration_window_closes(): void
    {
        $event = $this->makeActiveEvent();
        $day = $event->days()->orderBy('date')->first();

        $this->postJson('/api/public/open-registrations', [
            'contactName' => 'Pemilik Recovery',
            'nik' => '3374010101010071',
            'whatsapp' => '081234567071',
            'city' => 'Yogyakarta',
            'assignedDayId' => $day->id,
            'agreement' => true,
        ])->assertCreated();

        $event->forceFill(['registration_closes_at' => now()->subMinute()])->save();

        $this->getJson('/api/public/open-event')
            ->assertOk()
            ->assertJsonPath('data.slug', $event->slug)
            ->assertJsonPath('data.registrationWindowOpen', false)
            ->assertJsonPath('data.days.0.isOpen', false);

        $this->getJson('/api/public/bootstrap')
            ->assertOk()
            ->assertJsonPath('data.openEvent.registrationWindowOpen', false);

        $this->postJson('/api/public/open-registrations/precheck', [
            'nik' => '3374010101010072',
            'whatsapp' => '081234567072',
        ])->assertNotFound();

        $this->postJson('/api/public/open-registrations/lookup', [
            'nik' => '3374010101010071',
            'whatsapp' => '081234567071',
        ])
            ->assertOk()
            ->assertJsonPath('data.whatsappGroupUrl', 'https://chat.whatsapp.com/group-14');

        $this->postJson('/api/public/open-registrations/cancel', [
            'nik' => '3374010101010071',
            'whatsapp' => '081234567071',
        ])->assertOk();

        $this->assertDatabaseHas('open_registrations', [
            'open_event_id' => $event->id,
            'status' => 'Cancelled',
        ]);
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
            'city' => 'Solo',
            'assignedDayId' => $day->id,
            'agreement' => true,
        ])->assertCreated();

        $this->postJson('/api/public/open-registrations/cancel', [
            'nik' => '3374010101010020',
            'whatsapp' => '081234567020',
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
            'city' => 'Magelang',
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
            'city' => 'Yogyakarta',
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

    public function test_admin_can_create_event_with_nonconsecutive_dates(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/admin/open-events', [
            'name' => 'Istura Open Tanggal Pilihan',
            'dates' => ['2026-08-20', '2026-08-14', '2026-08-17'],
            'perDayQuota' => 100,
            'maxAddons' => 4,
        ])->assertCreated();

        $eventId = $response->json('data.id');
        $event = OpenEvent::findOrFail($eventId);

        $this->assertSame('2026-08-14', $event->start_date->toDateString());
        $this->assertSame('2026-08-20', $event->end_date->toDateString());
        $this->assertSame(
            ['2026-08-14', '2026-08-17', '2026-08-20'],
            $event->days()->orderBy('date')->get()->map(fn (OpenEventDay $day) => $day->date->toDateString())->all(),
        );
    }

    public function test_admin_cannot_create_event_with_past_dates(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/admin/open-events', [
            'name' => 'Istura Open Tanggal Lampau',
            'dates' => ['2026-07-31', '2026-08-14'],
            'perDayQuota' => 100,
            'maxAddons' => 4,
        ])->assertStatus(422)
            ->assertJsonValidationErrors('dates.0');

        $this->postJson('/api/admin/open-events', [
            'name' => 'Istura Open Rentang Lampau',
            'startDate' => '2026-07-31',
            'endDate' => '2026-08-14',
            'perDayQuota' => 100,
            'maxAddons' => 4,
        ])->assertStatus(422)
            ->assertJsonValidationErrors('startDate');

        $this->assertDatabaseMissing('open_events', [
            'name' => 'Istura Open Tanggal Lampau',
        ]);
    }

    public function test_admin_cannot_add_past_date_when_updating_event(): void
    {
        $this->actingAsAdmin();
        $event = $this->makeEvent(active: false);

        $this->putJson("/api/admin/open-events/{$event->id}", [
            'dates' => ['2026-07-31', '2026-08-14', '2026-08-15'],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('dates.0');
    }

    public function test_admin_can_retain_existing_past_date_when_updating_ongoing_event(): void
    {
        $this->actingAsAdmin();

        $event = OpenEvent::create([
            'name' => 'Istura Open Berjalan',
            'slug' => 'istura-open-berjalan',
            'start_date' => '2026-07-31',
            'end_date' => '2026-08-02',
            'per_day_quota' => 100,
            'max_addons' => 4,
            'assignment_mode' => 'self_select',
            'release_mode' => 'simultaneous',
            'is_active' => false,
        ]);
        foreach (['2026-07-31', '2026-08-01', '2026-08-02'] as $date) {
            $event->days()->create(['date' => $date, 'is_open' => false]);
        }

        $this->putJson("/api/admin/open-events/{$event->id}", [
            'name' => 'Istura Open Berjalan Diperbarui',
            'dates' => ['2026-07-31', '2026-08-01', '2026-08-02'],
        ])->assertOk()
            ->assertJsonPath('data.name', 'Istura Open Berjalan Diperbarui');
    }

    public function test_admin_can_delete_empty_inactive_event_and_poster(): void
    {
        Storage::fake('public');
        $this->actingAsAdmin();
        $event = $this->makeEvent(active: false);
        $posterPath = 'cms/open-posters/draft.webp';
        Storage::disk('public')->put($posterPath, 'poster');
        $event->update(['poster_path' => $posterPath]);

        $this->deleteJson("/api/admin/open-events/{$event->id}")
            ->assertOk()
            ->assertJsonPath('data.deleted', true);

        $this->assertDatabaseMissing('open_events', ['id' => $event->id]);
        $this->assertDatabaseMissing('open_event_days', ['open_event_id' => $event->id]);
        Storage::disk('public')->assertMissing($posterPath);
    }

    public function test_admin_cannot_delete_active_or_registered_event(): void
    {
        $this->actingAsAdmin();
        $active = $this->makeActiveEvent();

        $this->deleteJson("/api/admin/open-events/{$active->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('event');

        $active->update(['is_active' => false]);
        $day = $active->days()->firstOrFail();
        $this->makeRegistration($active, $day, '3374010101010080', '081234567080');

        $this->deleteJson("/api/admin/open-events/{$active->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('event');
        $this->assertDatabaseHas('open_events', ['id' => $active->id]);
    }

    public function test_admin_can_archive_and_restore_event(): void
    {
        $this->actingAsAdmin();
        $event = $this->makeActiveEvent();

        $this->postJson("/api/admin/open-events/{$event->id}/archive")
            ->assertOk()
            ->assertJsonPath('data.isActive', false)
            ->assertJsonPath('data.isArchived', true)
            ->assertJsonPath('data.lifecycleStatus', 'archived');

        $this->assertNotNull($event->fresh()->archived_at);

        $this->getJson('/api/public/open-event')
            ->assertOk()
            ->assertJsonPath('data', null);

        $this->postJson("/api/admin/open-events/{$event->id}/unarchive")
            ->assertOk()
            ->assertJsonPath('data.isActive', false)
            ->assertJsonPath('data.isArchived', false)
            ->assertJsonPath('data.lifecycleStatus', 'draft');
    }

    public function test_archived_event_rejects_operational_mutations_but_allows_export_and_restore(): void
    {
        Storage::fake('public');
        $this->actingAsAdmin();
        $event = $this->makeActiveEvent();
        $days = $event->days()->orderBy('date')->get();
        $registration = $this->makeRegistration($event, $days[0], '3374010101010082', '081234567082');

        $this->postJson("/api/admin/open-events/{$event->id}/archive")->assertOk();

        $this->putJson("/api/admin/open-events/{$event->id}", [
            'promoSubtitle' => 'Tidak boleh berubah.',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('event');

        $this->putJson("/api/admin/open-events/{$event->id}/days/{$days[0]->id}", [
            'isOpen' => false,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('event');

        $this->post("/api/admin/open-events/{$event->id}/poster", [
            'poster' => UploadedFile::fake()->image('poster.jpg', 1000, 1400)->size(400),
        ])->assertStatus(422);

        $this->postJson("/api/admin/open-events/{$event->id}/registrations/{$registration->code}/cancel")
            ->assertStatus(422)
            ->assertJsonValidationErrors('event');

        $this->getJson("/api/admin/open-events/{$event->id}/export")
            ->assertOk()
            ->assertJsonPath('data.0.code', $registration->code);

        $this->postJson("/api/admin/open-events/{$event->id}/unarchive")
            ->assertOk()
            ->assertJsonPath('data.lifecycleStatus', 'draft');
    }

    public function test_past_event_rejects_operational_mutations_but_allows_export(): void
    {
        $this->actingAsAdmin();
        $event = $this->makePastEvent(active: false);
        $day = $event->days()->orderBy('date')->first();

        $this->putJson("/api/admin/open-events/{$event->id}", [
            'promoSubtitle' => 'Tidak boleh berubah.',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('event');

        $this->putJson("/api/admin/open-events/{$event->id}/days/{$day->id}", [
            'isOpen' => false,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('event');

        $this->deleteJson("/api/admin/open-events/{$event->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('event');

        $this->getJson("/api/admin/open-events/{$event->id}/export")
            ->assertOk();
    }

    public function test_admin_cannot_remove_event_date_that_has_registrations(): void
    {
        $this->actingAsAdmin();
        $event = $this->makeEvent(active: false);
        $registeredDay = $event->days()->whereDate('date', '2026-08-15')->firstOrFail();
        $this->makeRegistration($event, $registeredDay, '3374010101010081', '081234567081');

        $this->putJson("/api/admin/open-events/{$event->id}", [
            'dates' => ['2026-08-14', '2026-08-16'],
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('dates');

        $this->assertDatabaseHas('open_event_days', ['id' => $registeredDay->id]);
        $this->assertSame('2026-08-14', $event->fresh()->start_date->toDateString());
        $this->assertSame('2026-08-16', $event->fresh()->end_date->toDateString());
    }

    public function test_open_event_mutations_broadcast_public_and_schedule_updates(): void
    {
        Event::fake([OpenQuotaUpdated::class, ScheduleUpdated::class]);
        $this->actingAsAdmin();
        $event = $this->makeActiveEvent();
        $day = $event->days()->orderBy('date')->firstOrFail();

        $this->putJson("/api/admin/open-events/{$event->id}", [
            'promoSubtitle' => 'Promo realtime',
        ])->assertOk();
        Event::assertDispatched(OpenQuotaUpdated::class, fn (OpenQuotaUpdated $broadcast) => $broadcast->eventSlug === $event->slug);

        $this->putJson("/api/admin/open-events/{$event->id}/days/{$day->id}", [
            'isOpen' => false,
        ])->assertOk();
        Event::assertDispatched(ScheduleUpdated::class, fn (ScheduleUpdated $broadcast) => $broadcast->from === '2026-08-14' && $broadcast->to === '2026-08-14');

        $this->postJson("/api/admin/open-events/{$event->id}/deactivate")->assertOk();
        Event::assertDispatched(OpenQuotaUpdated::class);
        Event::assertDispatched(ScheduleUpdated::class, fn (ScheduleUpdated $broadcast) => $broadcast->from === '2026-08-15' && $broadcast->to === '2026-08-16');
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

    public function test_admin_activate_warns_when_open_day_has_active_rombongan_booking(): void
    {
        $this->actingAsAdmin();
        $event = $this->makeEvent(active: false);
        $days = $event->days()->orderBy('date')->get();
        $conflictDay = $days[0];
        $freeDay = $days[1];

        $conflictDay->update(['is_open' => true, 'whatsapp_group_url' => 'https://chat.whatsapp.com/conflict']);
        $freeDay->update(['is_open' => true, 'whatsapp_group_url' => 'https://chat.whatsapp.com/free']);

        $this->makeBooking($conflictDay->date->toDateString(), '08.00', 'Accepted', 'ISTURA-2026-9101');
        $this->makeBooking($freeDay->date->toDateString(), '08.00', 'Rejected', 'ISTURA-2026-9102');

        $this->postJson("/api/admin/open-events/{$event->id}/activate")
            ->assertStatus(422)
            ->assertJsonValidationErrors('event')
            ->assertJsonPath('conflicts.0.code', 'ISTURA-2026-9101')
            ->assertJsonPath('conflicts.0.date', $conflictDay->date->toDateString());

        $this->assertFalse($event->fresh()->is_active);

        $this->postJson("/api/admin/open-events/{$event->id}/activate", [
            'acknowledgeConflicts' => true,
        ])->assertOk();

        $this->assertTrue($event->fresh()->is_active);
    }

    public function test_admin_cannot_activate_past_event(): void
    {
        $this->actingAsAdmin();
        $event = $this->makePastEvent(active: false);

        $this->postJson("/api/admin/open-events/{$event->id}/activate")
            ->assertStatus(422)
            ->assertJsonValidationErrors('event');
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

    public function test_admin_registration_move_endpoint_is_removed(): void
    {
        $this->actingAsAdmin();
        $event = $this->makeActiveEvent();
        $days = $event->days()->orderBy('date')->get();
        $from = $days[0];

        $registration = $this->makeRegistration($event, $from, '3374010101010040', '081234567040');

        $this->postJson("/api/admin/open-events/{$event->id}/registrations/{$registration->code}/move", [
            'dayId' => $days[1]->id,
        ])->assertNotFound();

        $this->assertSame($from->id, $registration->fresh()->assigned_event_day_id);
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

    public function test_open_day_closes_rombongan_schedule_only_for_opened_days(): void
    {
        // Weekday event Mon-Wed; in tests no national holiday is synced so these
        // are bookable by default. Day 1 is opened for Istura Open, day 2 stays
        // closed for the open event and must remain bookable for rombongan.
        $event = new OpenEvent;
        $event->name = 'Istura Open Weekday';
        $event->slug = 'istura-open-weekday';
        $event->start_date = '2026-08-17';
        $event->end_date = '2026-08-19';
        $event->per_day_quota = 100;
        $event->max_addons = 4;
        $event->assignment_mode = 'self_select';
        $event->release_mode = 'simultaneous';
        $event->is_active = true;
        $event->save();
        foreach (['2026-08-17', '2026-08-18', '2026-08-19'] as $date) {
            $event->days()->create(['date' => $date, 'is_open' => false]);
        }
        $openDay = $event->days()->whereDate('date', '2026-08-17')->first();
        $openDay->update(['is_open' => true, 'whatsapp_group_url' => 'https://chat.whatsapp.com/weekday']);

        $service = app(ScheduleService::class);

        // Opened Istura Open day: closed for rombongan with the dedicated reason.
        $this->assertSame('Closed', $service->slotStatusFor('2026-08-17', '08.00'));
        $horizon = collect($service->buildHorizon(Carbon::parse('2026-08-17', 'Asia/Jakarta'), Carbon::parse('2026-08-19', 'Asia/Jakarta')));
        $blocked = $horizon->firstWhere('date', '2026-08-17');
        $this->assertSame('istura_open', $blocked['closureReason']['type'] ?? null);
        $this->assertNotContains('Available', array_column($blocked['slots'], 'status'));

        // Day not opened for Istura Open stays bookable for rombongan.
        $this->assertSame('Available', $service->slotStatusFor('2026-08-18', '08.00'));
        $open = $horizon->firstWhere('date', '2026-08-18');
        $this->assertContains('Available', array_column($open['slots'], 'status'));
    }

    public function test_admin_can_upload_and_remove_event_poster(): void
    {
        Storage::fake('public');
        $this->actingAsAdmin();
        $event = $this->makeEvent(active: false);

        $upload = $this->post("/api/admin/open-events/{$event->id}/poster", [
            'poster' => UploadedFile::fake()->image('poster.jpg', 1000, 1400)->size(400),
        ])->assertOk();

        $posterUrl = $upload->json('data.posterUrl');
        $this->assertNotNull($posterUrl);
        $this->assertStringEndsWith('.webp', $posterUrl);
        $path = ltrim(substr(parse_url($posterUrl, PHP_URL_PATH), strlen('/storage/')), '/');
        Storage::disk('public')->assertExists($path);

        // Poster surfaces on the public payload too.
        $event->fresh()->update(['is_active' => true]);
        foreach ($event->fresh()->days as $day) {
            $day->update(['is_open' => true, 'whatsapp_group_url' => 'https://chat.whatsapp.com/poster']);
        }
        $this->getJson('/api/public/open-event')
            ->assertOk()
            ->assertJsonPath('data.posterUrl', $posterUrl);

        $this->deleteJson("/api/admin/open-events/{$event->id}/poster")
            ->assertOk()
            ->assertJsonPath('data.posterUrl', null);
        Storage::disk('public')->assertMissing($path);
    }

    public function test_poster_rejects_oversized_dimensions_with_clear_message(): void
    {
        Storage::fake('public');
        $this->actingAsAdmin();
        $event = $this->makeEvent(active: false);

        // 3000px wide exceeds the 2800px max — must fail with the dimensions message.
        $response = $this->post("/api/admin/open-events/{$event->id}/poster", [
            'poster' => UploadedFile::fake()->image('wide.jpg', 3000, 1200),
        ])->assertStatus(422);

        $this->assertStringContainsString('Dimensi gambar maksimal', $response->json('errors.poster.0'));
        $this->assertNull($event->fresh()->poster_path);
    }

    public function test_opening_day_warns_when_active_rombongan_booking_exists(): void
    {
        $this->actingAsAdmin();
        $event = $this->makeEvent(active: false);
        $days = $event->days()->orderBy('date')->get();
        $conflictDay = $days[0];
        $freeDay = $days[1];

        $this->makeBooking($conflictDay->date->toDateString(), '08.00', 'Accepted', 'ISTURA-2026-9001');
        // A non-active booking must NOT trigger the warning.
        $this->makeBooking($freeDay->date->toDateString(), '08.00', 'Rejected', 'ISTURA-2026-9002');

        // First attempt: blocked with the conflict list, day stays closed.
        $this->putJson("/api/admin/open-events/{$event->id}/days/{$conflictDay->id}", [
            'isOpen' => true,
            'whatsappGroupUrl' => 'https://chat.whatsapp.com/conflict',
        ])
            ->assertStatus(422)
            ->assertJsonPath('conflicts.0.code', 'ISTURA-2026-9001')
            ->assertJsonPath('conflicts.0.statusLabel', 'Disetujui');
        $this->assertFalse($conflictDay->fresh()->is_open);

        // Acknowledged: the day opens.
        $this->putJson("/api/admin/open-events/{$event->id}/days/{$conflictDay->id}", [
            'isOpen' => true,
            'whatsappGroupUrl' => 'https://chat.whatsapp.com/conflict',
            'acknowledgeConflicts' => true,
        ])->assertOk();
        $this->assertTrue($conflictDay->fresh()->is_open);

        // Day whose only booking is non-active opens without acknowledgement.
        $this->putJson("/api/admin/open-events/{$event->id}/days/{$freeDay->id}", [
            'isOpen' => true,
            'whatsappGroupUrl' => 'https://chat.whatsapp.com/free',
        ])->assertOk();
        $this->assertTrue($freeDay->fresh()->is_open);
    }

    public function test_admin_can_set_promo_copy_and_public_payload_exposes_it(): void
    {
        $this->actingAsAdmin();
        $event = $this->makeActiveEvent();

        $this->putJson("/api/admin/open-events/{$event->id}", [
            'promoSubtitle' => 'Subjudul khusus Agustus.',
            'bannerText' => 'Banner berjalan kustom!',
        ])
            ->assertOk()
            ->assertJsonPath('data.promoSubtitle', 'Subjudul khusus Agustus.')
            ->assertJsonPath('data.bannerText', 'Banner berjalan kustom!');

        $this->getJson('/api/public/open-event')
            ->assertOk()
            ->assertJsonPath('data.promoSubtitle', 'Subjudul khusus Agustus.')
            ->assertJsonPath('data.bannerText', 'Banner berjalan kustom!');
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

    private function makePastEvent(bool $active): OpenEvent
    {
        $event = new OpenEvent;
        $event->name = 'Istura Open Lewat';
        $event->slug = 'istura-open-lewat';
        $event->start_date = '2026-07-20';
        $event->end_date = '2026-07-21';
        $event->per_day_quota = 100;
        $event->max_addons = 4;
        $event->assignment_mode = 'self_select';
        $event->release_mode = 'simultaneous';
        $event->is_active = $active;
        $event->save();

        foreach (['2026-07-20', '2026-07-21'] as $date) {
            $event->days()->create([
                'date' => $date,
                'is_open' => true,
                'whatsapp_group_url' => 'https://chat.whatsapp.com/past',
            ]);
        }

        return $event->fresh('days');
    }

    private function makeBooking(string $date, string $time, string $status, string $code): Booking
    {
        $booking = new Booking;
        $booking->code = $code;
        $booking->contact_name = 'Rombongan '.substr($code, -4);
        $booking->nik = '33740101010100'.substr($code, -2);
        $booking->whatsapp = '0812345670'.substr($code, -2);
        $booking->institution = 'Instansi '.substr($code, -4);
        $booking->group_size = 40;
        $booking->date = $date;
        $booking->date_label = $date;
        $booking->time = $time;
        $booking->status = $status;
        $booking->document_original_name = 'surat.pdf';
        $booking->feedback_token = 'fb_'.bin2hex(random_bytes(8));
        $booking->submitted_at = now();
        $booking->save();

        return $booking->fresh();
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
        $registration->city = 'Yogyakarta';
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
