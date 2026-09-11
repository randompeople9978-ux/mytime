import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import {
  ensureBrowserPermission,
  showBrowserNotification,
  unreadCount,
  type Notif,
} from "@/lib/notifications";

/**
 * Topbar bell: live unread badge + in-app toast + OS notification for every
 * new notification (friend request, accepted request, follower, DM, call).
 */
export function NotificationsBell() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let alive = true;
    void unreadCount().then((n) => alive && setCount(n));
    void ensureBrowserPermission();

    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notif;
          setCount((c) => c + 1);
          toast(n.title, { description: n.body ?? undefined });
          showBrowserNotification(n.title, n.body);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          void unreadCount().then((n) => alive && setCount(n));
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  if (!user) return null;

  return (
    <Link to="/notif" className="bell-btn" aria-label={`Notifikasi${count ? `, ${count} belum dibaca` : ""}`}>
      <Bell size={18} />
      {count > 0 && <span className="bell-dot">{count > 9 ? "9+" : count}</span>}
    </Link>
  );
}
