import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage, validateImageFile } from "@/lib/imageUpload";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";

interface Photo {
  id: string;
  image_url: string;
  sort_order: number;
}

/** Galeri foto lapak — pemilik bisa tambah/hapus, semua orang bisa lihat. */
export function ListingGallery({
  listingId,
  canManage,
  userId,
}: {
  listingId: string;
  canManage: boolean;
  userId: string | null;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await supabase
      .from("listing_photos")
      .select("id,image_url,sort_order")
      .eq("listing_id", listingId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setPhotos((data as Photo[]) ?? []);
  }
  useEffect(() => {
    void load();
  }, [listingId]);

  async function add(file: File) {
    if (!userId) return;
    const err = validateImageFile(file);
    if (err) return toast.error(err);
    setBusy(true);
    try {
      const url = await uploadImage("listings", userId, file);
      const maxOrder = photos.reduce((m, p) => Math.max(m, p.sort_order), -1);
      const { error } = await supabase
        .from("listing_photos")
        .insert({ listing_id: listingId, image_url: url, sort_order: maxOrder + 1 });
      if (error) throw error;
      toast.success("Foto lapak ditambahkan.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal mengunggah foto.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirmDel) return;
    const pid = confirmDel;
    setConfirmDel(null);
    const { error } = await supabase.from("listing_photos").delete().eq("id", pid);
    if (error) return toast.error(error.message);
    setPhotos((p) => p.filter((x) => x.id !== pid));
    toast.success("Foto dihapus.");
  }

  if (photos.length === 0 && !canManage) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Galeri Lapak</h2>
        <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>
          {photos.length > 0 ? `${photos.length} foto` : canManage ? "Opsional — pancing pembeli lewat foto" : ""}
        </span>
      </div>
      <div className="gallery-grid">
        {photos.map((p) => (
          <div className="gallery-item" key={p.id}>
            <a href={p.image_url} target="_blank" rel="noopener noreferrer" aria-label="Lihat foto ukuran penuh">
              <img src={p.image_url} alt="Foto lapak" loading="lazy" />
            </a>
            {canManage && (
              <button className="gallery-del" onClick={() => setConfirmDel(p.id)} aria-label="Hapus foto">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
        {canManage && (
          <button className="gallery-add" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 size={18} className="spin" /> : <ImagePlus size={18} />}
            {busy ? "Mengunggah..." : "Tambah foto"}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void add(f);
          e.target.value = "";
        }}
      />
      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus foto ini?"
        message="Foto akan hilang dari galeri lapak kamu."
        confirmLabel="Ya, hapus"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
