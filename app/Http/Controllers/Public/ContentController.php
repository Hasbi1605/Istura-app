<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\ScheduleRangeRequest;
use App\Http\Resources\FaqResource;
use App\Http\Resources\FooterContactResource;
use App\Http\Resources\PublicVisitDayResource;
use App\Http\Resources\WaTemplateResource;
use App\Models\Faq;
use App\Models\FooterContact;
use App\Models\SiteSetting;
use App\Models\WaTemplate;
use App\Services\ScheduleService;
use App\Support\PublicCache;
use App\Support\SiteContentDefaults;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class ContentController extends Controller
{
    public function bootstrap(ScheduleRangeRequest $request, ScheduleService $service): JsonResponse
    {
        [$from, $to] = $this->scheduleRange($request);

        return $this->publicJson([
            'data' => [
                'schedule' => $this->scheduleData($from, $to, $service),
                'faqs' => $this->faqsData(),
                'contacts' => $this->contactsData(),
                'waTemplates' => $this->waTemplatesData(),
                'hero' => $this->heroData(),
                'letter' => $this->letterData(),
                'siteContent' => $this->siteContentData(),
            ],
        ], PublicCache::BOOTSTRAP_BROWSER_TTL);
    }

    public function faqs(): JsonResponse
    {
        return $this->publicJson(['data' => $this->faqsData()], PublicCache::CMS_BROWSER_TTL);
    }

    public function contacts(): JsonResponse
    {
        return $this->publicJson(['data' => $this->contactsData()], PublicCache::CMS_BROWSER_TTL);
    }

    public function schedule(ScheduleRangeRequest $request, ScheduleService $service): JsonResponse
    {
        [$from, $to] = $this->scheduleRange($request);

        return $this->publicJson([
            'data' => $this->scheduleData($from, $to, $service),
        ], PublicCache::SCHEDULE_BROWSER_TTL);
    }

    public function waTemplate(string $status): JsonResponse
    {
        $template = WaTemplate::where('status_key', $status)->firstOrFail();

        return $this->publicJson([
            'data' => (new WaTemplateResource($template))->resolve(),
        ], PublicCache::CMS_BROWSER_TTL);
    }

    public function waTemplates(): JsonResponse
    {
        return $this->publicJson(['data' => $this->waTemplatesData()], PublicCache::CMS_BROWSER_TTL);
    }

    public function hero(): JsonResponse
    {
        return $this->publicJson(['data' => $this->heroData()], PublicCache::CMS_BROWSER_TTL);
    }

    public function letter(): JsonResponse
    {
        return $this->publicJson(['data' => $this->letterData()], PublicCache::CMS_BROWSER_TTL);
    }

    public function siteContent(): JsonResponse
    {
        return $this->publicJson(['data' => $this->siteContentData()], PublicCache::CMS_BROWSER_TTL);
    }

    private function faqsData(): array
    {
        return PublicCache::rememberCms('faqs', fn () => FaqResource::collection(Faq::orderBy('sort_order')->get())->resolve());
    }

    private function contactsData(): array
    {
        return PublicCache::rememberCms('contacts', fn () => FooterContactResource::collection(FooterContact::orderBy('sort_order')->get())->resolve());
    }

    private function scheduleData(Carbon $from, Carbon $to, ScheduleService $service): array
    {
        return PublicCache::rememberSchedule(
            $from->toDateString(),
            $to->toDateString(),
            fn () => collect($service->buildHorizon($from, $to))->map(fn ($d) => (new PublicVisitDayResource($d))->resolve())->all(),
        );
    }

    private function waTemplatesData(): array
    {
        return PublicCache::rememberCms('wa-templates', fn () => WaTemplateResource::collection(WaTemplate::orderBy('id')->get())->resolve());
    }

    private function heroData(): array
    {
        return PublicCache::rememberCms('hero', fn () => SiteSetting::read('hero', [
            'headline' => 'ISTURA - Istana Untuk Rakyat',
            'subheadline' => 'Booking Kunjungan Istana Kepresidenan Yogyakarta',
            'primaryCta' => 'Mulai Booking',
            'secondaryCta' => 'Cek Jadwal',
            'story' => 'Pilih jadwal, isi data, unggah surat, lalu tunggu konfirmasi WhatsApp.',
        ]));
    }

    private function letterData(): array
    {
        return PublicCache::rememberCms('letter', fn () => SiteSetting::read('letter', [
            'image' => '/assets/contoh-kop-surat.webp',
            'checklist' => [
                'Kop surat resmi instansi atau organisasi.',
                'Perihal permohonan kunjungan dan tujuan surat yang jelas.',
                'Tanggal, waktu, jumlah peserta, nama koordinator, NIK, dan nomor HP.',
                'Tanda tangan kepala instansi atau penanggung jawab.',
            ],
        ]));
    }

    private function siteContentData(): array
    {
        return PublicCache::rememberCms('site-content', fn () => SiteContentDefaults::mergeSiteContent(SiteSetting::read('site_content')));
    }

    /**
     * @return array{0:Carbon,1:Carbon}
     */
    private function scheduleRange(ScheduleRangeRequest $request): array
    {
        return [$request->startDate(), $request->endDate()];
    }

    private function publicJson(array $payload, int $browserTtl): JsonResponse
    {
        return response()
            ->json($payload)
            ->withHeaders(PublicCache::publicHeaders($browserTtl));
    }
}
