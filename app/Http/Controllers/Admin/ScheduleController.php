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
use App\Support\PublicCache;
use Carbon\CarbonPeriod;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class ScheduleController extends Controller
{
    public function __construct(private readonly ScheduleService $service) {}

    public function index(ScheduleRangeRequest $request): JsonResponse
    {
        Gate::authorize('viewAny', ScheduleOverride::class);

        $from = $request->startDate();
        $to = $request->endDate();

        $days = $this->service->buildHorizon($from, $to);

        return response()->json([
            'data' => collect($days)->map(fn ($d) => (new VisitDayResource($d))->resolve())->all(),
        ]);
    }

    public function storeSlot(StoreScheduleSlotRequest $request): JsonResponse
    {
        Gate::authorize('update', ScheduleOverride::class);

        $data = $request->validated();

        $override = $this->upsertOverride(
            $data['date'],
            $data['time'],
            ['status' => $data['status'], 'custom' => true, 'note' => $data['note'] ?? null],
        );

        PublicCache::bumpScheduleVersion();
        ScheduleUpdated::dispatch($data['date'], $data['date']);

        AuditLogger::record($request->user(), "Mengubah slot jadwal {$data['date']} {$data['time']}", ScheduleOverride::class, $override->id, [
            'date' => $data['date'],
            'time' => $data['time'],
            'status' => $data['status'],
        ], $request);

        return response()->json(['data' => $override]);
    }

    public function destroySlot(DestroyScheduleSlotRequest $request): JsonResponse
    {
        Gate::authorize('delete', ScheduleOverride::class);

        $data = $request->validated();

        $deleted = ScheduleOverride::whereDate('date', $data['date'])
            ->where('time', $data['time'])
            ->delete();

        PublicCache::bumpScheduleVersion();
        ScheduleUpdated::dispatch($data['date'], $data['date']);

        AuditLogger::record($request->user(), "Menghapus override slot {$data['date']} {$data['time']}", ScheduleOverride::class, null, [
            'date' => $data['date'],
            'time' => $data['time'],
            'deleted' => $deleted,
        ], $request);

        return response()->json(['ok' => true]);
    }

    public function storeRange(StoreScheduleRangeRequest $request): JsonResponse
    {
        Gate::authorize('update', ScheduleOverride::class);

        $data = $request->validated();
        $weekdays = array_map('intval', $data['weekdays'] ?? []);
        $times = isset($data['time']) && $data['time']
            ? [$data['time']]
            : $this->rangeTimes($data['from'], $data['to']);

        DB::transaction(function () use ($data, $weekdays, $times) {
            $now = now();
            $rows = [];

            foreach (CarbonPeriod::create($data['from'], '1 day', $data['to']) as $cursor) {
                if ($weekdays !== [] && ! in_array($cursor->dayOfWeek, $weekdays, true)) {
                    continue;
                }

                foreach ($times as $time) {
                    $rows[] = [
                        'date' => $cursor->copy()->startOfDay()->toDateTimeString(),
                        'time' => $time,
                        'status' => $data['status'],
                        'custom' => true,
                        'note' => $data['note'] ?? null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }

            if ($rows !== []) {
                ScheduleOverride::upsert($rows, ['date', 'time'], ['status', 'custom', 'note', 'updated_at']);
            }
        });

        PublicCache::bumpScheduleVersion();
        ScheduleUpdated::dispatch($data['from'], $data['to']);

        AuditLogger::record($request->user(), "Mengubah rentang jadwal {$data['from']} sampai {$data['to']}", ScheduleOverride::class, null, [
            'from' => $data['from'],
            'to' => $data['to'],
            'time' => $data['time'] ?? null,
            'status' => $data['status'],
            'weekdays' => $weekdays,
        ], $request);

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
