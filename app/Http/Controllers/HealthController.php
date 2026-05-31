<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $checks = [
            'database' => false,
            'cache' => false,
        ];

        try {
            DB::select('select 1');
            $checks['database'] = true;

            $cacheKey = 'health:'.Str::random(12);
            $cacheValue = Str::random(12);
            Cache::put($cacheKey, $cacheValue, 10);
            $checks['cache'] = Cache::get($cacheKey) === $cacheValue;
            Cache::forget($cacheKey);
        } catch (Throwable $exception) {
            Log::warning('Health check failed.', [
                'error' => $exception->getMessage(),
            ]);
        }

        $healthy = ! in_array(false, $checks, true);

        return response()->json([
            'status' => $healthy ? 'ok' : 'degraded',
            'checks' => $checks,
        ], $healthy ? 200 : 503);
    }
}
