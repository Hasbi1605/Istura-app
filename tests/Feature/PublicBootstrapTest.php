<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Services\ScheduleService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicBootstrapTest extends TestCase
{
    use RefreshDatabase;

    private int $bookingSequence = 9100;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-06-01 09:00:00', 'Asia/Jakarta'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_public_bootstrap_returns_landing_payload_and_cache_headers(): void
    {
        $response = $this->getJson('/api/public/bootstrap');

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'schedule' => [
                        '*' => ['date', 'label', 'short', 'slots'],
                    ],
                    'faqs',
                    'contacts',
                    'waTemplates',
                    'hero' => ['headline', 'subheadline', 'primaryCta', 'secondaryCta', 'story'],
                    'letter' => ['image', 'checklist'],
                    'siteContent' => ['nav', 'quickInfo', 'schedule', 'video', 'bookingSteps', 'activities', 'letterSection', 'faq', 'cta', 'footer'],
                ],
            ]);

        $this->assertStringContainsString('public', $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-cache', $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('max-age=0', $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('must-revalidate', $response->headers->get('Cache-Control'));
    }

    public function test_public_schedule_response_is_publicly_cacheable(): void
    {
        $response = $this->getJson('/api/public/schedule?from=2026-06-01&to=2026-06-01');

        $response->assertOk();
        $cacheControl = $response->headers->get('Cache-Control');
        $this->assertStringContainsString('public', $cacheControl);
        $this->assertStringContainsString('max-age=60', $cacheControl);
        $this->assertStringContainsString('s-maxage=60', $cacheControl);
        $this->assertStringContainsString('stale-while-revalidate=300', $cacheControl);
        $this->assertStringNotContainsString('no-cache', $cacheControl);
    }

    public function test_public_schedule_has_dedicated_rate_limit(): void
    {
        $url = '/api/public/schedule?from=2026-06-01&to=2026-06-01';

        for ($i = 0; $i < 120; $i++) {
            $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.77'])
                ->getJson($url)
                ->assertOk();
        }

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.77'])
            ->getJson($url)
            ->assertTooManyRequests();

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.78'])
            ->getJson($url)
            ->assertOk();
    }

    public function test_public_schedule_omits_admin_booking_density_fields(): void
    {
        $date = '2026-06-04';
        $time = '08.00';

        $this->createBooking(['date' => $date, 'time' => $time, 'status' => 'Accepted']);
        $this->createBooking(['date' => $date, 'time' => $time, 'status' => 'Accepted']);

        $response = $this->getJson("/api/public/schedule?from={$date}&to={$date}")
            ->assertOk();

        $slot = collect($response->json('data.0.slots'))->firstWhere('time', $time);

        $this->assertIsArray($slot);
        $this->assertSame('Booked', $slot['status']);
        $this->assertArrayNotHasKey('bookingCount', $slot);
        $this->assertArrayNotHasKey('overbooked', $slot);
    }

    public function test_public_bootstrap_schedule_omits_admin_booking_density_fields(): void
    {
        $date = '2026-06-04';
        $time = '08.00';

        $this->createBooking(['date' => $date, 'time' => $time, 'status' => 'Accepted']);
        $this->createBooking(['date' => $date, 'time' => $time, 'status' => 'Accepted']);

        $response = $this->getJson("/api/public/bootstrap?from={$date}&to={$date}")
            ->assertOk();

        $slot = collect($response->json('data.schedule.0.slots'))->firstWhere('time', $time);

        $this->assertIsArray($slot);
        $this->assertSame('Booked', $slot['status']);
        $this->assertArrayNotHasKey('bookingCount', $slot);
        $this->assertArrayNotHasKey('overbooked', $slot);
    }

    private function createBooking(array $overrides = []): Booking
    {
        $date = $overrides['date'] ?? '2026-06-04';
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
        $booking->time = $overrides['time'] ?? '08.00';
        $booking->status = $overrides['status'] ?? 'Accepted';
        $booking->document_path = $overrides['document_path'] ?? null;
        $booking->document_original_name = $overrides['document_original_name'] ?? 'surat.pdf';
        $booking->feedback_token = $overrides['feedback_token'] ?? 'fb_'.bin2hex(random_bytes(8));
        $booking->submitted_at = $overrides['submitted_at'] ?? now();
        $booking->save();

        return $booking->fresh();
    }
}
