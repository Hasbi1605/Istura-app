<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DestroyScheduleSlotRequest;
use App\Http\Requests\Admin\StoreScheduleRangeRequest;
use App\Http\Requests\Admin\StoreScheduleSlotRequest;
use App\Http\Requests\ScheduleRangeRequest;
use App\Http\Resources\VisitDayResource;
use App\Models\ScheduleOverride;
use App\Services\ScheduleService;
use Carbon\CarbonPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ScheduleController extends Controller
{
    public function __construct(private readonly ScheduleService $service) {}

    public function index(ScheduleRangeRequest $request): JsonResponse
    {
        $from = $request->startDate();
        $to = $request->endDate();

        $days = $this->service->buildHorizon($from, $to);

        return response()->json([
            'data' => collect($days)->map(fn ($d) => (new VisitDayResource($d))->resolve())->all(),
        ]);
    }

    public function storeSlot(StoreScheduleSlotRequest $request): JsonResponse
    {
        $data = $request->validated();

        $override = $this->upsertOverride(
            $data['date'],
            $data['time'],
            ['status' => $data['status'], 'custom' => true, 'note' => $data['note'] ?? null],
        );

        return response()->json(['data' => $override]);
    }

    public function destroySlot(DestroyScheduleSlotRequest $request): JsonResponse
    {
        $data = $request->validated();

        ScheduleOverride::whereDate('date', $data['date'])
            ->where('time', $data['time'])
            ->delete();

        return response()->json(['ok' => true]);
    }

    public function storeRange(StoreScheduleRangeRequest $request): JsonResponse
    {
        $data = $request->validated();
        $weekdays = $data['weekdays'] ?? [];
        $times = isset($data['time']) && $data['time']
            ? [$data['time']]
            : $this->rangeTimes($data['from'], $data['to']);

        DB::transaction(function () use ($data, $weekdays, $times) {
            foreach (CarbonPeriod::create($data['from'], '1 day', $data['to']) as $cursor) {
                if ($weekdays !== [] && ! in_array($cursor->dayOfWeek, $weekdays, true)) {
                    continue;
                }
                foreach ($times as $time) {
                    $this->upsertOverride(
                        $cursor->toDateString(),
                        $time,
                        ['status' => $data['status'], 'custom' => true, 'note' => $data['note'] ?? null],
                    );
                }
            }
        });

        return response()->json(['ok' => true]);
    }

    private function rangeTimes(string $from, string $to): array
    {
        return collect(ScheduleService::TIME_SLOTS)
            ->merge(
                ScheduleOverride::whereDate('date', '>=', $from)
                    ->whereDate('date', '<=', $to)
                    ->pluck('time'),
            )
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    private function upsertOverride(string $date, string $time, array $values): ScheduleOverride
    {
        $override = ScheduleOverride::whereDate('date', $date)
            ->where('time', $time)
            ->first();

        if ($override) {
            $override->fill($values);
            $override->save();

            return $override;
        }

        return ScheduleOverride::create(array_merge([
            'date' => $date,
            'time' => $time,
        ], $values));
    }
}
