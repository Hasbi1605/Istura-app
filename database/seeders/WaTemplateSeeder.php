<?php

namespace Database\Seeders;

use App\Models\WaTemplate;
use Illuminate\Database\Seeder;

class WaTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $items = json_decode(file_get_contents(database_path('seeders/data/wa_templates.json')), true);

        foreach ($items as $item) {
            WaTemplate::updateOrCreate(
                ['status_key' => $item['id']],
                [
                    'label' => $item['label'],
                    'description' => $item['description'],
                    'template' => $item['template'],
                ],
            );
        }
    }
}
