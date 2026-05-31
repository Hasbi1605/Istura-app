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
        ]);
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
        ]);
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
        ]);
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
    ];

    public function hero(): JsonResponse
    {
        return response()->json(['data' => SiteSetting::read('hero', self::HERO_DEFAULT)]);
    }

    public function updateHero(UpdateHeroRequest $request): JsonResponse
    {
        SiteSetting::write('hero', $request->validated());

        AuditLogger::record($request->user(), 'Memperbarui konten hero', SiteSetting::class, 'hero');
        PublicCache::forgetCms('hero');

        return $this->hero();
    }

    public function letter(): JsonResponse
    {
        return response()->json(['data' => SiteSetting::read('letter', self::LETTER_DEFAULT)]);
    }

    public function updateLetter(UpdateLetterRequest $request): JsonResponse
    {
        $current = SiteSetting::read('letter', self::LETTER_DEFAULT);
        $oldImagePath = $this->publicDiskPathFromUrl($current['image'] ?? null);
        $newImagePath = null;
        $value = [
            'checklist' => array_values($request->validated('checklist')),
            'image' => $current['image'] ?? self::LETTER_DEFAULT['image'],
        ];

        if ($request->hasFile('image')) {
            $newImagePath = $this->storeOptimizedLetterImage($request->file('image'));
            $value['image'] = Storage::disk('public')->url($newImagePath);
        }

        try {
            SiteSetting::write('letter', $value);
        } catch (Throwable $exception) {
            if ($newImagePath) {
                Storage::disk('public')->delete($newImagePath);
            }

            throw $exception;
        }

        if ($newImagePath && $oldImagePath && $oldImagePath !== $newImagePath) {
            Storage::disk('public')->delete($oldImagePath);
        }

        AuditLogger::record($request->user(), 'Memperbarui konten contoh surat', SiteSetting::class, 'letter', [
            'checklist_count' => count($value['checklist']),
            'image_updated' => $request->hasFile('image'),
        ]);
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

        AuditLogger::record($request->user(), 'Memperbarui konten landing page', SiteSetting::class, 'site_content');
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

    private function storeOptimizedLetterImage(UploadedFile $image): string
    {
        if (! function_exists('imagecreatefromstring') || ! function_exists('imagewebp')) {
            return $image->store('letter', 'public');
        }

        $sourceBytes = file_get_contents($image->getRealPath());
        if ($sourceBytes === false) {
            return $image->store('letter', 'public');
        }

        $source = @imagecreatefromstring($sourceBytes);
        if (! $source) {
            return $image->store('letter', 'public');
        }

        $sourceWidth = imagesx($source);
        $sourceHeight = imagesy($source);
        $scale = min(1, 1400 / max(1, $sourceWidth), 1800 / max(1, $sourceHeight));
        $targetWidth = max(1, (int) round($sourceWidth * $scale));
        $targetHeight = max(1, (int) round($sourceHeight * $scale));
        $target = imagecreatetruecolor($targetWidth, $targetHeight);

        $white = imagecolorallocate($target, 255, 255, 255);
        imagefill($target, 0, 0, $white);
        imagecopyresampled($target, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $sourceWidth, $sourceHeight);

        $tmpPath = tempnam(sys_get_temp_dir(), 'istura-letter-');
        if (! $tmpPath || ! imagewebp($target, $tmpPath, 82)) {
            imagedestroy($source);
            imagedestroy($target);

            return $image->store('letter', 'public');
        }

        imagedestroy($source);
        imagedestroy($target);

        $path = 'letter/'.Str::uuid().'.webp';
        $optimizedBytes = file_get_contents($tmpPath);
        if ($optimizedBytes === false) {
            @unlink($tmpPath);

            return $image->store('letter', 'public');
        }

        Storage::disk('public')->put($path, $optimizedBytes);
        @unlink($tmpPath);

        return $path;
    }
}
