<?php

namespace Tests\Feature;

use App\Events\BookingCreated;
use App\Events\BookingDeleted;
use App\Events\BookingStatusChanged;
use App\Events\FeedbackSubmitted;
use App\Events\ScheduleUpdated;
use App\Models\AuditLog;
use App\Models\Booking;
use App\Models\BookingSlot;
use App\Models\Feedback;
use App\Models\NationalHoliday;
use App\Models\ScheduleOverride;
use App\Models\User;
use App\Services\BookingCodeGenerator;
use App\Services\BookingService;
use App\Services\NationalHolidaySyncService;
use App\Services\ScheduleService;
use App\Services\TwoFactorService;
use App\Support\PublicCache;
use App\Support\SiteContentDefaults;
use Carbon\Carbon;
use Database\Seeders\UserSeeder;
use Illuminate\Broadcasting\BroadcastException;
use Illuminate\Contracts\Broadcasting\Broadcaster as BroadcasterContract;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Broadcasting\ShouldRescue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class ScheduleSyncTest extends TestCase
{
    use RefreshDatabase;

    private int $bookingSequence = 9000;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-05-30 09:00:00', 'Asia/Jakarta'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_realtime_events_are_broadcast_after_commit_and_rescued(): void
    {
        foreach ([BookingCreated::class, BookingStatusChanged::class, BookingDeleted::class, FeedbackSubmitted::class] as $eventClass) {
            $interfaces = class_implements($eventClass) ?: [];

            $this->assertContains(ShouldBroadcast::class, $interfaces);
            $this->assertContains(ShouldBroadcastNow::class, $interfaces);
            $this->assertContains(ShouldRescue::class, $interfaces);
        }

        $scheduleInterfaces = class_implements(ScheduleUpdated::class) ?: [];
        $this->assertContains(ShouldBroadcast::class, $scheduleInterfaces);
        $this->assertContains(ShouldBroadcastNow::class, $scheduleInterfaces);
        $this->assertContains(ShouldRescue::class, $scheduleInterfaces);

        $this->assertTrue((new BookingCreated(new Booking))->afterCommit);
        $this->assertTrue((new BookingStatusChanged(new Booking, 'Pending'))->afterCommit);
        $this->assertTrue((new BookingDeleted('ISTURA-2026-TEST'))->afterCommit);
        $this->assertTrue((new FeedbackSubmitted(new Feedback))->afterCommit);
        $this->assertTrue((new ScheduleUpdated('2026-06-01', '2026-06-01'))->afterCommit);
    }

    public function test_broadcast_failure_does_not_block_booking_status_or_schedule_writes(): void
    {
        Storage::fake('local');
        $this->useFailingBroadcaster();

        $created = $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-04',
            'time' => '08.00',
        ]), ['Accept' => 'application/json'])
            ->assertCreated();

        $this->assertDatabaseHas('bookings', [
            'code' => $created->json('data.code'),
            'status' => 'Pending',
        ]);

        $this->actingAsAdmin();
        $pending = $this->createBooking([
            'code' => 'ISTURA-2026-BCAST',
            'date' => '2026-06-01',
            'time' => '09.00',
            'status' => 'Pending',
        ]);

        $this->postJson("/api/admin/bookings/{$pending->code}/accept")
            ->assertOk()
            ->assertJsonPath('data.status', 'Accepted');

        $this->assertDatabaseHas('bookings', [
            'code' => $pending->code,
            'status' => 'Accepted',
        ]);

        $this->postJson('/api/admin/schedule/slot', [
            'date' => '2026-06-01',
            'time' => '10.00',
            'status' => 'Closed',
        ])->assertOk();

        $this->assertDatabaseHas('schedule_overrides', [
            'date' => '2026-06-01 00:00:00',
            'time' => '10.00',
            'status' => 'Closed',
        ]);
    }

    public function test_pending_booking_expires_after_visit_start_and_releases_slot(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-01 12:00:00', 'Asia/Jakarta'));

        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-EXPIRE',
            'date' => '2026-06-01',
            'time' => '11.00',
            'status' => 'Pending',
        ]);

        $this->assertSame('Held', app(ScheduleService::class)->slotStatusFor('2026-06-01', '11.00'));

        $this->artisan('bookings:expire-pending')->assertSuccessful();

        $booking->refresh();
        $this->assertSame('Expired', $booking->status);
        $this->assertNotNull($booking->expired_at);
        $this->assertNull($booking->active_slot_key);
        $this->assertSame('Available', app(ScheduleService::class)->slotStatusFor('2026-06-01', '11.00'));
        $this->assertDatabaseHas('audit_logs', [
            'action' => "Menandai kedaluwarsa booking {$booking->code}",
        ]);
    }

    public function test_pending_booking_does_not_expire_before_visit_start_even_when_old(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-01 12:00:00', 'Asia/Jakarta'));

        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-OLD-PENDING',
            'date' => '2026-06-04',
            'time' => '08.00',
            'status' => 'Pending',
            'submitted_at' => now()->subDays(7),
        ]);

        $this->assertSame('Held', app(ScheduleService::class)->slotStatusFor('2026-06-04', '08.00'));

        $this->artisan('bookings:expire-pending')->assertSuccessful();

        $booking->refresh();
        $this->assertSame('Pending', $booking->status);
        $this->assertNull($booking->expired_at);
        $this->assertSame('Held', app(ScheduleService::class)->slotStatusFor('2026-06-04', '08.00'));
        $this->assertDatabaseMissing('audit_logs', [
            'target_id' => $booking->code,
            'action' => "Menandai kedaluwarsa booking {$booking->code}",
        ]);
    }

    public function test_stale_reschedule_restores_original_booking_when_original_slot_is_still_valid(): void
    {
        $this->actingAsAdmin();

        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-RESCHEDULE-RESTORE',
            'date' => '2026-06-04',
            'time' => '09.00',
            'status' => 'Accepted',
        ]);

        $this->postJson("/api/admin/bookings/{$booking->code}/reschedule", [
            'proposedDate' => '2026-06-01',
            'proposedTime' => '10.00',
            'note' => 'Tawarkan jam lebih awal.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'Reschedule');

        Carbon::setTestNow(Carbon::parse('2026-06-01 12:00:00', 'Asia/Jakarta'));

        $this->artisan('bookings:expire-pending')->assertSuccessful();

        $booking->refresh();
        $this->assertSame('Accepted', $booking->status);
        $this->assertNull($booking->expired_at);
        $this->assertNull($booking->proposed_date);
        $this->assertNull($booking->reschedule_previous_status);
        $this->assertDatabaseMissing('booking_slots', [
            'booking_id' => $booking->id,
            'kind' => BookingSlot::KIND_PROPOSED,
        ]);

        $this->assertSame('Available', app(ScheduleService::class)->slotStatusFor('2026-06-01', '10.00'));

        $schedule = $this->getJson('/api/public/schedule?from=2026-06-04&to=2026-06-04')
            ->assertOk()
            ->json('data');
        $this->assertSame('Booked', $this->slotFromResponse($schedule, '2026-06-04', '09.00')['status']);
        $this->assertDatabaseHas('audit_logs', [
            'action' => "Menandai kedaluwarsa usulan reschedule booking {$booking->code}",
        ]);
    }

    public function test_stale_reschedule_expires_booking_when_original_slot_also_passed(): void
    {
        $this->actingAsAdmin();

        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-RESCHEDULE-EXPIRE',
            'date' => '2026-06-01',
            'time' => '09.00',
            'status' => 'Accepted',
        ]);

        $this->postJson("/api/admin/bookings/{$booking->code}/reschedule", [
            'proposedDate' => '2026-06-01',
            'proposedTime' => '10.00',
            'note' => 'Tawarkan jam 10.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'Reschedule');

        Carbon::setTestNow(Carbon::parse('2026-06-01 12:00:00', 'Asia/Jakarta'));

        $this->artisan('bookings:expire-pending')->assertSuccessful();

        $booking->refresh();
        $this->assertSame('Expired', $booking->status);
        $this->assertNotNull($booking->expired_at);
        $this->assertNull($booking->active_slot_key);
        $this->assertNull($booking->proposed_date);

        $this->assertSame('Available', app(ScheduleService::class)->slotStatusFor('2026-06-01', '09.00'));
        $this->assertSame('Available', app(ScheduleService::class)->slotStatusFor('2026-06-01', '10.00'));
    }

    public function test_stale_reschedule_from_expired_booking_refreshes_expired_timestamp(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-02 09:00:00', 'Asia/Jakarta'));
        $this->actingAsAdmin();

        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-RESCHEDULE-EXPIRED-AGAIN',
            'date' => '2026-06-01',
            'time' => '09.00',
            'status' => 'Expired',
            'expired_at' => Carbon::parse('2026-06-01 09:00:00', 'Asia/Jakarta'),
        ]);

        $this->postJson("/api/admin/bookings/{$booking->code}/reschedule", [
            'proposedDate' => '2026-06-04',
            'proposedTime' => '10.00',
            'note' => 'Tawarkan ulang setelah jadwal awal terlewat.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'Reschedule');

        Carbon::setTestNow(Carbon::parse('2026-06-04 12:00:00', 'Asia/Jakarta'));

        $this->artisan('bookings:expire-pending')->assertSuccessful();

        $booking->refresh();
        $this->assertSame('Expired', $booking->status);
        $this->assertSame('2026-06-04 12:00:00', $booking->expired_at?->timezone('Asia/Jakarta')->toDateTimeString());
        $this->assertNull($booking->proposed_date);
        $this->assertSame('Available', app(ScheduleService::class)->slotStatusFor('2026-06-04', '10.00'));
    }

    public function test_admin_cannot_accept_pending_booking_after_visit_start(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-01 12:00:00', 'Asia/Jakarta'));
        $this->actingAsAdmin();

        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-LATE',
            'date' => '2026-06-01',
            'time' => '11.00',
            'status' => 'Pending',
        ]);

        $this->postJson("/api/admin/bookings/{$booking->code}/accept")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->assertDatabaseHas('bookings', [
            'code' => $booking->code,
            'status' => 'Pending',
        ]);
    }

    public function test_admin_cannot_accept_reschedule_after_proposed_visit_start(): void
    {
        $admin = $this->actingAsAdmin();

        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-LATE-RESCHEDULE',
            'date' => '2026-06-04',
            'time' => '09.00',
            'status' => 'Accepted',
        ]);

        $this->postJson("/api/admin/bookings/{$booking->code}/reschedule", [
            'proposedDate' => '2026-06-01',
            'proposedTime' => '10.00',
            'note' => 'Tawarkan jam 10.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'Reschedule');

        Carbon::setTestNow(Carbon::parse('2026-06-01 12:00:00', 'Asia/Jakarta'));
        $this->actingAsAdminSession($admin);

        $this->postJson("/api/admin/bookings/{$booking->code}/accept")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->assertDatabaseHas('bookings', [
            'code' => $booking->code,
            'status' => 'Reschedule',
        ]);
        $this->assertSame('Reschedule Hold', app(ScheduleService::class)->slotStatusFor('2026-06-01', '10.00'));
    }

    public function test_admin_can_offer_new_slot_for_expired_booking(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-02 09:00:00', 'Asia/Jakarta'));
        $this->actingAsAdmin();

        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-RECOVER',
            'date' => '2026-06-01',
            'time' => '11.00',
            'status' => 'Expired',
            'expired_at' => Carbon::parse('2026-06-01 11:00:00', 'Asia/Jakarta'),
        ]);

        $this->postJson("/api/admin/bookings/{$booking->code}/reschedule", [
            'proposedDate' => '2026-06-04',
            'proposedTime' => '09.00',
            'note' => 'Ditawarkan ulang karena jadwal awal terlewat.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'Reschedule')
            ->assertJsonPath('data.proposedDate', '2026-06-04');

        $this->assertDatabaseHas('bookings', [
            'code' => $booking->code,
            'status' => 'Reschedule',
            'reschedule_previous_status' => 'Expired',
        ]);
    }

    public function test_overbooking_migration_rollback_blocks_duplicate_active_slot_keys(): void
    {
        $first = $this->createBooking(['code' => 'ISTURA-2026-DUP1', 'time' => '08.00']);
        $second = $this->createBooking(['code' => 'ISTURA-2026-DUP2', 'time' => '09.00']);

        foreach ([$first, $second] as $booking) {
            BookingSlot::create([
                'booking_id' => $booking->id,
                'kind' => BookingSlot::KIND_ACTIVE,
                'slot_order' => 1,
                'date' => '2026-06-01',
                'date_label' => 'Senin, 1 Juni 2026',
                'time' => '08.00',
                'group_size' => 25,
                'active_slot_key' => '2026-06-01|08.00',
            ]);
        }

        $migration = require database_path('migrations/2026_05_30_000005_allow_admin_schedule_overrides_to_overbook_slots.php');

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('booking_slots has duplicate active_slot_key values');

        $migration->down();
    }

    public function test_completed_booking_repair_migration_clears_legacy_active_slot_keys(): void
    {
        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-COMPLETE-LEGACY',
            'date' => '2026-06-01',
            'time' => '08.00',
            'status' => 'Completed',
        ]);
        DB::table('bookings')
            ->where('id', $booking->id)
            ->update(['active_slot_key' => '2026-06-01|08.00']);
        BookingSlot::create([
            'booking_id' => $booking->id,
            'kind' => BookingSlot::KIND_ACTIVE,
            'slot_order' => 1,
            'date' => '2026-06-01',
            'date_label' => 'Senin, 1 Juni 2026',
            'time' => '08.00',
            'group_size' => 25,
            'active_slot_key' => '2026-06-01|08.00',
        ]);

        $migration = require database_path('migrations/2026_05_31_000002_repair_completed_booking_active_slot_keys.php');
        $migration->up();

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'active_slot_key' => null,
        ]);
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'active_slot_key' => null,
        ]);
    }

    public function test_large_legacy_booking_slot_repair_migration_splits_segments(): void
    {
        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-LARGE-LEGACY',
            'date' => '2026-06-04',
            'time' => '11.00',
            'status' => 'Pending',
            'group_size' => 160,
        ]);
        BookingSlot::create([
            'booking_id' => $booking->id,
            'kind' => BookingSlot::KIND_ACTIVE,
            'slot_order' => 1,
            'date' => '2026-06-04',
            'date_label' => 'Kamis, 4 Juni 2026',
            'time' => '11.00',
            'group_size' => 80,
            'active_slot_key' => '2026-06-04|11.00',
        ]);

        $migration = require database_path('migrations/2026_05_31_000003_repair_legacy_large_booking_slots.php');
        $migration->up();

        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'slot_order' => 1,
            'time' => '11.00',
            'group_size' => 80,
            'active_slot_key' => '2026-06-04|11.00',
        ]);
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'slot_order' => 2,
            'time' => '12.00',
            'group_size' => 80,
            'active_slot_key' => '2026-06-04|12.00',
        ]);
    }

    public function test_public_schedule_reflects_admin_override_and_active_booking(): void
    {
        $date = '2026-06-01';

        ScheduleOverride::create([
            'date' => $date,
            'time' => '08.00',
            'status' => 'Closed',
            'custom' => false,
        ]);
        $this->createBooking([
            'date' => $date,
            'time' => '09.00',
            'status' => 'Accepted',
        ]);

        $response = $this->getJson("/api/public/schedule?from={$date}&to={$date}");

        $response->assertOk();
        $this->assertSame('Closed', $this->slotFromResponse($response->json('data'), $date, '08.00')['status']);
        $this->assertSame('Booked', $this->slotFromResponse($response->json('data'), $date, '09.00')['status']);
    }

    public function test_closed_override_keeps_active_booking_visible_with_manual_reason(): void
    {
        $date = '2026-06-01';
        $this->actingAsAdmin();
        $this->createBooking([
            'date' => $date,
            'time' => '08.00',
            'status' => 'Accepted',
        ]);

        $this->postJson('/api/admin/schedule/slot', [
            'date' => $date,
            'time' => '08.00',
            'status' => 'Closed',
            'note' => 'Admin menutup slot meski sudah ada booking.',
        ])->assertOk();

        $response = $this->getJson("/api/admin/schedule?from={$date}&to={$date}")
            ->assertOk();
        $slot = $this->slotFromResponse($response->json('data'), $date, '08.00');

        $this->assertSame('Booked', $slot['status']);
        $this->assertSame(1, $slot['bookingCount']);
        $this->assertSame('manual_closed', $slot['closureReason']['type']);
        $this->assertSame('Ditutup admin', $slot['closureReason']['label']);
        $this->assertSame('Booked', app(ScheduleService::class)->slotStatusFor($date, '08.00'));
        $this->assertSame('Booked', app(ScheduleService::class)->slotStatusesFor($date, ['08.00'])['08.00']);
    }

    public function test_admin_schedule_keeps_day_closure_metadata_for_calendar_badges(): void
    {
        NationalHoliday::create([
            'date' => '2026-06-01',
            'year' => 2026,
            'name' => 'Hari Lahir Pancasila',
            'type' => NationalHoliday::TYPE_NATIONAL_HOLIDAY,
            'tentative' => false,
            'source' => 'test',
            'source_url' => 'https://example.test/holidays.json',
            'synced_at' => now(),
            'checksum' => hash('sha256', '2026-06-01'),
        ]);

        $this->actingAsAdmin();

        $response = $this->getJson('/api/admin/schedule?from=2026-06-01&to=2026-06-01')
            ->assertOk();

        $this->assertSame('national_holiday', $response->json('data.0.closureReason.type'));
        $this->assertSame('Libur Nasional: Hari Lahir Pancasila', $response->json('data.0.closureReason.label'));
        $this->assertSame('national_holiday', $response->json('data.0.holiday.type'));
        $this->assertSame('Libur Nasional: Hari Lahir Pancasila', $response->json('data.0.holiday.label'));
    }

    public function test_schedule_policy_defaults_open_friday(): void
    {
        $this->actingAsAdmin();

        $policy = $this->getJson('/api/admin/schedule/policy')
            ->assertOk();

        $this->assertSame([1, 2, 3, 4, 5], $policy->json('data.openWeekdays'));
        $this->assertSame('Available', app(ScheduleService::class)->slotStatusFor('2026-06-05', '08.00'));

        $response = $this->getJson('/api/public/schedule?from=2026-06-05&to=2026-06-05')
            ->assertOk();

        $slot = $this->slotFromResponse($response->json('data'), '2026-06-05', '08.00');
        $this->assertSame('Available', $slot['status']);
        $this->assertNull($slot['closureReason']);
        $this->assertNull($response->json('data.0.closureReason'));
    }

    public function test_admin_can_update_default_operational_days_without_overrides(): void
    {
        $this->actingAsAdmin();

        $this->putJson('/api/admin/schedule/policy', [
            'openWeekdays' => [1, 2, 3, 4, 5, 6],
            'closedLabels' => [
                '0' => 'Akhir pekan',
                '6' => 'Akhir pekan',
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.openWeekdays', [1, 2, 3, 4, 5, 6]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Memperbarui pola operasional jadwal',
            'target_id' => 'schedule_policy',
        ]);
        $this->assertSame('Available', app(ScheduleService::class)->slotStatusFor('2026-06-06', '08.00'));
        $this->assertDatabaseMissing('schedule_overrides', [
            'date' => '2026-06-06 00:00:00',
            'time' => '08.00',
        ]);

        $response = $this->getJson('/api/public/schedule?from=2026-06-06&to=2026-06-06')
            ->assertOk();

        $slot = $this->slotFromResponse($response->json('data'), '2026-06-06', '08.00');
        $this->assertSame('Available', $slot['status']);
        $this->assertNull($slot['closureReason']);
    }

    public function test_schedule_policy_does_not_bypass_public_h_and_h_plus_one_gate(): void
    {
        $this->actingAsAdmin();

        $this->putJson('/api/admin/schedule/policy', [
            'openWeekdays' => [0, 1, 2, 3, 4],
            'closedLabels' => [
                '0' => 'Akhir pekan',
                '5' => 'Libur operasional',
                '6' => 'Akhir pekan',
            ],
        ])->assertOk();

        $this->assertSame('Available', app(ScheduleService::class)->slotStatusFor('2026-05-31', '08.00'));

        $this->getJson('/api/public/schedule?from=2026-05-31&to=2026-05-31')
            ->assertOk()
            ->assertJsonPath('data', []);

        Storage::fake('local');
        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-05-31',
            'time' => '08.00',
        ]), ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('date');
    }

    public function test_indonesian_holiday_sync_closes_public_schedule_with_reason(): void
    {
        Http::fake([
            config('services.indonesian_holidays.url') => Http::response([
                '2026-03-20' => ['summary' => 'Cuti Bersama Idul Fitri'],
                '2026-06-01' => ['summary' => 'Hari Lahir Pancasila'],
                '2026-08-25' => ['summary' => 'Maulid Nabi Muhammad (belum pasti)'],
                'info' => ['updated' => '20260522 17:05:28'],
            ]),
        ]);

        $this->artisan('holidays:sync-id', ['--year' => [2026]])
            ->assertSuccessful();

        $holiday = NationalHoliday::whereDate('date', '2026-06-01')->firstOrFail();
        $this->assertSame('Hari Lahir Pancasila', $holiday->name);
        $this->assertSame(NationalHoliday::TYPE_NATIONAL_HOLIDAY, $holiday->type);
        $this->assertFalse($holiday->tentative);

        $collectiveLeave = NationalHoliday::whereDate('date', '2026-03-20')->firstOrFail();
        $this->assertSame('Cuti Bersama Idul Fitri', $collectiveLeave->name);
        $this->assertSame(NationalHoliday::TYPE_COLLECTIVE_LEAVE, $collectiveLeave->type);

        $tentative = NationalHoliday::whereDate('date', '2026-08-25')->firstOrFail();
        $this->assertSame('Maulid Nabi Muhammad', $tentative->name);
        $this->assertTrue($tentative->tentative);

        $response = $this->getJson('/api/public/schedule?from=2026-06-01&to=2026-06-01')
            ->assertOk();

        $slot = $this->slotFromResponse($response->json('data'), '2026-06-01', '08.00');
        $this->assertSame('Closed', $slot['status']);
        $this->assertSame('Libur Nasional: Hari Lahir Pancasila', $response->json('data.0.closureReason.label'));
        $this->assertSame('Libur Nasional: Hari Lahir Pancasila', $slot['closureReason']['label']);
        $this->assertArrayNotHasKey('bookingCount', $slot);
        $this->assertArrayNotHasKey('overbooked', $slot);
    }

    public function test_indonesian_holiday_sync_refreshes_schedule_cache_even_without_data_changes(): void
    {
        Cache::forever('public:schedule:version', 7);
        Http::fake([
            config('services.indonesian_holidays.url') => Http::response([
                '2026-06-16' => ['summary' => 'Satu Muharam / Tahun Baru Hijriah (belum pasti)'],
                'info' => ['updated' => '20260522 17:05:28'],
            ]),
        ]);

        $this->artisan('holidays:sync-id', ['--year' => [2026]])
            ->assertSuccessful();

        $this->assertSame(8, Cache::get('public:schedule:version'));

        $this->artisan('holidays:sync-id', ['--year' => [2026]])
            ->expectsOutput('Tanggal merah sinkron: 0 baru, 0 berubah, 0 dihapus.')
            ->assertSuccessful();

        $this->assertSame(9, Cache::get('public:schedule:version'));
    }

    public function test_schedule_cache_version_bump_moves_reads_to_new_cache_namespace(): void
    {
        $first = PublicCache::rememberSchedule('2026-06-16', '2026-06-16', fn () => ['stale']);

        PublicCache::bumpScheduleVersion();
        $second = PublicCache::rememberSchedule('2026-06-16', '2026-06-16', fn () => ['fresh']);

        $this->assertSame(['stale'], $first);
        $this->assertSame(['fresh'], $second);
        $this->assertSame(2, Cache::get('public:schedule:version'));
    }

    public function test_public_schedule_auto_syncs_missing_holiday_year_before_using_cached_available_response(): void
    {
        config(['services.indonesian_holidays.auto_sync' => false]);

        $firstResponse = $this->getJson('/api/public/schedule?from=2026-06-16&to=2026-06-16')
            ->assertOk();
        $this->assertSame('Available', $this->slotFromResponse($firstResponse->json('data'), '2026-06-16', '08.00')['status']);

        config([
            'services.indonesian_holidays.auto_sync' => true,
            'services.indonesian_holidays.auto_sync_in_tests' => true,
        ]);
        Http::fake([
            config('services.indonesian_holidays.url') => Http::response([
                '2026-06-16' => ['summary' => 'Satu Muharam / Tahun Baru Hijriah (belum pasti)'],
                'info' => ['updated' => '20260522 17:05:28'],
            ]),
        ]);

        $secondResponse = $this->getJson('/api/public/schedule?from=2026-06-16&to=2026-06-16')
            ->assertOk();

        $slot = $this->slotFromResponse($secondResponse->json('data'), '2026-06-16', '08.00');
        $this->assertSame('Closed', $slot['status']);
        $this->assertSame('Libur Nasional: Satu Muharam / Tahun Baru Hijriah', $secondResponse->json('data.0.closureReason.label'));
        $this->assertTrue($secondResponse->json('data.0.closureReason.tentative'));
        $this->assertDatabaseHas('national_holidays', [
            'date' => '2026-06-16',
            'type' => NationalHoliday::TYPE_NATIONAL_HOLIDAY,
        ]);
    }

    public function test_public_schedule_does_not_auto_sync_stale_existing_holiday_year_during_request(): void
    {
        config([
            'services.indonesian_holidays.auto_sync' => true,
            'services.indonesian_holidays.auto_sync_in_tests' => true,
        ]);
        NationalHoliday::create([
            'date' => '2026-06-16',
            'year' => 2026,
            'name' => 'Satu Muharam / Tahun Baru Hijriah',
            'type' => NationalHoliday::TYPE_NATIONAL_HOLIDAY,
            'tentative' => true,
            'source' => NationalHolidaySyncService::SOURCE,
            'source_url' => config('services.indonesian_holidays.url'),
            'synced_at' => now('Asia/Jakarta')->subDay(),
            'checksum' => hash('sha256', '2026-06-16'),
        ]);
        Http::fake([
            config('services.indonesian_holidays.url') => Http::response([
                '2026-06-16' => ['summary' => 'Satu Muharam / Tahun Baru Hijriah (belum pasti)'],
                'info' => ['updated' => '20260522 17:05:28'],
            ]),
        ]);

        $response = $this->getJson('/api/public/schedule?from=2026-06-16&to=2026-06-16')
            ->assertOk();

        $slot = $this->slotFromResponse($response->json('data'), '2026-06-16', '08.00');
        $this->assertSame('Closed', $slot['status']);
        Http::assertNothingSent();
    }

    public function test_public_booking_auto_syncs_missing_holiday_year_before_accepting_request(): void
    {
        Storage::fake('local');
        config([
            'services.indonesian_holidays.auto_sync' => true,
            'services.indonesian_holidays.auto_sync_in_tests' => true,
        ]);
        Http::fake([
            config('services.indonesian_holidays.url') => Http::response([
                '2026-06-16' => ['summary' => 'Satu Muharam / Tahun Baru Hijriah (belum pasti)'],
                'info' => ['updated' => '20260522 17:05:28'],
            ]),
        ]);

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-16',
            'time' => '08.00',
        ]), ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('time');

        $this->assertDatabaseCount('bookings', 0);
        $this->assertDatabaseHas('national_holidays', [
            'date' => '2026-06-16',
            'type' => NationalHoliday::TYPE_NATIONAL_HOLIDAY,
        ]);
    }

    public function test_public_booking_rejects_synced_national_holiday(): void
    {
        Storage::fake('local');
        NationalHoliday::create([
            'date' => '2026-06-01',
            'year' => 2026,
            'name' => 'Hari Lahir Pancasila',
            'type' => NationalHoliday::TYPE_NATIONAL_HOLIDAY,
            'tentative' => false,
            'source' => 'test',
            'source_url' => 'https://example.test/holidays.json',
            'synced_at' => now(),
            'checksum' => hash('sha256', '2026-06-01'),
        ]);

        $this->assertSame('Closed', app(ScheduleService::class)->slotStatusFor('2026-06-01', '08.00'));

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-01',
            'time' => '08.00',
        ]), ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('time');

        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_admin_available_override_cannot_open_synced_national_holiday(): void
    {
        NationalHoliday::create([
            'date' => '2026-06-01',
            'year' => 2026,
            'name' => 'Hari Lahir Pancasila',
            'type' => NationalHoliday::TYPE_NATIONAL_HOLIDAY,
            'tentative' => false,
            'source' => 'test',
            'source_url' => 'https://example.test/holidays.json',
            'synced_at' => now(),
            'checksum' => hash('sha256', '2026-06-01'),
        ]);

        $this->actingAsAdmin();

        // Admin boleh menyimpan override, tetapi tanggal merah nasional tetap
        // tutup (Opsi C): override Available tidak dapat membuka hari libur.
        $this->postJson('/api/admin/schedule/slot', [
            'date' => '2026-06-01',
            'time' => '08.00',
            'status' => 'Available',
        ])->assertOk();

        $response = $this->getJson('/api/public/schedule?from=2026-06-01&to=2026-06-01')
            ->assertOk();

        $slot = $this->slotFromResponse($response->json('data'), '2026-06-01', '08.00');
        $this->assertSame('Closed', $slot['status']);
        $this->assertSame('national_holiday', $slot['closureReason']['type']);
        $this->assertSame('national_holiday', $response->json('data.0.closureReason.type'));
    }

    public function test_range_open_does_not_open_national_holiday(): void
    {
        NationalHoliday::create([
            'date' => '2026-06-01',
            'year' => 2026,
            'name' => 'Hari Lahir Pancasila',
            'type' => NationalHoliday::TYPE_NATIONAL_HOLIDAY,
            'tentative' => false,
            'source' => 'test',
            'source_url' => 'https://example.test/holidays.json',
            'synced_at' => now(),
            'checksum' => hash('sha256', '2026-06-01'),
        ]);

        $this->actingAsAdmin();

        // Buka rentang yang mencakup tanggal merah 2026-06-01 (Senin).
        $this->postJson('/api/admin/schedule/range', [
            'from' => '2026-06-01',
            'to' => '2026-06-05',
            'weekdays' => [1, 2, 3, 4, 5],
            'status' => 'Available',
        ])->assertOk();

        $response = $this->getJson('/api/public/schedule?from=2026-06-01&to=2026-06-05')
            ->assertOk();

        // Tanggal merah tetap tutup meski masuk rentang yang dibuka.
        $holidaySlot = $this->slotFromResponse($response->json('data'), '2026-06-01', '08.00');
        $this->assertSame('Closed', $holidaySlot['status']);
        $this->assertSame('national_holiday', $holidaySlot['closureReason']['type']);

        // Hari kerja non-libur dalam rentang tetap terbuka seperti biasa.
        $workdaySlot = $this->slotFromResponse($response->json('data'), '2026-06-02', '08.00');
        $this->assertSame('Available', $workdaySlot['status']);
    }

    public function test_public_booking_rejected_on_national_holiday_opened_by_range(): void
    {
        NationalHoliday::create([
            'date' => '2026-06-01',
            'year' => 2026,
            'name' => 'Hari Lahir Pancasila',
            'type' => NationalHoliday::TYPE_NATIONAL_HOLIDAY,
            'tentative' => false,
            'source' => 'test',
            'source_url' => 'https://example.test/holidays.json',
            'synced_at' => now(),
            'checksum' => hash('sha256', '2026-06-01'),
        ]);

        $this->actingAsAdmin();
        $this->postJson('/api/admin/schedule/range', [
            'from' => '2026-06-01',
            'to' => '2026-06-01',
            'weekdays' => [1],
            'status' => 'Available',
        ])->assertOk();

        // Sesi admin tidak boleh mempengaruhi request booking publik.
        $this->flushSession();
        app('auth')->forgetGuards();

        $response = $this->postJson('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-01',
            'time' => '08.00',
            'groupSize' => 20,
        ]));

        $response->assertStatus(422);
        $this->assertSame(0, Booking::whereDate('date', '2026-06-01')->count());
    }

    public function test_public_schedule_omits_lunch_break_from_default_slots(): void
    {
        $date = '2026-06-04';

        $response = $this->getJson("/api/public/schedule?from={$date}&to={$date}")
            ->assertOk();

        $times = collect($response->json('data.0.slots'))->pluck('time')->all();

        $this->assertSame(['08.00', '09.00', '10.00', '11.00', '13.00', '14.00'], $times);
        $this->assertNotContains('12.00', $times);
    }

    public function test_public_schedule_hides_lunch_break_even_when_legacy_data_exists(): void
    {
        $date = '2026-06-04';

        $this->createBooking([
            'date' => $date,
            'time' => '12.00',
            'status' => 'Accepted',
        ]);
        ScheduleOverride::create([
            'date' => $date,
            'time' => '12.00',
            'status' => 'Available',
            'custom' => true,
        ]);

        $response = $this->getJson("/api/public/schedule?from={$date}&to={$date}")
            ->assertOk();

        $times = collect($response->json('data.0.slots'))->pluck('time')->all();

        $this->assertNotContains('12.00', $times);
    }

    public function test_cleanup_lunch_break_command_removes_test_data_at_noon(): void
    {
        $lunchBooking = $this->createBooking([
            'code' => 'ISTURA-2026-LUNCH',
            'date' => '2026-06-04',
            'time' => '12.00',
            'status' => 'Pending',
        ]);
        $splitBooking = $this->createBooking([
            'code' => 'ISTURA-2026-SPLIT-LUNCH',
            'date' => '2026-06-04',
            'time' => '11.00',
            'status' => 'Pending',
        ]);
        $keptBooking = $this->createBooking([
            'code' => 'ISTURA-2026-KEEP',
            'date' => '2026-06-04',
            'time' => '13.00',
            'status' => 'Pending',
        ]);

        BookingSlot::create([
            'booking_id' => $splitBooking->id,
            'kind' => BookingSlot::KIND_ACTIVE,
            'slot_order' => 2,
            'date' => '2026-06-04',
            'date_label' => $splitBooking->date_label,
            'time' => '12.00',
            'group_size' => 80,
            'active_slot_key' => '2026-06-04|12.00',
        ]);
        ScheduleOverride::create([
            'date' => '2026-06-04',
            'time' => '12.00',
            'status' => 'Available',
            'custom' => true,
        ]);
        DB::table('booking_slot_locks')->insert([
            ['slot_key' => '2026-06-04|12.00', 'created_at' => now(), 'updated_at' => now()],
            ['slot_key' => '2026-06-04|13.00', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->artisan('schedule:cleanup-lunch-break --force')->assertSuccessful();

        $this->assertDatabaseMissing('bookings', ['id' => $lunchBooking->id]);
        $this->assertDatabaseMissing('bookings', ['id' => $splitBooking->id]);
        $this->assertDatabaseHas('bookings', ['id' => $keptBooking->id]);
        $this->assertDatabaseMissing('booking_slots', ['time' => '12.00']);
        $this->assertDatabaseMissing('schedule_overrides', ['time' => '12.00']);
        $this->assertDatabaseMissing('booking_slot_locks', ['slot_key' => '2026-06-04|12.00']);
        $this->assertDatabaseHas('booking_slot_locks', ['slot_key' => '2026-06-04|13.00']);
    }

    public function test_available_override_does_not_let_public_overbook_active_slot(): void
    {
        Storage::fake('local');
        $date = '2026-06-04';
        $this->actingAsAdmin();

        $this->createBooking([
            'date' => $date,
            'time' => '08.00',
            'status' => 'Accepted',
        ]);

        $this->postJson('/api/admin/schedule/slot', [
            'date' => $date,
            'time' => '08.00',
            'status' => 'Available',
            'note' => 'Admin membuka slot untuk penggabungan kloter manual.',
        ])->assertOk();

        $schedule = $this->getJson("/api/public/schedule?from={$date}&to={$date}")
            ->assertOk()
            ->json('data');
        $this->assertSame('Booked', $this->slotFromResponse($schedule, $date, '08.00')['status']);

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => $date,
            'time' => '08.00',
            'contactName' => 'Tamu Override',
        ]), ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('time');

        $this->assertDatabaseCount('bookings', 1);
    }

    public function test_completed_booking_releases_schedule_slot(): void
    {
        $date = '2026-05-28';
        $booking = $this->createBooking([
            'date' => $date,
            'time' => '08.00',
            'status' => 'Accepted',
        ]);

        $this->actingAsAdmin();
        $this->postJson("/api/admin/bookings/{$booking->code}/complete")
            ->assertOk()
            ->assertJsonPath('data.status', 'Completed');

        $this->assertSame('Available', app(ScheduleService::class)->slotStatusFor($date, '08.00'));
        $this->assertDatabaseHas('bookings', [
            'code' => $booking->code,
            'status' => 'Completed',
            'active_slot_key' => null,
        ]);
    }

    public function test_complete_booking_persists_note_when_provided(): void
    {
        $booking = $this->createBooking([
            'date' => '2026-05-28',
            'time' => '08.00',
            'status' => 'Accepted',
        ]);

        $this->actingAsAdmin();
        $this->postJson("/api/admin/bookings/{$booking->code}/complete", [
            'note' => 'Kunjungan selesai dan peserta sudah menerima tautan feedback.',
        ])->assertOk()
            ->assertJsonPath('data.note', 'Kunjungan selesai dan peserta sudah menerima tautan feedback.');

        $this->assertDatabaseHas('bookings', [
            'code' => $booking->code,
            'status' => 'Completed',
            'note' => 'Kunjungan selesai dan peserta sudah menerima tautan feedback.',
        ]);
    }

    public function test_complete_booking_persists_documentation_link_when_provided(): void
    {
        $booking = $this->createBooking([
            'date' => '2026-05-28',
            'time' => '08.00',
            'status' => 'Accepted',
        ]);

        $link = 'https://drive.google.com/drive/folders/1VGbnnkXPnTXetYLpHtCRKhIfaq5N02Iu';

        $this->actingAsAdmin();
        $this->postJson("/api/admin/bookings/{$booking->code}/complete", [
            'documentationLink' => $link,
        ])->assertOk()
            ->assertJsonPath('data.status', 'Completed')
            ->assertJsonPath('data.documentationLink', $link);

        $this->assertDatabaseHas('bookings', [
            'code' => $booking->code,
            'status' => 'Completed',
            'documentation_link' => $link,
        ]);
    }

    public function test_complete_booking_rejects_invalid_documentation_link(): void
    {
        $booking = $this->createBooking([
            'date' => '2026-05-28',
            'time' => '08.00',
            'status' => 'Accepted',
        ]);

        $this->actingAsAdmin();
        $this->postJson("/api/admin/bookings/{$booking->code}/complete", [
            'documentationLink' => 'bukan-url-valid',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('documentationLink');
    }

    public function test_complete_booking_rejects_insecure_or_unapproved_documentation_link(): void
    {
        config(['security.documentation_link_hosts' => []]);

        $booking = $this->createBooking([
            'date' => '2026-05-28',
            'time' => '08.00',
            'status' => 'Accepted',
        ]);

        $this->actingAsAdmin();
        $this->postJson("/api/admin/bookings/{$booking->code}/complete", [
            'documentationLink' => 'http://drive.google.com/drive/folders/insecure',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('documentationLink');

        $this->postJson("/api/admin/bookings/{$booking->code}/complete", [
            'documentationLink' => 'https://phishing.example/dokumentasi',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('documentationLink');

        $this->assertDatabaseHas('bookings', [
            'code' => $booking->code,
            'status' => 'Accepted',
            'documentation_link' => null,
        ]);
    }

    public function test_admin_cannot_complete_future_booking(): void
    {
        $booking = $this->createBooking([
            'date' => '2026-06-01',
            'time' => '08.00',
            'status' => 'Accepted',
        ]);

        $this->actingAsAdmin();
        $this->postJson("/api/admin/bookings/{$booking->code}/complete")
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');

        $this->assertDatabaseHas('bookings', [
            'code' => $booking->code,
            'status' => 'Accepted',
            'completed_at' => null,
        ]);
    }

    public function test_admin_schedule_override_rejects_system_statuses_and_past_dates(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/admin/schedule/slot', [
            'date' => '2026-06-01',
            'time' => '08.00',
            'status' => 'Booked',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('status');

        $this->postJson('/api/admin/schedule/slot', [
            'date' => '2026-05-29',
            'time' => '08.00',
            'status' => 'Available',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('date');

        $this->postJson('/api/admin/schedule/range', [
            'from' => '2026-05-29',
            'to' => '2026-06-01',
            'status' => 'Closed',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('from');
    }

    public function test_public_booking_rejects_closed_slot(): void
    {
        Storage::fake('local');
        $date = '2026-06-04';
        ScheduleOverride::create([
            'date' => $date,
            'time' => '08.00',
            'status' => 'Closed',
            'custom' => false,
        ]);

        $response = $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => $date,
            'time' => '08.00',
        ]), ['Accept' => 'application/json']);

        $response->assertStatus(422)->assertJsonValidationErrors('time');
        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_public_booking_rejects_duplicate_active_slot(): void
    {
        Storage::fake('local');
        $date = '2026-06-04';
        $this->createBooking([
            'date' => $date,
            'time' => '08.00',
            'status' => 'Accepted',
        ]);

        $response = $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => $date,
            'time' => '08.00',
        ]), ['Accept' => 'application/json']);

        $response->assertStatus(422)->assertJsonValidationErrors('time');
        $this->assertDatabaseCount('bookings', 1);
    }

    public function test_public_booking_rejects_identity_after_active_booking_limit(): void
    {
        Storage::fake('local');
        config(['booking.public_active_identity_limit' => 2]);

        $this->createBooking([
            'code' => 'ISTURA-2026-ACTIVE1',
            'date' => '2026-06-04',
            'time' => '08.00',
            'status' => 'Pending',
            'nik' => '1234567890123456',
            'whatsapp' => '081234567890',
        ]);
        $this->createBooking([
            'code' => 'ISTURA-2026-ACTIVE2',
            'date' => '2026-06-05',
            'time' => '08.00',
            'status' => 'Accepted',
            'nik' => '1234567890123456',
            'whatsapp' => '6281234567890',
        ]);

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-06',
            'time' => '08.00',
            'nik' => '1234567890123456',
            'whatsapp' => '081234567890',
        ]), ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['nik', 'whatsapp']);

        $this->assertDatabaseMissing('bookings', [
            'date' => '2026-06-06 00:00:00',
            'time' => '08.00',
            'status' => 'Pending',
        ]);
    }

    public function test_public_booking_precheck_rejects_identity_at_active_limit(): void
    {
        Storage::fake('local');
        config(['booking.public_active_identity_limit' => 2]);

        $this->createBooking([
            'code' => 'ISTURA-2026-PRECHK1',
            'date' => '2026-06-04',
            'time' => '08.00',
            'status' => 'Pending',
            'nik' => '1234567890123456',
            'whatsapp' => '081234567890',
        ]);
        $this->createBooking([
            'code' => 'ISTURA-2026-PRECHK2',
            'date' => '2026-06-05',
            'time' => '08.00',
            'status' => 'Accepted',
            'nik' => '1234567890123456',
            'whatsapp' => '6281234567890',
        ]);

        $this->post('/api/public/bookings/precheck', [
            'nik' => '1234567890123456',
            'whatsapp' => '081234567890',
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['nik', 'whatsapp']);

        $this->assertDatabaseCount('bookings', 2);
    }

    public function test_public_booking_precheck_allows_identity_below_active_limit(): void
    {
        Storage::fake('local');
        config(['booking.public_active_identity_limit' => 2]);

        $this->createBooking([
            'code' => 'ISTURA-2026-PRECHK3',
            'date' => '2026-06-04',
            'time' => '08.00',
            'status' => 'Completed',
            'nik' => '1234567890123456',
            'whatsapp' => '081234567890',
        ]);

        $this->post('/api/public/bookings/precheck', [
            'nik' => '1234567890123456',
            'whatsapp' => '081234567890',
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.allowed', true);
    }

    public function test_public_booking_codes_start_from_zero_sequence(): void
    {
        Storage::fake('local');

        $first = $this->post('/api/public/bookings', $this->publicBookingPayload([
            'time' => '08.00',
        ]), ['Accept' => 'application/json']);
        $second = $this->post('/api/public/bookings', $this->publicBookingPayload([
            'time' => '09.00',
        ]), ['Accept' => 'application/json']);

        $first->assertCreated()->assertJsonPath('data.code', 'ISTURA-2026-0000');
        $second->assertCreated()->assertJsonPath('data.code', 'ISTURA-2026-0001');
        $this->assertDatabaseHas('bookings', ['code' => 'ISTURA-2026-0000']);
        $this->assertDatabaseHas('bookings', ['code' => 'ISTURA-2026-0001']);
    }

    public function test_admin_schedule_slot_and_range_mutations_persist_to_public_schedule(): void
    {
        $this->actingAsAdmin();
        $date = '2026-06-01';

        $this->postJson('/api/admin/schedule/slot', [
            'date' => $date,
            'time' => '15.30',
            'status' => 'Available',
        ])->assertOk();

        $withCustom = $this->getJson("/api/public/schedule?from={$date}&to={$date}")
            ->assertOk()
            ->json('data');
        $customSlot = $this->slotFromResponse($withCustom, $date, '15.30');
        $this->assertSame('Available', $customSlot['status']);
        $this->assertTrue($customSlot['custom']);

        $this->postJson('/api/admin/schedule/range', [
            'from' => $date,
            'to' => $date,
            'weekdays' => [1],
            'status' => 'Closed',
        ])->assertOk();

        $afterRange = $this->getJson("/api/public/schedule?from={$date}&to={$date}")
            ->assertOk()
            ->json('data');
        $this->assertSame('Closed', $this->slotFromResponse($afterRange, $date, '08.00')['status']);
        $this->assertSame('Closed', $this->slotFromResponse($afterRange, $date, '15.30')['status']);

        $this->deleteJson('/api/admin/schedule/slot', [
            'date' => $date,
            'time' => '15.30',
        ])->assertOk();

        $afterDelete = $this->getJson("/api/public/schedule?from={$date}&to={$date}")
            ->assertOk()
            ->json('data');
        $this->assertNull($this->findSlot($afterDelete, $date, '15.30'));

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Mengubah slot jadwal 2026-06-01 15.30',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Menghapus override slot 2026-06-01 15.30',
        ]);
    }

    public function test_far_future_available_range_override_does_not_later_open_h_plus_one_publicly(): void
    {
        Storage::fake('local');
        Carbon::setTestNow(Carbon::parse('2026-06-06 05:25:00', 'Asia/Jakarta'));
        $this->actingAsAdmin();

        $this->postJson('/api/admin/schedule/range', [
            'from' => '2026-06-29',
            'to' => '2026-06-29',
            'status' => 'Available',
        ])->assertOk();

        $override = ScheduleOverride::whereDate('date', '2026-06-29')
            ->where('time', '08.00')
            ->firstOrFail();
        $this->assertTrue($override->custom);
        $this->assertNull($override->public_early_opened_at);

        Carbon::setTestNow(Carbon::parse('2026-06-28 05:25:00', 'Asia/Jakarta'));

        $this->getJson('/api/public/schedule?from=2026-06-29&to=2026-06-29')
            ->assertOk()
            ->assertJsonPath('data', []);

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-29',
            'time' => '08.00',
        ]), ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('time');

        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_admin_opening_h_plus_one_marks_explicit_public_early_opening(): void
    {
        Storage::fake('local');
        Carbon::setTestNow(Carbon::parse('2026-06-28 09:00:00', 'Asia/Jakarta'));
        $this->actingAsAdmin();

        $this->postJson('/api/admin/schedule/slot', [
            'date' => '2026-06-29',
            'time' => '10.00',
            'status' => 'Available',
        ])->assertOk();

        $override = ScheduleOverride::whereDate('date', '2026-06-29')
            ->where('time', '10.00')
            ->firstOrFail();
        $this->assertTrue($override->custom);
        $this->assertNotNull($override->public_early_opened_at);

        $schedule = $this->getJson('/api/public/schedule?from=2026-06-29&to=2026-06-29')
            ->assertOk()
            ->json('data');
        $this->assertSame('Available', $this->slotFromResponse($schedule, '2026-06-29', '10.00')['status']);

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-29',
            'time' => '10.00',
        ]), ['Accept' => 'application/json'])
            ->assertCreated();

        $this->assertDatabaseHas('bookings', [
            'date' => '2026-06-29 00:00:00',
            'time' => '10.00',
            'status' => 'Pending',
        ]);
    }

    public function test_admin_collection_endpoints_return_pagination_meta(): void
    {
        $this->actingAsAdmin();

        $bookings = collect(range(1, 3))->map(fn (int $index) => $this->createBooking([
            'code' => "ISTURA-2026-PAGE{$index}",
            'time' => sprintf('%02d.00', 7 + $index),
        ]));

        $this->getJson('/api/admin/bookings?perPage=2')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.perPage', 2)
            ->assertJsonPath('meta.total', 3);

        $bookings->each(function (Booking $booking, int $index): void {
            Feedback::create([
                'booking_id' => $booking->id,
                'code' => $booking->code,
                'rating' => 5 - $index,
                'booking_ease' => 5,
                'service' => 5,
                'recommend' => 5,
                'highlights' => [],
                'improvements' => [],
                'comment' => null,
                'allow_publish' => false,
                'submitted_at' => now()->subMinutes($index),
            ]);

            AuditLog::create([
                'actor_name' => 'Admin',
                'action' => "Audit pagination {$index}",
                'target_type' => Booking::class,
                'target_id' => $booking->code,
                'created_at' => now()->subMinutes($index),
            ]);
        });

        $this->getJson('/api/admin/feedback?perPage=2')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.perPage', 2)
            ->assertJsonPath('meta.total', 3);

        $this->getJson('/api/admin/audit-logs?perPage=2')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.perPage', 2)
            ->assertJsonPath('meta.total', 3);
    }

    public function test_admin_collection_endpoints_reject_invalid_date_filters(): void
    {
        $this->actingAsAdmin();

        foreach (['/api/admin/bookings', '/api/admin/feedback', '/api/admin/audit-logs'] as $endpoint) {
            $this->getJson("{$endpoint}?from=not-a-date")
                ->assertStatus(422)
                ->assertJsonValidationErrors('from');
        }
    }

    public function test_admin_feedback_show_uses_submission_id_not_booking_code(): void
    {
        $this->actingAsAdmin();
        $booking = $this->createBooking([
            'status' => 'Completed',
            'completed_at' => now(),
        ]);

        $first = Feedback::create([
            'booking_id' => $booking->id,
            'code' => $booking->code,
            'rating' => 5,
            'booking_ease' => 5,
            'service' => 5,
            'recommend' => 5,
            'highlights' => [],
            'improvements' => ['Area tunggu'],
            'comment' => 'Feedback peserta pertama.',
            'allow_publish' => false,
            'submitted_at' => now()->subMinute(),
        ]);

        $second = Feedback::create([
            'booking_id' => $booking->id,
            'code' => $booking->code,
            'rating' => 3,
            'booking_ease' => 3,
            'service' => 3,
            'recommend' => 3,
            'highlights' => [],
            'improvements' => ['Alur masuk'],
            'comment' => 'Feedback peserta kedua.',
            'allow_publish' => true,
            'submitted_at' => now(),
        ]);

        $this->getJson("/api/admin/feedback/{$second->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $second->id)
            ->assertJsonPath('data.code', $booking->code)
            ->assertJsonPath('data.comment', 'Feedback peserta kedua.');

        $this->getJson("/api/admin/feedback/{$booking->code}")
            ->assertNotFound();

        $this->assertNotSame($first->id, $second->id);
    }

    public function test_health_endpoint_reports_database_and_cache_status(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('checks.database', true)
            ->assertJsonPath('checks.cache', true);
    }

    public function test_faq_link_persists_through_admin_and_public_cms(): void
    {
        $this->actingAsAdmin();

        $this->putJson('/api/admin/cms/faqs', [
            'items' => [
                [
                    'id' => 'faq-surat',
                    'question' => 'Apakah perlu surat?',
                    'answer' => 'Ya, unggah surat resmi dari instansi.',
                    'category' => 'booking',
                    'link' => [
                        'label' => 'Lihat contoh surat',
                        'href' => '#contoh-surat',
                    ],
                ],
            ],
        ])->assertOk()
            ->assertJsonPath('data.0.link.label', 'Lihat contoh surat')
            ->assertJsonPath('data.0.link.href', '#contoh-surat');

        $this->assertDatabaseHas('faqs', [
            'slug' => 'faq-surat',
            'link_label' => 'Lihat contoh surat',
            'link_href' => '#contoh-surat',
        ]);

        $this->getJson('/api/public/faqs')
            ->assertOk()
            ->assertJsonPath('data.0.link.label', 'Lihat contoh surat')
            ->assertJsonPath('data.0.link.href', '#contoh-surat');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Memperbarui FAQ publik',
        ]);
    }

    public function test_admin_can_save_pending_whatsapp_template(): void
    {
        $this->actingAsAdmin();

        $this->putJson('/api/admin/cms/wa-templates', [
            'items' => [
                [
                    'id' => 'Pending',
                    'label' => 'Reschedule dibatalkan',
                    'description' => 'Dikirim saat booking kembali menunggu konfirmasi.',
                    'template' => 'Booking {kode} masih menunggu konfirmasi admin.',
                ],
            ],
        ])->assertOk()
            ->assertJsonPath('data.0.id', 'Pending');

        $this->assertDatabaseHas('wa_templates', [
            'status_key' => 'Pending',
            'template' => 'Booking {kode} masih menunggu konfirmasi admin.',
        ]);
    }

    public function test_admin_cms_rejects_unsafe_public_urls(): void
    {
        $this->actingAsAdmin();

        $this->putJson('/api/admin/cms/faqs', [
            'items' => [
                [
                    'id' => 'unsafe',
                    'question' => 'Link?',
                    'answer' => 'Tidak aman.',
                    'link' => [
                        'label' => 'Klik',
                        'href' => 'javascript:alert(1)',
                    ],
                ],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('items.0.link.href');

        $siteContent = SiteContentDefaults::siteContent();
        $siteContent['video']['url'] = 'https://evil.example/embed/video';

        $this->putJson('/api/admin/cms/site-content', $siteContent)
            ->assertStatus(422)
            ->assertJsonValidationErrors('video.url');

        $siteContent = SiteContentDefaults::siteContent();
        $siteContent['activities']['items'][0]['image'] = 'https://tracker.example/pixel.png';

        $this->putJson('/api/admin/cms/site-content', $siteContent)
            ->assertStatus(422)
            ->assertJsonValidationErrors('activities.items.0.image');
    }

    public function test_security_headers_are_sent_on_public_and_auth_responses(): void
    {
        $expectedHeaders = [
            'X-Frame-Options' => 'DENY',
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'Permissions-Policy' => 'camera=(), microphone=(), geolocation=()',
        ];

        $public = $this->getJson('/api/public/site-content')->assertOk();
        $auth = $this->getJson('/api/auth/me')->assertOk();

        foreach ($expectedHeaders as $name => $value) {
            $public->assertHeader($name, $value);
            $auth->assertHeader($name, $value);
        }

        // CSP should contain frame-ancestors and other directives
        $csp = $public->headers->get('Content-Security-Policy');
        $this->assertStringContainsString("frame-ancestors 'none'", $csp);
        $this->assertStringContainsString("default-src 'self'", $csp);
        $this->assertStringContainsString("script-src 'self'", $csp);
        $this->assertStringContainsString('https://fonts.googleapis.com', $csp);
        $this->assertStringContainsString('https://fonts.gstatic.com', $csp);
        $this->assertStringContainsString("object-src 'none'", $csp);
    }

    public function test_inactive_admin_cannot_read_sensitive_admin_endpoints(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('booking-letters/real-surat.pdf', '%PDF-1.4 real file');
        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-INACTIVE',
            'document_path' => 'booking-letters/real-surat.pdf',
            'document_original_name' => 'real-surat.pdf',
        ]);

        $this->actingAsAdminSession(User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'email_verified_at' => null,
            'two_factor_confirmed_at' => now(),
        ]));

        $this->getJson('/api/admin/dashboard')->assertForbidden();
        $this->getJson('/api/admin/bookings')->assertForbidden();
        $this->get("/api/admin/bookings/{$booking->code}/document")->assertForbidden();
        $this->getJson('/api/admin/feedback')->assertForbidden();
        $this->getJson('/api/admin/users')->assertForbidden();
        $this->getJson('/api/admin/audit-logs')->assertForbidden();
    }

    public function test_dashboard_week_kpi_uses_sunday_to_saturday_range(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-01 09:00:00', 'Asia/Jakarta'));
        $this->actingAsAdmin();

        $this->createBooking([
            'date' => '2026-05-31',
            'time' => '08.00',
            'status' => 'Accepted',
        ]);
        $this->createBooking([
            'date' => '2026-05-30',
            'time' => '09.00',
            'status' => 'Accepted',
        ]);

        $this->getJson('/api/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('kpis.weekBookings', 1);
    }

    public function test_super_admin_user_management_writes_audit_log(): void
    {
        $this->actingAsAdminSession(User::factory()->create([
            'role' => User::ROLE_SUPER_ADMIN,
            'two_factor_confirmed_at' => now(),
        ]));

        $created = $this->postJson('/api/admin/users', [
            'name' => 'Audit User',
            'email' => 'audit-user@example.test',
            'password' => 'audit-user-password-123!',
            'role' => User::ROLE_ADMIN,
            'status' => 'Aktif',
        ])->assertCreated();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Membuat pengguna admin audit-user@example.test',
            'target_id' => (string) $created->json('data.id'),
        ]);
    }

    public function test_super_admin_user_management_rejects_unsupported_roles(): void
    {
        $this->actingAsAdminSession(User::factory()->create([
            'role' => User::ROLE_SUPER_ADMIN,
            'two_factor_confirmed_at' => now(),
        ]));

        $this->postJson('/api/admin/users', [
            'name' => 'Unsupported Role',
            'email' => 'unsupported-role@example.test',
            'password' => 'unsupported-role-password-123!',
            'role' => 'guest',
            'status' => 'Aktif',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('role');

        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->putJson("/api/admin/users/{$admin->id}", [
            'role' => 'guest',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('role');
    }

    public function test_user_seeder_sets_admin_role_and_active_status_without_mass_assignment(): void
    {
        config(['app.env' => 'local']);
        putenv('SEED_ADMIN_PASSWORD=seed-password-123!');
        $_ENV['SEED_ADMIN_PASSWORD'] = 'seed-password-123!';
        $_SERVER['SEED_ADMIN_PASSWORD'] = 'seed-password-123!';

        $this->seed(UserSeeder::class);

        $admin = User::where('role', User::ROLE_SUPER_ADMIN)->first();
        $this->assertNotNull($admin);
        $this->assertTrue($admin->isActive());
        $this->assertTrue(Hash::check('seed-password-123!', $admin->password));
        $this->assertSame(
            [User::ROLE_ADMIN, User::ROLE_SUPER_ADMIN],
            User::query()->pluck('role')->unique()->sort()->values()->all(),
        );

        putenv('SEED_ADMIN_PASSWORD');
        unset($_ENV['SEED_ADMIN_PASSWORD'], $_SERVER['SEED_ADMIN_PASSWORD']);
    }

    public function test_users_default_to_admin_role(): void
    {
        $user = User::factory()->create();

        $this->assertSame(User::ROLE_ADMIN, $user->fresh()->role);
    }

    public function test_super_admin_cannot_disable_or_demote_self(): void
    {
        $superAdmin = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'two_factor_confirmed_at' => now()]);
        $this->actingAsAdminSession($superAdmin);

        $this->putJson("/api/admin/users/{$superAdmin->id}", [
            'role' => User::ROLE_ADMIN,
        ])->assertStatus(422)
            ->assertJsonValidationErrors('user');

        $this->putJson("/api/admin/users/{$superAdmin->id}", [
            'status' => 'Nonaktif',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('user');

        $this->assertDatabaseHas('users', [
            'id' => $superAdmin->id,
            'role' => User::ROLE_SUPER_ADMIN,
        ]);
        $this->assertNotNull($superAdmin->fresh()->email_verified_at);
    }

    public function test_admin_document_endpoint_serves_uploaded_file_and_404s_when_missing(): void
    {
        Storage::fake('local');
        $this->actingAsAdmin();

        Storage::disk('local')->put('booking-letters/real-surat.pdf', '%PDF-1.4 real file');
        $withDocument = $this->createBooking([
            'code' => 'ISTURA-2026-DOC1',
            'document_path' => 'booking-letters/real-surat.pdf',
            'document_original_name' => 'real-surat.pdf',
        ]);
        $withoutDocument = $this->createBooking([
            'code' => 'ISTURA-2026-DOC2',
            'time' => '09.00',
            'document_path' => null,
        ]);

        $inlineResponse = $this->get("/api/admin/bookings/{$withDocument->code}/document?disposition=inline")
            ->assertOk()
            ->assertHeader('X-Frame-Options', 'SAMEORIGIN');
        $this->assertStringContainsString("frame-ancestors 'self'", $inlineResponse->headers->get('Content-Security-Policy'));

        $downloadResponse = $this->get("/api/admin/bookings/{$withDocument->code}/document")
            ->assertOk()
            ->assertHeader('X-Frame-Options', 'DENY');
        $this->assertStringContainsString("frame-ancestors 'none'", $downloadResponse->headers->get('Content-Security-Policy'));
        $this->getJson("/api/admin/bookings/{$withDocument->code}")
            ->assertOk()
            ->assertJsonPath('data.hasDocument', true);
        $this->getJson("/api/admin/bookings/{$withoutDocument->code}")
            ->assertOk()
            ->assertJsonPath('data.hasDocument', false);
        $this->get("/api/admin/bookings/{$withoutDocument->code}/document")
            ->assertNotFound();

        $missingFile = $this->createBooking([
            'code' => 'ISTURA-2026-DOC3',
            'time' => '10.00',
            'document_path' => 'booking-letters/missing.pdf',
            'document_original_name' => 'missing.pdf',
        ]);

        $this->get("/api/admin/bookings/{$missingFile->code}/document")
            ->assertNotFound();
    }

    public function test_admin_booking_payload_exposes_full_nik_only_on_admin_paths(): void
    {
        $this->actingAsAdmin();
        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-NIK1',
            'nik' => '3374123456789012',
            'status' => 'Pending',
        ]);

        $this->getJson('/api/admin/bookings')
            ->assertOk()
            ->assertJsonPath('data.0.code', $booking->code)
            ->assertJsonPath('data.0.nik', '3374123456789012')
            ->assertJsonPath('data.0.nikMasked', '3374********9012');

        $this->getJson("/api/admin/bookings/{$booking->code}")
            ->assertOk()
            ->assertJsonPath('data.nik', '3374123456789012')
            ->assertJsonPath('data.nikMasked', '3374********9012');

        $this->postJson("/api/admin/bookings/{$booking->code}/accept")
            ->assertOk()
            ->assertJsonPath('data.nik', '3374123456789012')
            ->assertJsonPath('data.nikMasked', '3374********9012');

        $this->actingAsAdminSession(User::factory()->create([
            'role' => User::ROLE_SUPER_ADMIN,
            'two_factor_confirmed_at' => now(),
        ]));

        $this->getJson('/api/admin/bookings')
            ->assertOk()
            ->assertJsonPath('data.0.nik', '3374123456789012')
            ->assertJsonPath('data.0.nikMasked', '3374********9012');

        $this->getJson("/api/admin/bookings/{$booking->code}")
            ->assertOk()
            ->assertJsonPath('data.nik', '3374123456789012')
            ->assertJsonPath('data.nikMasked', '3374********9012');
    }

    public function test_public_booking_payload_does_not_echo_full_nik(): void
    {
        Storage::fake('local');

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'nik' => '3374123456789012',
        ]), ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonMissingPath('data.nik')
            ->assertJsonMissingPath('data.feedbackToken')
            ->assertJsonPath('data.nikMasked', '3374********9012');
    }

    public function test_feedback_token_is_short_url_safe_and_non_sequential(): void
    {
        $token = app(BookingCodeGenerator::class)->token();

        $this->assertMatchesRegularExpression('/^fb_[A-Za-z0-9_-]{27}$/', $token);
        $this->assertStringNotContainsString('+', $token);
        $this->assertStringNotContainsString('/', $token);
        $this->assertStringNotContainsString('=', $token);
    }

    public function test_sensitive_fields_are_not_mass_assignable(): void
    {
        $booking = new Booking;

        $this->assertTrue($booking->isFillable('contact_name'));
        $this->assertTrue($booking->isFillable('nik'));
        $this->assertFalse($booking->isFillable('status'));
        $this->assertFalse($booking->isFillable('feedback_token'));
        $this->assertFalse($booking->isFillable('document_path'));
        $this->assertFalse($booking->isFillable('active_slot_key'));

        $user = new User;

        $this->assertTrue($user->isFillable('email'));
        $this->assertFalse($user->isFillable('role'));
    }

    public function test_reschedule_proposal_rejects_unavailable_slot(): void
    {
        $this->actingAsAdmin();
        $date = '2026-06-01';
        $this->createBooking([
            'date' => $date,
            'time' => '08.00',
            'status' => 'Accepted',
        ]);
        $booking = $this->createBooking([
            'date' => $date,
            'time' => '09.00',
            'status' => 'Accepted',
        ]);

        $this->postJson("/api/admin/bookings/{$booking->code}/reschedule", [
            'proposedDate' => $date,
            'proposedTime' => '08.00',
            'note' => 'Pindah ke slot lain.',
        ])->assertStatus(422)->assertJsonValidationErrors('time');

        $this->assertDatabaseHas('bookings', [
            'code' => $booking->code,
            'status' => 'Accepted',
            'proposed_time' => null,
        ]);
    }

    public function test_reschedule_proposal_reserves_new_slot_until_user_decides(): void
    {
        Storage::fake('local');
        $this->actingAsAdmin();
        $date = '2026-06-01';
        $booking = $this->createBooking([
            'date' => $date,
            'time' => '09.00',
            'status' => 'Accepted',
        ]);

        $this->postJson("/api/admin/bookings/{$booking->code}/reschedule", [
            'proposedDate' => $date,
            'proposedTime' => '10.00',
            'note' => 'Tawarkan jam 10.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'Reschedule')
            ->assertJsonPath('data.proposedSegments.0.time', '10.00');

        $schedule = $this->getJson("/api/public/schedule?from={$date}&to={$date}")
            ->assertOk()
            ->json('data');
        $this->assertSame('Reschedule Hold', $this->slotFromResponse($schedule, $date, '09.00')['status']);
        $this->assertSame('Reschedule Hold', $this->slotFromResponse($schedule, $date, '10.00')['status']);

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => $date,
            'time' => '10.00',
        ]), ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('time');

        $this->postJson("/api/admin/bookings/{$booking->code}/reschedule/cancel", [
            'note' => 'User menolak usulan.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'Accepted')
            ->assertJsonPath('data.proposedDate', null);

        $afterCancel = $this->getJson("/api/public/schedule?from={$date}&to={$date}")
            ->assertOk()
            ->json('data');
        $this->assertSame('Booked', $this->slotFromResponse($afterCancel, $date, '09.00')['status']);
        $this->assertSame('Available', $this->slotFromResponse($afterCancel, $date, '10.00')['status']);
    }

    public function test_cancel_reschedule_restores_pending_when_original_booking_was_pending(): void
    {
        Storage::fake('local');
        $this->actingAsAdmin();
        $date = '2026-06-01';
        $booking = $this->createBooking([
            'date' => $date,
            'time' => '09.00',
            'status' => 'Pending',
        ]);

        $this->postJson("/api/admin/bookings/{$booking->code}/reschedule", [
            'proposedDate' => $date,
            'proposedTime' => '10.00',
            'note' => 'Tawarkan jam 10.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'Reschedule');

        $this->assertDatabaseHas('bookings', [
            'code' => $booking->code,
            'reschedule_previous_status' => 'Pending',
        ]);

        $this->postJson("/api/admin/bookings/{$booking->code}/reschedule/cancel", [
            'note' => 'User menolak usulan.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'Pending')
            ->assertJsonPath('data.proposedDate', null);

        $this->assertDatabaseHas('bookings', [
            'code' => $booking->code,
            'status' => 'Pending',
            'reschedule_previous_status' => null,
        ]);

        $schedule = $this->getJson("/api/public/schedule?from={$date}&to={$date}")
            ->assertOk()
            ->json('data');
        $this->assertSame('Held', $this->slotFromResponse($schedule, $date, '09.00')['status']);
        $this->assertSame('Available', $this->slotFromResponse($schedule, $date, '10.00')['status']);
    }

    public function test_accepting_reschedule_moves_to_reserved_proposed_slot(): void
    {
        $this->actingAsAdmin();
        $date = '2026-06-01';
        $booking = $this->createBooking([
            'date' => $date,
            'time' => '09.00',
            'status' => 'Accepted',
        ]);

        $this->postJson("/api/admin/bookings/{$booking->code}/reschedule", [
            'proposedDate' => $date,
            'proposedTime' => '10.00',
            'note' => 'Tawarkan jam 10.',
        ])->assertOk();

        $this->postJson("/api/admin/bookings/{$booking->code}/accept")
            ->assertOk()
            ->assertJsonPath('data.status', 'Accepted')
            ->assertJsonPath('data.time', '10.00')
            ->assertJsonPath('data.segments.0.time', '10.00');

        $schedule = $this->getJson("/api/public/schedule?from={$date}&to={$date}")
            ->assertOk()
            ->json('data');
        $this->assertSame('Available', $this->slotFromResponse($schedule, $date, '09.00')['status']);
        $this->assertSame('Booked', $this->slotFromResponse($schedule, $date, '10.00')['status']);
        $this->assertDatabaseMissing('booking_slots', [
            'booking_id' => $booking->id,
            'kind' => 'proposed',
        ]);
    }

    public function test_rejecting_reschedule_cancels_booking_and_releases_old_and_proposed_slots(): void
    {
        $this->actingAsAdmin();
        $date = '2026-06-01';
        $booking = $this->createBooking([
            'date' => $date,
            'time' => '09.00',
            'status' => 'Accepted',
        ]);

        $this->postJson("/api/admin/bookings/{$booking->code}/reschedule", [
            'proposedDate' => $date,
            'proposedTime' => '10.00',
            'note' => 'Tawarkan jam 10.',
        ])->assertOk();

        $this->postJson("/api/admin/bookings/{$booking->code}/reject", [
            'note' => 'Jadwal tidak dapat diakomodasi.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'Rejected')
            ->assertJsonPath('data.proposedDate', null);

        $schedule = $this->getJson("/api/public/schedule?from={$date}&to={$date}")
            ->assertOk()
            ->json('data');
        $this->assertSame('Available', $this->slotFromResponse($schedule, $date, '09.00')['status']);
        $this->assertSame('Available', $this->slotFromResponse($schedule, $date, '10.00')['status']);
        $this->assertDatabaseMissing('booking_slots', [
            'booking_id' => $booking->id,
            'kind' => 'proposed',
        ]);
    }

    public function test_cancelling_accepted_booking_transitions_to_rejected_and_releases_slots(): void
    {
        $this->actingAsAdmin();
        $date = '2026-06-01';
        $booking = $this->createBooking([
            'date' => $date,
            'time' => '09.00',
            'status' => 'Accepted',
        ]);

        // Slot should be booked
        $schedule = $this->getJson("/api/public/schedule?from={$date}&to={$date}")->json('data');
        $this->assertSame('Booked', $this->slotFromResponse($schedule, $date, '09.00')['status']);

        // Cancel (reject) the accepted booking
        $this->postJson("/api/admin/bookings/{$booking->code}/reject", [
            'note' => 'Dibatalkan karena force majeure.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'Rejected');

        $booking->refresh();
        $this->assertSame('Rejected', $booking->status);
        $this->assertNotNull($booking->rejected_at);

        // Slot should be released
        $schedule = $this->getJson("/api/public/schedule?from={$date}&to={$date}")->json('data');
        $this->assertSame('Available', $this->slotFromResponse($schedule, $date, '09.00')['status']);
    }

    public function test_inactive_admin_cannot_mutate_schedule_or_cms(): void
    {
        ScheduleOverride::create([
            'date' => '2026-06-01',
            'time' => '08.00',
            'status' => 'Closed',
            'custom' => false,
        ]);

        $this->actingAsAdminSession(User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'email_verified_at' => null,
            'two_factor_confirmed_at' => now(),
        ]));

        $this->postJson('/api/admin/schedule/slot', [
            'date' => '2026-06-01',
            'time' => '08.00',
            'status' => 'Closed',
        ])->assertForbidden();

        $this->putJson('/api/admin/cms/faqs', [
            'items' => [
                [
                    'id' => 'blocked',
                    'question' => 'Tidak boleh?',
                    'answer' => 'Tidak boleh.',
                ],
            ],
        ])->assertForbidden();

        $this->deleteJson('/api/admin/schedule/slot', [
            'date' => '2026-06-01',
            'time' => '08.00',
        ])->assertForbidden();

        $this->assertDatabaseCount('schedule_overrides', 1);
        $this->assertDatabaseCount('faqs', 0);
    }

    public function test_inactive_admin_user_cannot_login(): void
    {
        User::factory()->create([
            'email' => 'inactive@istura.id',
            'password' => Hash::make('inactive-test-password-123!'),
            'role' => User::ROLE_ADMIN,
            'email_verified_at' => null,
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'inactive@istura.id',
            'password' => 'inactive-test-password-123!',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_inactive_existing_admin_session_cannot_access_admin_api(): void
    {
        $this->actingAsAdminSession(User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'email_verified_at' => null,
            'two_factor_confirmed_at' => now(),
        ]));

        $this->getJson('/api/admin/bookings')->assertForbidden();
    }

    public function test_two_factor_setup_confirmation_unlocks_admin_data_in_same_session(): void
    {
        $secret = app(TwoFactorService::class)->generateSecret();
        $code = (new Google2FA)->getCurrentOtp($secret);
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $admin->forceFill(['two_factor_secret' => encrypt($secret)])->save();
        $booking = $this->createBooking(['code' => 'ISTURA-2026-2FA']);

        $this->actingAs($admin);
        $this->withHeader('Origin', 'http://localhost');
        $this->withSession(['admin_session_started_at' => now()->timestamp]);

        $this->postJson('/api/auth/two-factor/confirm', ['code' => $code])
            ->assertOk()
            ->assertJsonCount(8, 'recovery_codes');

        $this->assertNotNull($admin->fresh()->two_factor_confirmed_at);

        $this->getJson('/api/admin/bookings')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.code', $booking->code);
    }

    public function test_two_factor_status_serializes_confirmed_timestamp_for_enabled_user(): void
    {
        $confirmedAt = now()->startOfSecond();
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'two_factor_confirmed_at' => $confirmedAt,
        ]);

        $this->actingAs($admin);

        $this->getJson('/api/auth/two-factor/status')
            ->assertOk()
            ->assertJsonPath('enabled', true)
            ->assertJsonPath('confirmed_at', $confirmedAt->toIso8601String());
    }

    public function test_public_booking_allows_h2_to_h4_and_rejects_h1(): void
    {
        Storage::fake('local');

        ScheduleOverride::create([
            'date' => '2026-05-31',
            'time' => '08.00',
            'status' => 'Available',
            'custom' => false,
        ]);

        ScheduleOverride::create([
            'date' => '2026-06-01',
            'time' => '08.00',
            'status' => 'Available',
            'custom' => false,
        ]);

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-05-31',
            'time' => '08.00',
        ]), ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('date');

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-01',
            'time' => '08.00',
        ]), ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.leadTimeDays', 2)
            ->assertJsonPath('data.isShortNotice', true);

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-03',
            'time' => '09.00',
        ]), ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.leadTimeDays', 4)
            ->assertJsonPath('data.isShortNotice', true);

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-05-30',
        ]), ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('date');
    }

    public function test_public_booking_enforces_group_size_and_five_megabyte_document_limit(): void
    {
        Storage::fake('local');

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-04',
            'groupSize' => 481,
        ]), ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('groupSize');

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-04',
            'document' => UploadedFile::fake()->create('surat.pdf', 5121, 'application/pdf'),
        ]), ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('document');

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-04',
            'whatsapp' => 'nomor-rusak',
        ]), ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('whatsapp');
    }

    public function test_public_booking_rejects_lunch_break_time(): void
    {
        Storage::fake('local');

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-04',
            'time' => '12.00',
        ]), ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('time');
    }

    public function test_public_booking_rejects_contact_name_with_digits_or_symbols(): void
    {
        Storage::fake('local');

        foreach (['Rina Prasetya 123', 'Rina Prasetya ###'] as $contactName) {
            $this->post('/api/public/bookings', $this->publicBookingPayload([
                'date' => '2026-06-04',
                'contactName' => $contactName,
            ]), ['Accept' => 'application/json'])
                ->assertStatus(422)
                ->assertJsonValidationErrors('contactName');
        }
    }

    public function test_public_booking_validates_institution_without_rejecting_common_names(): void
    {
        Storage::fake('local');

        foreach (['UKT %% ##', '###'] as $institution) {
            $this->post('/api/public/bookings', $this->publicBookingPayload([
                'date' => '2026-06-04',
                'institution' => $institution,
            ]), ['Accept' => 'application/json'])
                ->assertStatus(422)
                ->assertJsonValidationErrors('institution');
        }

        foreach (['SMK Negeri 1 Yogyakarta', 'PT. Maju Bersama', 'Universitas 17 Agustus 1945', 'CV Karya & Co.'] as $index => $institution) {
            $this->post('/api/public/bookings', $this->publicBookingPayload([
                'date' => '2026-06-04',
                'time' => sprintf('%02d.00', 8 + $index),
                'institution' => $institution,
            ]), ['Accept' => 'application/json'])
                ->assertCreated()
                ->assertJsonPath('data.institution', $institution);
        }
    }

    public function test_public_booking_splits_large_group_into_consecutive_kloters(): void
    {
        Storage::fake('local');

        $response = $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-04',
            'time' => '11.00',
            'groupSize' => 160,
        ]), ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('data.groupSize', 160)
            ->assertJsonPath('data.kloterCount', 2)
            ->assertJsonPath('data.segments.0.time', '11.00')
            ->assertJsonPath('data.segments.0.groupSize', 80)
            ->assertJsonPath('data.segments.1.time', '13.00')
            ->assertJsonPath('data.segments.1.groupSize', 80);

        $code = $response->json('data.code');
        $booking = Booking::where('code', $code)->firstOrFail();

        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'slot_order' => 1,
            'time' => '11.00',
            'group_size' => 80,
            'active_slot_key' => '2026-06-04|11.00',
        ]);
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'slot_order' => 2,
            'time' => '13.00',
            'group_size' => 80,
            'active_slot_key' => '2026-06-04|13.00',
        ]);

        $schedule = $this->getJson('/api/public/schedule?from=2026-06-04&to=2026-06-04')
            ->assertOk()
            ->json('data');

        $this->assertSame('Held', $this->slotFromResponse($schedule, '2026-06-04', '11.00')['status']);
        $this->assertNull(collect($schedule[0]['slots'])->firstWhere('time', '12.00'));
        $this->assertSame('Held', $this->slotFromResponse($schedule, '2026-06-04', '13.00')['status']);
        $this->assertSame('Available', $this->slotFromResponse($schedule, '2026-06-04', '14.00')['status']);
    }

    public function test_admin_can_merge_large_group_kloters_manually(): void
    {
        Storage::fake('local');

        $response = $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-04',
            'time' => '08.00',
            'groupSize' => 200,
        ]), ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('data.kloterCount', 3);

        $code = $response->json('data.code');
        $this->actingAsAdmin();

        $this->postJson("/api/admin/bookings/{$code}/segments", [
            'segments' => [
                ['date' => '2026-06-04', 'time' => '08.00', 'groupSize' => 100],
                ['date' => '2026-06-04', 'time' => '09.00', 'groupSize' => 100],
            ],
            'confirmRisk' => true,
        ])->assertOk()
            ->assertJsonPath('data.kloterCount', 2)
            ->assertJsonPath('data.segments.0.groupSize', 100)
            ->assertJsonPath('data.segments.1.groupSize', 100);
        $this->assertStringContainsString('Ada kloter di atas kapasitas standar 80 peserta.', (string) Booking::where('code', $code)->value('note'));

        $booking = Booking::where('code', $code)->firstOrFail();
        $this->assertDatabaseCount('booking_slots', 2);
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'slot_order' => 1,
            'time' => '08.00',
            'group_size' => 100,
        ]);
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'slot_order' => 2,
            'time' => '09.00',
            'group_size' => 100,
        ]);

        $this->postJson("/api/admin/bookings/{$code}/segments", [
            'segments' => [
                ['date' => '2026-06-04', 'time' => '08.00', 'groupSize' => 80],
                ['date' => '2026-06-04', 'time' => '09.00', 'groupSize' => 80],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('segments');
    }

    public function test_admin_manual_segments_merge_duplicate_slot_and_require_note_for_large_kloter(): void
    {
        Storage::fake('local');

        $response = $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-04',
            'time' => '08.00',
            'groupSize' => 160,
        ]), ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('data.kloterCount', 2);

        $code = $response->json('data.code');
        $this->actingAsAdmin();

        $payload = [
            'segments' => [
                ['date' => '2026-06-04', 'time' => '08.00', 'groupSize' => 80],
                ['date' => '2026-06-04', 'time' => '08.00', 'groupSize' => 80],
            ],
        ];

        $this->postJson("/api/admin/bookings/{$code}/segments", $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('confirmRisk');

        $this->postJson("/api/admin/bookings/{$code}/segments", $payload + [
            'confirmRisk' => true,
        ])->assertOk()
            ->assertJsonPath('data.kloterCount', 1)
            ->assertJsonPath('data.segments.0.time', '08.00')
            ->assertJsonPath('data.segments.0.groupSize', 160);
        $this->assertStringContainsString('Ada kloter di atas kapasitas standar 80 peserta.', (string) Booking::where('code', $code)->value('note'));
    }

    public function test_admin_manual_segments_can_correct_booking_group_size_with_note(): void
    {
        $this->actingAsAdmin();
        $date = '2026-06-04';
        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-CORRECTSIZE',
            'date' => $date,
            'time' => '08.00',
            'group_size' => 2,
            'status' => 'Accepted',
        ]);

        $payload = [
            'groupSize' => 30,
            'correctGroupSize' => true,
            'segments' => [
                ['date' => $date, 'time' => '08.00', 'groupSize' => 30],
            ],
        ];

        $this->postJson("/api/admin/bookings/{$booking->code}/segments", $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('confirmRisk');

        $this->postJson("/api/admin/bookings/{$booking->code}/segments", $payload + [
            'confirmRisk' => true,
        ])->assertOk()
            ->assertJsonPath('data.groupSize', 30)
            ->assertJsonPath('data.segments.0.groupSize', 30);

        $booking->refresh();
        $this->assertSame(30, $booking->group_size);
        $this->assertStringContainsString('Total peserta dikoreksi 2 -> 30.', (string) $booking->note);

        $log = AuditLog::where('target_id', $booking->code)->latest('id')->firstOrFail();
        $this->assertSame(2, $log->payload['old_group_size']);
        $this->assertSame(30, $log->payload['new_group_size']);
        $this->assertStringContainsString('Total peserta dikoreksi 2 -> 30.', $log->payload['note']);
        $this->assertTrue($log->payload['risk_confirmed']);
    }

    public function test_admin_manual_segments_can_increase_booking_group_size_with_note(): void
    {
        $this->actingAsAdmin();
        $date = '2026-06-04';
        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-INCREASESIZE',
            'date' => $date,
            'time' => '08.00',
            'group_size' => 70,
            'status' => 'Accepted',
        ]);

        $payload = [
            'groupSize' => 120,
            'correctGroupSize' => true,
            'segments' => [
                ['date' => $date, 'time' => '08.00', 'groupSize' => 60],
                ['date' => $date, 'time' => '09.00', 'groupSize' => 60],
            ],
        ];

        $this->postJson("/api/admin/bookings/{$booking->code}/segments", $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('confirmRisk');

        $this->postJson("/api/admin/bookings/{$booking->code}/segments", $payload + [
            'confirmRisk' => true,
        ])->assertOk()
            ->assertJsonPath('data.groupSize', 120)
            ->assertJsonPath('data.kloterCount', 2)
            ->assertJsonPath('data.segments.0.groupSize', 60)
            ->assertJsonPath('data.segments.1.groupSize', 60);

        $booking->refresh();
        $this->assertSame(120, $booking->group_size);
        $this->assertStringContainsString('Total peserta dikoreksi 70 -> 120.', (string) $booking->note);
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'slot_order' => 1,
            'time' => '08.00',
            'group_size' => 60,
            'active_slot_key' => "{$date}|08.00",
        ]);
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'slot_order' => 2,
            'time' => '09.00',
            'group_size' => 60,
            'active_slot_key' => "{$date}|09.00",
        ]);

        $log = AuditLog::where('target_id', $booking->code)->latest('id')->firstOrFail();
        $this->assertSame(70, $log->payload['old_group_size']);
        $this->assertSame(120, $log->payload['new_group_size']);
        $this->assertStringContainsString('Total peserta dikoreksi 70 -> 120.', $log->payload['note']);
        $this->assertTrue($log->payload['risk_confirmed']);
    }

    public function test_admin_manual_segments_can_decrease_booking_group_size_with_note(): void
    {
        $this->actingAsAdmin();
        $date = '2026-06-04';
        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-DECREASESIZE',
            'date' => $date,
            'time' => '10.00',
            'group_size' => 120,
            'status' => 'Accepted',
        ]);

        $payload = [
            'groupSize' => 70,
            'correctGroupSize' => true,
            'segments' => [
                ['date' => $date, 'time' => '10.00', 'groupSize' => 70],
            ],
        ];

        $this->postJson("/api/admin/bookings/{$booking->code}/segments", $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('confirmRisk');

        $this->postJson("/api/admin/bookings/{$booking->code}/segments", $payload + [
            'confirmRisk' => true,
        ])->assertOk()
            ->assertJsonPath('data.groupSize', 70)
            ->assertJsonPath('data.kloterCount', 1)
            ->assertJsonPath('data.segments.0.groupSize', 70);

        $booking->refresh();
        $this->assertSame(70, $booking->group_size);
        $this->assertStringContainsString('Total peserta dikoreksi 120 -> 70.', (string) $booking->note);
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'slot_order' => 1,
            'time' => '10.00',
            'group_size' => 70,
            'active_slot_key' => "{$date}|10.00",
        ]);
        $this->assertSame(1, BookingSlot::where('booking_id', $booking->id)->count());

        $log = AuditLog::where('target_id', $booking->code)->latest('id')->firstOrFail();
        $this->assertSame(120, $log->payload['old_group_size']);
        $this->assertSame(70, $log->payload['new_group_size']);
        $this->assertStringContainsString('Total peserta dikoreksi 120 -> 70.', $log->payload['note']);
        $this->assertTrue($log->payload['risk_confirmed']);
    }

    public function test_admin_manual_segments_require_explicit_overbook_for_occupied_slot(): void
    {
        $this->actingAsAdmin();
        $date = '2026-06-04';
        $occupied = $this->createBooking([
            'code' => 'ISTURA-2026-MERGEA',
            'date' => $date,
            'time' => '08.00',
            'status' => 'Accepted',
        ]);
        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-MERGEB',
            'date' => $date,
            'time' => '09.00',
            'status' => 'Accepted',
        ]);

        $payload = [
            'segments' => [
                ['date' => $date, 'time' => '08.00', 'groupSize' => $booking->group_size],
            ],
        ];

        $this->postJson("/api/admin/bookings/{$booking->code}/segments", $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('allowOverbook');

        $this->postJson("/api/admin/bookings/{$booking->code}/segments", $payload + ['allowOverbook' => true])
            ->assertStatus(422)
            ->assertJsonValidationErrors('confirmRisk');

        $this->postJson("/api/admin/bookings/{$booking->code}/segments", $payload + ['allowOverbook' => true, 'confirmRisk' => true])
            ->assertOk()
            ->assertJsonPath('data.segments.0.time', '08.00');

        $schedule = $this->getJson("/api/admin/schedule?from={$date}&to={$date}")
            ->assertOk()
            ->json('data');
        $slot = $this->slotFromResponse($schedule, $date, '08.00');

        $this->assertSame('Booked', $slot['status']);
        $this->assertSame(2, $slot['bookingCount']);
        $this->assertTrue($slot['overbooked']);
        $this->assertDatabaseHas('audit_logs', [
            'action' => "Mengubah pembagian kloter booking {$booking->code} dengan overbook manual",
            'target_id' => $booking->code,
        ]);
        $this->assertDatabaseHas('bookings', [
            'id' => $occupied->id,
            'active_slot_key' => "{$date}|08.00",
        ]);
    }

    public function test_public_booking_at_slot_capacity_stays_single_normal_booking(): void
    {
        Storage::fake('local');

        $response = $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-04',
            'time' => '08.00',
            'groupSize' => 80,
        ]), ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('data.groupSize', 80)
            ->assertJsonPath('data.kloterCount', 1)
            ->assertJsonCount(1, 'data.segments')
            ->assertJsonPath('data.segments.0.time', '08.00')
            ->assertJsonPath('data.segments.0.groupSize', 80);

        $code = $response->json('data.code');
        $booking = Booking::where('code', $code)->firstOrFail();

        $this->assertDatabaseCount('bookings', 1);
        $this->assertDatabaseCount('booking_slots', 1);
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'slot_order' => 1,
            'time' => '08.00',
            'group_size' => 80,
            'active_slot_key' => '2026-06-04|08.00',
        ]);
    }

    public function test_public_booking_balances_uneven_large_group_across_kloters(): void
    {
        Storage::fake('local');

        $response = $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-04',
            'time' => '09.00',
            'groupSize' => 90,
        ]), ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('data.groupSize', 90)
            ->assertJsonPath('data.kloterCount', 2)
            ->assertJsonPath('data.segments.0.time', '09.00')
            ->assertJsonPath('data.segments.0.groupSize', 45)
            ->assertJsonPath('data.segments.1.time', '10.00')
            ->assertJsonPath('data.segments.1.groupSize', 45);
    }

    public function test_large_group_booking_requires_consecutive_available_slots(): void
    {
        Storage::fake('local');

        ScheduleOverride::create([
            'date' => '2026-06-04',
            'time' => '13.00',
            'status' => 'Closed',
            'custom' => false,
        ]);

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-04',
            'time' => '11.00',
            'groupSize' => 150,
        ]), ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('time');
    }

    public function test_booking_status_transitions_reject_invalid_states(): void
    {
        $this->actingAsAdmin();

        $pending = $this->createBooking([
            'code' => 'ISTURA-2026-PENDING',
            'status' => 'Pending',
        ]);

        $this->postJson("/api/admin/bookings/{$pending->code}/complete")
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');

        $this->assertDatabaseHas('bookings', [
            'code' => $pending->code,
            'status' => 'Pending',
            'completed_at' => null,
        ]);

        $completed = $this->createBooking([
            'code' => 'ISTURA-2026-COMPLETE',
            'time' => '09.00',
            'status' => 'Completed',
            'completed_at' => now(),
        ]);

        $this->postJson("/api/admin/bookings/{$completed->code}/reject", [
            'note' => 'Tidak valid.',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_booking_transition_reloads_current_status_inside_transaction(): void
    {
        $admin = $this->actingAsAdmin();

        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-STALE',
            'status' => 'Pending',
        ]);
        $staleBooking = Booking::whereKey($booking->id)->firstOrFail();

        Booking::whereKey($booking->id)->update(['status' => 'Accepted']);

        try {
            app(BookingService::class)->accept($staleBooking, $admin);
            $this->fail('Stale booking transition should have failed.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('status', $exception->errors());
        }
    }

    public function test_schedule_ranges_are_bounded(): void
    {
        $this->getJson('/api/public/schedule?from=2026-06-01&to=2027-06-01')
            ->assertStatus(422)
            ->assertJsonValidationErrors('to');

        $this->actingAsAdmin();

        $this->postJson('/api/admin/schedule/range', [
            'from' => '2026-06-01',
            'to' => '2027-06-01',
            'status' => 'Closed',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('to');

        $this->postJson('/api/admin/schedule/slot', [
            'date' => '2026-06-01',
            'time' => '99.99',
            'status' => 'Available',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('time');

        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-RANGE',
            'date' => '2026-06-01',
            'time' => '08.00',
            'status' => 'Accepted',
        ]);

        $this->postJson("/api/admin/bookings/{$booking->code}/reschedule", [
            'proposedDate' => '2026-09-01',
            'proposedTime' => '09.00',
            'note' => 'Di luar horizon.',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('proposedDate');
    }

    public function test_admin_schedule_mutations_broadcast_schedule_updates(): void
    {
        $this->actingAsAdmin();
        Event::fake([ScheduleUpdated::class]);

        $this->postJson('/api/admin/schedule/slot', [
            'date' => '2026-06-01',
            'time' => '08.00',
            'status' => 'Closed',
        ])->assertOk();

        Event::assertDispatched(ScheduleUpdated::class, fn (ScheduleUpdated $event) => $event->from === '2026-06-01' && $event->to === '2026-06-01'
        );

        $this->postJson('/api/admin/schedule/range', [
            'from' => '2026-06-01',
            'to' => '2026-06-04',
            'weekdays' => [1, 2, 3, 4],
            'status' => 'Closed',
        ])->assertOk();

        Event::assertDispatched(ScheduleUpdated::class, fn (ScheduleUpdated $event) => $event->from === '2026-06-01' && $event->to === '2026-06-04'
        );

        $this->deleteJson('/api/admin/schedule/slot', [
            'date' => '2026-06-01',
            'time' => '08.00',
        ])->assertOk();

        Event::assertDispatchedTimes(ScheduleUpdated::class, 3);
    }

    public function test_admin_audit_log_records_request_ip_and_user_agent(): void
    {
        config(['trustedproxy.proxies' => ['192.0.2.10']]);
        $this->actingAsAdmin();

        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.10'])
            ->withHeaders([
                'X-Forwarded-For' => '198.51.100.44',
                'User-Agent' => 'IsturaTest/1.0',
            ])
            ->postJson('/api/admin/schedule/slot', [
                'date' => '2026-06-01',
                'time' => '10.00',
                'status' => 'Closed',
            ])->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Mengubah slot jadwal 2026-06-01 10.00',
            'ip_address' => '198.51.100.44',
            'user_agent' => 'IsturaTest/1.0',
        ]);
    }

    public function test_public_booking_broadcasts_public_schedule_update(): void
    {
        Storage::fake('local');
        Event::fake([ScheduleUpdated::class]);

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-06-04',
            'time' => '10.00',
        ]), ['Accept' => 'application/json'])
            ->assertCreated();

        Event::assertDispatched(ScheduleUpdated::class, fn (ScheduleUpdated $event) => $event->from === '2026-06-04' && $event->to === '2026-06-04'
        );
    }

    public function test_booking_status_changes_broadcast_public_schedule_update_for_old_and_proposed_dates(): void
    {
        $this->actingAsAdmin();
        $booking = $this->createBooking([
            'date' => '2026-06-01',
            'time' => '08.00',
            'status' => 'Accepted',
        ]);

        Event::fake([ScheduleUpdated::class]);

        $this->postJson("/api/admin/bookings/{$booking->code}/reschedule", [
            'proposedDate' => '2026-06-04',
            'proposedTime' => '10.00',
            'note' => 'Tawarkan jadwal baru.',
        ])->assertOk();

        Event::assertDispatched(ScheduleUpdated::class, fn (ScheduleUpdated $event) => $event->from === '2026-06-01' && $event->to === '2026-06-04'
        );

        Event::fake([ScheduleUpdated::class]);

        $this->postJson("/api/admin/bookings/{$booking->code}/reject", [
            'note' => 'User menolak jadwal baru.',
        ])->assertOk();

        Event::assertDispatched(ScheduleUpdated::class, fn (ScheduleUpdated $event) => $event->from === '2026-06-01' && $event->to === '2026-06-04'
        );
    }

    public function test_public_feedback_rejects_when_quota_full(): void
    {
        $booking = $this->createBooking([
            'status' => 'Completed',
            'feedback_token' => 'fb_single_feedback_token',
            'group_size' => 2,
            'completed_at' => now(),
        ]);
        $booking->feedback_expires_at = now()->addDays(14);
        $booking->save();

        // First feedback: accepted
        $this->postJson("/api/public/feedback/{$booking->code}", [
            'token' => 'fb_single_feedback_token',
            'visitorName' => 'Peserta 1',
            'gender' => 'male',
            'age' => 25,
            'origin' => 'Jakarta',
            'bookingEase' => 5,
            'service' => 5,
            'guideQuality' => 5,
            'facilityComfort' => 5,
            'recommend' => 5,
            'visitedBefore' => false,
            'discoverySource' => 'social_media',
            'highlights' => ['Penyambutan'],
            'improvements' => ['Fasilitas'],
            'comment' => 'Pertama.',
            'allowPublish' => false,
        ])->assertCreated();

        // Second feedback: accepted (quota = group_size = 2)
        $this->postJson("/api/public/feedback/{$booking->code}", [
            'token' => 'fb_single_feedback_token',
            'visitorName' => 'Peserta 2',
            'gender' => 'female',
            'age' => 30,
            'origin' => 'Bandung',
            'bookingEase' => 4,
            'service' => 4,
            'guideQuality' => 4,
            'facilityComfort' => 4,
            'recommend' => 4,
            'visitedBefore' => true,
            'discoverySource' => 'friends_family',
            'highlights' => [],
            'improvements' => ['Waktu kunjungan'],
            'comment' => 'Kedua.',
            'allowPublish' => true,
        ])->assertCreated();

        // Third feedback: rejected (quota full)
        $this->postJson("/api/public/feedback/{$booking->code}", [
            'token' => 'fb_single_feedback_token',
            'visitorName' => 'Peserta 3',
            'gender' => 'male',
            'age' => 20,
            'origin' => 'Surabaya',
            'bookingEase' => 4,
            'service' => 4,
            'guideQuality' => 4,
            'facilityComfort' => 4,
            'recommend' => 4,
            'visitedBefore' => false,
            'discoverySource' => 'web_search',
            'highlights' => [],
            'improvements' => ['Fasilitas'],
            'comment' => 'Ketiga harus ditolak.',
            'allowPublish' => false,
        ])->assertStatus(422)
            ->assertJsonValidationErrors('code')
            ->assertJsonPath('errors.code.0', 'Kuota feedback sudah terpenuhi.');

        $this->assertDatabaseCount('feedbacks', 2);
    }

    public function test_public_feedback_rejects_when_expired(): void
    {
        $booking = $this->createBooking([
            'status' => 'Completed',
            'feedback_token' => 'fb_expired_token',
            'group_size' => 80,
            'completed_at' => now()->subDays(15),
        ]);
        // Expired: completed 15 days ago, feedback_expires_at was 14 days after = 1 day ago
        $booking->feedback_expires_at = now()->subDay();
        $booking->save();

        $this->postJson("/api/public/feedback/{$booking->code}", [
            'token' => 'fb_expired_token',
            'visitorName' => 'Terlambat',
            'gender' => 'male',
            'age' => 40,
            'origin' => 'Yogyakarta',
            'bookingEase' => 5,
            'service' => 5,
            'guideQuality' => 5,
            'facilityComfort' => 5,
            'recommend' => 5,
            'visitedBefore' => false,
            'discoverySource' => 'social_media',
            'highlights' => [],
            'improvements' => ['Waktu kunjungan'],
            'comment' => 'Token sudah kedaluwarsa.',
            'allowPublish' => false,
        ])->assertStatus(422)
            ->assertJsonValidationErrors('code')
            ->assertJsonPath('errors.code.0', 'Periode feedback telah berakhir.');

        $this->assertDatabaseCount('feedbacks', 0);
    }

    public function test_public_feedback_show_returns_access_status_and_quota(): void
    {
        $booking = $this->createBooking([
            'status' => 'Completed',
            'feedback_token' => 'fb_quota_show_token',
            'group_size' => 25,
            'completed_at' => now(),
        ]);
        $booking->feedback_expires_at = now()->addDays(14);
        $booking->save();

        // Before any feedback
        $response = $this->getJson("/api/public/feedback/{$booking->code}?token=fb_quota_show_token")
            ->assertOk()
            ->assertJsonPath('feedback.accessStatus', 'available')
            ->assertJsonPath('feedback.submittedCount', 0)
            ->assertJsonPath('feedback.limit', 25)
            ->assertJsonPath('data', null);

        $this->assertArrayHasKey('expiresAt', $response->json('feedback'));
    }

    public function test_feedback_expires_at_set_when_booking_completed(): void
    {
        $booking = $this->createBooking([
            'status' => 'Accepted',
            'feedback_token' => 'fb_complete_expiry_token',
            'group_size' => 40,
            'date' => Carbon::today('Asia/Jakarta')->subDay()->toDateString(),
        ]);

        $this->actingAsAdmin();

        $this->postJson("/api/admin/bookings/{$booking->code}/complete")
            ->assertOk();

        $booking->refresh();
        $this->assertNotNull($booking->feedback_expires_at);
        $this->assertNotNull($booking->completed_at);
        $this->assertTrue(
            $booking->feedback_expires_at->isSameDay($booking->completed_at->addDays(14))
        );
    }

    public function test_public_rate_limits_are_isolated_per_flow(): void
    {
        Storage::fake('local');
        $booking = $this->createBooking([
            'status' => 'Completed',
            'feedback_token' => 'fb_rate_limit_token',
            'group_size' => 80,
            'completed_at' => now(),
        ]);
        $booking->feedback_expires_at = now()->addDays(14);
        $booking->save();

        $defaultTimes = ['08.00', '09.00', '10.00', '11.00', '13.00', '14.00'];

        for ($i = 0; $i < 11; $i++) {
            $this->withHeader('Accept', 'application/json')
                ->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])
                ->post('/api/public/bookings', $this->publicBookingPayload([
                    'contactName' => '',
                    'time' => $defaultTimes[$i % count($defaultTimes)],
                ]))
                ->assertStatus(422);
        }

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])
            ->postJson("/api/public/feedback/{$booking->code}", [
                'token' => 'fb_rate_limit_token',
                'visitorName' => 'Ani Wulandari',
                'gender' => 'female',
                'age' => 25,
                'origin' => 'Yogyakarta',
                'bookingEase' => 5,
                'service' => 5,
                'guideQuality' => 5,
                'facilityComfort' => 5,
                'recommend' => 5,
                'visitedBefore' => true,
                'discoverySource' => 'previous_visit',
                'highlights' => ['Penyambutan'],
                'improvements' => ['Waktu kunjungan'],
                'comment' => 'Rate limit flow tetap terpisah.',
                'allowPublish' => true,
            ])
            ->assertCreated();

        $this->assertDatabaseHas('audit_logs', [
            'action' => "Feedback dikirim untuk booking {$booking->code}",
            'target_type' => Feedback::class,
        ]);
    }

    public function test_public_feedback_rate_limits_allow_same_ip_group_burst(): void
    {
        $booking = $this->createBooking([
            'status' => 'Completed',
            'feedback_token' => 'fb_group_burst_token',
            'group_size' => 20,
            'completed_at' => now(),
        ]);
        $booking->feedback_expires_at = now()->addDays(14);
        $booking->save();
        $ip = '203.0.113.88';

        for ($i = 1; $i <= 11; $i++) {
            $this->withServerVariables(['REMOTE_ADDR' => $ip])
                ->getJson("/api/public/feedback/{$booking->code}?token=fb_group_burst_token")
                ->assertOk()
                ->assertJsonPath('feedback.accessStatus', 'available');
        }

        for ($i = 1; $i <= 11; $i++) {
            $this->withServerVariables(['REMOTE_ADDR' => $ip])
                ->postJson("/api/public/feedback/{$booking->code}", $this->publicFeedbackPayload([
                    'token' => 'fb_group_burst_token',
                    'visitorName' => "Peserta {$i}",
                    'comment' => "Feedback dari peserta {$i}.",
                ]))
                ->assertCreated();
        }

        $this->assertSame(11, Feedback::where('booking_id', $booking->id)->count());
    }

    public function test_public_feedback_show_requires_valid_token_and_returns_booking_status(): void
    {
        $booking = $this->createBooking([
            'status' => 'Completed',
            'feedback_token' => 'fb_show_token',
            'group_size' => 25,
            'completed_at' => now(),
        ]);
        $booking->feedback_expires_at = now()->addDays(14);
        $booking->save();

        $invalidMessage = 'Kode atau token feedback tidak valid.';

        $this->getJson('/api/public/feedback/ISTURA-2099-9999?token=wrong-token')
            ->assertStatus(422)
            ->assertJsonValidationErrors('token')
            ->assertJsonPath('errors.token.0', $invalidMessage)
            ->assertJsonMissing(['App\\Models\\Booking']);

        $this->getJson("/api/public/feedback/{$booking->code}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('token')
            ->assertJsonPath('errors.token.0', $invalidMessage);

        $this->getJson("/api/public/feedback/{$booking->code}?token=wrong-token")
            ->assertStatus(422)
            ->assertJsonValidationErrors('token')
            ->assertJsonPath('errors.token.0', $invalidMessage);

        // Valid token returns booking info + feedback meta (data always null for privacy)
        $this->getJson("/api/public/feedback/{$booking->code}?token=fb_show_token")
            ->assertOk()
            ->assertJsonPath('booking.code', $booking->code)
            ->assertJsonPath('booking.status', 'Completed')
            ->assertJsonPath('data', null)
            ->assertJsonPath('feedback.accessStatus', 'available')
            ->assertJsonPath('feedback.submittedCount', 0)
            ->assertJsonPath('feedback.limit', 25);

        // After creating a feedback, show still returns data=null (privacy)
        // but submittedCount increments
        Feedback::create([
            'booking_id' => $booking->id,
            'code' => $booking->code,
            'rating' => 4,
            'booking_ease' => 4,
            'service' => 4,
            'recommend' => 4,
            'highlights' => [],
            'improvements' => [],
            'comment' => null,
            'allow_publish' => false,
            'submitted_at' => now(),
        ]);

        $this->getJson("/api/public/feedback/{$booking->code}?token=fb_show_token")
            ->assertOk()
            ->assertJsonPath('data', null)
            ->assertJsonPath('feedback.accessStatus', 'available')
            ->assertJsonPath('feedback.submittedCount', 1);
    }

    public function test_public_feedback_submission_is_blocked_until_booking_completed(): void
    {
        $booking = $this->createBooking([
            'status' => 'Pending',
            'feedback_token' => 'fb_pending_token',
        ]);

        $this->postJson("/api/public/feedback/{$booking->code}", [
            'token' => 'fb_pending_token',
            'visitorName' => 'Rudi Hartono',
            'gender' => 'male',
            'age' => 40,
            'origin' => 'Surabaya',
            'bookingEase' => 5,
            'service' => 5,
            'guideQuality' => 5,
            'facilityComfort' => 5,
            'recommend' => 5,
            'visitedBefore' => false,
            'discoverySource' => 'school_institution',
            'highlights' => ['Penyambutan'],
            'improvements' => ['Dokumentasi'],
            'comment' => 'Belum selesai tidak boleh masuk.',
            'allowPublish' => true,
        ])->assertStatus(422)
            ->assertJsonValidationErrors('code');

        $this->assertDatabaseCount('feedbacks', 0);
    }

    public function test_public_feedback_stores_visit_insights_and_requires_other_source_detail(): void
    {
        $booking = $this->createBooking([
            'status' => 'Completed',
            'feedback_token' => 'fb_visit_insights_token',
            'group_size' => 80,
            'completed_at' => now(),
        ]);
        $booking->feedback_expires_at = now()->addDays(14);
        $booking->save();

        $payload = [
            'token' => 'fb_visit_insights_token',
            'visitorName' => 'Dewi Ratna',
            'gender' => 'female',
            'age' => 35,
            'origin' => 'Semarang',
            'bookingEase' => 4,
            'service' => 5,
            'guideQuality' => 4,
            'facilityComfort' => 3,
            'recommend' => 5,
            'visitedBefore' => false,
            'discoverySource' => 'other',
            'highlights' => ['Cerita sejarah'],
            'improvements' => ['Fasilitas'],
            'comment' => 'Tambahkan tempat duduk di area tunggu.',
            'allowPublish' => false,
        ];

        $this->postJson("/api/public/feedback/{$booking->code}", $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('discoverySourceOther');

        $response = $this->postJson("/api/public/feedback/{$booking->code}", [
            ...$payload,
            'discoverySourceOther' => 'Acara komunitas sejarah',
        ])->assertCreated()
            ->assertJsonPath('data.guideQuality', 4)
            ->assertJsonPath('data.facilityComfort', 3)
            ->assertJsonPath('data.visitedBefore', false)
            ->assertJsonPath('data.discoverySource', 'other')
            ->assertJsonPath('data.discoverySourceOther', 'Acara komunitas sejarah');

        $this->assertDatabaseHas('feedbacks', [
            'booking_id' => $booking->id,
            'guide_quality' => 4,
            'facility_comfort' => 3,
            'visited_before' => false,
            'discovery_source' => 'other',
            'discovery_source_other' => 'Acara komunitas sejarah',
        ]);

        // GET no longer returns individual feedback data (privacy in multi-feedback)
        // but confirms submittedCount incremented
        $this->getJson("/api/public/feedback/{$booking->code}?token=fb_visit_insights_token")
            ->assertOk()
            ->assertJsonPath('data', null)
            ->assertJsonPath('feedback.submittedCount', 1)
            ->assertJsonPath('feedback.accessStatus', 'available');
    }

    public function test_public_feedback_rejects_oversized_tag_payloads(): void
    {
        $booking = $this->createBooking([
            'status' => 'Completed',
            'feedback_token' => 'fb_oversized_tags_token',
            'group_size' => 80,
            'completed_at' => now(),
        ]);
        $booking->feedback_expires_at = now()->addDays(14);
        $booking->save();

        $payload = [
            'token' => 'fb_oversized_tags_token',
            'visitorName' => 'Tester',
            'gender' => 'male',
            'age' => 20,
            'origin' => 'Test City',
            'bookingEase' => 5,
            'service' => 5,
            'guideQuality' => 5,
            'facilityComfort' => 5,
            'recommend' => 5,
            'visitedBefore' => false,
            'discoverySource' => 'social_media',
            'highlights' => array_map(fn (int $index): string => "Aspek {$index}", range(1, 13)),
            'improvements' => ['Fasilitas'],
            'comment' => null,
            'allowPublish' => false,
        ];

        $this->postJson("/api/public/feedback/{$booking->code}", $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('highlights');

        $this->postJson("/api/public/feedback/{$booking->code}", [
            ...$payload,
            'highlights' => ['Penyambutan'],
            'improvements' => [str_repeat('A', 81)],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('improvements.0');

        $this->assertDatabaseMissing('feedbacks', [
            'booking_id' => $booking->id,
        ]);
    }

    private function useFailingBroadcaster(): void
    {
        config([
            'broadcasting.default' => 'failing',
            'broadcasting.connections.failing' => ['driver' => 'failing'],
            'queue.default' => 'sync',
        ]);

        Broadcast::extend('failing', fn () => new class implements BroadcasterContract
        {
            public function auth($request)
            {
                return null;
            }

            public function validAuthenticationResponse($request, $result)
            {
                return $result;
            }

            public function broadcast(array $channels, $event, array $payload = []): void
            {
                throw new BroadcastException('Broadcast transport unavailable.');
            }
        });
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'two_factor_confirmed_at' => now(),
        ]);

        return $this->actingAsAdminSession($admin);
    }

    private function actingAsAdminSession(User $user): User
    {
        $this->actingAs($user);
        $this->withHeader('Origin', 'http://localhost');
        $this->withSession([
            'admin_session_started_at' => now()->timestamp,
            TwoFactorService::VERIFIED_USER_ID_SESSION_KEY => $user->id,
        ]);

        return $user;
    }

    private function publicBookingPayload(array $overrides = []): array
    {
        return array_merge([
            'contactName' => 'Rina Prasetya',
            'nik' => '1234567890123456',
            'whatsapp' => '081234567890',
            'institution' => 'SMA Nusantara',
            'groupSize' => 25,
            'date' => '2026-06-04',
            'time' => '08.00',
            'agreement' => '1',
            'document' => UploadedFile::fake()->create('surat.pdf', 100, 'application/pdf'),
        ], $overrides);
    }

    private function publicFeedbackPayload(array $overrides = []): array
    {
        return array_merge([
            'token' => 'fb_test_token',
            'visitorName' => 'Peserta',
            'gender' => 'female',
            'age' => 25,
            'origin' => 'Yogyakarta',
            'bookingEase' => 5,
            'service' => 5,
            'guideQuality' => 5,
            'facilityComfort' => 5,
            'recommend' => 5,
            'visitedBefore' => false,
            'discoverySource' => 'social_media',
            'highlights' => ['Penyambutan'],
            'improvements' => ['Waktu kunjungan'],
            'comment' => 'Feedback peserta.',
            'allowPublish' => true,
        ], $overrides);
    }

    private function createBooking(array $overrides = []): Booking
    {
        $date = $overrides['date'] ?? '2026-06-01';
        $time = $overrides['time'] ?? '08.00';
        $dateObject = Carbon::createFromFormat('Y-m-d', $date, 'Asia/Jakarta')->startOfDay();
        $booking = new Booking;
        $booking->code = $overrides['code'] ?? 'ISTURA-2026-'.(++$this->bookingSequence);
        $booking->contact_name = $overrides['contact_name'] ?? 'Rina Prasetya';
        $booking->nik = $overrides['nik'] ?? '1234567890123456';
        $booking->whatsapp = $overrides['whatsapp'] ?? '081234567890';
        $booking->institution = $overrides['institution'] ?? 'SMA Nusantara';
        $booking->group_size = $overrides['group_size'] ?? 25;
        $booking->date = $dateObject;
        $booking->date_label = $overrides['date_label'] ?? app(ScheduleService::class)->formatLongDate($dateObject);
        $booking->time = $time;
        $booking->status = $overrides['status'] ?? 'Accepted';
        $booking->document_path = $overrides['document_path'] ?? null;
        $booking->document_original_name = $overrides['document_original_name'] ?? 'surat.pdf';
        $booking->feedback_token = $overrides['feedback_token'] ?? 'fb_'.bin2hex(random_bytes(8));
        $booking->submitted_at = $overrides['submitted_at'] ?? now();
        $booking->completed_at = $overrides['completed_at'] ?? null;
        $booking->expired_at = $overrides['expired_at'] ?? null;
        $booking->note = $overrides['note'] ?? null;
        // Auto-set feedback_expires_at for Completed bookings
        if (($overrides['status'] ?? 'Accepted') === 'Completed' && isset($overrides['completed_at'])) {
            $booking->feedback_expires_at = $overrides['feedback_expires_at']
                ?? Carbon::parse($overrides['completed_at'])->addDays(14);
        } elseif (isset($overrides['feedback_expires_at'])) {
            $booking->feedback_expires_at = $overrides['feedback_expires_at'];
        }
        $booking->save();

        return $booking->fresh();
    }

    private function slotFromResponse(array $days, string $date, string $time): array
    {
        $slot = $this->findSlot($days, $date, $time);
        $this->assertNotNull($slot, "Slot {$date} {$time} tidak ditemukan.");

        return $slot;
    }

    private function findSlot(array $days, string $date, string $time): ?array
    {
        $day = collect($days)->firstWhere('date', $date);
        if (! $day) {
            return null;
        }

        return collect($day['slots'])->firstWhere('time', $time);
    }
}
