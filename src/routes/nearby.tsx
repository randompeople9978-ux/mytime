import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, Loader2, Navigation } from "lucide-react";
import { Shell } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentPosition, haversineKm, formatDistance, loadUserLocation, saveUserLocation } from "@/lib/geo";
import { toast } from "sonner";

export const Route = createFileRoute("/nearby")({
  head: () => ({
    meta: [
      { title: "Jajanan Terdekat — MAUJAJAN INDONESIA" },
      { name: "description", content: "Cari penjual jajanan paling dekat dari lokasi kamu sekarang." },
      { property: "og:title", content: "Jajanan Terdekat — MAUJAJAN" },
      { property: "og:description", content: "Penjual jajanan di sekitar kamu, diurutkan berdasarkan jarak." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: NearbyPage,
});

interface L { id: string; name: string; category: string; image_url: string | null; is_open: boolean; lat: number; lng: number; address: string | null; distance: number }

function NearbyPage() {
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(() => loadUserLocation());
  const [rows, setRows] = useState<L[]>([]);
  const [busy, setBusy] = useState(false);

  async function requestLocation() {
    setBusy(true);
    try {
      const p = await getCurrentPosition();
      saveUserLocation(p);
      setLoc(p);
      toast.success("Lokasi diaktifkan.");
    } catch (e: any) {
      toast.error(e?.message || "Gagal mengambil lokasi.");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (!loc) return;
    (async () => {
      const { data } = await supabase
        .from("listings")
        .select("id,name,category,image_url,is_open,lat,lng,address")
        .not("lat", "is", null)
        .not("lng", "is", null);
      const withDist = ((data as any[]) ?? [])
        .map((l) => ({ ...l, distance: haversineKm(loc, { lat: l.lat, lng: l.lng }) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 50);
      setRows(withDist as L[]);
    })();
  }, [loc]);

  return (
    <Shell>
      <div className="section">
        <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}><Navigation size={20} color="var(--gold)" /> Terdekat</h2>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "-6px 0 0" }}>Aktifkan lokasi untuk melihat jualan di sekitarmu.</p>
      </div>

      {!loc ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <MapPin size={40} color="var(--gold)" style={{ margin: "0 auto 12px", display: "block" }} />
          <p style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 16 }}>Kami butuh izin lokasi untuk menemukan penjual terdekat.</p>
          <button className="btn btn-primary" onClick={requestLocation} disabled={busy}>
            {busy ? <Loader2 className="spin" size={14} /> : <MapPin size={14} />} Aktifkan lokasi saya
          </button>
        </div>
      ) : (
        <>
          <div style={{ padding: "0 18px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>Lokasi kamu: {loc.lat.toFixed(3)}, {loc.lng.toFixed(3)}</span>
            <button className="btn btn-outline btn-sm" onClick={requestLocation}>Perbarui</button>
          </div>
          {rows.length > 0 && (
            <iframe
              title="Peta jualan terdekat"
              style={{ margin: "10px 18px", width: "calc(100% - 36px)", height: 220, border: "1px solid var(--line)", borderRadius: 12 }}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${loc.lng - 0.03},${loc.lat - 0.03},${loc.lng + 0.03},${loc.lat + 0.03}&layer=mapnik&marker=${loc.lat},${loc.lng}`}
            />
          )}
          {rows.length === 0 ? (
            <p style={{ padding: 30, textAlign: "center", color: "var(--ink-soft)" }}>Belum ada jualan dengan lokasi terdaftar di sekitar sini.</p>
          ) : (
            <div style={{ padding: "6px 18px 20px" }}>
              {rows.map((l) => (
                <Link key={l.id} to="/detail/$id" params={{ id: l.id }} className="wishlist-card" style={{ textDecoration: "none", color: "inherit" }}>
                  <div className="wishlist-thumb">
                    {l.image_url ? <img src={l.image_url} alt={l.name} loading="lazy" /> : l.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{l.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{l.category} · {l.is_open ? "Buka" : "Tutup"}</div>
                    {l.address && <div style={{ fontSize: 11, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.address}</div>}
                  </div>
                  <span className="distance-pill">{formatDistance(l.distance)}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
