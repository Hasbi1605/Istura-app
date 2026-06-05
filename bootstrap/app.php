<?php

use App\Http\Middleware\AddSecurityHeaders;
use App\Http\Middleware\EnsureAdmin;
use App\Http\Middleware\EnsureAdminSessionFresh;
use App\Http\Middleware\EnsureSuperAdmin;
use App\Http\Middleware\EnsureTwoFactorVerified;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        ['middleware' => ['web', 'admin-access']],
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(
            headers: Request::HEADER_X_FORWARDED_FOR
                | Request::HEADER_X_FORWARDED_HOST
                | Request::HEADER_X_FORWARDED_PORT
                | Request::HEADER_X_FORWARDED_PROTO,
        );
        $middleware->append(AddSecurityHeaders::class);
        $middleware->redirectGuestsTo(
            fn (Request $request): ?string => $request->is('api/*', 'broadcasting/auth') ? null : '/',
        );
        $middleware->statefulApi();
        $middleware->alias([
            'admin' => EnsureAdmin::class,
            'admin-session' => EnsureAdminSessionFresh::class,
            'super-admin' => EnsureSuperAdmin::class,
            'two-factor' => EnsureTwoFactorVerified::class,
        ]);
        $middleware->group('admin-access', [
            'auth:sanctum',
            'admin-session',
            'two-factor',
            'admin',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*', 'broadcasting/auth'),
        );

        $exceptions->render(function (NotFoundHttpException $exception, Request $request) {
            if (! $request->is('api/*') || ! $exception->getPrevious() instanceof ModelNotFoundException) {
                return null;
            }

            return response()->json(['message' => 'Data tidak ditemukan.'], 404);
        });
    })->create();
