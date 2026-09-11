import { createFileRoute, Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { login, loginWithGoogle } from "@/integrations/auth0/client";
import { useAuth } from "@/lib/useAuth";
import logoAsset from "@/assets/maujajan-logo.png.asset.json";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Masuk / Daftar — MAUJAJAN INDONESIA" },
      { name: "description", content: "Masuk atau daftar untuk mulai jajan dan berjualan di MAUJAJAN INDONESIA." },
      { property: "og:title", content: "Masuk — MAUJAJAN INDONESIA" },
      { property: "og:description", content: "Masuk atau daftar akun MAUJAJAN INDONESIA." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/" });
  }, [loading, user, nav]);

  async function continueGeneric() {
    setBusy(true);
    try {
      await login();
    } catch (err: any) {
      toast.error(err.message ?? "Terjadi kesalahan");
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      toast.error(err.message ?? "Gagal masuk dengan Google");
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <div className="auth-wrap">
        <img src={logoAsset.url} alt="Maujajan Indonesia" className="brand-mark" width={200} height={200} />
        <h1>Masuk ke MAUJAJAN</h1>
        <p>Mulai jajan atau buka lapak sendiri. Wajib masuk untuk menggunakan aplikasi.</p>

        <button className="google-btn" onClick={google} disabled={busy} type="button">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Lanjutkan dengan Google
        </button>

        <div className="divider-label">atau</div>

        <button className="btn btn-primary btn-block" disabled={busy} type="button" onClick={continueGeneric} style={{ maxWidth: 320 }}>
          {busy ? "Mengalihkan..." : "Masuk / Daftar dengan Email"}
        </button>
        <p style={{ marginTop: 8, fontSize: 12, color: "var(--ink-soft)" }}>
          Kamu akan diarahkan ke halaman masuk resmi — bisa daftar akun baru atau masuk dengan akun yang sudah ada.
        </p>

        <p style={{ marginTop: 24, fontSize: 11.5, color: "var(--ink-soft)", maxWidth: 320, lineHeight: 1.5 }}>
          Dengan lanjut, kamu setuju pada{" "}
          <Link to="/terms" style={{ color: "var(--gold)", fontWeight: 600 }}>Syarat Layanan</Link>{" "}
          dan{" "}
          <Link to="/privacy" style={{ color: "var(--gold)", fontWeight: 600 }}>Kebijakan Privasi</Link> kami.
        </p>
      </div>
    </div>
  );
}
