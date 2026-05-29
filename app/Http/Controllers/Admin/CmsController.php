<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateFaqsRequest;
use App\Http\Requests\Admin\UpdateFooterContactsRequest;
use App\Http\Requests\Admin\UpdateWaTemplatesRequest;
use App\Http\Resources\FaqResource;
use App\Http\Resources\FooterContactResource;
use App\Http\Resources\WaTemplateResource;
use App\Models\Faq;
use App\Models\FooterContact;
use App\Models\WaTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class CmsController extends Controller
{
    public function faqs(): JsonResponse
    {
        return response()->json(['data' => FaqResource::collection(Faq::orderBy('sort_order')->get())->resolve()]);
    }

    public function updateFaqs(UpdateFaqsRequest $request): JsonResponse
    {
        $items = $request->validated('items');

        DB::transaction(function () use ($items) {
            $slugs = collect($items)->pluck('id');
            Faq::whereNotIn('slug', $slugs)->delete();
            foreach ($items as $index => $item) {
                Faq::updateOrCreate(
                    ['slug' => $item['id']],
                    [
                        'question' => $item['question'],
                        'answer' => $item['answer'],
                        'category' => $item['category'] ?? null,
                        'sort_order' => $index,
                    ],
                );
            }
        });

        return $this->faqs();
    }

    public function contacts(): JsonResponse
    {
        return response()->json(['data' => FooterContactResource::collection(FooterContact::orderBy('sort_order')->get())->resolve()]);
    }

    public function updateContacts(UpdateFooterContactsRequest $request): JsonResponse
    {
        $items = $request->validated('items');

        DB::transaction(function () use ($items) {
            $slugs = collect($items)->pluck('id');
            FooterContact::whereNotIn('slug', $slugs)->delete();
            foreach ($items as $index => $item) {
                FooterContact::updateOrCreate(
                    ['slug' => $item['id']],
                    [
                        'label' => $item['label'],
                        'value' => $item['value'],
                        'href' => $item['href'] ?? null,
                        'icon' => $item['iconKey'],
                        'sort_order' => $index,
                    ],
                );
            }
        });

        return $this->contacts();
    }

    public function waTemplates(): JsonResponse
    {
        return response()->json(['data' => WaTemplateResource::collection(WaTemplate::orderBy('id')->get())->resolve()]);
    }

    public function updateWaTemplates(UpdateWaTemplatesRequest $request): JsonResponse
    {
        $items = $request->validated('items');
        $userId = $request->user()?->id;

        DB::transaction(function () use ($items, $userId) {
            foreach ($items as $item) {
                WaTemplate::updateOrCreate(
                    ['status_key' => $item['id']],
                    [
                        'label' => $item['label'],
                        'description' => $item['description'],
                        'template' => $item['template'],
                        'updated_by' => $userId,
                    ],
                );
            }
        });

        return $this->waTemplates();
    }
}
