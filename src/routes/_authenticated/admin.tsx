import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/lib/useAuth";
import { toast } from "sonner";
import { Trash2, ShieldAlert, Wrench, Search, ImagePlus, Eye, EyeOff, Megaphone } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { uploadImage, validateImageFile } from "@/lib/imageUpload";
import { createAd, deleteAd, fetchAllAds, setAdActive, setAdInterval, setAdOrder, type Ad } from "@/lib/ads";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Tab = "reports" | "listings" | "bugs" | "users" | "ads";
interface Report { id: string; listing_id: string; reason: string; description: string | null; priority: boolean; status: string; created_at: string; reporter_id: string }
interface AdminListing { id: string; name: string; category: string; owner_id: string; is_open: boolean }
interface BugRow { id: string; user_id: string | null; title: string; description: string; status: string; created_at: string }
interface UserRow { id: string; display_name: string | null; location: string | null; avatar_url: string | null; isAdmin: boolean }


function AdminPage() {
  const { isAdmin, loading, user } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [bugs, setBugs] = useState<BugRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userQ, setUserQ] = useState("");
  const [maintenance, setMaintenance] = useState(false);
  const [maintMsg, setMaintMsg] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [confirmMaint, setConfirmMaint] = useState(false);
  const [ads, setAds] = useState<Ad[]>([]);
  const [adInterval, setAdIntervalState] = useState<5 | 10>(5);
  const [adTitle, setAdTitle] = useState("");
  const [adLink, setAdLink] = useState("");
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [confirmAdDel, setConfirmAdDel] = useState<string | null>(null);
  const adFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && user && !isAdmin) nav({ to: "/" });
  }, [loading, user, isAdmin]);

  async function load() {
    setLoadingData(true);
    const [r, l, b, p, ur, st] = await Promise.all([
      supabase.from("reports").select("*").order("priority", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("listings").select("id,name,category,owner_id,is_open").order("created_at", { ascending: false }),
      supabase.from("bug_reports").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,display_name,location,avatar_url").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id,role"),
      supabase.from("site_settings").select("maintenance_mode,maintenance_message,ads_interval_seconds").eq("id", "global").maybeSingle(),
    ]);
    try {
      setAds(await fetchAllAds());
    } catch (e) {
      toast.error("Iklan: " + (e as Error).message);
    }
    setAdIntervalState(Number(st.data?.ads_interval_seconds) === 10 ? 10 : 5);
    if (r.error) toast.error("Laporan: " + r.error.message);
    if (l.error) toast.error("Jualan: " + l.error.message);
    if (b.error) toast.error("Bug: " + b.error.message);
    if (p.error) toast.error("Pengguna: " + p.error.message);
    setReports((r.data as Report[]) ?? []);
    setListings((l.data as AdminListing[]) ?? []);
    setBugs((b.data as BugRow[]) ?? []);
    const adminIds = new Set(((ur.data as { user_id: string; role: string }[]) ?? []).filter((x) => x.role === "admin").map((x) => x.user_id));
    setUsers(((p.data as Omit<UserRow, "isAdmin">[]) ?? []).map((u) => ({ ...u, isAdmin: adminIds.has(u.id) })));
    setMaintenance(!!st.data?.maintenance_mode);
    setMaintMsg(st.data?.maintenance_message ?? "");
    setLoadingData(false);
  }
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  async function deleteListing() {
    if (!confirmDel) return;
    const id = confirmDel;
    setConfirmDel(null);
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Jualan dihapus."); load(); }
  }
  async function setReportStatus(id: string, status: "resolved" | "dismissed") {
    const { error } = await supabase.from("reports").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Status diperbarui."); load(); }
  }
  async function setBugStatus(id: string, status: "resolved" | "dismissed") {
    const { error } = await supabase.from("bug_reports").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Status diperbarui."); load(); }
  }
  async function toggleRole(u: UserRow) {
    if (u.id === user?.id) { toast.error("Kamu tidak bisa mencabut peran admin milikmu sendiri."); return; }
    if (u.isAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", "admin");
      if (error) { toast.error(error.message); return; }
      toast.success(`${u.display_name ?? "Akun"} bukan admin lagi.`);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: u.id, role: "admin" });
      if (error) { toast.error(error.message); return; }
      toast.success(`${u.display_name ?? "Akun"} sekarang admin.`);
    }
    load();
  }
  async function applyMaintenance(next: boolean) {
    const { error } = await supabase
      .from("site_settings")
      .update({ maintenance_mode: next, maintenance_message: maintMsg || null })
      .eq("id", "global");
    if (error) { toast.error(error.message); return; }
    setMaintenance(next);
    toast.success(next ? "Mode perbaikan aktif — hanya admin bisa masuk." : "Mode perbaikan dimatikan.");
  }

  async function handleAdFiles(files: FileList | null) {
    if (!files || !files.length || !user) return;
    const list = Array.from(files);
    setUploading({ done: 0, total: list.length });
    let base = ads.length ? Math.max(...ads.map((a) => a.sort_order)) + 1 : 0;
    let ok = 0;
    for (const file of list) {
      const bad = validateImageFile(file);
      if (bad) { toast.error(`${file.name}: ${bad}`); setUploading((u) => u && { ...u, done: u.done + 1 }); continue; }
      try {
        const url = await uploadImage("ads", user.id, file);
        await createAd({ imageUrl: url, title: adTitle || null, targetUrl: adLink || null, sortOrder: base++, createdBy: user.id });
        ok++;
      } catch (e) {
        toast.error(`${file.name}: ${(e as Error).message}`);
      }
      setUploading((u) => u && { ...u, done: u.done + 1 });
    }
    setUploading(null);
    if (adFileRef.current) adFileRef.current.value = "";
    setAdTitle(""); setAdLink("");
    if (ok) toast.success(`${ok} banner iklan diunggah.`);
    setAds(await fetchAllAds());
  }

  async function toggleAd(a: Ad) {
    try { await setAdActive(a.id, !a.is_active); setAds(await fetchAllAds()); }
    catch (e) { toast.error((e as Error).message); }
  }

  async function moveAd(a: Ad, dir: -1 | 1) {
    const sorted = [...ads];
    const i = sorted.findIndex((x) => x.id === a.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    try {
      await Promise.all(sorted.map((x, idx) => (x.sort_order === idx ? null : setAdOrder(x.id, idx))));
      setAds(await fetchAllAds());
    } catch (e) { toast.error((e as Error).message); }
  }

  async function removeAd() {
    if (!confirmAdDel) return;
    const id = confirmAdDel;
    setConfirmAdDel(null);
    try { await deleteAd(id); toast.success("Iklan dihapus."); setAds(await fetchAllAds()); }
    catch (e) { toast.error((e as Error).message); }
  }

  async function changeInterval(sec: 5 | 10) {
    try { await setAdInterval(sec); setAdIntervalState(sec); toast.success(`Durasi geser ${sec} detik.`); }
    catch (e) { toast.error((e as Error).message); }
  }

  const filteredUsers = useMemo(() => {
    const q = userQ.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.display_name ?? "").toLowerCase().includes(q) || u.id.toLowerCase().includes(q));
  }, [users, userQ]);

  if (loading) return <Shell><p style={{ padding: 30, textAlign: "center" }}>Memuat...</p></Shell>;
  if (!isAdmin) return null;

  const priorityCount = reports.filter((r) => r.priority && r.status === "pending").length;

  return (
    <Shell>
      <div className="section">
        <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldAlert size={20} color="var(--gold)" /> Panel Admin
        </h2>
        {priorityCount > 0 && (
          <div style={{ background: "var(--danger)", color: "#fff", padding: 10, borderRadius: 8, fontSize: 12.5, marginTop: 8 }}>
            {priorityCount} laporan prioritas menunggu tindakan
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8, marginTop: 12 }}>
          {[["Pengguna", users.length], ["Jualan", listings.length], ["Laporan", reports.length], ["Bug", bugs.length]].map(([k, v]) => (
            <div key={String(k)} className="card" style={{ padding: 12 }}>
              <b style={{ fontSize: 18, fontFamily: "var(--font-serif)" }}>{v as number}</b>
              <div style={{ fontSize: 10.5, textTransform: "uppercase", color: "var(--ink-soft)" }}>{k as string}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Wrench size={16} color="var(--gold)" />
            <b style={{ fontSize: 13.5 }}>Mode perbaikan situs</b>
            <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: maintenance ? "var(--danger)" : "var(--ink-soft)" }}>
              {maintenance ? "AKTIF" : "NONAKTIF"}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "8px 0" }}>
            Saat aktif, hanya akun admin yang bisa membuka situs. Pengunjung lain melihat halaman perbaikan.
          </p>
          <textarea className="field" value={maintMsg} onChange={(e) => setMaintMsg(e.target.value)} placeholder="Pesan untuk pengunjung (opsional)" />
          <div style={{ display: "flex", gap: 8 }}>
            {maintenance ? (
              <button className="btn btn-primary btn-sm" onClick={() => applyMaintenance(false)}>Matikan mode perbaikan</button>
            ) : (
              <button className="btn btn-danger btn-sm" onClick={() => setConfirmMaint(true)}>Aktifkan mode perbaikan</button>
            )}
            <button className="btn btn-outline btn-sm" onClick={load}>Muat ulang</button>
          </div>
        </div>
      </div>

      <div className="admin-tab-bar">
        <button className={`admin-tab ${tab === "reports" ? "active" : ""}`} onClick={() => setTab("reports")}>Laporan ({reports.length})</button>
        <button className={`admin-tab ${tab === "listings" ? "active" : ""}`} onClick={() => setTab("listings")}>Jualan ({listings.length})</button>
        <button className={`admin-tab ${tab === "bugs" ? "active" : ""}`} onClick={() => setTab("bugs")}>Bug ({bugs.length})</button>
        <button className={`admin-tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>Pengguna ({users.length})</button>
        <button className={`admin-tab ${tab === "ads" ? "active" : ""}`} onClick={() => setTab("ads")}>Iklan ({ads.length})</button>
      </div>

      {loadingData && <p style={{ padding: 16, textAlign: "center", color: "var(--ink-soft)" }}>Memuat data...</p>}

      {tab === "reports" && (
        <div>
          {!loadingData && reports.length === 0 && <p style={{ padding: 20, color: "var(--ink-soft)" }}>Belum ada laporan.</p>}
          {reports.map((r) => (
            <div key={r.id} className="list-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <b style={{ fontSize: 13 }}>{r.reason.toUpperCase()}</b>
                {r.priority && <span className="pill-priority">PRIORITAS</span>}
                <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--ink-soft)" }}>{r.status}</span>
              </div>
              {r.description && <p style={{ fontSize: 12.5, margin: 0, color: "var(--ink-soft)" }}>{r.description}</p>}
              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <Link to="/detail/$id" params={{ id: r.listing_id }} className="btn btn-outline btn-sm">Lihat Jualan</Link>
                <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(r.listing_id)}><Trash2 size={12} /> Hapus Jualan</button>
                <button className="btn btn-outline btn-sm" onClick={() => setReportStatus(r.id, "resolved")}>Selesai</button>
                <button className="btn btn-outline btn-sm" onClick={() => setReportStatus(r.id, "dismissed")}>Tolak</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "listings" && (
        <div>
          {!loadingData && listings.length === 0 && <p style={{ padding: 20, color: "var(--ink-soft)" }}>Belum ada jualan.</p>}
          {listings.map((l) => (
            <div key={l.id} className="list-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{l.name}</div>
                <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{l.category} • pemilik {l.owner_id.slice(0, 8)} • {l.is_open ? "Buka" : "Tutup"}</div>
              </div>
              <Link to="/detail/$id" params={{ id: l.id }} className="btn btn-outline btn-sm">Lihat</Link>
              <Link to="/edit/$id" params={{ id: l.id }} className="btn btn-outline btn-sm">Edit</Link>
              <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(l.id)}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {tab === "bugs" && (
        <div>
          {!loadingData && bugs.length === 0 && <p style={{ padding: 20, color: "var(--ink-soft)" }}>Belum ada bug dilaporkan.</p>}
          {bugs.map((b) => (
            <div key={b.id} className="list-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <b style={{ fontSize: 13 }}>{b.title}</b>
                <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--ink-soft)" }}>{b.status}</span>
              </div>
              <p style={{ fontSize: 12.5, margin: 0, color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{b.description}</p>
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button className="btn btn-outline btn-sm" onClick={() => setBugStatus(b.id, "resolved")}>Selesai</button>
                <button className="btn btn-outline btn-sm" onClick={() => setBugStatus(b.id, "dismissed")}>Tolak</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && (
        <div>
          <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={15} color="var(--ink-soft)" />
            <input className="field" style={{ margin: 0 }} value={userQ} onChange={(e) => setUserQ(e.target.value)} placeholder="Cari nama akun..." />
          </div>
          {!loadingData && filteredUsers.length === 0 && <p style={{ padding: 20, color: "var(--ink-soft)" }}>Tidak ada akun yang cocok.</p>}
          {filteredUsers.map((u) => (
            <div key={u.id} className="list-row">
              <div style={{ width: 34, height: 34, borderRadius: 999, overflow: "hidden", background: "var(--cream)", flex: "none", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>
                {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (u.display_name ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{u.display_name ?? "Tanpa nama"} {u.isAdmin && <span className="pill-priority" style={{ marginLeft: 4 }}>ADMIN</span>}</div>
                <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{u.location || "—"} • {u.id.slice(0, 8)}</div>
              </div>
              <button className={`btn btn-sm ${u.isAdmin ? "btn-outline" : "btn-gold"}`} onClick={() => toggleRole(u)}>
                {u.isAdmin ? "Cabut admin" : "Jadikan admin"}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "ads" && (
        <div>
          <div className="card" style={{ padding: 14, margin: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Megaphone size={16} color="var(--gold)" />
              <b style={{ fontSize: 13.5 }}>Banner iklan beranda</b>
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "8px 0" }}>
              Gunakan gambar landscape (16:9). Bisa pilih banyak foto sekaligus.
            </p>
            <input className="field" value={adTitle} onChange={(e) => setAdTitle(e.target.value)} placeholder="Judul iklan (opsional)" />
            <input className="field" value={adLink} onChange={(e) => setAdLink(e.target.value)} placeholder="Link tujuan saat diklik (opsional)" />
            <input
              ref={adFileRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => handleAdFiles(e.target.files)}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn btn-primary btn-sm" disabled={!!uploading} onClick={() => adFileRef.current?.click()}>
                <ImagePlus size={13} /> {uploading ? `Mengunggah ${uploading.done}/${uploading.total}...` : "Pilih foto dari galeri"}
              </button>
              <span style={{ fontSize: 11.5, color: "var(--ink-soft)", marginLeft: "auto" }}>Durasi geser</span>
              <button className={`btn btn-sm ${adInterval === 5 ? "btn-gold" : "btn-outline"}`} onClick={() => changeInterval(5)}>5 detik</button>
              <button className={`btn btn-sm ${adInterval === 10 ? "btn-gold" : "btn-outline"}`} onClick={() => changeInterval(10)}>10 detik</button>
            </div>
          </div>

          {ads.length === 0 && <p style={{ padding: 20, color: "var(--ink-soft)" }}>Belum ada iklan.</p>}
          {ads.map((a, i) => (
            <div key={a.id} className="list-row">
              <div style={{ width: 84, aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", background: "var(--cream)", flex: "none" }}>
                <img src={a.image_url} alt={a.title ?? "Iklan"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title || "Tanpa judul"}</div>
                <div style={{ fontSize: 11, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  #{i + 1} • {a.is_active ? "Aktif" : "Nonaktif"}{a.target_url ? ` • ${a.target_url}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button className="btn btn-outline btn-sm" onClick={() => moveAd(a, -1)} disabled={i === 0}>↑</button>
                <button className="btn btn-outline btn-sm" onClick={() => moveAd(a, 1)} disabled={i === ads.length - 1}>↓</button>
                <button className="btn btn-outline btn-sm" onClick={() => toggleAd(a)}>
                  {a.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setConfirmAdDel(a.id)}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAdDel}
        title="Hapus iklan?"
        message="Banner iklan ini akan hilang dari beranda."
        confirmLabel="Ya, hapus"
        danger
        onConfirm={removeAd}
        onCancel={() => setConfirmAdDel(null)}
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus jualan?"
        message="Jualan akan dihapus permanen dari platform. Aksi ini tidak bisa dibatalkan."
        confirmLabel="Ya, hapus"
        danger
        onConfirm={deleteListing}
        onCancel={() => setConfirmDel(null)}
      />

      <ConfirmDialog
        open={confirmMaint}
        title="Aktifkan mode perbaikan?"
        message="Semua pengunjung non-admin akan melihat halaman perbaikan sampai kamu mematikannya."
        confirmLabel="Ya, aktifkan"
        danger
        onConfirm={() => { setConfirmMaint(false); applyMaintenance(true); }}
        onCancel={() => setConfirmMaint(false)}
      />
    </Shell>
  );
}
