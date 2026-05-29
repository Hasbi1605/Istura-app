<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\FaqResource;
use App\Http\Resources\FooterContactResource;
use App\Http\Resources\VisitDayResource;
use App\Http\Resources\WaTemplateResource;
use App\Models\Faq;
use App\Models\FooterContact;
use App\Models\WaTemplate;
use App\Services\ScheduleService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    public function schedule(Request $request, ScheduleService $service): JsonResponse
    {
        $from = $request->date('from') ?? Carbon::today('Asia/Jakarta');
        $to = $request->date('to') ?? $from->copy()->addMonths(2);

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
}
