<?php

namespace Tests\Feature;

use App\Support\PublicCache;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class PublicHomeCacheTest extends TestCase
{
    public function test_homepage_is_stateless_and_uses_bounded_public_cache_headers(): void
    {
        $response = $this->get('/');

        $response->assertOk()
            ->assertHeader('Cache-Control', 'public, max-age=0, s-maxage=0, must-revalidate');

        $this->assertCount(0, $response->headers->getCookies());
        $this->assertStringNotContainsString('<meta name="csrf-token"', $response->getContent());
        $this->assertIsString(Cache::get('public:html:home'));
    }

    public function test_cms_invalidation_removes_cached_homepage_html(): void
    {
        Cache::put('public:html:home', '<html>stale</html>', now()->addMinutes(5));

        PublicCache::forgetCms('hero');

        $this->assertNull(Cache::get('public:html:home'));
    }
}
