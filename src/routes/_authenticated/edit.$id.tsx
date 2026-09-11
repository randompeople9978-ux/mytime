import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/lib/useAuth";
import { toast } from "sonner";
import { ListingForm, type ListingFormValues } from "@/components/ListingForm";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/edit/$id")({
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<ListingFormValues | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
      if (error || !data) { setLoading(false); return; }
      if (data.owner_id !== user.id && !isAdmin) { setForbidden(true); setLoading(false); return; }
      const prods = Array.isArray(data.products) ? (data.products as any[]) : [];
      setInitial({
        name: data.name ?? "",
        category: data.category ?? "Makanan",
        description: data.description ?? "",
        address: data.address ?? "",
        hours: data.hours ?? "",
        phone: data.phone ?? "",
        image_url: data.image_url ?? null,
        qris_url: data.qris_url ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        days: (data.days as string[]) ?? [],
        products: prods.length ? prods.map((p) => ({ name: String(p.name ?? ""), price: String(p.price ?? "") })) : [{ name: "", price: "" }],
        is_open: data.is_open ?? true,
      });
      setLoading(false);
    })();
  }, [id, user?.id, isAdmin]);

  async function save(f: ListingFormValues) {
    if (!user) return;
    setBusy(true);
    const cleanProducts = f.products.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), price: Number(p.price) || 0 }));
    const { error } = await supabase.from("listings").update({
      name: f.name, category: f.category, description: f.description || null,
      address: f.address || null, hours: f.hours || null, phone: f.phone || null,
      image_url: f.image_url, qris_url: f.qris_url, days: f.days,
      lat: f.lat, lng: f.lng,
      products: cleanProducts, is_open: f.is_open,
    }).eq("id", id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Jualan diperbarui.");
    nav({ to: "/detail/$id", params: { id } });
  }

  if (loading || !user) return <Shell><p style={{ padding: 30, textAlign: "center" }}>Memuat...</p></Shell>;
  if (forbidden) return <Shell><p style={{ padding: 30, textAlign: "center" }}>Kamu tidak berhak mengedit jualan ini. <Link to="/" style={{ color: "var(--gold)" }}>Kembali</Link></p></Shell>;
  if (!initial) return <Shell><p style={{ padding: 30, textAlign: "center" }}>Jualan tidak ditemukan.</p></Shell>;

  return (
    <Shell>
      <div style={{ padding: 12 }}>
        <Link to="/detail/$id" params={{ id }} className="btn btn-outline btn-sm"><ArrowLeft size={14} /> Kembali</Link>
      </div>
      <div className="section" style={{ paddingTop: 6 }}>
        <h2>Edit Jualan</h2>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "-6px 0 0" }}>Perbarui detail jualanmu kapan saja, meski sudah terpublikasi.</p>
      </div>
      <ListingForm userId={user.id} initial={initial} submitLabel="Simpan Perubahan" onSubmit={save} busy={busy} />
    </Shell>
  );
}
