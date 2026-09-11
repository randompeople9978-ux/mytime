import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Inbox, Search } from "lucide-react";
import { Shell } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { fetchProfiles, fmtTime, type MiniProfile } from "@/lib/social";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

interface Thread {
  peer: MiniProfile;
  last: string;
  at: string;
  unread: number;
  mine: boolean;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Hari ini";
  if (same(d, yest)) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function MessagesPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    let alive = true;
    async function load() {
      const { data } = await supabase
        .from("direct_messages")
        .select("sender_id,recipient_id,body,attachment_url,deleted_at,read_at,created_at")
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(500);
      const rows = data ?? [];
      const map = new Map<string, { last: string; at: string; unread: number; mine: boolean }>();
      for (const r of rows) {
        const peerId = r.sender_id === user!.id ? r.recipient_id : r.sender_id;
        const prev = map.get(peerId);
        const preview = r.deleted_at ? "Pesan dihapus" : r.body || (r.attachment_url ? "📷 Gambar" : "");
        const unreadInc = r.recipient_id === user!.id && !r.read_at ? 1 : 0;
        if (!prev) {
          map.set(peerId, { last: preview, at: r.created_at, unread: unreadInc, mine: r.sender_id === user!.id });
        } else {
          prev.unread += unreadInc;
        }
      }
      const profiles = await fetchProfiles([...map.keys()]);
      if (!alive) return;
      setThreads(
        [...map.entries()]
          .filter(([id]) => profiles[id])
          .map(([id, v]) => ({ peer: profiles[id]!, ...v }))
          .sort((a, b) => b.at.localeCompare(a.at)),
      );
      setLoading(false);
    }
    void load();

    const ch = supabase
      .channel(`inbox-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => void load())
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? threads.filter(
          (t) =>
            (t.peer.display_name ?? "").toLowerCase().includes(needle) ||
            t.peer.username.toLowerCase().includes(needle),
        )
      : threads;
    const out: { label: string; items: Thread[] }[] = [];
    for (const t of list) {
      const label = dayLabel(t.at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(t);
      else out.push({ label, items: [t] });
    }
    return out;
  }, [threads, q]);

  const totalUnread = threads.reduce((n, t) => n + t.unread, 0);

  return (
    <Shell>
      <div className="inbox-head">
        <h1 className="inbox-title">
          <Inbox size={20} /> Kotak Pesan
          {totalUnread > 0 && <span className="badge-dot">{totalUnread}</span>}
        </h1>
        <p className="inbox-sub">
          Semua percakapan jual–beli kamu ada di sini. Balas langsung tanpa perlu berteman.
        </p>
        <div className="inbox-search">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari percakapan..." aria-label="Cari percakapan" />
        </div>
      </div>

      <div className="inbox-scroll">
        {loading && <p className="inbox-empty">Memuat percakapan...</p>}

        {!loading && groups.length === 0 && (
          <p className="inbox-empty">
            Belum ada percakapan. Buka halaman jualan lalu tekan <b>Chat Penjual</b>.
          </p>
        )}

        {groups.map((g) => (
          <section key={g.label} className="inbox-group">
            <div className="inbox-day">{g.label}</div>
            {g.items.map((t) => (
              <Link
                key={t.peer.id}
                to="/chat/$userId"
                params={{ userId: t.peer.id }}
                className={`inbox-row press ${t.unread > 0 ? "unread" : ""}`}
              >
                <div className="avatar-sm">
                  {t.peer.avatar_url ? (
                    <img src={t.peer.avatar_url} alt={`Foto profil ${t.peer.username}`} />
                  ) : (
                    (t.peer.display_name ?? t.peer.username).slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="inbox-main">
                  <div className="inbox-name">{t.peer.display_name || t.peer.username}</div>
                  <div className="inbox-preview">
                    {t.mine && <span className="inbox-you">Kamu:</span>} {t.last || "—"}
                  </div>
                </div>
                <div className="inbox-meta">
                  <span className="inbox-time">{fmtTime(t.at)}</span>
                  {t.unread > 0 ? <span className="badge-dot">{t.unread}</span> : <ChevronRight size={16} />}
                </div>
              </Link>
            ))}
          </section>
        ))}
      </div>
    </Shell>
  );
}
