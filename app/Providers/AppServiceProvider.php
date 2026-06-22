<?php

namespace App\Providers;

use App\Models\Booking;
use App\Models\Feedback;
use App\Models\ScheduleOverride;
use App\Policies\BookingPolicy;
use App\Policies\FeedbackPolicy;
use App\Policies\ScheduleOverridePolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
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
        Gate::policy(Booking::class, BookingPolicy::class);
        Gate::policy(Feedback::class, FeedbackPolicy::class);
        Gate::policy(ScheduleOverride::class, ScheduleOverridePolicy::class);

        if (! $this->app->environment(['local', 'testing']) && config('app.debug')) {
            throw new \RuntimeException('APP_DEBUG must be false outside local environments.');
        }

        RateLimiter::for('auth-login', fn (Request $request) => Limit::perMinute(10)->by(
            'auth-login:'.sha1($request->ip().'|'.strtolower(trim($request->input('email', '')))),
        ));

        RateLimiter::for('two-factor', fn (Request $request) => Limit::perMinute(5)->by(
            'two-factor:'.sha1(($request->user()?->id ?? 'guest').'|'.$request->ip()),
        ));

        RateLimiter::for('public-bookings', fn (Request $request) => Limit::perMinute(30)->by(
            'public-bookings:'.$request->ip(),
        ));

        RateLimiter::for('public-open', fn (Request $request) => Limit::perMinute(30)->by(
            'public-open:'.$request->ip(),
        ));

        RateLimiter::for('public-schedule', fn (Request $request) => Limit::perMinute(120)->by(
            'public-schedule:'.$request->ip(),
        ));

        RateLimiter::for('public-feedback-view', fn (Request $request) => Limit::perMinute(120)->by(
            'public-feedback-view:'.$request->ip(),
        ));

        RateLimiter::for('public-feedback-submit', fn (Request $request) => Limit::perMinute(120)->by(
            'public-feedback-submit:'.$request->ip(),
        ));
    }
}
