<?php

use Illuminate\Support\Facades\Route;

// Halaman info server-rendered (ber-OG-tag) untuk preview link WhatsApp.
// HARUS didefinisikan sebelum catch-all SPA agar tidak diserahkan ke React —
// crawler WA tidak menjalankan JS, jadi OG tag wajib ada di HTML awal.
Route::view('/info/alur-kunjungan', 'info.visit-flow')->name('info.visit-flow');

// SPA shell — semua rute non-API diserahkan ke React (state-based router).
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '^(?!api).*$');
