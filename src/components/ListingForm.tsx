import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ImageUpload } from "./ImageUpload";
import { LocationPicker } from "./LocationPicker";

export interface ListingFormValues {
  name: string;
  category: string;
  description: string;
  address: string;
  hours: string;
  phone: string;
  image_url: string | null;
  qris_url: string | null;
  lat: number | null;
  lng: number | null;
  days: string[];
  products: { name: string; price: string }[];
  is_open: boolean;
}

export const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
export const CATEGORIES = ["Makanan", "Minuman", "Camilan", "Es", "Gorengan", "Nasi"];

export function ListingForm({
  userId, initial, submitLabel, onSubmit, busy,
}: {
  userId: string;
  initial: ListingFormValues;
  submitLabel: string;
  onSubmit: (v: ListingFormValues) => void | Promise<void>;
  busy: boolean;
}) {
  const [f, setF] = useState<ListingFormValues>(initial);

  function set<K extends keyof ListingFormValues>(k: K, v: ListingFormValues[K]) { setF((s) => ({ ...s, [k]: v })); }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} style={{ padding: "0 18px 20px" }}>
      <ImageUpload bucket="listings" userId={userId} value={f.image_url} onChange={(v) => set("image_url", v)} label="Foto Jualan" />

      <label className="lbl">Nama Jualan *</label>
      <input className="field" required value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Cth: Bakso Pak Kumis" />

      <label className="lbl">Kategori *</label>
      <select className="field" value={f.category} onChange={(e) => set("category", e.target.value)}>
        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
      </select>

      <label className="lbl">Deskripsi</label>
      <textarea className="field" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Cerita singkat tentang jualanmu..." />

      <label className="lbl">Alamat / Lokasi</label>
      <input className="field" value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Jl. Sudirman No. 1" />

      <LocationPicker lat={f.lat} lng={f.lng} onChange={(l) => setF((s) => ({ ...s, lat: l.lat, lng: l.lng }))} />

      <label className="lbl">Jam Buka</label>
      <input className="field" value={f.hours} onChange={(e) => set("hours", e.target.value)} />

      <label className="lbl">Hari Buka</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {DAYS.map((d) => (
          <button key={d} type="button" onClick={() => set("days", f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d])}
            className={`chip ${f.days.includes(d) ? "active" : ""}`}>{d}</button>
        ))}
      </div>

      <ImageUpload bucket="listings" userId={userId} value={f.qris_url} onChange={(v) => set("qris_url", v)} label="Gambar QRIS (opsional)" />

      <label className="lbl">Nomor WhatsApp</label>
      <input className="field" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="628123456789" />

      <label className="lbl">Status</label>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className={`chip ${f.is_open ? "active" : ""}`} onClick={() => set("is_open", true)}>Buka</button>
        <button type="button" className={`chip ${!f.is_open ? "active" : ""}`} onClick={() => set("is_open", false)}>Tutup</button>
      </div>

      <label className="lbl" style={{ marginTop: 18 }}>Menu / Produk</label>
      {f.products.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input className="field" placeholder="Nama menu" value={p.name} onChange={(e) => set("products", f.products.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
          <input className="field" placeholder="Harga" type="number" style={{ maxWidth: 110 }} value={p.price} onChange={(e) => set("products", f.products.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
          {f.products.length > 1 && (
            <button type="button" onClick={() => set("products", f.products.filter((_, j) => j !== i))} className="btn btn-outline btn-sm" style={{ padding: 8 }}><Trash2 size={14} /></button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => set("products", [...f.products, { name: "", price: "" }])} className="btn btn-outline btn-sm"><Plus size={14} /> Tambah menu</button>

      <button type="submit" className="btn btn-primary btn-block" disabled={busy} style={{ marginTop: 20 }}>
        {busy ? "Menyimpan..." : submitLabel}
      </button>
    </form>
  );
}
