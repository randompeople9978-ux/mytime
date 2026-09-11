import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { Shell } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Cari Jajanan — MAUJAJAN INDONESIA" },
      { name: "description", content: "Cari penjual jajanan berdasarkan nama, kategori, atau lokasi." },
      { property: "og:title", content: "Cari Jajanan — MAUJAJAN" },
      { property: "og:description", content: "Cari penjual jajanan favoritmu." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ id: string; name: string; category: string; address: string | null }[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setRes([]); return; }
      const { data } = await supabase.from("listings").select("id,name,category,address").ilike("name", `%${q}%`).limit(20);
      setRes(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <Shell>
      <div style={{ padding: 18 }}>
        <div className="search-pill" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <SearchIcon />
          <input placeholder="Ketik nama jualan..." value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <div className="chip-row" style={{ marginTop: 12, padding: 0 }}>
          <span className="chip active">Cari jualan</span>
        </div>
      </div>
      {res.map((l) => (
        <Link key={l.id} to="/detail/$id" params={{ id: l.id }} className="list-row" style={{ textDecoration: "none" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{l.name}</div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{l.category}{l.address ? ` • ${l.address}` : ""}</div>
          </div>
        </Link>
      ))}
      {q && res.length === 0 && <p style={{ padding: 20, textAlign: "center", color: "var(--ink-soft)" }}>Tidak ditemukan.</p>}
    </Shell>
  );
}
