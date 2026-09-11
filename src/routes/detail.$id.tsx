import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { MapPin, Phone, Flag, ArrowLeft, ThumbsUp, ThumbsDown, Heart, Pencil, ExternalLink, Share2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/lib/useAuth";
import { toast } from "sonner";
import { RatingBadge } from "@/components/RatingBadge";
import { ListingGallery } from "@/components/ListingGallery";
import { loadUserLocation, haversineKm, formatDistance } from "@/lib/geo";

export const Route = createFileRoute("/detail/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Penjual — MAUJAJAN INDONESIA` },
      { name: "description", content: `Detail penjual jajanan #${params.id.slice(0, 8)} di MAUJAJAN INDONESIA.` },
      { property: "og:title", content: "Detail Penjual — MAUJAJAN" },
      { property: "og:description", content: "Lihat menu, jam buka, dan hubungi penjual." },
    ],
  }),
  component: DetailPage,
});

interface Product { name: string; price: number }
interface Listing {
  id: string; owner_id: string; name: string; category: string; description: string | null;
  address: string | null; lat: number | null; lng: number | null; hours: string | null;
  days: string[] | null; is_open: boolean; image_url: string | null; qris_url: string | null; phone: string | null;
  products: Product[]; rating: number | null;
}
interface OwnerListing { id: string; name: string; category: string; image_url: string | null; is_open: boolean }

const REASONS: { v: "penipuan" | "bohong" | "berbahaya" | "spam" | "lainnya"; label: string; auto: boolean }[] = [
  { v: "penipuan", label: "Penipuan / menipu", auto: true },
  { v: "bohong", label: "Penjual berbohong (deskripsi palsu)", auto: true },
  { v: "berbahaya", label: "Barang berbahaya / tidak layak", auto: true },
  { v: "spam", label: "Spam / duplikat", auto: false },
  { v: "lainnya", label: "Lainnya", auto: false },
];

function DetailPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { user, isAdmin } = useAuth();
  const [item, setItem] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [openReport, setOpenReport] = useState(false);
  const [reason, setReason] = useState<typeof REASONS[number]["v"]>("penipuan");
  const [desc, setDesc] = useState("");
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [myReaction, setMyReaction] = useState<"like" | "dislike" | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [ownerListings, setOwnerListings] = useState<OwnerListing[]>([]);
  const [reactBusy, setReactBusy] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const userLoc = loadUserLocation();

  const loadReactions = useCallback(async (listingId: string, uid: string | null) => {
    const { data } = await supabase.from("listing_reactions").select("user_id,reaction").eq("listing_id", listingId);
    const rows = data ?? [];
    setLikes(rows.filter((r: any) => r.reaction === "like").length);
    setDislikes(rows.filter((r: any) => r.reaction === "dislike").length);
    const mine = uid ? rows.find((r: any) => r.user_id === uid) : null;
    setMyReaction((mine as any)?.reaction ?? null);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: listing } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
      setItem(listing as Listing | null);
      setLoading(false);
      if (listing) {
        await loadReactions(id, user?.id ?? null);
        const [{ data: profile }, { data: others }] = await Promise.all([
          supabase.from("profiles").select("display_name").eq("id", listing.owner_id).maybeSingle(),
          supabase.from("listings").select("id,name,category,image_url,is_open").eq("owner_id", listing.owner_id).neq("id", id).order("created_at", { ascending: false }).limit(6),
        ]);
        setOwnerName(profile?.display_name ?? null);
        setOwnerListings((others as OwnerListing[]) ?? []);
        if (user) {
          const { data: wl } = await supabase.from("wishlists").select("id").eq("listing_id", id).eq("user_id", user.id).maybeSingle();
          setInWishlist(!!wl);
        }
      }
    })();
  }, [id, user?.id, loadReactions]);

  async function react(next: "like" | "dislike") {
    if (!user) { nav({ to: "/auth" }); return; }
    setReactBusy(true);
    try {
      if (myReaction === next) {
        await supabase.from("listing_reactions").delete().eq("listing_id", id).eq("user_id", user.id);
      } else if (myReaction) {
        await supabase.from("listing_reactions").update({ reaction: next }).eq("listing_id", id).eq("user_id", user.id);
      } else {
        await supabase.from("listing_reactions").insert({ listing_id: id, user_id: user.id, reaction: next });
      }
      await loadReactions(id, user.id);
    } finally {
      setReactBusy(false);
    }
  }

  async function toggleWishlist() {
    if (!user) { nav({ to: "/auth" }); return; }
    if (inWishlist) {
      await supabase.from("wishlists").delete().eq("listing_id", id).eq("user_id", user.id);
      setInWishlist(false);
      toast.success("Dihapus dari wishlist.");
    } else {
      const { error } = await supabase.from("wishlists").insert({ listing_id: id, user_id: user.id });
      if (error) { toast.error(error.message); return; }
      setInWishlist(true);
      toast.success("Ditambahkan ke wishlist.");
    }
  }

  async function share() {
    if (!item) return;
    const url = window.location.origin + `/detail/${item.id}`;
    const text = `${item.name} di MAUJAJAN — ${item.address ?? ""}${item.lat && item.lng ? ` (https://maps.google.com/?q=${item.lat},${item.lng})` : ""}\n${url}`;
    try {
      if (navigator.share) await navigator.share({ title: item.name, text, url });
      else { await navigator.clipboard.writeText(text); toast.success("Link disalin."); }
    } catch { /* user cancelled */ }
  }

  async function report() {
    if (!user) { nav({ to: "/auth" }); return; }
    const { error } = await supabase.from("reports").insert({
      listing_id: id, reporter_id: user.id, reason, description: desc || null,
    });
    if (error) { toast.error(error.message); return; }
    const auto = REASONS.find((r) => r.v === reason)?.auto;
    toast.success(auto ? "Laporan diteruskan langsung ke admin." : "Laporan terkirim.");
    setOpenReport(false); setDesc("");
  }

  if (loading) return <Shell><p style={{ padding: 30, textAlign: "center" }}>Memuat...</p></Shell>;
  if (!item) return <Shell><p style={{ padding: 30, textAlign: "center" }}>Penjual tidak ditemukan. <Link to="/" style={{ color: "var(--gold)" }}>Kembali</Link></p></Shell>;

  const products = Array.isArray(item.products) ? item.products : [];
  const baseRating = Number(item.rating ?? 4.5);
  const adjustedRating = Math.max(1, baseRating - dislikes * 0.05);
  const isTop = likes >= 110;
  const isOwner = user?.id === item.owner_id;
  const distance = userLoc && item.lat != null && item.lng != null ? haversineKm(userLoc, { lat: item.lat, lng: item.lng }) : null;

  return (
    <Shell>
      <div style={{ padding: 12, display: "flex", gap: 8 }}>
        <Link to="/" className="btn btn-outline btn-sm"><ArrowLeft size={14} /> Kembali</Link>
        <button className={`btn btn-sm ${inWishlist ? "btn-danger" : "btn-outline"}`} onClick={toggleWishlist} style={{ marginLeft: "auto" }}>
          <Heart size={13} fill={inWishlist ? "currentColor" : "none"} /> {inWishlist ? "Tersimpan" : "Wishlist"}
        </button>
        <button className="btn btn-outline btn-sm" onClick={share}><Share2 size={13} /></button>
        {(isOwner || isAdmin) && (
          <Link to="/edit/$id" params={{ id: item.id }} className="btn btn-gold btn-sm"><Pencil size={13} /> Edit</Link>
        )}
      </div>
      <div style={{ height: 200, background: "linear-gradient(135deg, var(--gold-light), var(--maroon))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", position: "relative" }}>
        {item.image_url ? <img src={item.image_url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontFamily: "var(--font-serif)", fontSize: 42, fontWeight: 700 }}>{item.name.slice(0, 1).toUpperCase()}</span>}
        {isTop && <span className="top-badge" style={{ top: 12, right: 12 }}>★ Ter Worth It</span>}
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>{item.name}</h1>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>{item.category}</p>
          </div>
          <span className={`status-chip ${item.is_open ? "open" : "closed"}`} style={{ position: "static" }}>{item.is_open ? "Buka" : "Tutup"}</span>
        </div>

        <RatingBadge rating={adjustedRating} likes={likes} dislikes={dislikes} />

        <div className="reaction-bar">
          <button className={`reaction-btn ${myReaction === "like" ? "active-like" : ""}`} onClick={() => react("like")} disabled={reactBusy}>
            <ThumbsUp size={14} /> Suka · {likes}
          </button>
          <button className={`reaction-btn ${myReaction === "dislike" ? "active-dislike" : ""}`} onClick={() => react("dislike")} disabled={reactBusy}>
            <ThumbsDown size={14} /> Tidak · {dislikes}
          </button>
          {isTop && <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 700 }}>REKOMENDASI TERATAS</span>}
        </div>
        <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "8px 0 0" }}>
          Suka & tidak suka memengaruhi peringkat jualan ini di beranda.
        </p>

        <div style={{ display: "flex", gap: 18, margin: "14px 0", padding: "14px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <b style={{ display: "block", fontSize: 15, fontFamily: "var(--font-serif)" }}>{products.length}</b>
            <span style={{ fontSize: 10.5, color: "var(--ink-soft)", textTransform: "uppercase" }}>Menu</span>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <b style={{ display: "block", fontSize: 15, fontFamily: "var(--font-serif)" }}>{item.hours || "—"}</b>
            <span style={{ fontSize: 10.5, color: "var(--ink-soft)", textTransform: "uppercase" }}>Jam</span>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <b style={{ display: "block", fontSize: 15, fontFamily: "var(--font-serif)" }}>{distance != null ? formatDistance(distance) : "—"}</b>
            <span style={{ fontSize: 10.5, color: "var(--ink-soft)", textTransform: "uppercase" }}>Jarak</span>
          </div>
        </div>

        {item.description && <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-soft)" }}>{item.description}</p>}

        {item.address && (
          <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-soft)", margin: "10px 0" }}>
            <MapPin size={14} />{item.address}
          </p>
        )}

        {products.length > 0 && (
          <>
            <h2 style={{ fontSize: 15, margin: "18px 0 10px" }}>Menu</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {products.map((p, i) => (
                <div key={i} className="card" style={{ padding: 12, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                  <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: 13 }}>Rp {Number(p.price || 0).toLocaleString("id-ID")}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <ListingGallery listingId={item.id} canManage={isOwner || isAdmin} userId={user?.id ?? null} />

        {item.qris_url && (
          <div style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Bayar pakai QRIS</h2>
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 10px" }}>Pindai kode ini dengan aplikasi pembayaran kamu.</p>
            <img src={item.qris_url} alt={`QRIS ${item.name}`} style={{ width: "100%", maxWidth: 260, borderRadius: 12, border: "1px solid var(--line)" }} />
            <div>
              <a href={item.qris_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ marginTop: 8 }}>Buka gambar QRIS</a>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          {!isOwner && (
            <Link
              to="/chat/$userId"
              params={{ userId: item.owner_id }}
              className="btn btn-primary"
              style={{ flex: 1, minWidth: 140 }}
            >
              <MessageCircle size={14} /> Chat Penjual
            </Link>
          )}
          {item.phone && (
            <a href={`https://wa.me/${item.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ flex: 1, minWidth: 120 }}>
              <Phone size={14} /> WhatsApp
            </a>
          )}

          {item.lat && item.lng && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`} target="_blank" rel="noopener noreferrer" className="btn btn-gold" style={{ flex: 1, minWidth: 120 }}>
              <ExternalLink size={14} /> Buka di Maps
            </a>
          )}
          <button className="btn btn-outline" onClick={() => setOpenReport(true)} style={{ flex: 1, minWidth: 120 }}>
            <Flag size={14} /> Laporkan
          </button>
        </div>

        {item.lat && item.lng && (
          <iframe
            title="Lokasi penjual"
            style={{ marginTop: 16, width: "100%", height: 220, border: "1px solid var(--line)", borderRadius: 12 }}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${item.lng - 0.005},${item.lat - 0.005},${item.lng + 0.005},${item.lat + 0.005}&layer=mapnik&marker=${item.lat},${item.lng}`}
          />
        )}

        <div style={{ marginTop: 26, padding: "16px 0 0", borderTop: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>Tentang Penjual</h2>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 12px" }}>
            {ownerName ?? "Penjual"} · {ownerListings.length + 1} jualan
          </p>
          <h3 style={{ fontSize: 13, margin: "0 0 10px", color: "var(--maroon)", fontWeight: 700 }}>Jualan lainnya dari penjual ini</h3>
          {ownerListings.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Belum ada jualan lain.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ownerListings.map((o) => (
                <Link key={o.id} to="/detail/$id" params={{ id: o.id }} className="mini-listing">
                  <div className="thumb-sm">
                    {o.image_url ? <img src={o.image_url} alt={o.name} /> : o.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="info">
                    <b>{o.name}</b>
                    <span>{o.category} · {o.is_open ? "Buka" : "Tutup"}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {openReport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setOpenReport(false)}>
          <div style={{ background: "var(--surface)", width: "100%", maxWidth: 480, padding: 22, borderRadius: "20px 20px 0 0" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 6px" }}>Laporkan Jualan</h3>
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 14px" }}>Alasan penipuan, bohong, atau berbahaya akan otomatis diteruskan ke admin.</p>
            <label className="lbl">Alasan</label>
            {REASONS.map((r) => (
              <label key={r.v} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", fontSize: 13 }}>
                <input type="radio" checked={reason === r.v} onChange={() => setReason(r.v)} />
                {r.label} {r.auto && <span className="pill-priority" style={{ marginLeft: "auto" }}>PRIORITAS</span>}
              </label>
            ))}
            <label className="lbl">Detail (opsional)</label>
            <textarea className="field" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ceritakan yang terjadi..." />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setOpenReport(false)}>Batal</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={report}>Kirim Laporan</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
