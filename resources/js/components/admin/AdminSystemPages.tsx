import { useCallback, useEffect, useState } from "react";
import { PenLine, Plus, X } from "lucide-react";
import type { AdminSession } from "../../domain/types";
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminAuditLogs,
  fetchAdminUsers,
  updateAdminUser,
  type ApiAdminUser,
  type ApiAuditLog,
} from "../../api/admin";
import { ApiError, ValidationError } from "../../api/client";
import { ButtonSpinner, InlineSpinner, TableSkeleton } from "../ui/LoadingStates";

type UserRole = "super_admin" | "admin" | "viewer";

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "viewer", label: "Viewer" },
];

type UserDraft = {
  id: number | null;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status: "Aktif" | "Nonaktif";
};

const emptyDraft: UserDraft = {
  id: null,
  name: "",
  email: "",
  password: "",
  role: "admin",
  status: "Aktif",
};

export function AdminUsersList({ session }: { session: AdminSession | null }) {
  const canManage = session?.role === "Super Admin";
  const [users, setUsers] = useState<ApiAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<UserDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(() => {
    if (!canManage) {
      setUsers([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchAdminUsers()
      .then((data) => {
        setUsers(data);
        setError(null);
      })
      .catch(() => setError("Gagal memuat daftar pengguna."))
      .finally(() => setLoading(false));
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  const startCreate = () => {
    setFormError(null);
    setShowPassword(false);
    setDraft({ ...emptyDraft });
  };

  const startEdit = (user: ApiAdminUser) => {
    setFormError(null);
    setShowPassword(false);
    setDraft({
      id: user.id,
      name: user.name,
      email: user.email,
      password: "",
      role: user.role as UserRole,
      status: user.status,
    });
  };

  const cancel = () => {
    setDraft(null);
    setFormError(null);
    setShowPassword(false);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setFormError(null);
    try {
      if (draft.id == null) {
        await createAdminUser({
          name: draft.name.trim(),
          email: draft.email.trim(),
          password: draft.password,
          role: draft.role,
          status: draft.status,
        });
      } else {
        await updateAdminUser(draft.id, {
          name: draft.name.trim(),
          email: draft.email.trim(),
          role: draft.role,
          status: draft.status,
          ...(draft.password ? { password: draft.password } : {}),
        });
      }
      cancel();
      load();
    } catch (err) {
      if (err instanceof ValidationError) {
        setFormError(Object.values(err.errors)[0]?.[0] ?? "Validasi gagal.");
      } else if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Gagal menyimpan pengguna.");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (user: ApiAdminUser) => {
    if (!window.confirm(`Hapus akun ${user.name}?`)) return;
    try {
      await deleteAdminUser(user.id);
      load();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Gagal menghapus pengguna.");
    }
  };

  const isFormOpen = draft !== null;
  const canSave =
    draft != null &&
    draft.name.trim() &&
    draft.email.trim() &&
    (draft.id != null || draft.password.length >= 8);

  return (
    <div className="admin-cms-page">
		<div className="admin-heading">
			<div>
				<h1>Pengguna Admin</h1>
				<p>Daftar akun yang memiliki akses dashboard ISTURA.</p>
				{loading && <InlineSpinner label="Memuat daftar pengguna" />}
			</div>
        {canManage && !isFormOpen && (
          <button type="button" className="button button-primary" onClick={startCreate}>
            <Plus size={16} aria-hidden="true" />
            Tambah akun
          </button>
        )}
      </div>

      {isFormOpen && (
        <section className="admin-card">
          <header className="admin-card-head">
            <div>
              <h2>{draft?.id == null ? "Tambah akun baru" : "Edit akun"}</h2>
              <p>
                {draft?.id == null
                  ? "Akun baru dapat langsung login dengan password yang ditetapkan."
                  : "Kosongkan password jika tidak ingin mengubahnya."}
              </p>
            </div>
          </header>
          <div className="admin-cms-form">
            <label className="form-field">
              <span>Nama</span>
              <input
                value={draft?.name ?? ""}
                onChange={(event) => setDraft((d) => (d ? { ...d, name: event.target.value } : d))}
              />
            </label>
            <label className="form-field">
              <span>Email</span>
              <input
                type="email"
                value={draft?.email ?? ""}
                onChange={(event) => setDraft((d) => (d ? { ...d, email: event.target.value } : d))}
              />
            </label>
            <div className="admin-cms-link">
              <label className="form-field">
                <span>Peran</span>
                <select
                  value={draft?.role ?? "admin"}
                  onChange={(event) =>
                    setDraft((d) => (d ? { ...d, role: event.target.value as UserRole } : d))
                  }
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Status</span>
                <select
                  value={draft?.status ?? "Aktif"}
                  onChange={(event) =>
                    setDraft((d) =>
                      d ? { ...d, status: event.target.value as "Aktif" | "Nonaktif" } : d,
                    )
                  }
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Nonaktif">Nonaktif</option>
                </select>
              </label>
            </div>
            <label className="form-field">
              <span>{draft?.id == null ? "Password" : "Password baru (opsional)"}</span>
              <span className="admin-password-input">
                <input
                  type={showPassword ? "text" : "password"}
                  value={draft?.password ?? ""}
                  placeholder="Minimal 8 karakter"
                  autoComplete="new-password"
                  onChange={(event) =>
                    setDraft((d) => (d ? { ...d, password: event.target.value } : d))
                  }
                />
                <button
                  type="button"
                  className="admin-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                >
                  {showPassword ? "Sembunyikan" : "Lihat"}
                </button>
              </span>
            </label>
            {formError && <p className="admin-form-error">{formError}</p>}
            <div className="admin-cms-actions">
              <button type="button" className="button button-ghost" onClick={cancel}>
                Batal
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={save}
                disabled={!canSave || saving}
              >
				{saving ? <ButtonSpinner label="Menyimpan..." /> : "Simpan"}
			</button>
            </div>
          </div>
        </section>
      )}

      <section className="admin-card admin-users-card">
        {error ? (
          <p className="admin-info-note">{error}</p>
		) : loading ? (
			<TableSkeleton rows={6} />
        ) : (
          <table className="admin-table admin-users-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Peran</th>
                <th>Status</th>
                <th>Login terakhir</th>
                {canManage && <th aria-label="Aksi" />}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td data-label="Nama">
                    <strong>{user.name}</strong>
                  </td>
                  <td data-label="Email">{user.email}</td>
                  <td data-label="Peran">{user.roleLabel}</td>
                  <td data-label="Status">
                    <span
                      className={`admin-pill admin-pill--${user.status === "Aktif" ? "ok" : "off"}`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td data-label="Login terakhir">{user.lastLogin ?? "Belum pernah"}</td>
                  {canManage && (
                    <td data-label="Aksi">
                      <div className="admin-cms-row-actions">
                        <button
                          type="button"
                          className="admin-icon-btn"
                          onClick={() => startEdit(user)}
                          aria-label={`Edit ${user.name}`}
                        >
                          <PenLine size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn admin-icon-btn--danger"
                          onClick={() => remove(user)}
                          aria-label={`Hapus ${user.name}`}
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!canManage && (
          <p className="admin-info-note">
            Hanya Super Admin yang dapat menambah akun, mengubah peran, atau mereset password.
          </p>
        )}
      </section>
    </div>
  );
}

export function AdminAuditLog() {
  const [logs, setLogs] = useState<ApiAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAdminAuditLogs()
      .then((data) => {
        if (cancelled) return;
        setLogs(data);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat riwayat aktivitas.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="admin-cms-page">
		<div className="admin-heading">
			<div>
				<h1>Riwayat Aktivitas</h1>
				<p>Log perubahan yang dilakukan oleh tim admin.</p>
				{loading && <InlineSpinner label="Memuat riwayat" />}
			</div>
      </div>

      <section className="admin-card">
        {error ? (
          <p className="admin-info-note">{error}</p>
		) : loading ? (
			<TableSkeleton rows={7} />
        ) : logs.length === 0 ? (
          <p className="admin-info-note">Belum ada aktivitas tercatat.</p>
        ) : (
          <ol className="admin-audit-list">
            {logs.map((entry) => (
              <li key={entry.id}>
                <span className="admin-audit-dot" aria-hidden="true" />
                <div>
                  <strong>{entry.actor ?? "Sistem"}</strong>
                  <p>{entry.action}</p>
                  <small>{entry.at ?? ""}</small>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
