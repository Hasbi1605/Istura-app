<?php

namespace Tests\Feature;

use App\Events\BookingCreated;
use App\Events\BookingStatusChanged;
use App\Events\FeedbackSubmitted;
use App\Events\ScheduleUpdated;
use App\Models\AuditLog;
use App\Models\Booking;
use App\Models\BookingSlot;
use App\Models\Feedback;
use App\Models\ScheduleOverride;
use App\Models\User;
use App\Services\BookingService;
use App\Services\ScheduleService;
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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
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

    public function test_realtime_events_are_queued_after_commit_and_rescued(): void
    {
        foreach ([BookingCreated::class, BookingStatusChanged::class, FeedbackSubmitted::class, ScheduleUpdated::class] as $eventClass) {
            $interfaces = class_implements($eventClass) ?: [];

            $this->assertContains(ShouldBroadcast::class, $interfaces);
            $this->assertContains(ShouldRescue::class, $interfaces);
            $this->assertNotContains(ShouldBroadcastNow::class, $interfaces);
        }

        $this->assertTrue((new BookingCreated(new Booking))->afterCommit);
        $this->assertTrue((new BookingStatusChanged(new Booking, 'Pending'))->afterCommit);
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

        $schedule = $this->getJson("/api/public/schedule?from={$date}&to={$date}")
            ->assertOk()
            ->json('data');

        $this->assertSame('Available', $this->slotFromResponse($schedule, $date, '08.00')['status']);
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
        $this->assertStringContainsString("object-src 'none'", $csp);
    }

    public function test_viewer_cannot_read_sensitive_admin_endpoints(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('booking-letters/real-surat.pdf', '%PDF-1.4 real file');
        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-VIEWER',
            'document_path' => 'booking-letters/real-surat.pdf',
            'document_original_name' => 'real-surat.pdf',
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_VIEWER]));

        $this->getJson('/api/admin/dashboard')->assertForbidden();
        $this->getJson('/api/admin/bookings')->assertForbidden();
        $this->get("/api/admin/bookings/{$booking->code}/document")->assertForbidden();
        $this->getJson('/api/admin/feedback')->assertForbidden();
        $this->getJson('/api/admin/users')->assertForbidden();
        $this->getJson('/api/admin/audit-logs')->assertForbidden();
    }

    public function test_super_admin_user_management_writes_audit_log(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPER_ADMIN]));

        $created = $this->postJson('/api/admin/users', [
            'name' => 'Audit User',
            'email' => 'audit-user@example.test',
            'password' => 'audit-user-password-123!',
            'role' => User::ROLE_VIEWER,
            'status' => 'Aktif',
        ])->assertCreated();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Membuat pengguna admin audit-user@example.test',
            'target_id' => (string) $created->json('data.id'),
        ]);
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

        putenv('SEED_ADMIN_PASSWORD');
        unset($_ENV['SEED_ADMIN_PASSWORD'], $_SERVER['SEED_ADMIN_PASSWORD']);
    }

    public function test_super_admin_cannot_disable_or_demote_self(): void
    {
        $superAdmin = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN]);
        Sanctum::actingAs($superAdmin);

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

    public function test_admin_booking_payload_masks_nik_unless_super_admin_reads_detail(): void
    {
        $this->actingAsAdmin();
        $booking = $this->createBooking([
            'code' => 'ISTURA-2026-NIK1',
            'nik' => '3374123456789012',
        ]);

        $this->getJson('/api/admin/bookings')
            ->assertOk()
            ->assertJsonPath('data.0.code', $booking->code)
            ->assertJsonMissingPath('data.0.nik')
            ->assertJsonPath('data.0.nikMasked', '3374********9012');

        $this->getJson("/api/admin/bookings/{$booking->code}")
            ->assertOk()
            ->assertJsonMissingPath('data.nik')
            ->assertJsonPath('data.nikMasked', '3374********9012');

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPER_ADMIN]));

        $this->getJson('/api/admin/bookings')
            ->assertOk()
            ->assertJsonMissingPath('data.0.nik')
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

    public function test_viewer_cannot_mutate_schedule_or_cms(): void
    {
        ScheduleOverride::create([
            'date' => '2026-06-01',
            'time' => '08.00',
            'status' => 'Closed',
            'custom' => false,
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_VIEWER]));

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
        Sanctum::actingAs(User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'email_verified_at' => null,
        ]));

        $this->getJson('/api/admin/bookings')->assertForbidden();
    }

    public function test_public_booking_allows_h1_to_h4_and_rejects_same_day(): void
    {
        Storage::fake('local');

        ScheduleOverride::create([
            'date' => '2026-05-31',
            'time' => '08.00',
            'status' => 'Available',
            'custom' => false,
        ]);

        $this->post('/api/public/bookings', $this->publicBookingPayload([
            'date' => '2026-05-31',
            'time' => '08.00',
        ]), ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.leadTimeDays', 1)
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
            'groupSize' => 561,
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
            ->assertJsonPath('data.segments.1.time', '12.00')
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
            'time' => '12.00',
            'group_size' => 80,
            'active_slot_key' => '2026-06-04|12.00',
        ]);

        $schedule = $this->getJson('/api/public/schedule?from=2026-06-04&to=2026-06-04')
            ->assertOk()
            ->json('data');

        $this->assertSame('Held', $this->slotFromResponse($schedule, '2026-06-04', '11.00')['status']);
        $this->assertSame('Held', $this->slotFromResponse($schedule, '2026-06-04', '12.00')['status']);
        $this->assertSame('Available', $this->slotFromResponse($schedule, '2026-06-04', '13.00')['status']);
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
            'note' => 'User meminta penggabungan dari 3 kloter menjadi 2 kloter.',
        ])->assertOk()
            ->assertJsonPath('data.kloterCount', 2)
            ->assertJsonPath('data.segments.0.groupSize', 100)
            ->assertJsonPath('data.segments.1.groupSize', 100)
            ->assertJsonPath('data.note', 'User meminta penggabungan dari 3 kloter menjadi 2 kloter.');

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
            ->assertJsonValidationErrors('note');

        $this->postJson("/api/admin/bookings/{$code}/segments", $payload + [
            'note' => 'Admin menggabungkan dua kloter karena rombongan meminta satu sesi.',
        ])->assertOk()
            ->assertJsonPath('data.kloterCount', 1)
            ->assertJsonPath('data.segments.0.time', '08.00')
            ->assertJsonPath('data.segments.0.groupSize', 160)
            ->assertJsonPath('data.note', 'Admin menggabungkan dua kloter karena rombongan meminta satu sesi.');
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
            'segments' => [
                ['date' => $date, 'time' => '08.00', 'groupSize' => 30],
            ],
        ];

        $this->postJson("/api/admin/bookings/{$booking->code}/segments", $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('note');

        $this->postJson("/api/admin/bookings/{$booking->code}/segments", $payload + [
            'note' => 'User salah input jumlah peserta, admin koreksi manual.',
        ])->assertOk()
            ->assertJsonPath('data.groupSize', 30)
            ->assertJsonPath('data.segments.0.groupSize', 30)
            ->assertJsonPath('data.note', 'User salah input jumlah peserta, admin koreksi manual.');

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'group_size' => 30,
            'note' => 'User salah input jumlah peserta, admin koreksi manual.',
        ]);

        $log = AuditLog::where('target_id', $booking->code)->latest('id')->firstOrFail();
        $this->assertSame(2, $log->payload['old_group_size']);
        $this->assertSame(30, $log->payload['new_group_size']);
        $this->assertSame('User salah input jumlah peserta, admin koreksi manual.', $log->payload['note']);
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
            'note' => 'Rombongan meminta digabung dengan slot sebelumnya.',
        ];

        $this->postJson("/api/admin/bookings/{$booking->code}/segments", $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('allowOverbook');

        $this->postJson("/api/admin/bookings/{$booking->code}/segments", $payload + ['allowOverbook' => true])
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
            'time' => '12.00',
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

    public function test_public_feedback_stays_single_per_booking(): void
    {
        $booking = $this->createBooking([
            'status' => 'Completed',
            'feedback_token' => 'fb_single_feedback_token',
        ]);

        Feedback::create([
            'booking_id' => $booking->id,
            'code' => $booking->code,
            'rating' => 5,
            'booking_ease' => 5,
            'service' => 5,
            'recommend' => 5,
            'highlights' => [],
            'improvements' => [],
            'comment' => null,
            'allow_publish' => false,
            'submitted_at' => now(),
        ]);

        $this->postJson("/api/public/feedback/{$booking->code}", [
            'token' => 'fb_single_feedback_token',
            'rating' => 4,
            'bookingEase' => 4,
            'service' => 4,
            'recommend' => 4,
            'highlights' => [],
            'improvements' => [],
            'comment' => 'Duplikat harus ditolak.',
            'allowPublish' => false,
        ])->assertStatus(422)
            ->assertJsonValidationErrors('code');

        $this->assertDatabaseCount('feedbacks', 1);
    }

    public function test_public_rate_limits_are_isolated_per_flow(): void
    {
        Storage::fake('local');
        $booking = $this->createBooking([
            'status' => 'Completed',
            'feedback_token' => 'fb_rate_limit_token',
        ]);

        for ($i = 0; $i < 11; $i++) {
            $this->withHeader('Accept', 'application/json')
                ->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])
                ->post('/api/public/bookings', $this->publicBookingPayload([
                    'contactName' => '',
                    'time' => sprintf('%02d.00', 8 + ($i % 7)),
                ]))
                ->assertStatus(422);
        }

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])
            ->postJson("/api/public/feedback/{$booking->code}", [
                'token' => 'fb_rate_limit_token',
                'rating' => 5,
                'bookingEase' => 5,
                'service' => 5,
                'recommend' => 5,
                'highlights' => ['Penyambutan'],
                'improvements' => [],
                'comment' => 'Rate limit flow tetap terpisah.',
                'allowPublish' => true,
            ])
            ->assertCreated();

        $this->assertDatabaseHas('audit_logs', [
            'action' => "Feedback dikirim untuk booking {$booking->code}",
            'target_type' => Feedback::class,
        ]);
    }

    public function test_public_feedback_show_requires_valid_token_and_returns_booking_status(): void
    {
        $booking = $this->createBooking([
            'status' => 'Completed',
            'feedback_token' => 'fb_show_token',
        ]);

        $this->getJson("/api/public/feedback/{$booking->code}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('token');

        $this->getJson("/api/public/feedback/{$booking->code}?token=wrong-token")
            ->assertStatus(422)
            ->assertJsonValidationErrors('token');

        $this->getJson("/api/public/feedback/{$booking->code}?token=fb_show_token")
            ->assertOk()
            ->assertJsonPath('booking.code', $booking->code)
            ->assertJsonPath('booking.status', 'Completed')
            ->assertJsonPath('data', null);
    }

    public function test_public_feedback_submission_is_blocked_until_booking_completed(): void
    {
        $booking = $this->createBooking([
            'status' => 'Pending',
            'feedback_token' => 'fb_pending_token',
        ]);

        $this->postJson("/api/public/feedback/{$booking->code}", [
            'token' => 'fb_pending_token',
            'rating' => 5,
            'bookingEase' => 5,
            'service' => 5,
            'recommend' => 5,
            'highlights' => ['Penyambutan'],
            'improvements' => [],
            'comment' => 'Belum selesai tidak boleh masuk.',
            'allowPublish' => true,
        ])->assertStatus(422)
            ->assertJsonValidationErrors('code');

        $this->assertDatabaseCount('feedbacks', 0);
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
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        Sanctum::actingAs($admin);

        return $admin;
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
        $booking->note = $overrides['note'] ?? null;
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
