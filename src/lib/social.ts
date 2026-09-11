import { supabase } from "@/integrations/supabase/client";

export interface MiniProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  location?: string | null;
}

export async function getBlock(me: string, other: string) {
  const { data } = await supabase
    .from("blocks")
    .select("id,blocker_id")
    .or(
      `and(blocker_id.eq.${me},blocked_id.eq.${other}),and(blocker_id.eq.${other},blocked_id.eq.${me})`,
    );
  const rows = data ?? [];
  return {
    iBlocked: rows.find((r) => r.blocker_id === me)?.id ?? null,
    blockedMe: rows.some((r) => r.blocker_id === other),
  };
}

export async function blockUser(me: string, other: string) {
  const { error } = await supabase.from("blocks").insert({ blocker_id: me, blocked_id: other });
  if (error) throw error;
}

export async function unblockUser(id: string) {
  const { error } = await supabase.from("blocks").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchProfiles(ids: string[]): Promise<Record<string, MiniProfile>> {
  if (ids.length === 0) return {};
  const { data } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,location")
    .in("id", ids);
  const map: Record<string, MiniProfile> = {};
  for (const p of (data as MiniProfile[]) ?? []) map[p.id] = p;
  return map;
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
