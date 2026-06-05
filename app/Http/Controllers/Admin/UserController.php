<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => UserResource::collection(User::orderBy('name')->get())->resolve(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:160', 'unique:users,email'],
            'password' => ['required', 'string', 'min:12', 'max:255'],
            'role' => ['required', Rule::in([User::ROLE_SUPER_ADMIN, User::ROLE_ADMIN])],
            'status' => ['sometimes', Rule::in(['Aktif', 'Nonaktif'])],
        ]);

        return DB::transaction(function () use ($request, $data) {
            $user = new User;
            $user->name = $data['name'];
            $user->email = $data['email'];
            $user->password = Hash::make($data['password']);
            $user->role = $data['role'];
            $user->email_verified_at = ($data['status'] ?? 'Aktif') === 'Aktif' ? now() : null;
            $user->save();

            AuditLogger::record($request->user(), "Membuat pengguna admin {$user->email}", User::class, $user->id, [
                'role' => $user->role,
                'status' => $user->email_verified_at ? 'Aktif' : 'Nonaktif',
            ], $request);

            return response()->json(['data' => (new UserResource($user))->resolve()], 201);
        });
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', 'max:160', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'nullable', 'string', 'min:12', 'max:255'],
            'role' => ['sometimes', Rule::in([User::ROLE_SUPER_ADMIN, User::ROLE_ADMIN])],
            'status' => ['sometimes', Rule::in(['Aktif', 'Nonaktif'])],
        ]);

        return DB::transaction(function () use ($request, $user, $data) {
            $this->lockActiveSuperAdmins();
            $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $this->assertUserUpdateKeepsSuperAdminAccess($request->user(), $user, $data);

            if (array_key_exists('name', $data)) {
                $user->name = $data['name'];
            }
            if (array_key_exists('email', $data)) {
                $user->email = $data['email'];
            }
            if (array_key_exists('role', $data)) {
                $user->role = $data['role'];
            }
            if (! empty($data['password'])) {
                $user->password = Hash::make($data['password']);
            }
            if (array_key_exists('status', $data)) {
                $user->email_verified_at = $data['status'] === 'Aktif' ? ($user->email_verified_at ?? now()) : null;
            }
            $user->save();

            AuditLogger::record($request->user(), "Memperbarui pengguna admin {$user->email}", User::class, $user->id, [
                'fields' => array_values(array_diff(array_keys($data), ['password'])),
                'password_changed' => ! empty($data['password']),
                'role' => $user->role,
                'status' => $user->email_verified_at ? 'Aktif' : 'Nonaktif',
            ], $request);

            return response()->json(['data' => (new UserResource($user->fresh()))->resolve()]);
        });
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        if ($request->user()->id === $user->id) {
            throw ValidationException::withMessages([
                'user' => ['Tidak dapat menghapus akun yang sedang login.'],
            ]);
        }

        return DB::transaction(function () use ($request, $user) {
            $this->lockActiveSuperAdmins();
            $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $this->assertCanRemoveUser($user);

            $targetEmail = $user->email;
            $targetId = $user->id;
            $user->delete();

            AuditLogger::record($request->user(), "Menghapus pengguna admin {$targetEmail}", User::class, $targetId, request: $request);

            return response()->json(['ok' => true]);
        });
    }

    private function authorizeSuperAdmin(Request $request): void
    {
        abort_unless($request->user()?->isSuperAdmin(), 403, 'Hanya Super Admin yang dapat mengelola pengguna.');
    }

    private function assertUserUpdateKeepsSuperAdminAccess(User $actor, User $target, array $data): void
    {
        if ($actor->id === $target->id) {
            if (($data['role'] ?? $target->role) !== User::ROLE_SUPER_ADMIN) {
                throw ValidationException::withMessages([
                    'user' => ['Tidak dapat menurunkan peran akun yang sedang login.'],
                ]);
            }

            if (($data['status'] ?? 'Aktif') === 'Nonaktif') {
                throw ValidationException::withMessages([
                    'user' => ['Tidak dapat menonaktifkan akun yang sedang login.'],
                ]);
            }
        }

        $nextRole = $data['role'] ?? $target->role;
        $nextActive = array_key_exists('status', $data)
            ? $data['status'] === 'Aktif'
            : $target->isActive();

        if ($target->isActiveSuperAdmin() && ($nextRole !== User::ROLE_SUPER_ADMIN || ! $nextActive)) {
            $this->assertAnotherActiveSuperAdminExists($target);
        }
    }

    private function assertCanRemoveUser(User $target): void
    {
        if ($target->isActiveSuperAdmin()) {
            $this->assertAnotherActiveSuperAdminExists($target);
        }
    }

    private function assertAnotherActiveSuperAdminExists(User $target): void
    {
        $anotherActiveSuperAdminExists = User::query()
            ->where('role', User::ROLE_SUPER_ADMIN)
            ->whereNotNull('email_verified_at')
            ->whereKeyNot($target->id)
            ->exists();

        if (! $anotherActiveSuperAdminExists) {
            throw ValidationException::withMessages([
                'user' => ['Minimal harus ada satu Super Admin aktif.'],
            ]);
        }
    }

    private function lockActiveSuperAdmins(): void
    {
        User::query()
            ->where('role', User::ROLE_SUPER_ADMIN)
            ->whereNotNull('email_verified_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->get(['id']);
    }
}
