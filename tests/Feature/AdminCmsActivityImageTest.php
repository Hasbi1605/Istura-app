<?php

namespace Tests\Feature;

use App\Models\SiteSetting;
use App\Models\User;
use App\Services\TwoFactorService;
use App\Support\SiteContentDefaults;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminCmsActivityImageTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_upload_nav_footer_and_cta_images_as_webp(): void
    {
        Storage::fake('public');
        $this->actingAsAdmin();

        $content = SiteContentDefaults::siteContent();
        $response = $this->post('/api/admin/cms/site-content', [
            'content' => json_encode($content, JSON_THROW_ON_ERROR),
            'navLogo' => UploadedFile::fake()->image('nav-logo.png', 1200, 500)->size(300),
            'footerLogo' => UploadedFile::fake()->image('footer-logo.png', 1200, 500)->size(300),
            'ctaBackground' => UploadedFile::fake()->image('cta.jpg', 1800, 1000)->size(500),
        ]);

        $response->assertOk();

        $stored = SiteSetting::read('site_content');
        $images = [
            'cms/branding/nav/' => $stored['nav']['logoSrc'],
            'cms/branding/footer/' => $stored['footer']['logoSrc'],
            'cms/cta/' => $stored['cta']['backgroundImage'],
        ];

        foreach ($images as $directory => $url) {
            $this->assertStringStartsWith('/storage/'.$directory, $url);
            $this->assertStringEndsWith('.webp', $url);
            Storage::disk('public')->assertExists($this->publicDiskPath($url));
        }
    }

    public function test_admin_can_update_public_wizard_copy_in_site_content(): void
    {
        $this->actingAsAdmin();

        $content = SiteContentDefaults::siteContent();
        $content['bookingWizard']['steps'][0]['title'] = 'Halo Rencang Istana';
        $content['bookingWizard']['fields']['contactNameLabel'] = 'Nama Koordinator';
        $content['feedbackWizard']['intro'] = 'Bagikan cerita kunjunganmu untuk perbaikan layanan.';
        $content['feedbackWizard']['options']['highlights'][0] = 'Sambutan petugas';

        $this->putJson('/api/admin/cms/site-content', $content)
            ->assertOk()
            ->assertJsonPath('data.bookingWizard.steps.0.title', 'Halo Rencang Istana')
            ->assertJsonPath('data.bookingWizard.fields.contactNameLabel', 'Nama Koordinator')
            ->assertJsonPath('data.feedbackWizard.intro', 'Bagikan cerita kunjunganmu untuk perbaikan layanan.')
            ->assertJsonPath('data.feedbackWizard.options.highlights.0', 'Sambutan petugas');

        $this->getJson('/api/public/bootstrap')
            ->assertOk()
            ->assertJsonPath('data.siteContent.bookingWizard.steps.0.title', 'Halo Rencang Istana')
            ->assertJsonPath('data.siteContent.feedbackWizard.options.highlights.0', 'Sambutan petugas');
    }

    public function test_replacing_nav_logo_deletes_only_previous_managed_nav_logo(): void
    {
        Storage::fake('public');
        $this->actingAsAdmin();

        $content = SiteContentDefaults::siteContent();
        $content['nav']['logoSrc'] = '/storage/cms/branding/nav/old.webp';
        $content['footer']['logoSrc'] = '/storage/cms/branding/footer/keep.webp';
        $content['cta']['backgroundImage'] = '/storage/cms/cta/keep.webp';
        SiteSetting::write('site_content', $content);
        Storage::disk('public')->put('cms/branding/nav/old.webp', 'old-nav');
        Storage::disk('public')->put('cms/branding/footer/keep.webp', 'footer');
        Storage::disk('public')->put('cms/cta/keep.webp', 'cta');

        $this->post('/api/admin/cms/site-content', [
            'content' => json_encode($content, JSON_THROW_ON_ERROR),
            'navLogo' => UploadedFile::fake()->image('replacement.png', 1200, 500)->size(300),
        ])->assertOk();

        $stored = SiteSetting::read('site_content');
        Storage::disk('public')->assertMissing('cms/branding/nav/old.webp');
        Storage::disk('public')->assertExists($this->publicDiskPath($stored['nav']['logoSrc']));
        Storage::disk('public')->assertExists('cms/branding/footer/keep.webp');
        Storage::disk('public')->assertExists('cms/cta/keep.webp');
    }

    public function test_invalid_fixed_site_image_rejects_whole_save_without_partial_files(): void
    {
        Storage::fake('public');
        $this->actingAsAdmin();

        $content = SiteContentDefaults::siteContent();
        SiteSetting::write('site_content', $content);

        $this->post('/api/admin/cms/site-content', [
            'content' => json_encode($content, JSON_THROW_ON_ERROR),
            'navLogo' => UploadedFile::fake()->image('valid.png', 1200, 500)->size(300),
            'ctaBackground' => UploadedFile::fake()->createWithContent(
                'oversized.png',
                $this->pngWithDimensions(12000, 12000),
            ),
        ])->assertStatus(422)
            ->assertJsonValidationErrors('ctaBackground');

        $this->assertSame($content, SiteSetting::read('site_content'));
        $this->assertEmpty(Storage::disk('public')->allFiles('cms'));
    }

    public function test_admin_can_replace_multiple_activity_images_and_store_them_as_webp(): void
    {
        Storage::fake('public');
        $this->actingAsAdmin();

        $content = SiteContentDefaults::siteContent();
        $response = $this->post('/api/admin/cms/site-content', [
            'content' => json_encode($content, JSON_THROW_ON_ERROR),
            'activityImages' => [
                0 => UploadedFile::fake()->image('penyambutan.png', 1200, 800)->size(400),
                2 => UploadedFile::fake()->image('museum.jpg', 1400, 900)->size(450),
            ],
        ]);

        $response->assertOk();

        $stored = SiteSetting::read('site_content');
        $firstImage = $stored['activities']['items'][0]['image'];
        $thirdImage = $stored['activities']['items'][2]['image'];

        $this->assertStringStartsWith('/storage/cms/activities/', $firstImage);
        $this->assertStringEndsWith('.webp', $firstImage);
        $this->assertStringStartsWith('/storage/cms/activities/', $thirdImage);
        $this->assertStringEndsWith('.webp', $thirdImage);
        $this->assertSame('/assets/cerita-sejarah-gedung-agung.webp', $stored['activities']['items'][1]['image']);

        Storage::disk('public')->assertExists($this->publicDiskPath($firstImage));
        Storage::disk('public')->assertExists($this->publicDiskPath($thirdImage));
        $this->assertCount(2, Storage::disk('public')->files('cms/activities'));
    }

    public function test_replacing_activity_image_deletes_only_the_previous_managed_file(): void
    {
        Storage::fake('public');
        $this->actingAsAdmin();

        $content = SiteContentDefaults::siteContent();
        $content['activities']['items'][0]['image'] = '/storage/cms/activities/old.webp';
        SiteSetting::write('site_content', $content);
        Storage::disk('public')->put('cms/activities/old.webp', 'old-image');

        $this->post('/api/admin/cms/site-content', [
            'content' => json_encode($content, JSON_THROW_ON_ERROR),
            'activityImages' => [
                0 => UploadedFile::fake()->image('replacement.png', 1200, 800)->size(400),
            ],
        ])->assertOk();

        $stored = SiteSetting::read('site_content');
        $newImage = $stored['activities']['items'][0]['image'];

        Storage::disk('public')->assertMissing('cms/activities/old.webp');
        Storage::disk('public')->assertExists($this->publicDiskPath($newImage));
        $this->assertSame('/assets/cerita-sejarah-gedung-agung.webp', $stored['activities']['items'][1]['image']);
    }

    public function test_managed_image_is_preserved_while_another_panel_still_references_it(): void
    {
        Storage::fake('public');
        $this->actingAsAdmin();

        $content = SiteContentDefaults::siteContent();
        $content['activities']['items'][0]['image'] = '/storage/cms/activities/shared.webp';
        $content['activities']['items'][1]['image'] = '/storage/cms/activities/shared.webp';
        SiteSetting::write('site_content', $content);
        Storage::disk('public')->put('cms/activities/shared.webp', 'shared-image');

        $this->post('/api/admin/cms/site-content', [
            'content' => json_encode($content, JSON_THROW_ON_ERROR),
            'activityImages' => [
                0 => UploadedFile::fake()->image('replacement.png', 1200, 800)->size(400),
            ],
        ])->assertOk();

        Storage::disk('public')->assertExists('cms/activities/shared.webp');
        $this->assertSame(
            '/storage/cms/activities/shared.webp',
            SiteSetting::read('site_content')['activities']['items'][1]['image'],
        );
    }

    public function test_deleting_activity_panel_cleans_up_its_unreferenced_managed_image(): void
    {
        Storage::fake('public');
        $this->actingAsAdmin();

        $content = SiteContentDefaults::siteContent();
        $content['activities']['items'][0]['image'] = '/storage/cms/activities/removed.webp';
        SiteSetting::write('site_content', $content);
        Storage::disk('public')->put('cms/activities/removed.webp', 'removed-image');

        array_shift($content['activities']['items']);

        $this->putJson('/api/admin/cms/site-content', $content)->assertOk();

        Storage::disk('public')->assertMissing('cms/activities/removed.webp');
        $this->assertCount(3, SiteSetting::read('site_content')['activities']['items']);
    }

    public function test_invalid_activity_image_rejects_the_whole_save_without_storing_partial_files(): void
    {
        Storage::fake('public');
        $this->actingAsAdmin();

        $content = SiteContentDefaults::siteContent();
        SiteSetting::write('site_content', $content);

        $this->post('/api/admin/cms/site-content', [
            'content' => json_encode($content, JSON_THROW_ON_ERROR),
            'activityImages' => [
                0 => UploadedFile::fake()->image('valid.png', 1200, 800)->size(400),
                1 => UploadedFile::fake()->createWithContent(
                    'oversized.png',
                    $this->pngWithDimensions(12000, 12000),
                ),
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('activityImages.1');

        $this->assertSame($content, SiteSetting::read('site_content'));
        $this->assertEmpty(Storage::disk('public')->files('cms/activities'));
    }

    public function test_activity_image_index_must_match_an_existing_panel(): void
    {
        Storage::fake('public');
        $this->actingAsAdmin();

        $content = SiteContentDefaults::siteContent();

        $this->post('/api/admin/cms/site-content', [
            'content' => json_encode($content, JSON_THROW_ON_ERROR),
            'activityImages' => [
                7 => UploadedFile::fake()->image('orphan.png', 1200, 800)->size(400),
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('activityImages.7');

        $this->assertEmpty(Storage::disk('public')->files('cms/activities'));
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'two_factor_confirmed_at' => now(),
        ]);

        $this->actingAs($admin);
        $this->withHeader('Accept', 'application/json');
        $this->withHeader('Origin', 'http://localhost');
        $this->withSession([
            'admin_session_started_at' => now()->timestamp,
            TwoFactorService::VERIFIED_USER_ID_SESSION_KEY => $admin->id,
        ]);

        return $admin;
    }

    private function publicDiskPath(string $url): string
    {
        return ltrim(str_replace('/storage/', '', $url), '/');
    }

    private function pngWithDimensions(int $width, int $height): string
    {
        return "\x89PNG\r\n\x1a\n"
            .$this->pngChunk('IHDR', pack('NNCCCCC', $width, $height, 8, 2, 0, 0, 0))
            .$this->pngChunk('IEND', '');
    }

    private function pngChunk(string $type, string $data): string
    {
        return pack('N', strlen($data)).$type.$data.pack('N', crc32($type.$data));
    }
}
