<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\User;
use App\Services\ScheduleService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookingReportingDateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-06-01 10:00:00', 'Asia/Jakarta'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_rejected_booking_exposes_rejected_at_for_report_periods(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'two_factor_confirmed_at' => now(),
        ]);
        Sanctum::actingAs($admin);

        $booking = $this->createBooking([
            'status' => 'Pending',
            'date' => '2026-06-10',
            'submitted_at' => Carbon::parse('2026-05-31 16:30:00', 'Asia/Jakarta'),
        ]);

        $this->postJson("/api/admin/bookings/{$booking->code}/reject", [
            'note' => 'Kuota tidak tersedia.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'Rejected')
            ->assertJsonPath('data.rejectedAt', '1 Juni 2026, 10.00 WIB');

        $this->assertSame(
            '2026-06-01 10:00:00',
            $booking->fresh()->rejected_at?->timezone('Asia/Jakarta')->toDateTimeString(),
        );
    }

    private function createBooking(array $overrides = []): Booking
    {
        $date = $overrides['date'] ?? '2026-06-01';
        $dateObject = Carbon::createFromFormat('Y-m-d', $date, 'Asia/Jakarta')->startOfDay();

        $booking = new Booking;
        $booking->code = $overrides['code'] ?? 'ISTURA-2026-9001';
        $booking->contact_name = $overrides['contact_name'] ?? 'Rina Prasetya';
        $booking->nik = $overrides['nik'] ?? '1234567890123456';
        $booking->whatsapp = $overrides['whatsapp'] ?? '081234567890';
        $booking->institution = $overrides['institution'] ?? 'SMA Nusantara';
        $booking->group_size = $overrides['group_size'] ?? 25;
        $booking->date = $dateObject;
        $booking->date_label = $overrides['date_label'] ?? app(ScheduleService::class)->formatLongDate($dateObject);
        $booking->time = $overrides['time'] ?? '08.00';
        $booking->status = $overrides['status'] ?? 'Pending';
        $booking->document_path = $overrides['document_path'] ?? null;
        $booking->document_original_name = $overrides['document_original_name'] ?? 'surat.pdf';
        $booking->feedback_token = $overrides['feedback_token'] ?? 'fb_report_period';
        $booking->submitted_at = $overrides['submitted_at'] ?? now();
        $booking->completed_at = $overrides['completed_at'] ?? null;
        $booking->rejected_at = $overrides['rejected_at'] ?? null;
        $booking->note = $overrides['note'] ?? null;
        $booking->save();

        return $booking->fresh();
    }
}
