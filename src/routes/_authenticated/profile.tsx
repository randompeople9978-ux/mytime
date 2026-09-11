import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logout as auth0Logout } from "@/integrations/auth0/client";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/lib/useAuth";
import { toast } from "sonner";
import { LogOut, Shield, Bug, Trash2, Pencil, MapPin, MessageCircle, HelpCircle, Settings } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { getCurrentPosition, saveUserLocation, clearUserLocation, loadUserLocation } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

interface Profile { username: string; display_name: string | null; phone: string | null; bio: string | null; location: string | null; avatar_url: string | null }
interface MyListing { id: string; name: string; category: string; is_open: boolean }

function ProfilePage() {
  const { user, isAdmin } = useAuth();
  const [p, setP] = useState<Profile>({ username: "", display_name: "", phone: "", bio: "", location: "", avatar_url: null });
  const [mine, setMine] = useState<MyListing[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [hasLoc, setHasLoc] = useState(!!loadUserLocation());

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("username,display_name,phone,bio,location,avatar_url").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) setP(data);
    });
    supabase.from("listings").select("id,name,category,is_open").eq("owner_id", user.id).order("created_at", { ascending: false }).then(({ data }) => {
      setMine((data as MyListing[]) ?? []);
    });
  }, [user?.id]);

  async function save() {
    if (!user) return;
    const uname = p.username.trim();
    if (!/^[a-zA-Z0-9._]{3,20}$/.test(uname)) {
      toast.error("Username 3-20 karakter, hanya huruf, angka, titik, dan garis bawah.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ ...p, username: uname, onboarded: true }).eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message.toLowerCase().includes("username") ? "Username sudah dipakai akun lain." : error.message);
      return;
    }
    toast.success("Profil disimpan. Akunmu kini terdaftar di pencarian global.");
  }

  async function logout() {
    await auth0Logout();
  }

  async function deleteMy() {
    if (!confirmDelete) return;
    const id = confirmDelete;
    setConfirmDelete(null);
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { setMine((m) => m.filter((x) => x.id !== id)); toast.success("Dihapus."); }
  }

  async function enableLocation() {
    try {
      const loc = await getCurrentPosition();
      saveUserLocation(loc);
      setHasLoc(true);
      toast.success("Lokasi diaktifkan. Kamu bisa lihat jualan terdekat sekarang.");
    } catch (e: any) { toast.error(e?.message || "Gagal aktifkan lokasi"); }
  }
  function disableLocation() { clearUserLocation(); setHasLoc(false); toast.success("Lokasi dimatikan."); }

  return (
    <Shell>
      <div style={{ background: "linear-gradient(135deg, var(--maroon), var(--gold))", padding: "26px 20px 60px", color: "var(--cream)" }}>
        <div style={{ width: 84, height: 84, borderRadius: "50%", background: "var(--surface)", color: "var(--maroon)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: 28, border: "3px solid var(--cream)", margin: "0 auto", overflow: "hidden" }}>
          {p.avatar_url ? <img src={p.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (p.display_name || user?.email || "?").slice(0, 1).toUpperCase()}
        </div>
        <p style={{ textAlign: "center", marginTop: 10, fontFamily: "var(--font-serif)", fontSize: 18 }}>{p.display_name || user?.email}</p>
        <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,248,238,.9)", margin: 0 }}>{user?.email}</p>
        {isAdmin && <p style={{ textAlign: "center", marginTop: 8 }}><span className="pill-role">ADMIN</span></p>}
      </div>

      <div style={{ padding: "0 18px", marginTop: -30 }}>
        <div className="card" style={{ padding: 16 }}>
          {user && <ImageUpload bucket="avatars" userId={user.id} value={p.avatar_url} onChange={(v) => setP({ ...p, avatar_url: v })} label="Foto Profil" />}
          <label className="lbl">Username (unik)</label>
          <input className="field" value={p.username} onChange={(e) => setP({ ...p, username: e.target.value.trim() })} placeholder="mis. budi.jajan" maxLength={20} />
          <label className="lbl">Nama Tampilan</label>
          <input className="field" value={p.display_name ?? ""} onChange={(e) => setP({ ...p, display_name: e.target.value })} />
          <label className="lbl">Nomor WhatsApp</label>
          <input className="field" value={p.phone ?? ""} onChange={(e) => setP({ ...p, phone: e.target.value })} placeholder="628..." />
          <label className="lbl">Lokasi</label>
          <input className="field" value={p.location ?? ""} onChange={(e) => setP({ ...p, location: e.target.value })} placeholder="Jakarta" />
          <label className="lbl">Bio</label>
          <textarea className="field" value={p.bio ?? ""} onChange={(e) => setP({ ...p, bio: e.target.value })} />
          <button className="btn btn-primary btn-block" onClick={save} disabled={busy} style={{ marginTop: 14 }}>
            {busy ? "Menyimpan..." : "Simpan Profil"}
          </button>
        </div>
      </div>

      <div className="section">
        <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}><MapPin size={18} color="var(--gold)" /> Lokasi Saya</h2>
      </div>
      <div style={{ padding: "0 18px" }}>
        <div className="card" style={{ padding: 14 }}>
          <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 10px" }}>
            {hasLoc
              ? "Lokasi kamu tersimpan di perangkat ini. Kami pakai untuk menampilkan jualan terdekat."
              : "Aktifkan agar bisa melihat jarak & jualan di sekitarmu."}
          </p>
          {hasLoc ? (
            <button className="btn btn-outline btn-sm" onClick={disableLocation}>Matikan lokasi</button>
          ) : (
            <button className="btn btn-gold btn-sm" onClick={enableLocation}><MapPin size={13} /> Aktifkan lokasi</button>
          )}
        </div>
      </div>

      <div className="section">
        <h2>Jualanku ({mine.length})</h2>
      </div>
      {mine.length === 0 ? (
        <p style={{ padding: "0 18px", color: "var(--ink-soft)", fontSize: 13 }}>Belum ada. <Link to="/new" style={{ color: "var(--gold)" }}>Buka lapak</Link></p>
      ) : mine.map((l) => (
        <div key={l.id} className="list-row">
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{l.name}</div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{l.category} • {l.is_open ? "Buka" : "Tutup"}</div>
          </div>
          <Link to="/edit/$id" params={{ id: l.id }} className="btn btn-outline btn-sm"><Pencil size={12} /></Link>
          <Link to="/detail/$id" params={{ id: l.id }} className="btn btn-outline btn-sm">Lihat</Link>
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(l.id)}><Trash2 size={13} /></button>
        </div>
      ))}

      <div className="section" style={{ marginTop: 20 }}>
        <h2>Menu</h2>
      </div>
      <Link to="/messages" className="list-row" style={{ textDecoration: "none" }}>
        <MessageCircle size={18} /> <span style={{ flex: 1, fontWeight: 500 }}>Pesan</span>
      </Link>
            <Link to="/help" className="list-row" style={{ textDecoration: "none" }}>
        <HelpCircle size={18} /> <span style={{ flex: 1, fontWeight: 500 }}>Tutorial Pemakaian</span>
      </Link>
      <Link to="/settings" className="list-row" style={{ textDecoration: "none" }}>
        <Settings size={18} /> <span style={{ flex: 1, fontWeight: 500 }}>Pengaturan</span>
      </Link>
      <Link to="/bug" className="list-row" style={{ textDecoration: "none" }}>
        <Bug size={18} /> <span style={{ flex: 1, fontWeight: 500 }}>Laporkan Bug</span>
      </Link>
      {isAdmin && (
        <Link to="/admin" className="list-row" style={{ textDecoration: "none" }}>
          <Shield size={18} /> <span style={{ flex: 1, fontWeight: 500 }}>Panel Admin</span>
        </Link>
      )}
      <button onClick={() => setConfirmLogout(true)} className="list-row" style={{ width: "100%", border: "none", cursor: "pointer", color: "var(--danger)", textAlign: "left", fontFamily: "inherit" }}>
        <LogOut size={18} /> <span style={{ flex: 1, fontWeight: 500 }}>Keluar</span>
      </button>

      <ConfirmDialog
        open={confirmLogout}
        title="Keluar dari akun?"
        message="Kamu harus login ulang untuk mengakses jualanmu dan wishlist."
        confirmLabel="Ya, keluar"
        cancelLabel="Batal"
        danger
        onConfirm={logout}
        onCancel={() => setConfirmLogout(false)}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        title="Hapus jualan ini?"
        message="Aksi ini tidak bisa dibatalkan. Semua reaksi dan wishlist yang terkait juga akan hilang."
        confirmLabel="Ya, hapus"
        danger
        onConfirm={deleteMy}
        onCancel={() => setConfirmDelete(null)}
      />
    </Shell>
  );
}
