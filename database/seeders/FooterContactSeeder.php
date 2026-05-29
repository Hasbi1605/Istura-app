<?php

namespace Database\Seeders;

use App\Models\FooterContact;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class FooterContactSeeder extends Seeder
{
    public function run(): void
    {
        $items = json_decode(file_get_contents(database_path('seeders/data/footer_contacts.json')), true);

        foreach ($items as $index => $item) {
            $slug = Str::slug($item['label']);
            FooterContact::updateOrCreate(
                ['slug' => $slug],
                [
                    'label' => $item['label'],
                    'value' => $item['value'],
                    'icon' => $item['iconKey'],
                    'href' => $item['href'] ?? null,
                    'sort_order' => $index,
                ],
            );
        }
    }
}
