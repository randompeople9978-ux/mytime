import { useRef, useState } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { uploadImage, validateImageFile, type ImageBucket } from "@/lib/imageUpload";
import { toast } from "sonner";

export function ImageUpload({
  bucket, userId, value, onChange, label = "Foto",
}: {
  bucket: ImageBucket;
  userId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(f: File | null) {
    if (!f) return;
    const err = validateImageFile(f);
    if (err) { toast.error(err); return; }
    setBusy(true);
    try {
      const url = await uploadImage(bucket, userId, f);
      onChange(url);
      toast.success("Gambar terunggah.");
    } catch (e: any) {
      toast.error(e?.message || "Gagal mengunggah gambar.");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <label className="lbl">{label}</label>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ width: 88, height: 88, borderRadius: 12, border: "1px solid var(--line)", background: "var(--cream)", overflow: "hidden", position: "relative", flex: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {value ? <img src={value} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Camera size={26} color="var(--ink-soft)" />}
          {busy && <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.7)", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="spin" size={22} /></div>}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <input ref={ref} type="file" accept="image/*" onChange={(e) => handle(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => ref.current?.click()} disabled={busy}>
            <Camera size={13} /> {value ? "Ganti gambar" : "Pilih dari galeri"}
          </button>
          {value && <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange(null)} disabled={busy}><X size={13} /> Hapus</button>}
          <span style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>JPG/PNG maks 5MB. Diambil langsung dari galeri kamu.</span>
        </div>
      </div>
    </div>
  );
}
