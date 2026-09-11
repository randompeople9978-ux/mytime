import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, MapPin, Lock, LogOut, Trash2, Moon, HelpCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { logout as auth0Logout, requestPasswordReset } from "@/integrations/auth0/client";
import { useAuth } from "@/lib/useAuth";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { clearUserLocation, getCurrentPosition, loadUserLocation, saveUserLocation } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const PREF_KEY = "mj:prefs";
interface Prefs {
  notifyMessages: boolean;
  notifyFriends: boolean;
  compact: boolean;
}
const DEFAULTS: Prefs = { notifyMessages: true, notifyFriends: true, compact: false };

function SettingsPage() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [hasLoc, setHasLoc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    setHasLoc(!!loadUserLocation());
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  function update(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    localStorage.setItem(PREF_KEY, JSON.stringify(next));
    toast.success("Pengaturan disimpan.");
  }

  async function changePassword() {
    if (!user?.email) return toast.error("Email tidak ditemukan.");
    setBusy(true);
    try {
      await requestPasswordReset(user.email);
      toast.success("Email pengaturan ulang kata sandi terkirim. Cek inbox kamu.");
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal mengirim email.");
    }
    setBusy(false);
  }

  async function logout() {
    await auth0Logout();
  }

  async function wipeChats() {
    setConfirmWipe(false);
    if (!user) return;
    const { error } = await supabase.from("direct_messages").delete().eq("sender_id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Semua pesan yang kamu kirim sudah dihapus.");
  }

  async function toggleLocation() {
    if (hasLoc) {
      clearUserLocation();
      setHasLoc(false);
      return toast.success("Lokasi dimatikan.");
    }
    try {
      saveUserLocation(await getCurrentPosition());
      setHasLoc(true);
      toast.success("Lokasi diaktifkan.");
    } catch (e: any) {
      toast.error(e?.message || "Gagal aktifkan lokasi");
    }
  }

  return (
    <Shell>
      <div style={{ padding: "18px 18px 6px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 22, margin: "0 0 4px" }}>Pengaturan</h1>
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: 0 }}>Atur notifikasi, privasi, lokasi, dan keamanan akun.</p>
      </div>

      <div className="section"><h2><Bell size={16} color="var(--gold)" /> Notifikasi</h2></div>
      <div style={{ padding: "0 18px" }}>
        <div className="card" style={{ padding: 14 }}>
          <label className="switch-row">
            <span>Pesan baru</span>
            <input type="checkbox" checked={prefs.notifyMessages} onChange={(e) => update({ notifyMessages: e.target.checked })} />
          </label>
          <label className="switch-row">
            <span>Permintaan pertemanan</span>
            <input type="checkbox" checked={prefs.notifyFriends} onChange={(e) => update({ notifyFriends: e.target.checked })} />
          </label>
        </div>
      </div>

      <div className="section"><h2><Moon size={16} color="var(--gold)" /> Tampilan</h2></div>
      <div style={{ padding: "0 18px" }}>
        <div className="card" style={{ padding: 14 }}>
          <label className="switch-row">
            <span>Mode padat (list lebih rapat)</span>
            <input type="checkbox" checked={prefs.compact} onChange={(e) => update({ compact: e.target.checked })} />
          </label>
        </div>
      </div>

      <div className="section"><h2><MapPin size={16} color="var(--gold)" /> Lokasi</h2></div>
      <div style={{ padding: "0 18px" }}>
        <div className="card" style={{ padding: 14 }}>
          <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 10px" }}>
            {hasLoc ? "Lokasi tersimpan di perangkat ini." : "Aktifkan untuk melihat jualan terdekat."}
          </p>
          <button className={`btn btn-sm ${hasLoc ? "btn-outline" : "btn-gold"}`} onClick={toggleLocation}>
            {hasLoc ? "Matikan lokasi" : "Aktifkan lokasi"}
          </button>
        </div>
      </div>

      <div className="section"><h2><Lock size={16} color="var(--gold)" /> Keamanan</h2></div>
      <div style={{ padding: "0 18px" }}>
        <div className="card" style={{ padding: 14 }}>
          <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 10 }}>
            Kata sandi dikelola lewat halaman masuk resmi. Klik tombol di bawah untuk menerima
            email pengaturan ulang kata sandi.
          </p>
          <button className="btn btn-primary btn-sm" onClick={changePassword} disabled={busy}>
            {busy ? "Mengirim..." : "Kirim email ubah kata sandi"}
          </button>
        </div>
      </div>

      <div className="section"><h2><ShieldCheck size={16} color="var(--gold)" /> Privasi</h2></div>
            <Link to="/help" className="list-row" style={{ textDecoration: "none" }}>
        <HelpCircle size={17} /> <span style={{ flex: 1, fontWeight: 500 }}>Tutorial pemakaian</span>
      </Link>
      <button className="list-row" onClick={() => setConfirmWipe(true)} style={{ width: "100%", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "var(--danger)" }}>
        <Trash2 size={17} /> <span style={{ flex: 1, fontWeight: 500 }}>Hapus semua pesan saya</span>
      </button>
      <button className="list-row" onClick={() => setConfirmLogout(true)} style={{ width: "100%", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "var(--danger)" }}>
        <LogOut size={17} /> <span style={{ flex: 1, fontWeight: 500 }}>Keluar dari akun</span>
      </button>

      <ConfirmDialog
        open={confirmLogout}
        title="Keluar dari akun?"
        message="Kamu harus login ulang untuk mengakses jualan, chat, dan wishlist."
        confirmLabel="Ya, keluar"
        danger
        onConfirm={logout}
        onCancel={() => setConfirmLogout(false)}
      />
      <ConfirmDialog
        open={confirmWipe}
        title="Hapus semua pesan yang kamu kirim?"
        message="Pesan akan hilang dari semua percakapan dan tidak bisa dikembalikan."
        confirmLabel="Ya, hapus"
        danger
        onConfirm={wipeChats}
        onCancel={() => setConfirmWipe(false)}
      />
    </Shell>
  );
}
