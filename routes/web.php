<?php

use Illuminate\Support\Facades\Route;

// SPA shell — semua rute non-API diserahkan ke React (state-based router).
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '^(?!api).*$');
