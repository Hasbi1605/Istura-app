<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\NationalHoliday;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class NationalHolidaySyncService
{
    public const SOURCE = 'guangrei/APIHariLibur_V2';

    /**
     * @param  array<int, int|string>|null  $years
     * @return array{created:int,updated:int,deleted:int,years:array<int,int>,yearsWithProviderData:array<int,int>,missingYears:array<int,int>,conflicts:array<int,array{date:string,count:int}>,providerUpdatedAt:?string,source:string,sourceUrl:string}
     */
    public function sync(?array $years = null): array
    {
        return $this->syncPayload($this->fetchPayload(), $years);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<int, int|string>|null  $years
     * @return array{created:int,updated:int,deleted:int,years:array<int,int>,yearsWithProviderData:array<int,int>,missingYears:array<int,int>,conflicts:array<int,array{date:string,count:int}>,providerUpdatedAt:?string,source:string,sourceUrl:string}
     */
    public function syncPayload(array $payload, ?array $years = null): array
    {
        $years = $this->normalizeYears($years);
        $sourceUrl = (string) config('services.indonesian_holidays.url');
        $providerUpdatedAt = $this->providerUpdatedAt($payload);
        $syncedAt = now();

        $rows = collect($payload)
            ->map(fn (mixed $entry, string|int $dateKey): ?array => $this->rowFromEntry((string) $dateKey, $entry, $years, $sourceUrl, $providerUpdatedAt, $syncedAt))
            ->filter()
            ->values();

        $yearsWithProviderData = $rows->pluck('year')->unique()->sort()->values()->all();
        $missingYears = array_values(array_diff($years, $yearsWithProviderData));
        $syncedDates = $rows->pluck('date')->all();

        $existing = NationalHoliday::where('source', self::SOURCE)
            ->whereIn('year', $yearsWithProviderData)
            ->get()
            ->keyBy(fn (NationalHoliday $holiday): string => $holiday->date->toDateString());

        $created = 0;
        $updated = 0;
        foreach ($rows as $row) {
            $current = $existing->get($row['date']);
            if (! $current) {
                $created++;

                continue;
            }

            if ($current->checksum !== $row['checksum']) {
                $updated++;
            }
        }

        if ($rows->isNotEmpty()) {
            NationalHoliday::upsert(
                $rows->all(),
                ['date'],
                ['year', 'name', 'type', 'tentative', 'source', 'source_url', 'provider_updated_at', 'synced_at', 'checksum', 'updated_at'],
            );
        }

        $deleted = 0;
        if ($yearsWithProviderData !== []) {
            $deleted = NationalHoliday::where('source', self::SOURCE)
                ->whereIn('year', $yearsWithProviderData)
                ->whereNotIn('date', $syncedDates)
                ->delete();
        }

        return [
            'created' => $created,
            'updated' => $updated,
            'deleted' => $deleted,
            'years' => $years,
            'yearsWithProviderData' => $yearsWithProviderData,
            'missingYears' => $missingYears,
            'conflicts' => $this->activeBookingConflicts($syncedDates),
            'providerUpdatedAt' => $providerUpdatedAt?->toIso8601String(),
            'source' => self::SOURCE,
            'sourceUrl' => $sourceUrl,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function fetchPayload(): array
    {
        $url = (string) config('services.indonesian_holidays.url');

        $response = Http::timeout((int) config('services.indonesian_holidays.timeout', 10))
            ->retry(2, 500)
            ->acceptJson()
            ->get($url);

        $response->throw();

        $payload = $response->json();
        if (! is_array($payload)) {
            throw new \RuntimeException('Payload tanggal merah Indonesia tidak valid.');
        }

        return $payload;
    }

    /**
     * @param  array<int, int|string>|null  $years
     * @return array<int, int>
     */
    private function normalizeYears(?array $years): array
    {
        if (! $years) {
            $currentYear = Carbon::today('Asia/Jakarta')->year;

            return [$currentYear, $currentYear + 1];
        }

        return collect($years)
            ->map(fn (int|string $year): int => (int) $year)
            ->filter(fn (int $year): bool => $year >= 2000 && $year <= 2100)
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function providerUpdatedAt(array $payload): ?Carbon
    {
        $updated = data_get($payload, 'info.updated');
        if (! is_string($updated) || trim($updated) === '') {
            return null;
        }

        try {
            return Carbon::createFromFormat('Ymd H:i:s', $updated, 'Asia/Jakarta');
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @param  array<int, int>  $years
     * @return array<string, mixed>|null
     */
    private function rowFromEntry(
        string $dateKey,
        mixed $entry,
        array $years,
        string $sourceUrl,
        ?Carbon $providerUpdatedAt,
        Carbon $syncedAt,
    ): ?array {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateKey)) {
            return null;
        }

        $date = Carbon::createFromFormat('Y-m-d', $dateKey, 'Asia/Jakarta')->startOfDay();
        if (! in_array($date->year, $years, true)) {
            return null;
        }

        $summary = $this->summaryFromEntry($entry);
        if ($summary === null) {
            return null;
        }

        $tentative = Str::contains(Str::lower($summary), 'belum pasti');
        $name = trim((string) preg_replace('/\s*\(belum pasti\)\s*/i', '', $summary));
        $type = Str::startsWith(Str::lower($summary), 'cuti bersama')
            ? NationalHoliday::TYPE_COLLECTIVE_LEAVE
            : NationalHoliday::TYPE_NATIONAL_HOLIDAY;

        $checksum = hash('sha256', json_encode([
            'date' => $dateKey,
            'name' => $name,
            'type' => $type,
            'tentative' => $tentative,
            'source' => self::SOURCE,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

        return [
            'date' => $dateKey,
            'year' => $date->year,
            'name' => $name,
            'type' => $type,
            'tentative' => $tentative,
            'source' => self::SOURCE,
            'source_url' => $sourceUrl,
            'provider_updated_at' => $providerUpdatedAt,
            'synced_at' => $syncedAt,
            'checksum' => $checksum,
            'created_at' => $syncedAt,
            'updated_at' => $syncedAt,
        ];
    }

    private function summaryFromEntry(mixed $entry): ?string
    {
        $summary = is_array($entry) ? ($entry['summary'] ?? null) : null;
        if (is_array($summary)) {
            $summary = $summary[0] ?? null;
        }

        if (! is_string($summary)) {
            return null;
        }

        $summary = trim($summary);

        return $summary === '' ? null : $summary;
    }

    /**
     * @param  array<int, string>  $dates
     * @return array<int, array{date:string,count:int}>
     */
    private function activeBookingConflicts(array $dates): array
    {
        if ($dates === []) {
            return [];
        }

        return Booking::whereIn('date', $dates)
            ->whereIn('status', Booking::ACTIVE_STATUSES)
            ->selectRaw('date, count(*) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row): array => [
                'date' => Carbon::parse($row->date)->toDateString(),
                'count' => (int) $row->count,
            ])
            ->all();
    }
}
