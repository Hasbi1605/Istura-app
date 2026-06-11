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
use App\Services\CmsImageService;
use App\Support\PublicCache;
use App\Support\SiteContentDefaults;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class CmsController extends Controller
{
    public function __construct(private readonly CmsImageService $cmsImages) {}

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

        try {
            if ($request->hasFile('image')) {
                $newImagePath = $this->cmsImages->storePublicWebp($request->file('image'), 'letter', 'image', 1400, 1800);
                $value['image'] = Storage::disk('public')->url($newImagePath);
            }

            if ($request->hasFile('rulesImage')) {
                $newRulesImagePath = $this->cmsImages->storePublicWebp($request->file('rulesImage'), 'letter', 'rulesImage', 1400, 1800);
                $value['rulesImage'] = Storage::disk('public')->url($newRulesImagePath);
            }

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
        $value = $request->validated();
        unset(
            $value['content'],
            $value['activityImages'],
            $value['navLogo'],
            $value['footerLogo'],
            $value['ctaBackground'],
        );

        $current = SiteContentDefaults::mergeSiteContent(SiteSetting::read('site_content'));
        $newImagePaths = [];

        try {
            $siteImages = [
                'navLogo' => ['target' => 'nav.logoSrc', 'directory' => 'cms/branding/nav', 'width' => 1600, 'height' => 800, 'transparent' => true],
                'footerLogo' => ['target' => 'footer.logoSrc', 'directory' => 'cms/branding/footer', 'width' => 1600, 'height' => 800, 'transparent' => true],
                'ctaBackground' => ['target' => 'cta.backgroundImage', 'directory' => 'cms/cta', 'width' => 1920, 'height' => 1920, 'transparent' => false],
            ];

            foreach ($siteImages as $field => $config) {
                $image = $request->file($field);
                if (! $image instanceof UploadedFile) {
                    continue;
                }

                $newPath = $this->cmsImages->storePublicWebp(
                    $image,
                    $config['directory'],
                    $field,
                    $config['width'],
                    $config['height'],
                    $config['transparent'],
                );
                $newImagePaths[] = $newPath;
                data_set($value, $config['target'], Storage::disk('public')->url($newPath));
            }

            $activityImages = $request->file('activityImages', []);
            foreach (is_array($activityImages) ? $activityImages : [] as $index => $image) {
                if (! $image instanceof UploadedFile) {
                    continue;
                }

                $itemIndex = (int) $index;
                $newPath = $this->cmsImages->storePublicWebp(
                    $image,
                    'cms/activities',
                    "activityImages.{$index}",
                    1920,
                    1920,
                );
                $newImagePaths[] = $newPath;
                $value['activities']['items'][$itemIndex]['image'] = Storage::disk('public')->url($newPath);
            }

            SiteSetting::write('site_content', $value);
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($newImagePaths);

            throw $exception;
        }

        Storage::disk('public')->delete(array_values(array_diff(
            $this->managedSiteContentImagePaths($current),
            $this->managedSiteContentImagePaths($value),
        )));

        AuditLogger::record($request->user(), 'Memperbarui konten landing page', SiteSetting::class, 'site_content', [
            'activity_images_updated' => count(array_filter((array) $request->file('activityImages', []))),
            'nav_logo_updated' => $request->hasFile('navLogo'),
            'footer_logo_updated' => $request->hasFile('footerLogo'),
            'cta_background_updated' => $request->hasFile('ctaBackground'),
        ], $request);
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

    private function managedPublicDiskPathFromUrl(?string $url, string $directory): ?string
    {
        $path = $this->publicDiskPathFromUrl($url);
        $prefix = trim($directory, '/').'/';

        return $path && str_starts_with($path, $prefix) ? $path : null;
    }

    /**
     * @return array<int, string>
     */
    private function managedSiteContentImagePaths(array $content): array
    {
        $paths = [];
        $fixedImages = [
            ['value' => $content['nav']['logoSrc'] ?? null, 'directory' => 'cms/branding/nav'],
            ['value' => $content['footer']['logoSrc'] ?? null, 'directory' => 'cms/branding/footer'],
            ['value' => $content['cta']['backgroundImage'] ?? null, 'directory' => 'cms/cta'],
        ];

        foreach ($fixedImages as $image) {
            $path = $this->managedPublicDiskPathFromUrl($image['value'], $image['directory']);
            if ($path) {
                $paths[] = $path;
            }
        }

        foreach ($content['activities']['items'] ?? [] as $item) {
            $path = $this->managedPublicDiskPathFromUrl($item['image'] ?? null, 'cms/activities');
            if ($path) {
                $paths[] = $path;
            }
        }

        return array_values(array_unique($paths));
    }
}
