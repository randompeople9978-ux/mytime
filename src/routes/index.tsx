import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, MapPin, Trophy, Navigation } from "lucide-react";
import { Shell } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { RatingBadge, computeScore } from "@/components/RatingBadge";
import { loadUserLocation, haversineKm, formatDistance } from "@/lib/geo";
import { AdsCarousel } from "@/components/AdsCarousel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MAUJAJAN INDONESIA — Temukan Jajanan Terdekat" },
      { name: "description", content: "Marketplace jajanan kaki lima Indonesia. Cari penjual jajanan favorit di sekitarmu, lihat menu, dan hubungi langsung." },
      { property: "og:title", content: "MAUJAJAN INDONESIA" },
      { property: "og:description", content: "Marketplace jajanan kaki lima Indonesia." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

const CATEGORIES = ["Semua", "Makanan", "Minuman", "Camilan", "Es", "Gorengan", "Nasi"];
const TOP_THRESHOLD = 110;

interface Listing {
  id: string; name: string; category: string; is_open: boolean;
  image_url: string | null; rating: number | null; address: string | null;
  lat: number | null; lng: number | null;
  likes: number; dislikes: number; score: number; distance: number | null;
}

function Index() {
  const nav = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Semua");
  const [sort, setSort] = useState<"score" | "distance" | "new">("score");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const userLoc = loadUserLocation();

  useEffect(() => {
    if (!authLoading && !session) nav({ to: "/auth", replace: true });
  }, [authLoading, session, nav]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data: rows } = await supabase
        .from("listings")
        .select("id,name,category,is_open,image_url,rating,address,lat,lng")
        .order("created_at", { ascending: false });
      const base = (rows as any[]) ?? [];
      const { data: reactions } = await supabase.from("listing_reactions").select("listing_id,reaction");
      const counts = new Map<string, { l: number; d: number }>();
      (reactions ?? []).forEach((r: any) => {
        const c = counts.get(r.listing_id) ?? { l: 0, d: 0 };
        if (r.reaction === "like") c.l++; else c.d++;
        counts.set(r.listing_id, c);
      });
      setListings(base.map((l) => {
        const c = counts.get(l.id) ?? { l: 0, d: 0 };
        const rating = Number(l.rating ?? 4.5);
        return {
          ...l,
          likes: c.l, dislikes: c.d,
          score: computeScore(rating, c.l, c.d),
          distance: userLoc && l.lat != null && l.lng != null ? haversineKm(userLoc, { lat: l.lat, lng: l.lng }) : null,
        };
      }));
      setLoading(false);
    })();
  }, [session]);

  const filtered = listings.filter((l) => {
    if (cat !== "Semua" && l.category !== cat) return false;
    if (q && !l.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "score") return b.score - a.score;
    if (sort === "distance") return (a.distance ?? Infinity) - (b.distance ?? Infinity);
    return 0;
  });

  const topWorthIt = [...listings]
    .filter((l) => l.likes >= TOP_THRESHOLD)
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 6);

  return (
    <Shell>
      <section className="hero">
        <span className="eyebrow">Jajan Nusantara</span>
        <h1>Temukan jajanan favoritmu di sekitar</h1>
        <p className="hero-tagline">MAU CARI TEMPAT JAJAN YANG SUKA KELILING ATAU YANG MAU NYARI TEMPAT MAKAN HIDDEN GAMES</p>
        <div className="search-pill">
          <Search />
          <input placeholder="Cari nama jajanan atau penjual..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Link to="/nearby" className="btn btn-gold btn-sm"><Navigation size={13} /> Cari yang terdekat</Link>
        </div>
      </section>

      <AdsCarousel />



      <div className="chip-row" style={{ paddingTop: 18 }}>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      <div className="chip-row" style={{ paddingTop: 0 }}>
        <button className={`chip ${sort === "score" ? "active" : ""}`} onClick={() => setSort("score")}>Peringkat</button>
        <button className={`chip ${sort === "distance" ? "active" : ""}`} onClick={() => setSort("distance")} disabled={!userLoc}>Terdekat</button>
        <button className={`chip ${sort === "new" ? "active" : ""}`} onClick={() => setSort("new")}>Terbaru</button>
      </div>

      {topWorthIt.length > 0 && (
        <>
          <div className="section" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Trophy size={18} color="var(--gold)" />
            <h2 style={{ margin: 0 }}>Ter Worth It</h2>
            <span style={{ fontSize: 11, color: "var(--ink-soft)", marginLeft: 4 }}>110+ likes</span>
          </div>
          <div className="seller-grid fade-in">
            {topWorthIt.map((l) => (
              <Card key={l.id} l={l} showBadge />
            ))}
          </div>
        </>
      )}

      <div className="section">
        <h2>Semua Penjual</h2>
      </div>

      {loading ? (
        <p style={{ padding: 20, textAlign: "center", color: "var(--ink-soft)" }}>Memuat...</p>
      ) : sorted.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--ink-soft)" }}>
          <p>Belum ada jualan yang cocok.</p>
          <Link to="/new" className="btn btn-gold btn-sm" style={{ marginTop: 12 }}>Jadi Penjual Pertama</Link>
        </div>
      ) : (
        <div className="seller-grid fade-in">
          {sorted.map((l) => <Card key={l.id} l={l} />)}
        </div>
      )}
    </Shell>
  );
}

function Card({ l, showBadge = false }: { l: Listing; showBadge?: boolean }) {
  return (
    <Link to="/detail/$id" params={{ id: l.id }} className="seller-card">
      <div className="thumb">
        {l.image_url ? <img src={l.image_url} alt={l.name} loading="lazy" /> : l.name.slice(0, 1).toUpperCase()}
        {(showBadge || l.likes >= TOP_THRESHOLD) && <span className="top-badge">★ Top</span>}
        <span className={`status-chip ${l.is_open ? "open" : "closed"}`}>{l.is_open ? "Buka" : "Tutup"}</span>
      </div>
      <div className="body">
        <p className="name">{l.name}</p>
        <p className="cat">{l.category}</p>
        <RatingBadge rating={Number(l.rating ?? 4.5)} likes={l.likes} dislikes={l.dislikes} compact />
        {(l.distance != null || l.address) && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 5, fontSize: 10.5, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <MapPin size={10} />
            {l.distance != null ? formatDistance(l.distance) : l.address}
          </div>
        )}
      </div>
    </Link>
  );
}
