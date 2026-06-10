<?php

use App\Models\SiteSetting;
use App\Support\PublicCache;
use App\Support\SeoMeta;
use App\Support\SiteContentDefaults;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/robots.txt', function () {
    return response(SeoMeta::robotsTxt(), 200, [
        'Content-Type' => 'text/plain; charset=UTF-8',
        'Cache-Control' => 'public, max-age=3600',
    ]);
})->name('robots');

Route::get('/sitemap.xml', function (Request $request) {
    if ($redirect = SeoMeta::canonicalRedirect($request)) {
        return $redirect;
    }

    return response(SeoMeta::sitemapXml(), 200, [
        'Content-Type' => 'application/xml; charset=UTF-8',
        'Cache-Control' => 'public, max-age=3600',
    ]);
})->name('sitemap');

// Halaman info server-rendered (ber-OG-tag) untuk preview link WhatsApp.
// HARUS didefinisikan sebelum catch-all SPA agar tidak diserahkan ke React —
// crawler WA tidak menjalankan JS, jadi OG tag wajib ada di HTML awal.
Route::get('/info/alur-kunjungan', function (Request $request) {
    if ($redirect = SeoMeta::canonicalRedirect($request)) {
        return $redirect;
    }

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
Route::get('/{any?}', function (Request $request) {
    if ($redirect = SeoMeta::canonicalRedirect($request)) {
        return $redirect;
    }

    return view('app', SeoMeta::homePageViewData());
})->where('any', '^(?!api).*$');
