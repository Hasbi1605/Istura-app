<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FaqResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->slug,
            'question' => $this->question,
            'answer' => $this->answer,
            'category' => $this->category,
            'link' => $this->link_label && $this->link_href ? [
                'label' => $this->link_label,
                'href' => $this->link_href,
            ] : null,
        ];
    }
}
