<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\Public\CancelOpenRegistrationRequest;
use App\Http\Requests\Public\LookupOpenRegistrationRequest;
use App\Http\Requests\Public\PrecheckOpenRegistrationRequest;
use App\Http\Requests\Public\StoreOpenRegistrationRequest;
use App\Models\OpenEvent;
use App\Models\OpenRegistration;
use App\Services\OpenRegistrationService;
use App\Support\PublicCache;
use Illuminate\Http\JsonResponse;

class OpenRegistrationController extends Controller
{
    public function __construct(private readonly OpenRegistrationService $service) {}

    /**
     * Active event summary for public surfaces (popup, banner, wizard).
     * Never exposes WhatsApp group links.
     */
    public function show(): JsonResponse
    {
        $event = $this->service->activeEvent();

        if (! $event || ! $event->registrationWindowOpen()) {
            return $this->publicJson(['data' => null]);
        }

        return $this->publicJson([
            'data' => $this->publicEventPayload($event),
        ]);
    }

    public function precheck(PrecheckOpenRegistrationRequest $request): JsonResponse
    {
        $event = $this->requireActiveEvent();

        $result = $this->service->precheck($event, $request->validated('nik'), $request->validated('whatsapp'));

        return response()->json(['data' => $result]);
    }

    public function store(StoreOpenRegistrationRequest $request): JsonResponse
    {
        $event = $this->requireActiveEvent();

        $registration = $this->service->register($event, $request->validated(), $request);

        return response()->json([
            'data' => $this->successPayload($registration),
        ], 201);
    }

    public function lookup(LookupOpenRegistrationRequest $request): JsonResponse
    {
        $event = $this->requireActiveEvent();

        $registration = $this->service->lookupByIdentity(
            $event,
            $request->validated('nik'),
            $request->validated('whatsapp'),
        );

        if (! $registration) {
            return response()->json(['data' => null]);
        }

        return response()->json(['data' => $this->successPayload($registration)]);
    }

    public function cancel(CancelOpenRegistrationRequest $request): JsonResponse
    {
        $event = $this->requireActiveEvent();

        $registration = $this->service->lookupByIdentity(
            $event,
            $request->validated('nik'),
            $request->validated('whatsapp'),
        );

        if (! $registration) {
            return response()->json([
                'message' => 'Pendaftaran tidak ditemukan untuk NIK dan WhatsApp tersebut.',
            ], 404);
        }

        $this->service->cancel($registration, null, $request);

        return response()->json(['data' => ['cancelled' => true]]);
    }

    private function requireActiveEvent(): OpenEvent
    {
        $event = $this->service->activeEvent();

        abort_if($event === null || ! $event->registrationWindowOpen(), 404, 'Tidak ada event Istura Open yang aktif.');

        return $event;
    }

    private function publicEventPayload(OpenEvent $event): array
    {
        $quota = collect($this->service->quotaSummary($event))->keyBy('dayId');

        return [
            'name' => $event->name,
            'slug' => $event->slug,
            'startDate' => $event->start_date?->toDateString(),
            'endDate' => $event->end_date?->toDateString(),
            'maxAddons' => (int) $event->max_addons,
            'agreementText' => $event->agreement_text,
            'posterUrl' => $event->posterUrl(),
            'promoSubtitle' => $event->promo_subtitle,
            'bannerText' => $event->banner_text,
            'days' => $event->days
                ->map(function ($day) use ($quota) {
                    $summary = $quota->get($day->id);

                    return [
                        'id' => $day->id,
                        'date' => $day->date?->toDateString(),
                        'quota' => $summary['quota'] ?? $day->effectiveQuota($day->event),
                        'used' => $summary['used'] ?? 0,
                        'remaining' => $summary['remaining'] ?? 0,
                        'isOpen' => $summary['isOpen'] ?? false,
                    ];
                })
                ->values()
                ->all(),
        ];
    }

    private function successPayload(OpenRegistration $registration): array
    {
        $registration->loadMissing('day');

        return [
            'code' => $registration->code,
            'status' => $registration->status,
            'dayDate' => $registration->day?->date?->toDateString(),
            'headcount' => (int) $registration->headcount,
            'members' => is_array($registration->members) ? array_values($registration->members) : [],
            'whatsappGroupUrl' => $registration->day?->whatsapp_group_url,
        ];
    }

    private function publicJson(array $payload): JsonResponse
    {
        return response()
            ->json($payload)
            ->withHeaders(PublicCache::publicHeaders(0));
    }
}
