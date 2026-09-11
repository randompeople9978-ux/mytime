import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/lib/useAuth";
import { toast } from "sonner";
import { ListingForm, type ListingFormValues } from "@/components/ListingForm";

export const Route = createFileRoute("/_authenticated/new")({
  component: NewPage,
});

function NewPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  const initial: ListingFormValues = {
    name: "", category: "Makanan", description: "", address: "", hours: "08:00 - 20:00",
    phone: "", image_url: null, qris_url: null, lat: null, lng: null,
    days: ["Sen", "Sel", "Rab", "Kam", "Jum"],
    products: [{ name: "", price: "" }],
    is_open: true,
  };

  async function save(f: ListingFormValues) {
    if (!user) return;
    setBusy(true);
    const cleanProducts = f.products.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), price: Number(p.price) || 0 }));
    const { data, error } = await supabase.from("listings").insert({
      owner_id: user.id,
      name: f.name, category: f.category, description: f.description || null,
      address: f.address || null, hours: f.hours || null, phone: f.phone || null,
      image_url: f.image_url, qris_url: f.qris_url, days: f.days,
      lat: f.lat, lng: f.lng,
      products: cleanProducts, is_open: f.is_open,
    }).select("id").single();
    setBusy(false);
    if (error) {
      const msg = /maksimal 3 jualan/i.test(error.message)
        ? "Batas maksimal 3 jualan per akun sudah tercapai. Gunakan akun lain untuk menambah jualan."
        : error.message;
      toast.error(msg);
      return;
    }
    toast.success("Jualan diterbitkan!");
    nav({ to: "/detail/$id", params: { id: data.id } });
  }

  if (!user) return null;

  return (
    <Shell>
      <div className="section">
        <h2>Buka Lapak Baru</h2>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "-6px 0 0" }}>Isi info jualanmu supaya pembeli mudah menemukan.</p>
        <p style={{ fontSize: 12, color: "var(--gold)", margin: "6px 0 0", fontWeight: 600 }}>Catatan: satu akun maksimal 3 jualan.</p>
      </div>
      <ListingForm userId={user.id} initial={initial} submitLabel="Terbitkan Jualan" onSubmit={save} busy={busy} />
    </Shell>
  );
}
