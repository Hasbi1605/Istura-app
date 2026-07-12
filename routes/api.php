<?php

use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\BookingController as AdminBookingController;
use App\Http\Controllers\Admin\CmsController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\FeedbackController as AdminFeedbackController;
use App\Http\Controllers\Admin\OpenEventController;
use App\Http\Controllers\Admin\OpenFeedbackController as AdminOpenFeedbackController;
use App\Http\Controllers\Admin\OpenRegistrationController as AdminOpenRegistrationController;
use App\Http\Controllers\Admin\ScheduleController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\TwoFactorController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\Public\BookingController as PublicBookingController;
use App\Http\Controllers\Public\ContentController;
use App\Http\Controllers\Public\FeedbackController as PublicFeedbackController;
use App\Http\Controllers\Public\OpenFeedbackController as PublicOpenFeedbackController;
use App\Http\Controllers\Public\OpenRegistrationController as PublicOpenRegistrationController;
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
        Route::post('bookings/precheck', [PublicBookingController::class, 'precheck']);
        Route::post('bookings', [PublicBookingController::class, 'store']);
    });

    // Istura Open (public registration for special events)
    Route::get('open-event', [PublicOpenRegistrationController::class, 'show']);
    Route::middleware('throttle:public-open')->group(function () {
        Route::post('open-registrations/precheck', [PublicOpenRegistrationController::class, 'precheck']);
        Route::post('open-registrations', [PublicOpenRegistrationController::class, 'store']);
        Route::post('open-registrations/lookup', [PublicOpenRegistrationController::class, 'lookup']);
        Route::post('open-registrations/cancel', [PublicOpenRegistrationController::class, 'cancel']);
    });

    Route::get('feedback/{code}', [PublicFeedbackController::class, 'show'])->middleware('throttle:public-feedback-view');
    Route::post('feedback/{code}', [PublicFeedbackController::class, 'store'])->middleware('throttle:public-feedback-submit');

    // Istura Open feedback (shared per-day link, token in path)
    Route::get('open-feedback/{token}', [PublicOpenFeedbackController::class, 'show'])->middleware('throttle:public-open-feedback-view');
    Route::post('open-feedback/{token}', [PublicOpenFeedbackController::class, 'store'])->middleware('throttle:public-open-feedback-submit');
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
    // === READ routes (viewer + admin + super_admin) ===
    Route::get('dashboard', DashboardController::class);

    Route::get('bookings', [AdminBookingController::class, 'index']);
    Route::get('bookings/{code}', [AdminBookingController::class, 'show']);
    Route::get('bookings/{code}/document', [AdminBookingController::class, 'document']);

    Route::get('schedule', [ScheduleController::class, 'index']);
    Route::get('schedule/policy', [ScheduleController::class, 'policy']);

    Route::get('feedback', [AdminFeedbackController::class, 'index']);
    Route::get('feedback/{feedback}', [AdminFeedbackController::class, 'show']);

    Route::get('cms/faqs', [CmsController::class, 'faqs']);
    Route::get('cms/contacts', [CmsController::class, 'contacts']);
    Route::get('cms/wa-templates', [CmsController::class, 'waTemplates']);
    Route::get('cms/hero', [CmsController::class, 'hero']);
    Route::get('cms/letter', [CmsController::class, 'letter']);
    Route::get('cms/site-content', [CmsController::class, 'siteContent']);

    // Istura Open read + export
    Route::get('open-events', [OpenEventController::class, 'index']);
    Route::get('open-events/{event}/export', [OpenEventController::class, 'export']);
    Route::get('open-events/{event}/registrations', [AdminOpenRegistrationController::class, 'index']);
    Route::get('open-events/{event}/feedback', [AdminOpenFeedbackController::class, 'index']);

    // === MUTATION routes (admin + super_admin only) ===
    Route::middleware('operator')->group(function () {
        Route::get('audit-logs', [AuditLogController::class, 'index']);

        Route::middleware('throttle:admin-mutations')->group(function () {
            Route::post('bookings', [AdminBookingController::class, 'store']);
            Route::put('bookings/{code}', [AdminBookingController::class, 'updateContact']);
            Route::post('bookings/{code}/accept', [AdminBookingController::class, 'accept']);
            Route::post('bookings/{code}/reject', [AdminBookingController::class, 'reject']);
            Route::post('bookings/{code}/reschedule', [AdminBookingController::class, 'reschedule']);
            Route::post('bookings/{code}/reschedule/cancel', [AdminBookingController::class, 'cancelReschedule']);
            Route::post('bookings/{code}/segments', [AdminBookingController::class, 'segments']);
            Route::post('bookings/{code}/move', [AdminBookingController::class, 'move']);
            Route::post('bookings/{code}/complete', [AdminBookingController::class, 'complete']);
            Route::delete('bookings/{code}', [AdminBookingController::class, 'destroy']);

            Route::put('schedule/policy', [ScheduleController::class, 'updatePolicy']);
            Route::post('schedule/slot', [ScheduleController::class, 'storeSlot']);
            Route::delete('schedule/slot', [ScheduleController::class, 'destroySlot']);
            Route::post('schedule/range', [ScheduleController::class, 'storeRange']);

            Route::put('cms/faqs', [CmsController::class, 'updateFaqs']);
            Route::put('cms/contacts', [CmsController::class, 'updateContacts']);
            Route::put('cms/wa-templates', [CmsController::class, 'updateWaTemplates']);
            Route::put('cms/hero', [CmsController::class, 'updateHero']);
            Route::post('cms/letter', [CmsController::class, 'updateLetter']);
            Route::put('cms/site-content', [CmsController::class, 'updateSiteContent']);
            Route::post('cms/site-content', [CmsController::class, 'updateSiteContent']);

            // Istura Open mutations
            Route::post('open-events', [OpenEventController::class, 'store']);
            Route::put('open-events/{event}', [OpenEventController::class, 'update']);
            Route::delete('open-events/{event}', [OpenEventController::class, 'destroy']);
            Route::post('open-events/{event}/activate', [OpenEventController::class, 'activate']);
            Route::post('open-events/{event}/deactivate', [OpenEventController::class, 'deactivate']);
            Route::post('open-events/{event}/archive', [OpenEventController::class, 'archive']);
            Route::post('open-events/{event}/unarchive', [OpenEventController::class, 'unarchive']);
            Route::post('open-events/{event}/poster', [OpenEventController::class, 'uploadPoster']);
            Route::delete('open-events/{event}/poster', [OpenEventController::class, 'deletePoster']);
            Route::put('open-events/{event}/days/{day}', [OpenEventController::class, 'updateDay']);
            Route::post('open-events/{event}/registrations/{code}/cancel', [AdminOpenRegistrationController::class, 'cancel']);
        });
    });

    // === USER MANAGEMENT (super_admin only) ===
    Route::middleware('super-admin')->group(function () {
        Route::get('users', [UserController::class, 'index']);
        Route::middleware('throttle:admin-mutations')->group(function () {
            Route::post('users', [UserController::class, 'store']);
            Route::put('users/{user}', [UserController::class, 'update']);
            Route::delete('users/{user}', [UserController::class, 'destroy']);
        });
    });
});
