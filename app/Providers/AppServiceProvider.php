<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('auth-login', fn (Request $request) => Limit::perMinute(10)->by(
            'auth-login:'.$request->ip(),
        ));

        RateLimiter::for('public-bookings', fn (Request $request) => Limit::perMinute(30)->by(
            'public-bookings:'.$request->ip(),
        ));

        RateLimiter::for('public-feedback', fn (Request $request) => Limit::perMinute(10)->by(
            'public-feedback:'.$request->ip(),
        ));
    }
}
