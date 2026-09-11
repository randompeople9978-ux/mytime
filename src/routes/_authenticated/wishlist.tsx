import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/lib/useAuth";
import { toast } from "sonner";
import { RatingBadge } from "@/components/RatingBadge";

export const Route = createFileRoute("/_authenticated/wishlist")({
  component: WishlistPage,
});

interface Row {
  id: string; // wishlist id
  listing: {
    id: string; name: string; category: string; image_url: string | null;
    is_open: boolean; rating: number | null; address: string | null;
  } | null;
  likes: number;
  dislikes: number;
}

function WishlistPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    const { data: wl } = await supabase
      .from("wishlists")
      .select("id, listing_id, listings(id, name, category, image_url, is_open, rating, address)")
      .order("created_at", { ascending: false });
    const list = (wl as any[]) ?? [];
    const ids = list.map((r) => r.listing_id).filter(Boolean);
    const { data: reactions } = ids.length
      ? await supabase.from("listing_reactions").select("listing_id, reaction").in("listing_id", ids)
      : { data: [] as any[] };
    const counts = new Map<string, { l: number; d: number }>();
    (reactions ?? []).forEach((r: any) => {
      const c = counts.get(r.listing_id) ?? { l: 0, d: 0 };
      if (r.reaction === "like") c.l++; else c.d++;
      counts.set(r.listing_id, c);
    });
    setRows(list.map((r) => ({
      id: r.id,
      listing: r.listings,
      likes: counts.get(r.listing_id)?.l ?? 0,
      dislikes: counts.get(r.listing_id)?.d ?? 0,
    })));
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  async function remove(wid: string) {
    const { error } = await supabase.from("wishlists").delete().eq("id", wid);
    if (error) toast.error(error.message);
    else { toast.success("Dihapus dari wishlist."); setRows((r) => r.filter((x) => x.id !== wid)); }
  }

  return (
    <Shell>
      <div className="section">
        <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}><Heart size={20} color="var(--danger)" /> Wishlist</h2>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "-6px 0 0" }}>Jualan yang ingin kamu beli lain hari.</p>
      </div>

      {loading ? (
        <p style={{ padding: 30, textAlign: "center", color: "var(--ink-soft)" }}>Memuat...</p>
      ) : rows.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--ink-soft)" }}>
          <p>Wishlist masih kosong.</p>
          <button className="btn btn-gold btn-sm" style={{ marginTop: 12 }} onClick={() => nav({ to: "/" })}>Cari Jajanan</button>
        </div>
      ) : (
        <div style={{ padding: "0 18px" }}>
          {rows.map((r) => r.listing && (
            <div key={r.id} className="wishlist-card">
              <Link to="/detail/$id" params={{ id: r.listing.id }} className="wishlist-thumb">
                {r.listing.image_url ? <img src={r.listing.image_url} alt={r.listing.name} loading="lazy" /> : r.listing.name.slice(0, 1).toUpperCase()}
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to="/detail/$id" params={{ id: r.listing.id }} style={{ color: "inherit", textDecoration: "none" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.listing.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 4 }}>{r.listing.category} · {r.listing.is_open ? "Buka" : "Tutup"}</div>
                </Link>
                <RatingBadge rating={Number(r.listing.rating ?? 4.5)} likes={r.likes} dislikes={r.dislikes} compact />
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => remove(r.id)} title="Hapus dari wishlist"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
