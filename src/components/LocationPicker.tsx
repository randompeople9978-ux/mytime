import { useState } from "react";
import { MapPin, Loader2, ExternalLink } from "lucide-react";
import { getCurrentPosition } from "@/lib/geo";
import { toast } from "sonner";

export function LocationPicker({
  lat, lng, onChange,
}: {
  lat: number | null; lng: number | null;
  onChange: (loc: { lat: number | null; lng: number | null }) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function useMyLocation() {
    setBusy(true);
    try {
      const p = await getCurrentPosition();
      onChange({ lat: p.lat, lng: p.lng });
      toast.success("Lokasi tersimpan.");
    } catch (e: any) {
      toast.error(e?.message || "Gagal mengambil lokasi.");
    } finally { setBusy(false); }
  }

  const has = lat != null && lng != null;

  return (
    <div>
      <label className="lbl">Lokasi (peta)</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={useMyLocation} disabled={busy}>
          {busy ? <Loader2 size={13} className="spin" /> : <MapPin size={13} />} Gunakan lokasi saya sekarang
        </button>
        {has && (
          <a className="btn btn-outline btn-sm" href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={13} /> Buka di Google Maps
          </a>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          <input className="field" placeholder="Latitude" value={lat ?? ""} onChange={(e) => onChange({ lat: e.target.value ? Number(e.target.value) : null, lng })} />
        </div>
        <div style={{ flex: 1 }}>
          <input className="field" placeholder="Longitude" value={lng ?? ""} onChange={(e) => onChange({ lat, lng: e.target.value ? Number(e.target.value) : null })} />
        </div>
      </div>
      {has && (
        <iframe
          title="Preview lokasi"
          style={{ marginTop: 10, width: "100%", height: 180, border: "1px solid var(--line)", borderRadius: 12 }}
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng! - 0.005},${lat! - 0.005},${lng! + 0.005},${lat! + 0.005}&layer=mapnik&marker=${lat},${lng}`}
        />
      )}
    </div>
  );
}
