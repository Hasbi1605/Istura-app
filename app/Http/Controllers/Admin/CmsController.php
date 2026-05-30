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
use App\Support\SiteContentDefaults;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

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
        'image' => '/assets/contoh-kop-surat.png',
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

        return $this->hero();
    }

    public function letter(): JsonResponse
    {
        return response()->json(['data' => SiteSetting::read('letter', self::LETTER_DEFAULT)]);
    }

    public function updateLetter(UpdateLetterRequest $request): JsonResponse
    {
        $current = SiteSetting::read('letter', self::LETTER_DEFAULT);
        $value = [
            'checklist' => array_values($request->validated('checklist')),
            'image' => $current['image'] ?? self::LETTER_DEFAULT['image'],
        ];

        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('letter', 'public');
            $value['image'] = Storage::disk('public')->url($path);
        }

        SiteSetting::write('letter', $value);

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

        return $this->siteContent();
    }
}
