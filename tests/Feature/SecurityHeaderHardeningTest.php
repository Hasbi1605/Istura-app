<?php

namespace Tests\Feature;

use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class SecurityHeaderHardeningTest extends TestCase
{
    public function test_unauthenticated_admin_api_request_without_json_accept_returns_unauthorized(): void
    {
        $this->get('/api/admin/dashboard')
            ->assertUnauthorized()
            ->assertJson([
                'message' => 'Unauthenticated.',
            ]);
    }

    public function test_cors_rejects_untrusted_origins_and_allows_configured_origin(): void
    {
        config(['cors.allowed_origins' => ['https://isturaiky.page', 'https://admin.isturaiky.page']]);

        $this->withHeader('Origin', 'https://evil.example')
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertHeaderMissing('Access-Control-Allow-Origin');

        $this->flushHeaders();

        $this->withHeader('Origin', 'https://isturaiky.page')
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertHeader('Access-Control-Allow-Origin', 'https://isturaiky.page');
    }

    public function test_api_model_not_found_errors_use_generic_json_message(): void
    {
        Route::get('/api/test-model-not-found', function () {
            throw (new ModelNotFoundException)->setModel('App\\Models\\WaTemplate');
        });

        $response = $this->getJson('/api/test-model-not-found')
            ->assertNotFound()
            ->assertJson(['message' => 'Data tidak ditemukan.']);

        $responseBody = $response->getContent();
        $this->assertStringNotContainsString('App\\Models', $responseBody);
        $this->assertStringNotContainsString('WaTemplate', $responseBody);
    }

    public function test_security_txt_is_available_as_static_policy_file(): void
    {
        $path = public_path('.well-known/security.txt');

        $this->assertFileExists($path);

        $contents = (string) file_get_contents($path);
        $this->assertStringContainsString('Contact: https://wa.me/6281160300040', $contents);
        $this->assertStringContainsString('Canonical: https://isturaiky.page/.well-known/security.txt', $contents);
        $this->assertStringContainsString('Preferred-Languages: id, en', $contents);
    }

    public function test_csp_keeps_youtube_maps_and_admin_preview_sources_without_image_wildcard(): void
    {
        config([
            'security.public_image_hosts' => ['cdn.istura.example'],
            'reverb.apps.apps.0.options.host' => 'isturaiky.page',
            'reverb.apps.apps.0.options.port' => 443,
            'reverb.apps.apps.0.options.scheme' => 'https',
        ]);

        $response = $this->get('/')->assertOk();
        $csp = (string) $response->headers->get('Content-Security-Policy');

        $this->assertStringContainsString("img-src 'self' data: blob: https://cdn.istura.example", $csp);
        $this->assertStringNotContainsString("img-src 'self' data: https:", $csp);
        $this->assertStringContainsString('https://www.youtube.com', $csp);
        $this->assertStringContainsString('https://www.youtube-nocookie.com', $csp);
        $this->assertStringContainsString('https://www.google.com', $csp);
        $this->assertStringContainsString('https://maps.google.com', $csp);
        $this->assertStringContainsString("style-src 'self' https://fonts.googleapis.com", $csp);
        $this->assertStringContainsString("style-src-attr 'unsafe-inline'", $csp);
        $this->assertStringContainsString('connect-src \'self\' wss://isturaiky.page:443', $csp);
        $this->assertStringNotContainsString('connect-src \'self\' wss://isturaiky.page:443 ws://isturaiky.page:443', $csp);
    }
}
