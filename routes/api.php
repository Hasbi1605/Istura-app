<?php

use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\BookingController as AdminBookingController;
use App\Http\Controllers\Admin\CmsController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\FeedbackController as AdminFeedbackController;
use App\Http\Controllers\Admin\ScheduleController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\TwoFactorController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\Public\BookingController as PublicBookingController;
use App\Http\Controllers\Public\ContentController;
use App\Http\Controllers\Public\FeedbackController as PublicFeedbackController;
use Illuminate\Support\Facades\Route;

Route::get('health', HealthController::class);

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------
Route::prefix('public')->group(function () {
    Route::get('bootstrap', [ContentController::class, 'bootstrap']);
    Route::get('faqs', [ContentController::class, 'faqs']);
    Route::get('contacts', [ContentController::class, 'contacts']);
    Route::get('schedule', [ContentController::class, 'schedule'])->middleware('throttle:public-schedule');
    Route::get('hero', [ContentController::class, 'hero']);
    Route::get('letter', [ContentController::class, 'letter']);
    Route::get('site-content', [ContentController::class, 'siteContent']);
    Route::get('wa-templates', [ContentController::class, 'waTemplates']);
    Route::get('wa-templates/{status}', [ContentController::class, 'waTemplate']);

    Route::middleware('throttle:public-bookings')->group(function () {
        Route::post('bookings', [PublicBookingController::class, 'store']);
    });

    Route::get('feedback/{code}', [PublicFeedbackController::class, 'show'])->middleware('throttle:public-feedback');
    Route::post('feedback/{code}', [PublicFeedbackController::class, 'store'])->middleware('throttle:public-feedback');
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:auth-login');
    Route::get('me', [AuthController::class, 'me']);
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('two-factor/status', [TwoFactorController::class, 'status']);
        Route::middleware('throttle:two-factor')->group(function () {
            Route::post('two-factor/setup', [TwoFactorController::class, 'setup']);
            Route::post('two-factor/confirm', [TwoFactorController::class, 'confirm']);
            Route::post('two-factor/verify', [TwoFactorController::class, 'verify']);
            Route::post('two-factor/disable', [TwoFactorController::class, 'disable']);
            Route::post('two-factor/recovery-codes', [TwoFactorController::class, 'regenerateRecoveryCodes']);
        });
        Route::get('two-factor/challenge', [TwoFactorController::class, 'challenge']);
    });
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
Route::middleware('admin-access')->prefix('admin')->group(function () {
    Route::get('dashboard', DashboardController::class);

    Route::get('bookings', [AdminBookingController::class, 'index']);
    Route::get('bookings/{code}', [AdminBookingController::class, 'show']);
    Route::post('bookings/{code}/accept', [AdminBookingController::class, 'accept']);
    Route::post('bookings/{code}/reject', [AdminBookingController::class, 'reject']);
    Route::post('bookings/{code}/reschedule', [AdminBookingController::class, 'reschedule']);
    Route::post('bookings/{code}/reschedule/cancel', [AdminBookingController::class, 'cancelReschedule']);
    Route::post('bookings/{code}/segments', [AdminBookingController::class, 'segments']);
    Route::post('bookings/{code}/complete', [AdminBookingController::class, 'complete']);
    Route::get('bookings/{code}/document', [AdminBookingController::class, 'document']);

    Route::get('schedule', [ScheduleController::class, 'index']);
    Route::post('schedule/slot', [ScheduleController::class, 'storeSlot']);
    Route::delete('schedule/slot', [ScheduleController::class, 'destroySlot']);
    Route::post('schedule/range', [ScheduleController::class, 'storeRange']);

    Route::get('feedback', [AdminFeedbackController::class, 'index']);
    Route::get('feedback/{code}', [AdminFeedbackController::class, 'show']);

    Route::get('cms/faqs', [CmsController::class, 'faqs']);
    Route::put('cms/faqs', [CmsController::class, 'updateFaqs']);
    Route::get('cms/contacts', [CmsController::class, 'contacts']);
    Route::put('cms/contacts', [CmsController::class, 'updateContacts']);
    Route::get('cms/wa-templates', [CmsController::class, 'waTemplates']);
    Route::put('cms/wa-templates', [CmsController::class, 'updateWaTemplates']);

    Route::get('cms/hero', [CmsController::class, 'hero']);
    Route::put('cms/hero', [CmsController::class, 'updateHero']);
    Route::get('cms/letter', [CmsController::class, 'letter']);
    Route::post('cms/letter', [CmsController::class, 'updateLetter']);
    Route::get('cms/site-content', [CmsController::class, 'siteContent']);
    Route::put('cms/site-content', [CmsController::class, 'updateSiteContent']);

    Route::middleware('super-admin')->group(function () {
        Route::get('users', [UserController::class, 'index']);
        Route::post('users', [UserController::class, 'store']);
        Route::put('users/{user}', [UserController::class, 'update']);
        Route::delete('users/{user}', [UserController::class, 'destroy']);
    });
    Route::get('audit-logs', [AuditLogController::class, 'index']);
});
