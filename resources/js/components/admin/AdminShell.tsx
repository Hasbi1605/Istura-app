import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  LogOut,
  Mail,
  Menu,
  RefreshCw,
  Timer,
} from "lucide-react";
import type { AdminSession, AdminTab } from "../../domain/types";
import type { RealtimeConnectionStatus } from "../../realtime/echo";
import { ASSETS } from "../../lib/assets";
import { ADMIN_MENU } from "../../constants";
import type { AdminMenuItem } from "../../constants";
import { login as apiLogin, me as apiMe } from "../../api/auth";
import { ApiError, ValidationError } from "../../api/client";
import { ButtonSpinner } from "../ui/LoadingStates";
import { useIdleTimeout } from "../../hooks/useIdleTimeout";

export function AdminShell({
  session,
  tab,
  onTabChange,
  onLogout,
  onRefresh,
  refreshing = false,
  realtimeStatus,
  adminRealtimeReady,
  onExitToPublic,
  children,
}: {
  session: AdminSession;
  tab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onLogout: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  realtimeStatus: RealtimeConnectionStatus;
  adminRealtimeReady: boolean | null;
  onExitToPublic: () => void;
  children: ReactNode;
}) {
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);
  // Tampilkan konfirmasi singkat "Diperbarui" saat refresh selesai.
  useEffect(() => {
    if (refreshing || !justRefreshed) return;
    const timer = window.setTimeout(() => setJustRefreshed(false), 1800);
    return () => window.clearTimeout(timer);
  }, [refreshing, justRefreshed]);
  const refreshServerSession = useCallback(async () => {
    const user = await apiMe();
    if (!user) throw new Error("Sesi admin sudah berakhir.");
  }, []);
  const { showWarning, remainingSeconds, extendSession } = useIdleTimeout({
    timeoutMinutes: 120,
    warningSeconds: 120,
    keepAliveMinutes: 10,
    onKeepAlive: refreshServerSession,
    onLogout,
    enabled: true,
  });
  const visibleMenu = ADMIN_MENU.filter(
    (item) => {
      if (item.key === "users" && session.role !== "Super Admin") return false;
      if (item.key === "audit" && session.role === "Viewer") return false;
      return true;
    },
  );
  const currentItem = visibleMenu.find((item) => item.key === tab) ?? visibleMenu[0];
  const realtimeConnected = realtimeStatus === "connected" && adminRealtimeReady === true;
  const realtimeLabel = realtimeConnected
    ? "Realtime aktif"
    : realtimeStatus === "connecting" || adminRealtimeReady === null
      ? "Menghubungkan"
      : "Sinkronisasi cadangan";

  // Group menu by section header
  const grouped = visibleMenu.reduce<Record<string, AdminMenuItem[]>>((acc, item) => {
    const key = item.group ?? "Operasional";
    acc[key] = acc[key] ?? [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="admin-shell">
      <button
        type="button"
        className={`admin-shell-scrim${isMobileNavOpen ? " is-open" : ""}`}
        aria-hidden={!isMobileNavOpen}
        tabIndex={isMobileNavOpen ? 0 : -1}
        onClick={() => setMobileNavOpen(false)}
      />

      <aside className={`admin-shell-sidebar${isMobileNavOpen ? " is-open" : ""}`}>
        <div className="admin-shell-brand">
          <img src={ASSETS.logoGold} alt="Gedung Agung" />
          <strong>ISTURA Admin</strong>
        </div>
        <nav className="admin-shell-menu" aria-label="Navigasi admin">
          {Object.entries(grouped).map(([group, items]) => (
            <div className="admin-shell-menu-group" key={group}>
              <span className="admin-shell-menu-label">{group}</span>
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === tab;
                return (
                  <button
                    type="button"
                    key={item.key}
                    className={`admin-shell-menu-item${isActive ? " is-active" : ""}`}
                    onClick={() => {
                      onTabChange(item.key);
                      setMobileNavOpen(false);
                    }}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.status === "soon" && (
                      <em className="admin-shell-menu-tag">soon</em>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <button
          type="button"
          className="admin-shell-exit"
          onClick={onExitToPublic}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Lihat sisi publik
        </button>
      </aside>

      <div className="admin-shell-main">
        <header className="admin-shell-topbar">
          <button
            type="button"
            className="admin-shell-mobile-toggle"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Toggle menu admin"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="admin-shell-context">
            <div className="admin-shell-crumb">
              <small>Dashboard</small>
              <strong>{currentItem.label}</strong>
            </div>
            <div className="admin-shell-page-actions">
              {onRefresh && (
                <button
                  type="button"
                  className="admin-shell-refresh"
                  onClick={() => {
                    if (refreshing) return;
                    setJustRefreshed(true);
                    onRefresh();
                  }}
                  disabled={refreshing}
                  aria-label="Muat ulang data"
                  title="Muat ulang data"
                >
                  <RefreshCw size={16} aria-hidden="true" className={refreshing ? "is-spinning" : undefined} />
                  <span>Muat ulang</span>
                </button>
              )}
              <span
                className={`admin-realtime-status${realtimeConnected ? " is-connected" : " is-fallback"}`}
                role="status"
                aria-label={realtimeLabel}
                title={realtimeLabel}
              >
                <span aria-hidden="true" />
                <em>{realtimeLabel}</em>
              </span>
            </div>
          </div>
          <div className="admin-shell-user">
            <div className="admin-shell-user-avatar" aria-hidden="true">
              {session.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="admin-shell-user-meta">
              <strong>{session.name}</strong>
              <small>{session.role}</small>
            </div>
            <button
              type="button"
              className="admin-shell-logout"
              onClick={onLogout}
              aria-label="Keluar"
            >
              <LogOut size={16} aria-hidden="true" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        <div className="admin-shell-content">{children}</div>

        {(refreshing || justRefreshed) && (
          <div
            className={`admin-schedule-toast ${refreshing ? "admin-schedule-toast--saving" : "admin-schedule-toast--saved"}`}
            role="status"
            aria-live="polite"
          >
            {refreshing ? (
              <>
                <RefreshCw size={15} aria-hidden="true" className="is-spinning" />
                <span>Memuat ulang…</span>
              </>
            ) : (
              <span>Data diperbarui</span>
            )}
          </div>
        )}
      </div>

      {showWarning && (
        <div className="admin-idle-overlay">
          <div className="admin-idle-modal">
            <Timer size={32} aria-hidden="true" />
            <h2>Sesi akan berakhir</h2>
            <p>
              Anda tidak aktif selama beberapa saat. Sesi akan otomatis keluar dalam{" "}
              <strong>{remainingSeconds} detik</strong>.
            </p>
            <button
              type="button"
              className="button button-primary"
              onClick={extendSession}
            >
              Perpanjang Sesi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminLogin({
  onAuthenticated,
  onTwoFactorRequired,
  onCancel,
}: {
  onAuthenticated: (session: AdminSession) => void;
  onTwoFactorRequired: () => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    apiLogin(email.trim(), password)
      .then((result) => {
        if (result.requires2fa || !result.user) {
          onTwoFactorRequired();
          return;
        }

        onAuthenticated({
          email: result.user.email,
          name: result.user.name,
          role: result.user.roleLabel,
          loggedAt: new Date().toISOString(),
        });
      })
      .catch((err) => {
        setLoading(false);
        if (err instanceof ValidationError) {
          const first = Object.values(err.errors).flat()[0];
          setError(first ?? "Email atau password salah. Coba lagi.");
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Tidak dapat menghubungi server. Coba lagi.");
        }
      });
  };

  return (
    <div className="admin-login">
      <button type="button" className="admin-login-back" onClick={onCancel}>
        <ArrowLeft size={16} aria-hidden="true" />
        Kembali ke beranda
      </button>

      <div className="admin-login-card">
        <div className="admin-login-brand">
          <img src={ASSETS.logoGold} alt="Gedung Agung" />
          <strong>ISTURA Admin</strong>
        </div>
        <h1>Masuk ke dashboard</h1>
        <p>
          Akses ini terbatas untuk pengelola Istana Kepresidenan Yogyakarta. Gunakan akun admin
          yang diberikan operator.
        </p>

        <form className="admin-login-form" onSubmit={submit} noValidate>
          <label className="form-field">
            <span>Email</span>
            <span className="admin-login-input">
              <Mail size={16} aria-hidden="true" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Masukkan email admin"
                required
              />
            </span>
          </label>
          <label className="form-field">
            <span>Password</span>
            <span className="admin-login-input">
              <Lock size={16} aria-hidden="true" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Kata sandi"
                required
              />
              <button
                type="button"
                className="admin-login-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
              >
                {showPassword ? "Sembunyikan" : "Lihat"}
              </button>
            </span>
          </label>

          {error && <strong className="form-message form-message--error">{error}</strong>}

			<button
				type="submit"
				className="button button-primary admin-login-submit"
				disabled={loading}
			>
				{loading ? <ButtonSpinner label="Memeriksa..." /> : "Masuk"}
				{!loading && <ArrowRight size={18} aria-hidden="true" />}
			</button>
        </form>
      </div>
    </div>
  );
}

export function AdminPlaceholder({ tab }: { tab: AdminTab }) {
  const item = ADMIN_MENU.find((entry) => entry.key === tab);
  return (
    <div className="admin-placeholder">
      <div className="admin-placeholder-card">
        <span className="admin-placeholder-badge">Segera hadir</span>
        <h1>{item?.label ?? "Halaman ini sedang disiapkan"}</h1>
        <p>
          Modul ini akan tersedia setelah modul backend dan CMS terhubung. Untuk sementara, gunakan
          menu Booking untuk mengelola permohonan kunjungan.
        </p>
        <ul>
          <li>Data masih dirakit dari sumber resmi.</li>
          <li>Fitur akan diaktifkan secara bertahap setelah migrasi data selesai.</li>
        </ul>
      </div>
    </div>
  );
}
