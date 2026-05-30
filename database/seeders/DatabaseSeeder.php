<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $seeders = [
            FaqSeeder::class,
            FooterContactSeeder::class,
            WaTemplateSeeder::class,
            SiteSettingSeeder::class,
        ];

        if (! app()->environment('production')) {
            array_unshift($seeders, UserSeeder::class);
        }

        $this->call($seeders);
    }
}
