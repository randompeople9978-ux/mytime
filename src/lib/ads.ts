import { supabase } from "@/integrations/supabase/client";

export interface Ad {
  id: string;
  image_url: string;
  title: string | null;
  target_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export const AD_SELECT = "id,image_url,title,target_url,sort_order,is_active,created_at";

/** Banner iklan aktif untuk carousel beranda. */
export async function fetchActiveAds(): Promise<Ad[]> {
  const { data } = await supabase
    .from("ads")
    .select(AD_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(60);
  return (data as Ad[]) ?? [];
}

/** Semua iklan (admin), termasuk yang nonaktif. */
export async function fetchAllAds(): Promise<Ad[]> {
  const { data } = await supabase
    .from("ads")
    .select(AD_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as Ad[]) ?? [];
}

export async function createAd(input: {
  imageUrl: string;
  title?: string | null;
  targetUrl?: string | null;
  sortOrder?: number;
  createdBy: string;
}) {
  const { error } = await supabase.from("ads").insert({
    image_url: input.imageUrl,
    title: input.title?.trim() || null,
    target_url: input.targetUrl?.trim() || null,
    sort_order: input.sortOrder ?? 0,
    created_by: input.createdBy,
  });
  if (error) throw error;
}

export async function setAdActive(id: string, isActive: boolean) {
  const { error } = await supabase.from("ads").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function setAdOrder(id: string, sortOrder: number) {
  const { error } = await supabase.from("ads").update({ sort_order: sortOrder }).eq("id", id);
  if (error) throw error;
}

export async function deleteAd(id: string) {
  const { error } = await supabase.from("ads").delete().eq("id", id);
  if (error) throw error;
}

/** Durasi geser carousel (detik) dari pengaturan situs. */
export async function fetchAdInterval(): Promise<number> {
  const { data } = await supabase
    .from("site_settings")
    .select("ads_interval_seconds")
    .eq("id", "global")
    .maybeSingle();
  const s = Number(data?.ads_interval_seconds ?? 5);
  return s === 10 ? 10 : 5;
}

export async function setAdInterval(seconds: 5 | 10) {
  const { error } = await supabase
    .from("site_settings")
    .update({ ads_interval_seconds: seconds })
    .eq("id", "global");
  if (error) throw error;
}
