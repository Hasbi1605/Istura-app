<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Wraps the array shape produced by ScheduleService::buildHorizon(); the source
 * data is already a plain array so this simply forwards it. Resource exists so
 * the controller has a consistent JSON envelope alongside the others.
 */
class VisitDayResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'date' => $this->resource['date'],
            'label' => $this->resource['label'],
            'short' => $this->resource['short'],
            'closureReason' => $this->resource['closureReason'] ?? null,
            'holiday' => $this->resource['holiday'] ?? null,
            'slots' => $this->resource['slots'],
        ];
    }
}
