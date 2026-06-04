<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Services\TwoFactorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private TwoFactorService $twoFactor) {}

    /**
     * Maximum failed attempts before progressive delay kicks in.
     */
    private const MAX_ATTEMPTS_BEFORE_DELAY = 3;

    /**
     * Maximum delay in seconds (cap the exponential growth).
     */
    private const MAX_DELAY_SECONDS = 300; // 5 minutes

    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->safe()->only(['email', 'password']);
        $throttleKey = $this->loginThrottleKey($request);

        // Check progressive delay
        $this->enforceProgressiveDelay($throttleKey);

        if (! Auth::attempt($credentials, $request->boolean('remember'))) {
            $this->recordFailedAttempt($throttleKey);

            throw ValidationException::withMessages([
                'email' => ['Email atau password salah.'],
            ]);
        }

        $user = $request->user();
        if (! $user->isActive()) {
            $this->logoutCurrentSession($request);

            throw ValidationException::withMessages([
                'email' => ['Akun ini sedang nonaktif. Hubungi Super Admin.'],
            ]);
        }

        // Clear failed attempts on successful login
        $this->clearFailedAttempts($throttleKey);

        if ($request->hasSession()) {
            $request->session()->regenerate();
            $this->twoFactor->clearSessionVerification($request);
            $request->session()->put('admin_session_started_at', now()->timestamp);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json([
            'user' => new UserResource($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user && $this->adminSessionExpired($request)) {
            $this->logoutCurrentSession($request);

            return response()->json(['user' => null]);
        }

        if ($user && ! $user->isActive()) {
            $this->logoutCurrentSession($request);

            return response()->json(['user' => null]);
        }

        return response()->json([
            'user' => $user ? new UserResource($user) : null,
        ]);
    }

    private function logoutCurrentSession(Request $request): void
    {
        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }
    }

    private function adminSessionExpired(Request $request): bool
    {
        if (! $request->hasSession()) {
            return false;
        }

        $startedAt = (int) $request->session()->get('admin_session_started_at', 0);
        if ($startedAt <= 0) {
            $request->session()->put('admin_session_started_at', now()->timestamp);

            return false;
        }

        $absoluteLifetime = max(1, (int) config('session.admin_absolute_lifetime', 720));

        return (now()->timestamp - $startedAt) > $absoluteLifetime * 60;
    }

    /**
     * Generate throttle key combining IP + email for targeted protection.
     */
    private function loginThrottleKey(Request $request): string
    {
        $email = strtolower(trim($request->input('email', '')));

        return 'login_attempts:'.sha1($request->ip().'|'.$email);
    }

    /**
     * Enforce progressive delay based on failed attempt count.
     * Delay formula: 2^(attempts - threshold) seconds, capped at MAX_DELAY_SECONDS.
     */
    private function enforceProgressiveDelay(string $key): void
    {
        $lockKey = $key.':locked_until';
        $lockedUntil = Cache::get($lockKey);

        if ($lockedUntil && now()->timestamp < $lockedUntil) {
            $remainingSeconds = $lockedUntil - now()->timestamp;

            throw ValidationException::withMessages([
                'email' => ["Terlalu banyak percobaan login. Coba lagi dalam {$remainingSeconds} detik."],
            ]);
        }
    }

    /**
     * Record a failed login attempt and apply progressive delay if threshold exceeded.
     */
    private function recordFailedAttempt(string $key): void
    {
        $attemptsKey = $key.':count';
        $attempts = (int) Cache::get($attemptsKey, 0) + 1;

        // Store attempts for 30 minutes
        Cache::put($attemptsKey, $attempts, now()->addMinutes(30));

        if ($attempts >= self::MAX_ATTEMPTS_BEFORE_DELAY) {
            $delaySeconds = min(
                (int) pow(2, $attempts - self::MAX_ATTEMPTS_BEFORE_DELAY),
                self::MAX_DELAY_SECONDS,
            );

            $lockKey = $key.':locked_until';
            Cache::put($lockKey, now()->timestamp + $delaySeconds, now()->addSeconds($delaySeconds));
        }
    }

    /**
     * Clear failed attempts after successful login.
     */
    private function clearFailedAttempts(string $key): void
    {
        Cache::forget($key.':count');
        Cache::forget($key.':locked_until');
    }
}
