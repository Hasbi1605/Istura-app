import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Shield, Copy, Check, ArrowRight } from "lucide-react";
import { twoFactorSetup, twoFactorConfirm } from "../../api/auth";
import { ValidationError, ApiError } from "../../api/client";
import { ButtonSpinner } from "../ui/LoadingStates";
import { ASSETS } from "../../lib/assets";

type Step = "loading" | "scan" | "confirm" | "recovery";

/**
 * Mandatory 2FA setup screen shown when admin hasn't enabled 2FA yet.
 */
export function TwoFactorSetup({
  onComplete,
  onCancel,
}: {
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>("loading");
  const [qrSvg, setQrSvg] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Start setup once after mount. Do not run this during render.
  useEffect(() => {
    let cancelled = false;

    twoFactorSetup()
      .then((res) => {
        if (cancelled) return;
        setQrSvg(res.qr_svg);
        setSecret(res.secret);
        setStep("scan");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Gagal memulai setup 2FA.");
        setStep("scan");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const confirmCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code.trim()) return;

    setError("");
    setLoading(true);

    twoFactorConfirm(code.trim())
      .then((res) => {
        setRecoveryCodes(res.recovery_codes);
        setStep("recovery");
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        if (err instanceof ValidationError) {
          const first = Object.values(err.errors).flat()[0];
          setError(first ?? "Kode tidak valid.");
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Gagal memverifikasi kode.");
        }
      });
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="admin-login">
      <button type="button" className="admin-login-back" onClick={onCancel}>
        Batalkan &amp; keluar
      </button>

      <div className="admin-login-card" style={{ maxWidth: 440 }}>
        <div className="admin-login-brand">
          <img src={ASSETS.logoGold} alt="Gedung Agung" />
          <strong>ISTURA Admin</strong>
        </div>

        {step === "loading" && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <ButtonSpinner label="Menyiapkan 2FA..." />
          </div>
        )}

        {step === "scan" && (
          <>
            <h1>
              <Shield size={20} style={{ display: "inline", marginRight: 8, verticalAlign: "middle" }} />
              Aktifkan Verifikasi 2 Langkah
            </h1>
            <p style={{ marginBottom: 8 }}>
              Untuk keamanan, Anda <strong>wajib</strong> mengaktifkan 2FA sebelum mengakses dashboard admin.
            </p>
            <p style={{ fontSize: "0.85rem", marginBottom: 16 }}>
              1. Install aplikasi <strong>Google Authenticator</strong> atau <strong>Authy</strong> di HP Anda.<br />
              2. Scan QR code di bawah ini dengan aplikasi tersebut.
            </p>

            {qrSvg && (
              <div
                className="admin-2fa-qr"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
                style={{ display: "flex", justifyContent: "center", margin: "1rem 0", background: "#fff", borderRadius: 8, padding: 12 }}
              />
            )}

            <div style={{ fontSize: "0.8rem", textAlign: "center", marginBottom: 16 }}>
              <span style={{ color: "#666" }}>Atau masukkan kode manual:</span>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}>
                <code style={{ fontSize: "0.75rem", letterSpacing: 1, wordBreak: "break-all" }}>{secret}</code>
                <button type="button" onClick={copySecret} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <form className="admin-login-form" onSubmit={confirmCode} noValidate>
              <label className="form-field">
                <span>Masukkan kode 6 digit dari aplikasi</span>
                <span className="admin-login-input">
                  <Shield size={16} aria-hidden="true" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    required
                    autoFocus
                  />
                </span>
              </label>

              {error && <strong className="form-message form-message--error">{error}</strong>}

              <button
                type="submit"
                className="button button-primary admin-login-submit"
                disabled={loading || code.length < 6}
              >
                {loading ? <ButtonSpinner label="Memverifikasi..." /> : "Konfirmasi & Aktifkan"}
                {!loading && <ArrowRight size={18} aria-hidden="true" />}
              </button>
            </form>
          </>
        )}

        {step === "recovery" && (
          <>
            <h1>
              <Shield size={20} style={{ display: "inline", marginRight: 8, verticalAlign: "middle" }} />
              Simpan Kode Pemulihan
            </h1>
            <p style={{ marginBottom: 8 }}>
              2FA berhasil diaktifkan! Simpan kode pemulihan di bawah ini di tempat yang aman.
              Kode ini bisa digunakan jika HP Anda hilang.
            </p>
            <p style={{ fontSize: "0.82rem", color: "#c00", marginBottom: 12 }}>
              Kode ini hanya ditampilkan sekali. Pastikan Anda sudah menyimpannya.
            </p>

            <div className="admin-2fa-recovery-codes" style={{ background: "#f5f5f3", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", fontFamily: "monospace", fontSize: "0.85rem" }}>
                {recoveryCodes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <button
                type="button"
                onClick={copyCodes}
                style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #ddd", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: "0.8rem" }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Tersalin!" : "Salin semua kode"}
              </button>
            </div>

            <button
              type="button"
              className="button button-primary admin-login-submit"
              onClick={onComplete}
              style={{ width: "100%" }}
            >
              Saya sudah menyimpan, lanjut ke dashboard
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
