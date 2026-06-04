<?php

namespace Tests\Feature;

use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminCmsLetterImageTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_letter_image_upload_is_stored_as_webp(): void
    {
        Storage::fake('public');
        $this->actingAsAdmin();

        $this->postJson('/api/admin/cms/letter', [
            'checklist' => ['Kop surat resmi.', 'Tanggal kunjungan jelas.'],
            'rulesDescription' => 'Teks tata tertib baru yang cukup panjang untuk lulus validasi.',
            'image' => UploadedFile::fake()->image('contoh-surat.png', 1200, 1600)->size(400),
        ])->assertOk()
            ->assertJsonPath('data.checklist.0', 'Kop surat resmi.');

        $letter = SiteSetting::read('letter');
        $this->assertStringStartsWith('/storage/letter/', $letter['image']);
        $this->assertStringEndsWith('.webp', $letter['image']);

        $storedPath = ltrim(str_replace('/storage/', '', $letter['image']), '/');
        Storage::disk('public')->assertExists($storedPath);
    }

    public function test_admin_letter_image_upload_rejects_svg(): void
    {
        Storage::fake('public');
        $this->actingAsAdmin();

        $this->postJson('/api/admin/cms/letter', [
            'checklist' => ['Kop surat resmi.'],
            'rulesDescription' => 'Teks tata tertib baru yang cukup panjang untuk lulus validasi.',
            'image' => UploadedFile::fake()->createWithContent(
                'contoh-surat.svg',
                '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>',
            ),
        ])->assertStatus(422)
            ->assertJsonValidationErrors('image');

        Storage::disk('public')->assertMissing('letter/contoh-surat.svg');
    }

    public function test_admin_letter_image_upload_rejects_large_dimensions_before_decode(): void
    {
        Storage::fake('public');
        $this->actingAsAdmin();

        $this->postJson('/api/admin/cms/letter', [
            'checklist' => ['Kop surat resmi.'],
            'rulesDescription' => 'Teks tata tertib baru yang cukup panjang untuk lulus validasi.',
            'image' => UploadedFile::fake()->createWithContent(
                'contoh-surat.png',
                $this->pngWithDimensions(12000, 12000),
            ),
        ])->assertStatus(422)
            ->assertJsonValidationErrors('image');

        $this->assertEmpty(Storage::disk('public')->files('letter'));
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
            'two_factor_verified' => true,
        ]);

        return $admin;
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
