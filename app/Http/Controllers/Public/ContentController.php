<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\ScheduleRangeRequest;
use App\Http\Resources\FaqResource;
use App\Http\Resources\FooterContactResource;
use App\Http\Resources\VisitDayResource;
use App\Http\Resources\WaTemplateResource;
use App\Models\Faq;
use App\Models\FooterContact;
use App\Models\SiteSetting;
use App\Models\WaTemplate;
use App\Services\ScheduleService;
use App\Support\SiteContentDefaults;
use Illuminate\Http\JsonResponse;

class ContentController extends Controller
{
    public function faqs(): JsonResponse
    {
        return response()->json([
            'data' => FaqResource::collection(Faq::orderBy('sort_order')->get())->resolve(),
        ]);
    }

    public function contacts(): JsonResponse
    {
        return response()->json([
            'data' => FooterContactResource::collection(FooterContact::orderBy('sort_order')->get())->resolve(),
        ]);
    }

    public function schedule(ScheduleRangeRequest $request, ScheduleService $service): JsonResponse
    {
        $from = $request->startDate();
        $to = $request->endDate();

        $days = $service->buildHorizon($from, $to);

        return response()->json([
            'data' => collect($days)->map(fn ($d) => (new VisitDayResource($d))->resolve())->all(),
        ]);
    }

    public function waTemplate(string $status): JsonResponse
    {
        $template = WaTemplate::where('status_key', $status)->firstOrFail();

        return response()->json([
            'data' => (new WaTemplateResource($template))->resolve(),
        ]);
    }

    public function waTemplates(): JsonResponse
    {
        return response()->json([
            'data' => WaTemplateResource::collection(WaTemplate::orderBy('id')->get())->resolve(),
        ]);
    }

    public function hero(): JsonResponse
    {
        return response()->json([
            'data' => SiteSetting::read('hero', [
                'headline' => 'ISTURA - Istana Untuk Rakyat',
                'subheadline' => 'Booking Kunjungan Istana Kepresidenan Yogyakarta',
                'primaryCta' => 'Mulai Booking',
                'secondaryCta' => 'Cek Jadwal',
                'story' => 'Pilih jadwal, isi data, unggah surat, lalu tunggu konfirmasi WhatsApp.',
            ]),
        ]);
    }

    public function letter(): JsonResponse
    {
        return response()->json([
            'data' => SiteSetting::read('letter', [
                'image' => '/assets/contoh-kop-surat.png',
                'checklist' => [
                    'Kop surat resmi instansi atau organisasi.',
                    'Perihal permohonan kunjungan dan tujuan surat yang jelas.',
                    'Tanggal, waktu, jumlah peserta, nama koordinator, NIK, dan nomor HP.',
                    'Tanda tangan kepala instansi atau penanggung jawab.',
                ],
            ]),
        ]);
    }

    public function siteContent(): JsonResponse
    {
        return response()->json([
            'data' => SiteContentDefaults::mergeSiteContent(SiteSetting::read('site_content')),
        ]);
    }
}
