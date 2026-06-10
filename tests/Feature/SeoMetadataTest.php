<?php

namespace Tests\Feature;

use App\Models\Faq;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeoMetadataTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-06-10 08:00:00', 'Asia/Jakarta'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_home_page_renders_crawlable_seo_metadata_and_content(): void
    {
        Faq::create([
            'slug' => 'faq-biaya',
            'question' => 'Apakah kunjungan ISTURA gratis?',
            'answer' => 'Ya. ISTURA tidak dipungut biaya.',
            'sort_order' => 1,
        ]);

        $response = $this->get('/');

        $response->assertOk();
        $response->assertSee('<title>ISTURA Yogyakarta - Booking Kunjungan Istana Kepresidenan Gedung Agung</title>', false);
        $response->assertSee('<meta name="description" content="Daftar kunjungan ISTURA Gedung Agung Yogyakarta secara online. Cek jadwal, syarat surat permohonan, tata tertib, dan konfirmasi WhatsApp." />', false);
        $response->assertSee('<link rel="canonical" href="https://www.isturaiky.page/" />', false);
        $response->assertSee('<script type="application/ld+json">', false);
        $response->assertSee('"@type": "FAQPage"', false);
        $response->assertSee('Booking Kunjungan Istana Kepresidenan Yogyakarta');
        $response->assertSee('Jadwal Kunjungan ISTURA');
        $response->assertSee('Apakah kunjungan ISTURA gratis?');
    }

    public function test_sitemap_xml_lists_canonical_public_urls(): void
    {
        $response = $this->get('/sitemap.xml');

        $response->assertOk();
        $this->assertStringContainsString('application/xml', (string) $response->headers->get('Content-Type'));
        $response->assertSee('<?xml version="1.0" encoding="UTF-8"?>', false);
        $response->assertSee('<loc>https://www.isturaiky.page/</loc>', false);
        $response->assertSee('<loc>https://www.isturaiky.page/info/alur-kunjungan</loc>', false);
        $response->assertSee('<lastmod>2026-06-10</lastmod>', false);
    }

    public function test_robots_allows_ai_search_and_gemini_grounding_but_disallows_training_crawlers(): void
    {
        $response = $this->get('/robots.txt');

        $response->assertOk();
        $this->assertStringContainsString('text/plain', (string) $response->headers->get('Content-Type'));
        $response->assertSee('Content-Signal: search=yes,ai-input=yes,ai-train=no');
        $response->assertSee("User-agent: OAI-SearchBot\nAllow: /", false);
        $response->assertSee("User-agent: Google-Extended\nAllow: /", false);
        $response->assertSee("User-agent: GPTBot\nDisallow: /", false);
        $response->assertSee('Sitemap: https://www.isturaiky.page/sitemap.xml');
    }

    public function test_public_home_redirects_from_bare_domain_to_canonical_www_host(): void
    {
        config([
            'seo.redirect_to_canonical' => true,
            'seo.redirect_hosts' => ['isturaiky.page'],
        ]);

        $this->call('GET', 'https://isturaiky.page/?utm_source=test')
            ->assertStatus(301)
            ->assertHeader('Location', 'https://www.isturaiky.page/?utm_source=test');
    }
}
