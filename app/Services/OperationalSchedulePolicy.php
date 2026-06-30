<?php

namespace App\Services;

use App\Models\SiteSetting;
use Carbon\Carbon;

class OperationalSchedulePolicy
{
    public const SETTING_KEY = 'schedule_policy';

    private const DEFAULT_OPEN_WEEKDAYS = [1, 2, 3, 4, 5];

    private const DEFAULT_CLOSED_LABELS = [
        '0' => 'Akhir pekan',
        '6' => 'Akhir pekan',
    ];

    private const WEEKDAY_LABELS = [
        0 => 'Minggu',
        1 => 'Senin',
        2 => 'Selasa',
        3 => 'Rabu',
        4 => 'Kamis',
        5 => 'Jumat',
        6 => 'Sabtu',
    ];

    private const DISPLAY_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

    private ?array $policy = null;

    public function read(): array
    {
        return $this->policy ??= $this->normalize(SiteSetting::read(self::SETTING_KEY, self::defaults()));
    }

    public function payload(): array
    {
        $policy = $this->read();

        return [
            'openWeekdays' => $policy['openWeekdays'],
            'closedLabels' => $policy['closedLabels'],
            'weekdayOptions' => collect(self::DISPLAY_DAY_ORDER)
                ->map(fn (int $weekday): array => [
                    'value' => $weekday,
                    'label' => self::WEEKDAY_LABELS[$weekday],
                    'isOpen' => in_array($weekday, $policy['openWeekdays'], true),
                    'closedLabel' => $policy['closedLabels'][(string) $weekday],
                ])
                ->values()
                ->all(),
        ];
    }

    public function update(array $value): array
    {
        $this->policy = $this->normalize($value);
        SiteSetting::write(self::SETTING_KEY, $this->policy);

        return $this->payload();
    }

    public function isOperationalDay(Carbon $date): bool
    {
        return in_array($date->dayOfWeek, $this->read()['openWeekdays'], true);
    }

    public function closureReasonFor(Carbon $date): ?array
    {
        if ($this->isOperationalDay($date)) {
            return null;
        }

        $label = $this->read()['closedLabels'][(string) $date->dayOfWeek] ?? 'Libur operasional';

        return [
            'type' => 'operational_closed',
            'name' => $label,
            'label' => $label,
            'tentative' => false,
        ];
    }

    public static function defaults(): array
    {
        return [
            'openWeekdays' => self::DEFAULT_OPEN_WEEKDAYS,
            'closedLabels' => self::normalizedClosedLabels(self::DEFAULT_CLOSED_LABELS),
        ];
    }

    private function normalize(array $value): array
    {
        $openWeekdays = collect($value['openWeekdays'] ?? self::DEFAULT_OPEN_WEEKDAYS)
            ->map(fn ($weekday): int => (int) $weekday)
            ->filter(fn (int $weekday): bool => $weekday >= 0 && $weekday <= 6)
            ->unique()
            ->sortBy(fn (int $weekday): int => array_search($weekday, self::DISPLAY_DAY_ORDER, true))
            ->values()
            ->all();

        if ($openWeekdays === []) {
            $openWeekdays = self::DEFAULT_OPEN_WEEKDAYS;
        }

        return [
            'openWeekdays' => $openWeekdays,
            'closedLabels' => self::normalizedClosedLabels($value['closedLabels'] ?? []),
        ];
    }

    private static function normalizedClosedLabels(array $value): array
    {
        $labels = [];

        foreach (range(0, 6) as $weekday) {
            $key = (string) $weekday;
            $label = trim((string) ($value[$key] ?? $value[$weekday] ?? self::DEFAULT_CLOSED_LABELS[$key] ?? 'Libur operasional'));
            $labels[$key] = $label !== '' ? $label : 'Libur operasional';
        }

        return $labels;
    }
}
