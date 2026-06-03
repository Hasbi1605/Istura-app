<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicVisitDayResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'date' => $this->resource['date'],
            'label' => $this->resource['label'],
            'short' => $this->resource['short'],
            'closureReason' => $this->resource['closureReason'] ?? null,
            'holiday' => $this->resource['holiday'] ?? null,
            'slots' => collect($this->resource['slots'])->map(fn (array $slot) => [
                'time' => $slot['time'],
                'status' => $slot['status'],
                'custom' => $slot['custom'],
                'closureReason' => $slot['closureReason'] ?? null,
            ])->all(),
        ];
    }
}
