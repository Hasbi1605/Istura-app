<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BookingSlot;
use App\Models\User;
use App\Services\ScheduleService;
use App\Services\TwoFactorService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminBookingFlexibilityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-06-15 09:00:00', 'Asia/Jakarta'));
        Storage::fake('local');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_admin_can_open_h_plus_one_slot_with_normal_schedule_toggle(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/admin/schedule/slot', [
            'date' => '2026-06-16',
            'time' => '10.00',
            'status' => 'Available',
            'note' => 'Membuka slot H+1 untuk publik.',
        ])->assertOk();

        $schedule = $this->getJson('/api/public/schedule?from=2026-06-16&to=2026-06-16')
            ->assertOk()
            ->json('data');
        $slot = collect($schedule[0]['slots'])->firstWhere('time', '10.00');
        $this->assertSame('Available', $slot['status']);
        $this->assertArrayNotHasKey('remainingCapacity', $slot);
        $this->assertArrayNotHasKey('shortNotice', $slot);

        $this->post('/api/public/bookings', $this->publicPayload([
            'groupSize' => 50,
            'date' => '2026-06-16',
            'time' => '10.00',
        ]), ['Accept' => 'application/json'])->assertCreated();

        $this->post('/api/public/bookings', $this->publicPayload([
            'contactName' => 'Dimas Nugraha',
            'nik' => '2234567890123456',
            'whatsapp' => '081234567891',
            'groupSize' => 20,
            'date' => '2026-06-16',
            'time' => '10.00',
        ]), ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('time');

        $refreshed = $this->getJson('/api/public/schedule?from=2026-06-16&to=2026-06-16')->json('data');
        $refreshedSlot = collect($refreshed[0]['slots'])->firstWhere('time', '10.00');
        $this->assertSame('Held', $refreshedSlot['status']);
        $this->assertArrayNotHasKey('remainingCapacity', $refreshedSlot);
    }

    public function test_admin_opened_same_day_slot_is_visible_public_and_supports_manual_booking(): void
    {
        $admin = $this->actingAsAdmin();

        $this->postJson('/api/admin/schedule/slot', [
            'date' => '2026-06-15',
            'time' => '10.00',
            'status' => 'Available',
            'note' => 'Slot tamu khusus.',
        ])->assertOk();

        $publicSchedule = $this->getJson('/api/public/schedule?from=2026-06-15&to=2026-06-15')->json('data');
        $this->assertSame('Available', collect($publicSchedule[0]['slots'])->firstWhere('time', '10.00')['status']);

        $payload = [
            'contactName' => 'Tamu Khusus',
            'nik' => '3234567890123456',
            'whatsapp' => '081234567892',
            'institution' => 'Undangan Khusus',
            'groupSize' => 40,
            'date' => '2026-06-15',
            'time' => '10.00',
            'status' => 'Accepted',
            'confirmedWithGuest' => true,
        ];

        $this->postJson('/api/admin/bookings', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('confirmManualBooking');

        $response = $this->postJson('/api/admin/bookings', $payload + [
            'confirmManualBooking' => true,
        ])->assertCreated()
            ->assertJsonPath('data.source', 'admin')
            ->assertJsonPath('data.hasDocument', false)
            ->assertJsonMissingPath('data.nik_encrypted');

        $booking = Booking::where('code', $response->json('data.code'))->firstOrFail();
        $this->assertSame($admin->id, $booking->created_by_admin_id);
        $this->assertStringContainsString('booking manual dibuat dari panel admin', (string) $booking->note);
        $this->assertStringContainsString('Tanpa surat permohonan', (string) $booking->note);
        $this->assertSame('3234567890123456', $booking->nik);
        $this->assertNotSame('3234567890123456', $booking->getRawOriginal('nik_encrypted'));
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'date' => '2026-06-15 00:00:00',
            'time' => '10.00',
            'group_size' => 40,
        ]);
    }

    public function test_admin_manual_booking_can_attach_optional_letter(): void
    {
        $this->actingAsAdmin();

        $response = $this->post('/api/admin/bookings', [
            'contactName' => 'Tamu Bersurat',
            'nik' => '5234567890123456',
            'whatsapp' => '081234567895',
            'institution' => 'Undangan Bersurat',
            'groupSize' => 12,
            'date' => '2026-06-16',
            'time' => '10.00',
            'status' => 'Pending',
            'confirmManualBooking' => '1',
            'document' => UploadedFile::fake()->create('surat-admin.pdf', 120, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.source', 'admin')
            ->assertJsonPath('data.hasDocument', true)
            ->assertJsonPath('data.documentName', 'surat-admin.pdf');

        $booking = Booking::where('code', $response->json('data.code'))->firstOrFail();
        $this->assertNotNull($booking->document_path);
        $this->assertStringContainsString('Surat permohonan dilampirkan admin', (string) $booking->note);
        Storage::disk('local')->assertExists($booking->document_path);
    }

    public function test_admin_manual_booking_can_use_custom_kloter_segments(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/admin/bookings', [
            'contactName' => 'Tamu Kloter Manual',
            'nik' => '6234567890123456',
            'whatsapp' => '081234567896',
            'institution' => 'Rombongan Manual',
            'groupSize' => 200,
            'date' => '2026-06-16',
            'time' => '08.00',
            'status' => 'Accepted',
            'confirmedWithGuest' => true,
            'confirmManualBooking' => true,
            'segments' => [
                ['date' => '2026-06-16', 'time' => '08.00', 'groupSize' => 80],
                ['date' => '2026-06-16', 'time' => '10.00', 'groupSize' => 80],
                ['date' => '2026-06-16', 'time' => '13.00', 'groupSize' => 40],
            ],
        ])->assertCreated()
            ->assertJsonPath('data.groupSize', 200)
            ->assertJsonPath('data.kloterCount', 3)
            ->assertJsonPath('data.time', '08.00')
            ->assertJsonPath('data.segments.0.time', '08.00')
            ->assertJsonPath('data.segments.0.groupSize', 80)
            ->assertJsonPath('data.segments.1.time', '10.00')
            ->assertJsonPath('data.segments.1.groupSize', 80)
            ->assertJsonPath('data.segments.2.time', '13.00')
            ->assertJsonPath('data.segments.2.groupSize', 40);

        $booking = Booking::where('code', $response->json('data.code'))->firstOrFail();
        $this->assertStringContainsString('Pembagian kloter manual: 08.00 WIB (80 peserta); 10.00 WIB (80 peserta); 13.00 WIB (40 peserta).', (string) $booking->note);
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'slot_order' => 1,
            'date' => '2026-06-16 00:00:00',
            'time' => '08.00',
            'group_size' => 80,
        ]);
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'slot_order' => 2,
            'date' => '2026-06-16 00:00:00',
            'time' => '10.00',
            'group_size' => 80,
        ]);
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'slot_order' => 3,
            'date' => '2026-06-16 00:00:00',
            'time' => '13.00',
            'group_size' => 40,
        ]);
    }

    public function test_admin_manual_booking_segments_must_match_booking_total_and_date(): void
    {
        $this->actingAsAdmin();

        $payload = [
            'contactName' => 'Tamu Kloter Salah',
            'nik' => '7234567890123456',
            'whatsapp' => '081234567897',
            'institution' => 'Rombongan Salah',
            'groupSize' => 200,
            'date' => '2026-06-16',
            'time' => '08.00',
            'status' => 'Accepted',
            'confirmedWithGuest' => true,
            'confirmManualBooking' => true,
        ];

        $this->postJson('/api/admin/bookings', $payload + [
            'segments' => [
                ['date' => '2026-06-16', 'time' => '08.00', 'groupSize' => 80],
                ['date' => '2026-06-16', 'time' => '10.00', 'groupSize' => 80],
            ],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('segments');

        $this->postJson('/api/admin/bookings', $payload + [
            'segments' => [
                ['date' => '2026-06-17', 'time' => '08.00', 'groupSize' => 200],
            ],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('segments.0.date');
    }

    public function test_accepted_booking_direct_move_does_not_require_guest_agreement_and_can_move_to_today(): void
    {
        $this->actingAsAdmin();
        $booking = $this->createBookingWithSlots('ISTURA-2026-MOVE', '2026-06-16', '08.00', 50, 'Accepted');

        $this->postJson("/api/admin/bookings/{$booking->code}/move", [
            'date' => '2026-06-15',
            'time' => '08.00',
            'confirmedDirectMove' => true,
        ])->assertUnprocessable()->assertJsonValidationErrors('time');

        $this->postJson("/api/admin/bookings/{$booking->code}/move", [
            'date' => '2026-06-15',
            'time' => '13.00',
        ])->assertUnprocessable()->assertJsonValidationErrors('confirmedDirectMove');

        $this->postJson("/api/admin/bookings/{$booking->code}/move", [
            'date' => '2026-06-15',
            'time' => '13.00',
            'confirmedDirectMove' => true,
        ])->assertOk()
            ->assertJsonPath('data.date', '2026-06-15')
            ->assertJsonPath('data.time', '13.00')
            ->assertJsonPath('data.status', 'Accepted');

        $this->assertDatabaseMissing('booking_slots', [
            'booking_id' => $booking->id,
            'date' => '2026-06-16 00:00:00',
            'time' => '08.00',
        ]);
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'date' => '2026-06-15 00:00:00',
            'time' => '13.00',
        ]);
        $this->assertStringContainsString('pindah jadwal langsung disetujui', (string) $booking->fresh()->note);
    }

    public function test_direct_move_preserves_manual_booking_kloter_shape(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/admin/bookings', [
            'contactName' => 'Tamu Manual Pindah',
            'nik' => '6234567890123499',
            'whatsapp' => '081234567899',
            'institution' => 'Rombongan Manual Pindah',
            'groupSize' => 200,
            'date' => '2026-06-16',
            'time' => '08.00',
            'status' => 'Accepted',
            'confirmedWithGuest' => true,
            'confirmManualBooking' => true,
            'segments' => [
                ['date' => '2026-06-16', 'time' => '08.00', 'groupSize' => 100],
                ['date' => '2026-06-16', 'time' => '09.00', 'groupSize' => 100],
            ],
        ])->assertCreated()
            ->assertJsonPath('data.groupSize', 200)
            ->assertJsonPath('data.kloterCount', 2)
            ->assertJsonPath('data.segments.0.groupSize', 100)
            ->assertJsonPath('data.segments.1.groupSize', 100);

        $code = $response->json('data.code');

        $this->postJson("/api/admin/bookings/{$code}/move", [
            'date' => '2026-06-16',
            'time' => '08.00',
            'confirmedDirectMove' => true,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('time');

        $this->postJson("/api/admin/bookings/{$code}/move", [
            'date' => '2026-06-17',
            'time' => '10.00',
            'confirmedDirectMove' => true,
        ])->assertOk()
            ->assertJsonPath('data.date', '2026-06-17')
            ->assertJsonPath('data.time', '10.00')
            ->assertJsonPath('data.kloterCount', 2)
            ->assertJsonPath('data.segments.0.time', '10.00')
            ->assertJsonPath('data.segments.0.groupSize', 100)
            ->assertJsonPath('data.segments.1.time', '11.00')
            ->assertJsonPath('data.segments.1.groupSize', 100);

        $booking = Booking::where('code', $code)->firstOrFail();
        $this->assertSame(2, $booking->slots()->where('kind', BookingSlot::KIND_ACTIVE)->count());
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'kind' => BookingSlot::KIND_ACTIVE,
            'slot_order' => 1,
            'date' => '2026-06-17 00:00:00',
            'time' => '10.00',
            'group_size' => 100,
        ]);
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'kind' => BookingSlot::KIND_ACTIVE,
            'slot_order' => 2,
            'date' => '2026-06-17 00:00:00',
            'time' => '11.00',
            'group_size' => 100,
        ]);
    }

    public function test_direct_move_rejects_active_reschedule_and_preserves_proposal(): void
    {
        $this->actingAsAdmin();
        $booking = $this->createBookingWithSlots('ISTURA-2026-MOVERES', '2026-06-16', '08.00', 30, 'Reschedule');
        $booking->forceFill([
            'proposed_date' => '2026-06-17',
            'proposed_date_label' => 'Rabu, 17 Juni 2026',
            'proposed_time' => '09.00',
            'proposed_segments' => [[
                'slot_order' => 1,
                'date' => '2026-06-17',
                'date_label' => 'Rabu, 17 Juni 2026',
                'time' => '09.00',
                'group_size' => 30,
            ]],
            'proposed_at' => now(),
            'reschedule_previous_status' => 'Accepted',
        ])->save();
        $booking->slots()->create([
            'kind' => BookingSlot::KIND_PROPOSED,
            'slot_order' => 1,
            'date' => '2026-06-17',
            'date_label' => 'Rabu, 17 Juni 2026',
            'time' => '09.00',
            'group_size' => 30,
            'active_slot_key' => '2026-06-17|09.00',
        ]);

        $this->postJson("/api/admin/bookings/{$booking->code}/move", [
            'date' => '2026-06-15',
            'time' => '14.00',
            'confirmedDirectMove' => true,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $booking->refresh();
        $this->assertSame('Reschedule', $booking->status);
        $this->assertSame('2026-06-17', $booking->proposed_date->toDateString());
        $this->assertSame('09.00', $booking->proposed_time);
        $this->assertSame('Accepted', $booking->reschedule_previous_status);
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'kind' => BookingSlot::KIND_PROPOSED,
            'date' => '2026-06-17 00:00:00',
            'time' => '09.00',
        ]);
    }

    public function test_segment_total_is_locked_until_explicit_correction_mode_is_enabled(): void
    {
        $this->actingAsAdmin();
        $booking = $this->createBookingWithSlots('ISTURA-2026-SEG', '2026-06-16', '08.00', 160, 'Accepted');

        $this->postJson("/api/admin/bookings/{$booking->code}/segments", [
            'groupSize' => 170,
            'segments' => [[
                'date' => '2026-06-16',
                'time' => '10.00',
                'groupSize' => 170,
            ]],
            'note' => 'Tambahan peserta telah dikonfirmasi.',
        ])->assertUnprocessable()->assertJsonValidationErrors('correctGroupSize');

        $this->postJson("/api/admin/bookings/{$booking->code}/segments", [
            'groupSize' => 170,
            'correctGroupSize' => true,
            'confirmRisk' => true,
            'segments' => [[
                'date' => '2026-06-16',
                'time' => '10.00',
                'groupSize' => 170,
            ]],
        ])->assertOk()
            ->assertJsonPath('data.groupSize', 170)
            ->assertJsonPath('data.kloterCount', 1);

        $booking->refresh();
        $this->assertStringContainsString('Total peserta dikoreksi 160 -> 170.', $booking->note);
        $this->assertStringContainsString('Ada kloter di atas kapasitas standar 80 peserta.', $booking->note);
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'time' => '10.00',
            'group_size' => 170,
        ]);
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

    private function publicPayload(array $overrides = []): array
    {
        return array_merge([
            'contactName' => 'Rina Prasetya',
            'nik' => '1234567890123456',
            'whatsapp' => '081234567890',
            'institution' => 'SMA Nusantara',
            'groupSize' => 25,
            'date' => '2026-06-17',
            'time' => '08.00',
            'agreement' => '1',
            'document' => UploadedFile::fake()->create('surat.pdf', 100, 'application/pdf'),
        ], $overrides);
    }

    private function createBookingWithSlots(string $code, string $date, string $time, int $groupSize, string $status): Booking
    {
        $dateObject = Carbon::createFromFormat('Y-m-d', $date, 'Asia/Jakarta')->startOfDay();
        $booking = new Booking;
        $booking->code = $code;
        $booking->contact_name = 'Rina Prasetya';
        $booking->nik = '4234567890123456';
        $booking->whatsapp = '081234567893';
        $booking->institution = 'SMA Nusantara';
        $booking->group_size = $groupSize;
        $booking->date = $dateObject;
        $booking->date_label = app(ScheduleService::class)->formatLongDate($dateObject);
        $booking->time = $time;
        $booking->status = $status;
        $booking->document_original_name = 'surat.pdf';
        $booking->feedback_token = 'fb_'.bin2hex(random_bytes(8));
        $booking->submitted_at = now();
        $booking->save();

        $sizes = $groupSize === 160 ? [80, 80] : [$groupSize];
        $times = $groupSize === 160 ? ['08.00', '09.00'] : [$time];
        foreach ($sizes as $index => $size) {
            $booking->slots()->create([
                'kind' => BookingSlot::KIND_ACTIVE,
                'slot_order' => $index + 1,
                'date' => $date,
                'date_label' => $booking->date_label,
                'time' => $times[$index],
                'group_size' => $size,
                'active_slot_key' => BookingSlot::slotKey($date, $times[$index]),
            ]);
        }

        return $booking->fresh('slots');
    }
}
