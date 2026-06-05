<?php

use App\Support\PublicCache;
use App\Support\SiteContentDefaults;
use App\Models\SiteSetting;
use Illuminate\Support\Facades\Route;

// Halaman info server-rendered (ber-OG-tag) untuk preview link WhatsApp.
// HARUS didefinisikan sebelum catch-all SPA agar tidak diserahkan ke React —
// crawler WA tidak menjalankan JS, jadi OG tag wajib ada di HTML awal.
Route::get('/info/alur-kunjungan', function () {
    // Ambil lokasi dari sumber yang sama dengan footer SPA (CMS) supaya
    // alamat & link maps konsisten saat admin mengubahnya.
    $footer = PublicCache::rememberCms(
        'site-content',
        fn () => SiteContentDefaults::mergeSiteContent(SiteSetting::read('site_content')),
    )['footer'] ?? [];

    return view('info.visit-flow', [
        'mapUrl' => $footer['mapUrl'] ?? null,
        'address' => $footer['address'] ?? null,
    ]);
})->name('info.visit-flow');

// SPA shell — semua rute non-API diserahkan ke React (state-based router).
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '^(?!api).*$');
