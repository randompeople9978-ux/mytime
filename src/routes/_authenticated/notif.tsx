import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Bell, Check, Trash2, UserPlus, MessageCircle, Phone, Users } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import {
  clearNotifications,
  ensureBrowserPermission,
  fetchNotifications,
  markAllRead,
  markRead,
  notifHref,
  type Notif,
} from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/notif")({
  component: NotifPage,
});

function icon(kind: string) {
  if (kind === "message") return <MessageCircle size={15} />;
  if (kind === "call") return <Phone size={15} />;
  if (kind === "follow") return <UserPlus size={15} />;
  if (kind.startsWith("friend")) return <Users size={15} />;
  return <Bell size={15} />;
}

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "baru saja";
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function NotifPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setRows(await fetchNotifications());
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal memuat notifikasi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
    const ch = supabase
      .channel(`notif-page-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => setRows((p) => [payload.new as Notif, ...p]),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, load]);

  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <Shell>
      <div style={{ padding: "18px 18px 6px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 22, margin: "0 0 4px" }}>Notifikasi</h1>
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 12px" }}>
          Permintaan pertemanan, pesan baru, pengikut baru, dan panggilan masuk muncul di sini secara langsung.
        </p>
        <div className="chip-row" style={{ padding: 0 }}>
          <button
            className="chip"
            onClick={async () => {
              await markAllRead();
              setRows((p) => p.map((r) => ({ ...r, read_at: r.read_at ?? new Date().toISOString() })));
            }}
          >
            <Check size={12} /> Tandai dibaca {unread ? `(${unread})` : ""}
          </button>
          <button
            className="chip"
            onClick={async () => {
              await clearNotifications();
              setRows([]);
            }}
          >
            <Trash2 size={12} /> Bersihkan
          </button>
          <button
            className="chip"
            onClick={async () => {
              const ok = await ensureBrowserPermission();
              toast[ok ? "success" : "error"](
                ok ? "Notifikasi perangkat aktif." : "Izin notifikasi ditolak di peramban.",
              );
            }}
          >
            Aktifkan notifikasi perangkat
          </button>
        </div>
      </div>

      {loading && <p style={{ padding: 18, fontSize: 12.5, color: "var(--ink-soft)" }}>Memuat...</p>}

      {!loading && rows.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--ink-soft)" }}>
          <Bell size={40} style={{ opacity: 0.4, marginBottom: 10 }} />
          <p style={{ fontSize: 13 }}>Belum ada notifikasi.</p>
        </div>
      )}

      {rows.map((n) => {
        const href = notifHref(n);
        return (
          <Link
            key={n.id}
            to={href.to}
            params={href.params as never}
            className="list-row"
            style={{ textDecoration: "none", background: n.read_at ? undefined : "var(--cream)" }}
            onClick={() => {
              if (!n.read_at) {
                void markRead(n.id);
                setRows((p) => p.map((r) => (r.id === n.id ? { ...r, read_at: new Date().toISOString() } : r)));
              }
            }}
          >
            <div className="avatar-sm">{icon(n.kind)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
              {n.body && <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{n.body}</div>}
            </div>
            <span style={{ fontSize: 10.5, color: "var(--ink-soft)", flex: "none" }}>{ago(n.created_at)}</span>
          </Link>
        );
      })}
    </Shell>
  );
}
