<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreScheduleRangeRequest;
use App\Http\Requests\Admin\StoreScheduleSlotRequest;
use App\Http\Resources\VisitDayResource;
use App\Models\ScheduleOverride;
use App\Services\ScheduleService;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ScheduleController extends Controller
{
    public function __construct(private readonly ScheduleService $service) {}

    public function index(Request $request): JsonResponse
    {
        $from = $request->date('from') ?? Carbon::today('Asia/Jakarta');
        $to = $request->date('to') ?? $from->copy()->addMonths(2);

        $days = $this->service->buildHorizon($from, $to);

        return response()->json([
            'data' => collect($days)->map(fn ($d) => (new VisitDayResource($d))->resolve())->all(),
        ]);
    }

    public function storeSlot(StoreScheduleSlotRequest $request): JsonResponse
    {
        $data = $request->validated();

        $override = ScheduleOverride::updateOrCreate(
            ['date' => $data['date'], 'time' => $data['time']],
            ['status' => $data['status'], 'custom' => true, 'note' => $data['note'] ?? null],
        );

        return response()->json(['data' => $override]);
    }

    public function destroySlot(Request $request): JsonResponse
    {
        $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'time' => ['required', 'string', 'regex:/^\d{2}\.\d{2}$/'],
        ]);

        ScheduleOverride::where('date', $request->date('date'))
            ->where('time', $request->string('time')->value())
            ->delete();

        return response()->json(['ok' => true]);
    }

    public function storeRange(StoreScheduleRangeRequest $request): JsonResponse
    {
        $data = $request->validated();
        $weekdays = $data['weekdays'] ?? [];
        $times = $data['time'] ? [$data['time']] : ScheduleService::TIME_SLOTS;

        DB::transaction(function () use ($data, $weekdays, $times) {
            foreach (CarbonPeriod::create($data['from'], '1 day', $data['to']) as $cursor) {
                if ($weekdays !== [] && ! in_array($cursor->dayOfWeek, $weekdays, true)) {
                    continue;
                }
                foreach ($times as $time) {
                    ScheduleOverride::updateOrCreate(
                        ['date' => $cursor->toDateString(), 'time' => $time],
                        ['status' => $data['status'], 'custom' => true, 'note' => $data['note'] ?? null],
                    );
                }
            }
        });

        return response()->json(['ok' => true]);
    }
}
