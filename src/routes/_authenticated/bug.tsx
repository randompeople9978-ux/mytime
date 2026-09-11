import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/lib/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bug")({
  component: BugPage,
});

function BugPage() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("bug_reports").insert({ user_id: user.id, title, description: desc });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Terima kasih! Bug sudah dikirim ke admin.");
    setTitle(""); setDesc("");
  }

  return (
    <Shell>
      <div className="section">
        <h2>Kotak Keluhan Bug</h2>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "-6px 0 0" }}>Ceritakan masalah yang kamu temui. Admin akan meninjaunya.</p>
      </div>
      <form onSubmit={submit} style={{ padding: "0 18px" }}>
        <label className="lbl">Judul singkat *</label>
        <input className="field" required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Cth: Tombol simpan tidak berfungsi" />
        <label className="lbl">Deskripsi lengkap *</label>
        <textarea className="field" required value={desc} onChange={(e) => setDesc(e.target.value)} rows={6} placeholder="Langkah reproduksi, screenshot url, dsb." />
        <button className="btn btn-primary btn-block" disabled={busy} type="submit" style={{ marginTop: 14 }}>
          {busy ? "Mengirim..." : "Kirim Laporan Bug"}
        </button>
      </form>
    </Shell>
  );
}
