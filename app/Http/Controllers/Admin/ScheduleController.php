<?php

namespace App\Http\Controllers\Admin;

use App\Events\ScheduleUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DestroyScheduleSlotRequest;
use App\Http\Requests\Admin\StoreScheduleRangeRequest;
use App\Http\Requests\Admin\StoreScheduleSlotRequest;
use App\Http\Requests\ScheduleRangeRequest;
use App\Http\Resources\VisitDayResource;
use App\Models\ScheduleOverride;
use App\Services\AuditLogger;
use App\Services\ScheduleService;
use Carbon\CarbonPeriod;
use Illuminate\Database\QueryException;
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

        ScheduleUpdated::dispatch($data['date'], $data['date']);

        AuditLogger::record($request->user(), "Mengubah slot jadwal {$data['date']} {$data['time']}", ScheduleOverride::class, $override->id, [
            'date' => $data['date'],
            'time' => $data['time'],
            'status' => $data['status'],
        ]);

        return response()->json(['data' => $override]);
    }

    public function destroySlot(DestroyScheduleSlotRequest $request): JsonResponse
    {
        $data = $request->validated();

        $deleted = ScheduleOverride::whereDate('date', $data['date'])
            ->where('time', $data['time'])
            ->delete();

        ScheduleUpdated::dispatch($data['date'], $data['date']);

        AuditLogger::record($request->user(), "Menghapus override slot {$data['date']} {$data['time']}", ScheduleOverride::class, null, [
            'date' => $data['date'],
            'time' => $data['time'],
            'deleted' => $deleted,
        ]);

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

        ScheduleUpdated::dispatch($data['from'], $data['to']);

        AuditLogger::record($request->user(), "Mengubah rentang jadwal {$data['from']} sampai {$data['to']}", ScheduleOverride::class, null, [
            'from' => $data['from'],
            'to' => $data['to'],
            'time' => $data['time'] ?? null,
            'status' => $data['status'],
            'weekdays' => $weekdays,
        ]);

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

        try {
            return ScheduleOverride::create(array_merge([
                'date' => $date,
                'time' => $time,
            ], $values));
        } catch (QueryException $exception) {
            $override = ScheduleOverride::whereDate('date', $date)
                ->where('time', $time)
                ->first();

            if (! $override) {
                throw $exception;
            }

            $override->fill($values);
            $override->save();

            return $override;
        }
    }
}
