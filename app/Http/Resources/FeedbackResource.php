<?php

namespace App\Http\Resources;

use App\Services\IndonesianDate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FeedbackResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'code' => $this->code,
            'rating' => (int) $this->rating,
            'bookingEase' => (int) $this->booking_ease,
            'service' => (int) $this->service,
            'recommend' => (int) $this->recommend,
            'highlights' => $this->highlights ?? [],
            'improvements' => $this->improvements ?? [],
            'comment' => $this->comment,
            'allowPublish' => (bool) $this->allow_publish,
            'submittedAt' => $this->submitted_at ? IndonesianDate::submittedAt($this->submitted_at) : null,
        ];
    }
}
