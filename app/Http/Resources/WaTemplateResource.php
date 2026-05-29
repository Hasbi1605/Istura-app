<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WaTemplateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->status_key,
            'label' => $this->label,
            'description' => $this->description,
            'template' => $this->template,
        ];
    }
}
