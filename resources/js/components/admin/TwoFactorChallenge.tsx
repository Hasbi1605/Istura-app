import { useState } from "react";
import type { FormEvent } from "react";
import { Shield, ArrowRight } from "lucide-react";
import { twoFactorVerify } from "../../api/auth";
import { ValidationError, ApiError } from "../../api/client";
import { ButtonSpinner } from "../ui/LoadingStates";
import { ASSETS } from "../../lib/assets";

/**
 * 2FA verification screen shown after login when the user has 2FA enabled.
 * Accepts TOTP code or recovery code.
 */
export function TwoFactorChallenge({
  onVerified,
  onCancel,
}: {
  onVerified: () => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code.trim()) return;

    setError("");
    setLoading(true);

    twoFactorVerify(code.trim(), trustDevice)
      .then(() => {
        onVerified();
      })
      .catch((err) => {
        setLoading(false);
        if (err instanceof ValidationError) {
          const first = Object.values(err.errors).flat()[0];
          setError(first ?? "Kode tidak valid.");
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
        Batalkan &amp; keluar
      </button>

      <div className="admin-login-card">
        <div className="admin-login-brand">
          <img src={ASSETS.logoGold} alt="Gedung Agung" />
          <strong>ISTURA Admin</strong>
        </div>
        <h1>
          <Shield size={20} style={{ display: "inline", marginRight: 8, verticalAlign: "middle" }} />
          Verifikasi Dua Langkah
        </h1>
        <p>
          {useRecovery
            ? "Masukkan salah satu kode pemulihan (recovery code) yang Anda simpan saat mengaktifkan 2FA."
            : "Buka aplikasi authenticator Anda dan masukkan kode 6 digit yang ditampilkan."}
        </p>

        <form className="admin-login-form" onSubmit={submit} noValidate>
          <label className="form-field">
            <span>{useRecovery ? "Kode Pemulihan" : "Kode OTP"}</span>
            <span className="admin-login-input">
              <Shield size={16} aria-hidden="true" />
              <input
                type="text"
                inputMode={useRecovery ? "text" : "numeric"}
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder={useRecovery ? "XXXX-XXXX" : "123456"}
                maxLength={useRecovery ? 9 : 6}
                required
                autoFocus
              />
            </span>
          </label>

          <label className="form-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
            />
            <span style={{ fontSize: "0.85rem" }}>Percayai perangkat ini selama 30 hari</span>
          </label>

          {error && <strong className="form-message form-message--error">{error}</strong>}

          <button
            type="submit"
            className="button button-primary admin-login-submit"
            disabled={loading}
          >
            {loading ? <ButtonSpinner label="Memverifikasi..." /> : "Verifikasi"}
            {!loading && <ArrowRight size={18} aria-hidden="true" />}
          </button>
        </form>

        <button
          type="button"
          className="admin-2fa-toggle-mode"
          onClick={() => {
            setUseRecovery(!useRecovery);
            setCode("");
            setError("");
          }}
        >
          {useRecovery ? "Gunakan kode OTP dari authenticator" : "Gunakan kode pemulihan (recovery)"}
        </button>
      </div>
    </div>
  );
}
