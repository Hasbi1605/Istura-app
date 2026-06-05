<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateFaqsRequest;
use App\Http\Requests\Admin\UpdateFooterContactsRequest;
use App\Http\Requests\Admin\UpdateHeroRequest;
use App\Http\Requests\Admin\UpdateLetterRequest;
use App\Http\Requests\Admin\UpdateSiteContentRequest;
use App\Http\Requests\Admin\UpdateWaTemplatesRequest;
use App\Http\Resources\FaqResource;
use App\Http\Resources\FooterContactResource;
use App\Http\Resources\WaTemplateResource;
use App\Models\Faq;
use App\Models\FooterContact;
use App\Models\SiteSetting;
use App\Models\WaTemplate;
use App\Services\AuditLogger;
use App\Support\PublicCache;
use App\Support\SiteContentDefaults;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class CmsController extends Controller
{
    public function faqs(): JsonResponse
    {
        return response()->json(['data' => FaqResource::collection(Faq::orderBy('sort_order')->get())->resolve()]);
    }

    public function updateFaqs(UpdateFaqsRequest $request): JsonResponse
    {
        $items = $request->validated('items');

        DB::transaction(function () use ($items) {
            $slugs = collect($items)->pluck('id');
            Faq::whereNotIn('slug', $slugs)->delete();
            foreach ($items as $index => $item) {
                $link = $item['link'] ?? [];
                Faq::updateOrCreate(
                    ['slug' => $item['id']],
                    [
                        'question' => $item['question'],
                        'answer' => $item['answer'],
                        'category' => $item['category'] ?? null,
                        'link_label' => $link['label'] ?? null,
                        'link_href' => $link['href'] ?? null,
                        'sort_order' => $index,
                    ],
                );
            }
        });

        AuditLogger::record($request->user(), 'Memperbarui FAQ publik', Faq::class, null, [
            'count' => count($items),
        ], $request);
        PublicCache::forgetCms('faqs');

        return $this->faqs();
    }

    public function contacts(): JsonResponse
    {
        return response()->json(['data' => FooterContactResource::collection(FooterContact::orderBy('sort_order')->get())->resolve()]);
    }

    public function updateContacts(UpdateFooterContactsRequest $request): JsonResponse
    {
        $items = $request->validated('items');

        DB::transaction(function () use ($items) {
            $slugs = collect($items)->pluck('id');
            FooterContact::whereNotIn('slug', $slugs)->delete();
            foreach ($items as $index => $item) {
                FooterContact::updateOrCreate(
                    ['slug' => $item['id']],
                    [
                        'label' => $item['label'],
                        'value' => $item['value'],
                        'href' => $item['href'] ?? null,
                        'icon' => $item['iconKey'],
                        'sort_order' => $index,
                    ],
                );
            }
        });

        AuditLogger::record($request->user(), 'Memperbarui kontak footer publik', FooterContact::class, null, [
            'count' => count($items),
        ], $request);
        PublicCache::forgetCms('contacts');

        return $this->contacts();
    }

    public function waTemplates(): JsonResponse
    {
        return response()->json(['data' => WaTemplateResource::collection(WaTemplate::orderBy('id')->get())->resolve()]);
    }

    public function updateWaTemplates(UpdateWaTemplatesRequest $request): JsonResponse
    {
        $items = $request->validated('items');
        $userId = $request->user()?->id;

        DB::transaction(function () use ($items, $userId) {
            foreach ($items as $item) {
                WaTemplate::updateOrCreate(
                    ['status_key' => $item['id']],
                    [
                        'label' => $item['label'],
                        'description' => $item['description'],
                        'template' => $item['template'],
                        'updated_by' => $userId,
                    ],
                );
            }
        });

        AuditLogger::record($request->user(), 'Memperbarui template WhatsApp', WaTemplate::class, null, [
            'statuses' => collect($items)->pluck('id')->values()->all(),
        ], $request);
        PublicCache::forgetCms('wa-templates');

        return $this->waTemplates();
    }

    // ---- Hero & story ----------------------------------------------------

    private const HERO_DEFAULT = [
        'headline' => 'ISTURA - Istana Untuk Rakyat',
        'subheadline' => 'Booking Kunjungan Istana Kepresidenan Yogyakarta',
        'primaryCta' => 'Mulai Booking',
        'secondaryCta' => 'Cek Jadwal',
        'story' => 'Pilih jadwal, isi data, unggah surat, lalu tunggu konfirmasi WhatsApp.',
    ];

    private const LETTER_DEFAULT = [
        'image' => '/assets/contoh-kop-surat.webp',
        'checklist' => [
            'Kop surat resmi instansi atau organisasi.',
            'Perihal permohonan kunjungan dan tujuan surat yang jelas.',
            'Tanggal, waktu, jumlah peserta, nama koordinator, NIK, dan nomor HP.',
            'Tanda tangan kepala instansi atau penanggung jawab.',
        ],
        'rulesImage' => '/assets/peraturan-kunjungan.webp',
        'rulesDescription' => 'Setiap rombongan diwajibkan untuk memahami dan menaati seluruh peraturan tata tertib fisik kunjungan demi kenyamanan bersama dan menjaga kehormatan lingkungan Istana Kepresidenan Yogyakarta.',
        'rulesList' => [
            'Berpakaian sopan, rapi, bersepatu',
            'Dilarang menggunakan kaos oblong, celana jeans, dan celana pendek',
            'Dilarang membawa makanan & minuman',
            'Dilarang parkir dalam Istana',
            'HP dan kamera profesional dititipkan koordinator kunjungan',
            'Dilarang mengambil gambar di dalam museum dan area dalam gedung induk',
            'Kunjungan akan didokumentasikan pihak istana dan link akan dikirimkan melalui koordinator kunjungan',
            'Dimohon mengisi kuisoner dan penilaian',
        ],
    ];

    public function hero(): JsonResponse
    {
        return response()->json(['data' => SiteSetting::read('hero', self::HERO_DEFAULT)]);
    }

    public function updateHero(UpdateHeroRequest $request): JsonResponse
    {
        SiteSetting::write('hero', $request->validated());

        AuditLogger::record($request->user(), 'Memperbarui konten hero', SiteSetting::class, 'hero', request: $request);
        PublicCache::forgetCms('hero');

        return $this->hero();
    }

    // ---- Letter & rules --------------------------------------------------

    public function letter(): JsonResponse
    {
        return response()->json(['data' => SiteSetting::read('letter', self::LETTER_DEFAULT)]);
    }

    public function updateLetter(UpdateLetterRequest $request): JsonResponse
    {
        $current = SiteSetting::read('letter', self::LETTER_DEFAULT);
        $oldImagePath = $this->publicDiskPathFromUrl($current['image'] ?? null);
        $oldRulesImagePath = $this->publicDiskPathFromUrl($current['rulesImage'] ?? null);
        $newImagePath = null;
        $newRulesImagePath = null;

        $value = [
            'checklist' => array_values($request->validated('checklist')),
            'image' => $current['image'] ?? self::LETTER_DEFAULT['image'],
            'rulesDescription' => $request->validated('rulesDescription'),
            'rulesImage' => $current['rulesImage'] ?? self::LETTER_DEFAULT['rulesImage'],
            'rulesList' => $current['rulesList'] ?? self::LETTER_DEFAULT['rulesList'],
        ];

        if ($request->hasFile('image')) {
            $newImagePath = $this->storeOptimizedLetterImage($request->file('image'), 'image');
            $value['image'] = Storage::disk('public')->url($newImagePath);
        }

        if ($request->hasFile('rulesImage')) {
            $newRulesImagePath = $this->storeOptimizedLetterImage($request->file('rulesImage'), 'rulesImage');
            $value['rulesImage'] = Storage::disk('public')->url($newRulesImagePath);
        }

        try {
            SiteSetting::write('letter', $value);
        } catch (Throwable $exception) {
            if ($newImagePath) {
                Storage::disk('public')->delete($newImagePath);
            }
            if ($newRulesImagePath) {
                Storage::disk('public')->delete($newRulesImagePath);
            }

            throw $exception;
        }

        if ($newImagePath && $oldImagePath && $oldImagePath !== $newImagePath) {
            Storage::disk('public')->delete($oldImagePath);
        }
        if ($newRulesImagePath && $oldRulesImagePath && $oldRulesImagePath !== $newRulesImagePath) {
            Storage::disk('public')->delete($oldRulesImagePath);
        }

        AuditLogger::record($request->user(), 'Memperbarui ketentuan kunjungan (surat & tata tertib)', SiteSetting::class, 'letter', [
            'checklist_count' => count($value['checklist']),
            'description_updated' => true,
            'image_updated' => $request->hasFile('image'),
            'rules_image_updated' => $request->hasFile('rulesImage'),
        ], $request);
        PublicCache::forgetCms('letter');

        return $this->letter();
    }

    public function siteContent(): JsonResponse
    {
        return response()->json([
            'data' => SiteContentDefaults::mergeSiteContent(SiteSetting::read('site_content')),
        ]);
    }

    public function updateSiteContent(UpdateSiteContentRequest $request): JsonResponse
    {
        SiteSetting::write('site_content', $request->validated());

        AuditLogger::record($request->user(), 'Memperbarui konten landing page', SiteSetting::class, 'site_content', request: $request);
        PublicCache::forgetCms('site-content');

        return $this->siteContent();
    }

    private function publicDiskPathFromUrl(?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        $path = parse_url($url, PHP_URL_PATH) ?: $url;
        if (! str_starts_with($path, '/storage/')) {
            return null;
        }

        $relativePath = ltrim(substr($path, strlen('/storage/')), '/');

        return $relativePath !== '' ? $relativePath : null;
    }

    private function storeOptimizedLetterImage(UploadedFile $image, string $attribute = 'image'): string
    {
        $realPath = $this->validatedLetterImagePath($image, $attribute);

        if (! function_exists('imagecreatefromstring') || ! function_exists('imagewebp')) {
            throw ValidationException::withMessages([
                $attribute => 'Server belum mendukung konversi gambar ke WebP.',
            ]);
        }

        $sourceBytes = file_get_contents($realPath);
        if ($sourceBytes === false) {
            throw ValidationException::withMessages([
                $attribute => 'Gambar tidak dapat dibaca.',
            ]);
        }

        $source = @imagecreatefromstring($sourceBytes);
        if (! $source instanceof \GdImage) {
            throw ValidationException::withMessages([
                $attribute => 'Gambar tidak dapat diproses.',
            ]);
        }

        $target = null;
        $tmpPath = null;

        try {
            $sourceWidth = imagesx($source);
            $sourceHeight = imagesy($source);
            $scale = min(1, 1400 / max(1, $sourceWidth), 1800 / max(1, $sourceHeight));
            $targetWidth = max(1, (int) round($sourceWidth * $scale));
            $targetHeight = max(1, (int) round($sourceHeight * $scale));
            $target = imagecreatetruecolor($targetWidth, $targetHeight);
            if (! $target instanceof \GdImage) {
                throw ValidationException::withMessages([
                    $attribute => 'Gambar tidak dapat diproses.',
                ]);
            }

            $white = imagecolorallocate($target, 255, 255, 255);
            if ($white === false || ! imagefill($target, 0, 0, $white)) {
                throw ValidationException::withMessages([
                    $attribute => 'Gambar tidak dapat diproses.',
                ]);
            }

            if (! imagecopyresampled($target, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $sourceWidth, $sourceHeight)) {
                throw ValidationException::withMessages([
                    $attribute => 'Gambar tidak dapat diproses.',
                ]);
            }

            $tmpPath = tempnam(sys_get_temp_dir(), 'istura-letter-');
            if (! is_string($tmpPath) || ! imagewebp($target, $tmpPath, 82)) {
                throw ValidationException::withMessages([
                    $attribute => 'Gambar gagal dikonversi ke WebP.',
                ]);
            }

            $optimizedBytes = file_get_contents($tmpPath);
            if ($optimizedBytes === false) {
                throw ValidationException::withMessages([
                    $attribute => 'Gambar gagal dikonversi ke WebP.',
                ]);
            }

            $path = 'letter/'.Str::uuid().'.webp';
            if (! Storage::disk('public')->put($path, $optimizedBytes)) {
                throw ValidationException::withMessages([
                    $attribute => 'Gambar gagal disimpan.',
                ]);
            }

            return $path;
        } finally {
            imagedestroy($source);

            if ($target instanceof \GdImage) {
                imagedestroy($target);
            }

            if (is_string($tmpPath)) {
                @unlink($tmpPath);
            }
        }
    }

    private function validatedLetterImagePath(UploadedFile $image, string $attribute = 'image'): string
    {
        $realPath = $image->getRealPath();
        if (! is_string($realPath) || $realPath === '') {
            throw ValidationException::withMessages([
                $attribute => 'Gambar tidak dapat dibaca.',
            ]);
        }

        $dimensions = @getimagesize($realPath);
        if (! is_array($dimensions)) {
            throw ValidationException::withMessages([
                $attribute => 'Gambar tidak dapat dibaca.',
            ]);
        }

        $width = (int) ($dimensions[0] ?? 0);
        $height = (int) ($dimensions[1] ?? 0);
        if ($width < 1 || $height < 1) {
            throw ValidationException::withMessages([
                $attribute => 'Gambar tidak dapat dibaca.',
            ]);
        }

        if ($width > UpdateLetterRequest::LETTER_IMAGE_MAX_WIDTH || $height > UpdateLetterRequest::LETTER_IMAGE_MAX_HEIGHT) {
            throw ValidationException::withMessages([
                $attribute => 'Dimensi gambar terlalu besar.',
            ]);
        }

        if ($height > intdiv(UpdateLetterRequest::LETTER_IMAGE_MAX_PIXELS, max(1, $width))) {
            throw ValidationException::withMessages([
                $attribute => 'Total piksel gambar terlalu besar.',
            ]);
        }

        return $realPath;
    }
}
