import { supabase } from "@/integrations/supabase/client";

export interface Notif {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export const NOTIF_SELECT = "id,user_id,actor_id,kind,title,body,entity_id,read_at,created_at";

export async function fetchNotifications(limit = 100) {
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIF_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Notif[]) ?? [];
}

export async function unreadCount() {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}

export async function markAllRead() {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
}

export async function markRead(id: string) {
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export async function clearNotifications() {
  const { data } = await supabase.from("notifications").select("id");
  const ids = (data ?? []).map((r) => r.id);
  if (ids.length) await supabase.from("notifications").delete().in("id", ids);
}

/** Ask once for browser notification permission (so alerts also show outside the tab). */
export async function ensureBrowserPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

export function showBrowserNotification(title: string, body?: string | null) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body: body ?? undefined, icon: "/favicon.ico" });
  } catch {
    /* ignore */
  }
}

export function notifHref(n: Notif): { to: string; params?: Record<string, string> } {
  switch (n.kind) {
    case "message":
      return { to: "/chat/$userId", params: { userId: n.actor_id ?? "" } };
    default:
      return { to: "/notif" };
  }
}
