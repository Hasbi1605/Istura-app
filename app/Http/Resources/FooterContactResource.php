<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FooterContactResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->slug,
            'label' => $this->label,
            'value' => $this->value,
            'href' => $this->href,
            'iconKey' => $this->icon,
        ];
    }
}
