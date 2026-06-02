<?php

namespace Tests\Feature;

use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicBootstrapTest extends TestCase
{
    use RefreshDatabase;

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
}
