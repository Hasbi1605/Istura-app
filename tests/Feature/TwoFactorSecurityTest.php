<?php

namespace Tests\Feature;

use App\Http\Middleware\EnsureAdminSessionFresh;
use App\Models\TrustedDevice;
use App\Models\User;
use App\Services\TwoFactorService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class TwoFactorSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-06-01 09:00:00', 'Asia/Jakarta'));
        Cache::flush();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_recovery_codes_are_hashed_and_single_use(): void
    {
        $secret = app(TwoFactorService::class)->generateSecret();
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $admin->forceFill(['two_factor_secret' => encrypt($secret)])->save();

        $this->actingAs($admin);

        $response = $this->postJson('/api/auth/two-factor/confirm', [
            'code' => (new Google2FA)->getCurrentOtp($secret),
        ])->assertOk();

        $firstRecoveryCode = $response->json('recovery_codes.0');
        $storedCodes = json_decode(decrypt($admin->fresh()->two_factor_recovery_codes), true);

        $this->assertCount(8, $storedCodes);
        $this->assertNotContains($firstRecoveryCode, $storedCodes);
        $this->assertTrue(Hash::check($firstRecoveryCode, $storedCodes[0]));

        $this->postJson('/api/auth/two-factor/verify', [
            'code' => $firstRecoveryCode,
            'trust_device' => false,
        ])->assertOk();

        $remainingCodes = json_decode(decrypt($admin->fresh()->two_factor_recovery_codes), true);
        $this->assertCount(7, $remainingCodes);

        $this->postJson('/api/auth/two-factor/verify', [
            'code' => $firstRecoveryCode,
            'trust_device' => false,
        ])->assertStatus(422);
    }

    public function test_trusted_device_uses_cookie_token_hash_instead_of_request_fingerprint(): void
    {
        $service = app(TwoFactorService::class);
        $admin = $this->createConfirmedAdmin($service);
        $token = Str::random(64);

        TrustedDevice::create([
            'user_id' => $admin->id,
            'device_hash' => $service->hashTrustedDeviceToken($token),
            'device_name' => 'Chrome',
            'trusted_until' => now()->addDays(30),
        ]);

        $request = Request::create('/api/admin/dashboard', 'GET', [], [
            TwoFactorService::TRUSTED_DEVICE_COOKIE => $token,
        ], [], [
            'REMOTE_ADDR' => '198.51.100.10',
            'HTTP_USER_AGENT' => 'Different Browser',
        ]);

        $this->assertTrue($service->isDeviceTrusted($admin, $request));

        $requestWithoutCookie = Request::create('/api/admin/dashboard', 'GET', [], [], [], [
            'REMOTE_ADDR' => '198.51.100.10',
            'HTTP_USER_AGENT' => 'Different Browser',
        ]);

        $this->assertFalse($service->isDeviceTrusted($admin, $requestWithoutCookie));
    }

    public function test_verifying_with_trust_device_queues_trusted_cookie(): void
    {
        $service = app(TwoFactorService::class);
        $admin = $this->createConfirmedAdmin($service);

        $this->actingAs($admin);

        $this->postJson('/api/auth/two-factor/verify', [
            'code' => (new Google2FA)->getCurrentOtp(decrypt($admin->two_factor_secret)),
            'trust_device' => true,
        ])->assertOk()
            ->assertCookie(TwoFactorService::TRUSTED_DEVICE_COOKIE);

        $this->assertDatabaseCount('trusted_devices', 1);
        $this->assertSame(64, strlen((string) TrustedDevice::first()?->device_hash));
    }

    public function test_two_factor_verify_is_rate_limited(): void
    {
        $service = app(TwoFactorService::class);
        $admin = $this->createConfirmedAdmin($service);
        RateLimiter::clear('two-factor:'.sha1($admin->id.'|127.0.0.1'));

        $this->actingAs($admin);

        foreach (range(1, 5) as $_) {
            $this->postJson('/api/auth/two-factor/verify', [
                'code' => '000000',
                'trust_device' => false,
            ])->assertStatus(422);
        }

        $this->postJson('/api/auth/two-factor/verify', [
            'code' => '000000',
            'trust_device' => false,
        ])->assertStatus(429);
    }

    public function test_admin_session_absolute_lifetime_forces_relogin(): void
    {
        config(['session.admin_absolute_lifetime' => 720]);
        $admin = $this->createConfirmedAdmin(app(TwoFactorService::class));
        $request = Request::create('/api/admin/dashboard', 'GET');
        $request->setUserResolver(fn () => $admin);
        $request->setLaravelSession(app('session.store'));
        $request->session()->put('admin_session_started_at', now()->subHours(13)->timestamp);

        $response = app(EnsureAdminSessionFresh::class)->handle(
            $request,
            fn () => response()->json(['ok' => true]),
        );

        $this->assertSame(401, $response->getStatusCode());
        $this->assertSame(
            'Sesi admin sudah melewati batas waktu maksimum. Silakan login kembali.',
            json_decode($response->getContent(), true)['message'],
        );
    }

    public function test_cli_can_reset_two_factor_for_emergency_recovery(): void
    {
        $service = app(TwoFactorService::class);
        $admin = $this->createConfirmedAdmin($service);

        TrustedDevice::create([
            'user_id' => $admin->id,
            'device_hash' => $service->hashTrustedDeviceToken(Str::random(64)),
            'device_name' => 'Safari',
            'trusted_until' => now()->addDays(30),
        ]);

        $this->artisan('user:reset-2fa', [
            'email' => $admin->email,
            '--force' => true,
        ])->assertSuccessful();

        $admin->refresh();

        $this->assertNull($admin->two_factor_secret);
        $this->assertNull($admin->two_factor_recovery_codes);
        $this->assertNull($admin->two_factor_confirmed_at);
        $this->assertDatabaseCount('trusted_devices', 0);
        $this->assertDatabaseHas('audit_logs', [
            'actor_name' => 'Sistem',
            'action' => 'Mereset Two-Factor Authentication via CLI',
            'target_type' => User::class,
            'target_id' => (string) $admin->id,
        ]);
    }

    private function createConfirmedAdmin(TwoFactorService $service): User
    {
        $secret = $service->generateSecret();
        $recoveryCodes = $service->generateRecoveryCodes();

        return User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'two_factor_secret' => encrypt($secret),
            'two_factor_recovery_codes' => encrypt(json_encode($service->hashRecoveryCodes($recoveryCodes))),
            'two_factor_confirmed_at' => now(),
        ]);
    }
}
