<?php

namespace Database\Seeders;

use App\Models\Faq;
use App\Support\PublicCache;
use Illuminate\Database\Seeder;

class FaqSeeder extends Seeder
{
    public function run(): void
    {
        $items = json_decode(file_get_contents(database_path('seeders/data/faqs.json')), true);

        foreach ($items as $index => $item) {
            Faq::updateOrCreate(
                ['slug' => $item['id']],
                [
                    'question' => $item['question'],
                    'answer' => $item['answer'],
                    'category' => $item['category'] ?? null,
                    'link_label' => $item['link']['label'] ?? null,
                    'link_href' => $item['link']['href'] ?? null,
                    'sort_order' => $index,
                ],
            );
        }

        PublicCache::forgetCms('faqs');
    }
}
