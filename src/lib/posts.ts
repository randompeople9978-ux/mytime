import { supabase } from "@/integrations/supabase/client";
import type { MiniProfile } from "@/lib/social";

export interface Post {
  id: string;
  user_id: string;
  image_url: string | null;
  title: string;
  description: string | null;
  link_url: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface PostView extends Post {
  author: MiniProfile | null;
  likes: number;
  liked: boolean;
  comments: number;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: MiniProfile | null;
}

const SELECT = "id,user_id,image_url,title,description,link_url,expires_at,created_at";

export async function fetchFeed(meId: string | null): Promise<PostView[]> {
  const { data } = await supabase
    .from("posts")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(100);
  const posts = ((data as Post[]) ?? []).filter(
    (p) => !p.expires_at || new Date(p.expires_at).getTime() > Date.now() || p.user_id === meId,
  );
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);
  const [likes, comments, profiles] = await Promise.all([
    supabase.from("post_likes").select("post_id,user_id").in("post_id", ids),
    supabase.from("post_comments").select("post_id").in("post_id", ids),
    supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .in("id", [...new Set(posts.map((p) => p.user_id))]),
  ]);
  const likeRows = (likes.data as { post_id: string; user_id: string }[]) ?? [];
  const commentRows = (comments.data as { post_id: string }[]) ?? [];
  const profMap = new Map<string, MiniProfile>();
  for (const p of (profiles.data as MiniProfile[]) ?? []) profMap.set(p.id, p);
  return posts.map((p) => ({
    ...p,
    author: profMap.get(p.user_id) ?? null,
    likes: likeRows.filter((l) => l.post_id === p.id).length,
    liked: !!meId && likeRows.some((l) => l.post_id === p.id && l.user_id === meId),
    comments: commentRows.filter((c) => c.post_id === p.id).length,
  }));
}

export async function createPost(input: {
  userId: string;
  imageUrl: string | null;
  title: string;
  description: string | null;
  linkUrl: string | null;
  expiresAt: string | null;
}) {
  const { error } = await supabase.from("posts").insert({
    user_id: input.userId,
    image_url: input.imageUrl,
    title: input.title,
    description: input.description,
    link_url: input.linkUrl,
    expires_at: input.expiresAt,
  });
  if (error) throw error;
}

export async function deletePost(id: string) {
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleLike(postId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
}

export async function fetchComments(postId: string): Promise<PostComment[]> {
  const { data } = await supabase
    .from("post_comments")
    .select("id,post_id,user_id,body,created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(200);
  const rows = (data as Omit<PostComment, "author">[]) ?? [];
  if (rows.length === 0) return [];
  const { data: profs } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url")
    .in("id", [...new Set(rows.map((r) => r.user_id))]);
  const map = new Map<string, MiniProfile>();
  for (const p of (profs as MiniProfile[]) ?? []) map.set(p.id, p);
  return rows.map((r) => ({ ...r, author: map.get(r.user_id) ?? null }));
}

export async function addComment(postId: string, userId: string, body: string) {
  const { error } = await supabase.from("post_comments").insert({ post_id: postId, user_id: userId, body });
  if (error) throw error;
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from("post_comments").delete().eq("id", id);
  if (error) throw error;
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function expiryFromChoice(choice: string): string | null {
  const hours: Record<string, number> = { "6j": 6, "12j": 12, "1h": 24, "3h": 72, "7h": 168, "30h": 720 };
  const h = hours[choice];
  if (!h) return null;
  return new Date(Date.now() + h * 3_600_000).toISOString();
}
