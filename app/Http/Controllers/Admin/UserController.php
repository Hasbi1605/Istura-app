<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in([User::ROLE_SUPER_ADMIN, User::ROLE_ADMIN, User::ROLE_VIEWER])],
            'status' => ['sometimes', Rule::in(['Aktif', 'Nonaktif'])],
        ]);

        $user = new User;
        $user->name = $data['name'];
        $user->email = $data['email'];
        $user->password = Hash::make($data['password']);
        $user->role = $data['role'];
        $user->email_verified_at = ($data['status'] ?? 'Aktif') === 'Aktif' ? now() : null;
        $user->save();

        return response()->json(['data' => (new UserResource($user))->resolve()], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', 'max:160', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'nullable', 'string', 'min:8'],
            'role' => ['sometimes', Rule::in([User::ROLE_SUPER_ADMIN, User::ROLE_ADMIN, User::ROLE_VIEWER])],
            'status' => ['sometimes', Rule::in(['Aktif', 'Nonaktif'])],
        ]);

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

        return response()->json(['data' => (new UserResource($user->fresh()))->resolve()]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        if ($request->user()->id === $user->id) {
            throw ValidationException::withMessages([
                'user' => ['Tidak dapat menghapus akun yang sedang login.'],
            ]);
        }

        $user->delete();

        return response()->json(['ok' => true]);
    }

    private function authorizeSuperAdmin(Request $request): void
    {
        abort_unless($request->user()?->isSuperAdmin(), 403, 'Hanya Super Admin yang dapat mengelola pengguna.');
    }
}
