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

    public function test_admin_can_open_capacity_limited_public_short_notice_slot(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/admin/schedule/short-notice', [
            'date' => '2026-06-17',
            'time' => '10.00',
            'audience' => 'public',
            'closesAt' => '2026-06-16T09:30:00+07:00',
            'capacity' => 60,
            'note' => 'Tidak seharusnya memakai mode dadakan.',
        ])->assertUnprocessable()->assertJsonValidationErrors('date');

        $this->postJson('/api/admin/schedule/short-notice', [
            'date' => '2026-06-16',
            'time' => '10.00',
            'audience' => 'public',
            'closesAt' => '2026-06-15T09:30:00+07:00',
            'capacity' => 60,
            'note' => 'Membuka kuota dadakan untuk rombongan terkoordinasi.',
        ])->assertOk();

        $schedule = $this->getJson('/api/public/schedule?from=2026-06-16&to=2026-06-16')
            ->assertOk()
            ->json('data');
        $slot = collect($schedule[0]['slots'])->firstWhere('time', '10.00');
        $this->assertSame('Available', $slot['status']);
        $this->assertSame(60, $slot['remainingCapacity']);
        $this->assertSame('public', $slot['shortNotice']['mode']);

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
        $this->assertSame('Available', $refreshedSlot['status']);
        $this->assertSame(10, $refreshedSlot['remainingCapacity']);
    }

    public function test_admin_only_short_notice_stays_hidden_public_and_supports_manual_booking(): void
    {
        $admin = $this->actingAsAdmin();

        $this->postJson('/api/admin/schedule/short-notice', [
            'date' => '2026-06-15',
            'time' => '10.00',
            'audience' => 'admin',
            'capacity' => 120,
            'note' => 'Slot tamu khusus.',
        ])->assertOk();

        $publicSchedule = $this->getJson('/api/public/schedule?from=2026-06-15&to=2026-06-15')->json('data');
        $this->assertSame('Closed', collect($publicSchedule[0]['slots'])->firstWhere('time', '10.00')['status']);

        $response = $this->postJson('/api/admin/bookings', [
            'contactName' => 'Tamu Khusus',
            'nik' => '3234567890123456',
            'whatsapp' => '081234567892',
            'institution' => 'Undangan Khusus',
            'groupSize' => 40,
            'date' => '2026-06-15',
            'time' => '10.00',
            'status' => 'Accepted',
            'confirmedWithGuest' => true,
            'note' => 'Jadwal dikonfirmasi oleh admin protokol.',
        ])->assertCreated()
            ->assertJsonPath('data.source', 'admin')
            ->assertJsonPath('data.hasDocument', false)
            ->assertJsonMissingPath('data.nik_encrypted');

        $booking = Booking::where('code', $response->json('data.code'))->firstOrFail();
        $this->assertSame($admin->id, $booking->created_by_admin_id);
        $this->assertSame('3234567890123456', $booking->nik);
        $this->assertNotSame('3234567890123456', $booking->getRawOriginal('nik_encrypted'));
        $this->assertDatabaseHas('booking_slots', [
            'booking_id' => $booking->id,
            'date' => '2026-06-15 00:00:00',
            'time' => '10.00',
            'group_size' => 40,
        ]);
    }

    public function test_accepted_booking_direct_move_requires_guest_agreement_and_can_move_to_today(): void
    {
        $this->actingAsAdmin();
        $booking = $this->createBookingWithSlots('ISTURA-2026-MOVE', '2026-06-16', '08.00', 50, 'Accepted');

        $this->postJson("/api/admin/bookings/{$booking->code}/move", [
            'date' => '2026-06-15',
            'time' => '08.00',
            'confirmedWithGuest' => true,
            'note' => 'Percobaan ke jam yang sudah lewat.',
        ])->assertUnprocessable()->assertJsonValidationErrors('time');

        $this->postJson("/api/admin/bookings/{$booking->code}/move", [
            'date' => '2026-06-15',
            'time' => '13.00',
            'note' => 'Tamu meminta kunjungan dipercepat.',
        ])->assertUnprocessable()->assertJsonValidationErrors('confirmedWithGuest');

        $this->postJson("/api/admin/bookings/{$booking->code}/move", [
            'date' => '2026-06-15',
            'time' => '13.00',
            'confirmedWithGuest' => true,
            'note' => 'Tamu meminta kunjungan dipercepat.',
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
    }

    public function test_direct_move_clears_active_reschedule_proposal_and_restores_status(): void
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
            'confirmedWithGuest' => true,
            'note' => 'Jadwal final sudah disepakati tanpa proposal lanjutan.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'Accepted')
            ->assertJsonPath('data.proposedDate', null)
            ->assertJsonPath('data.proposedTime', null);

        $booking->refresh();
        $this->assertNull($booking->proposed_segments);
        $this->assertNull($booking->reschedule_previous_status);
        $this->assertDatabaseMissing('booking_slots', [
            'booking_id' => $booking->id,
            'kind' => BookingSlot::KIND_PROPOSED,
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
            'segments' => [[
                'date' => '2026-06-16',
                'time' => '10.00',
                'groupSize' => 170,
            ]],
            'note' => 'Tambahan peserta telah dikonfirmasi.',
        ])->assertOk()
            ->assertJsonPath('data.groupSize', 170)
            ->assertJsonPath('data.kloterCount', 1);

        $booking->refresh();
        $this->assertStringContainsString('Tambahan peserta telah dikonfirmasi.', $booking->note);
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
