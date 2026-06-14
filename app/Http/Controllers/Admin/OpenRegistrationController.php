<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\MoveOpenRegistrationRequest;
use App\Http\Resources\OpenRegistrationResource;
use App\Models\OpenEvent;
use App\Models\OpenEventDay;
use App\Models\OpenRegistration;
use App\Services\OpenRegistrationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class OpenRegistrationController extends Controller
{
    public function __construct(private readonly OpenRegistrationService $service) {}

    public function index(Request $request, OpenEvent $event): JsonResponse
    {
        $query = $event->registrations()->with('day');
        $countsQuery = $event->registrations();

        if ($dayId = $request->integer('dayId')) {
            $query->where('assigned_event_day_id', $dayId);
        }

        if ($status = $request->string('status')->toString()) {
            if ($status === 'Registered') {
                $query->whereIn('status', OpenRegistration::ACTIVE_STATUSES);
            } else {
                $query->where('status', $status);
            }
        }

        if ($search = trim($request->string('search')->toString())) {
            $query->where(function ($q) use ($search) {
                $q->where('contact_name', 'like', "%{$search}%")
                    ->orWhere('whatsapp', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $registrations = $query->orderByDesc('id')->paginate(25);

        return response()->json([
            'data' => OpenRegistrationResource::collection($registrations->items())->resolve(),
            'meta' => [
                'currentPage' => $registrations->currentPage(),
                'lastPage' => $registrations->lastPage(),
                'perPage' => $registrations->perPage(),
                'total' => $registrations->total(),
                'counts' => [
                    'total' => (clone $countsQuery)->count(),
                    'registered' => (clone $countsQuery)->whereIn('status', OpenRegistration::ACTIVE_STATUSES)->count(),
                    'cancelled' => (clone $countsQuery)->where('status', 'Cancelled')->count(),
                ],
            ],
        ]);
    }

    public function move(MoveOpenRegistrationRequest $request, OpenEvent $event, string $code): JsonResponse
    {
        $this->ensureOperationallyMutable($event);

        $registration = $this->resolveRegistration($event, $code);
        $targetDay = OpenEventDay::where('open_event_id', $event->id)
            ->whereKey($request->integer('dayId'))
            ->firstOrFail();

        $registration = $this->service->move(
            $registration,
            $targetDay,
            $request->user(),
            (bool) $request->boolean('allowOverbook'),
            $request->input('note'),
            $request,
        );

        return response()->json([
            'data' => (new OpenRegistrationResource($registration))->resolve(),
        ]);
    }

    public function cancel(Request $request, OpenEvent $event, string $code): JsonResponse
    {
        $this->ensureOperationallyMutable($event);

        $registration = $this->resolveRegistration($event, $code);

        $registration = $this->service->cancel($registration, $request->user(), $request);

        return response()->json([
            'data' => (new OpenRegistrationResource($registration))->resolve(),
        ]);
    }

    private function resolveRegistration(OpenEvent $event, string $code): OpenRegistration
    {
        return OpenRegistration::where('open_event_id', $event->id)
            ->where('code', $code)
            ->with(['day', 'event'])
            ->firstOrFail();
    }

    private function ensureOperationallyMutable(OpenEvent $event): void
    {
        if ($event->isArchived()) {
            throw ValidationException::withMessages([
                'event' => ['Event arsip bersifat baca-saja. Pulihkan arsip sebelum mengubah data operasional.'],
            ]);
        }

        if ($event->isPast()) {
            throw ValidationException::withMessages([
                'event' => ['Event yang sudah lewat bersifat baca-saja untuk mutasi operasional.'],
            ]);
        }
    }
}
