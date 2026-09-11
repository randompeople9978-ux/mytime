import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, MessageCircle, Trash2, Plus, ExternalLink, Send, Newspaper, Clock } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/lib/useAuth";
import { ImageUpload } from "@/components/ImageUpload";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  fetchFeed,
  createPost,
  deletePost,
  toggleLike,
  fetchComments,
  addComment,
  deleteComment,
  fmtDateTime,
  expiryFromChoice,
  type PostView,
  type PostComment,
} from "@/lib/posts";

export const Route = createFileRoute("/newsjajan")({
  head: () => ({
    meta: [
      { title: "NewsJajan — Promosi Jajanan Terbaru | MAUJAJAN INDONESIA" },
      {
        name: "description",
        content:
          "Lihat promosi, harga spesial, dan info terbaru dari penjual jajanan di sekitarmu. Suka dan komentari postingan favoritmu.",
      },
      { property: "og:title", content: "NewsJajan — Promosi Jajanan Terbaru" },
      {
        property: "og:description",
        content: "Promosi dan info jajanan terbaru dari para penjual MAUJAJAN INDONESIA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewsPage,
});

const EXPIRY_OPTIONS = [
  { v: "1h", label: "1 hari" },
  { v: "6j", label: "6 jam" },
  { v: "12j", label: "12 jam" },
  { v: "3h", label: "3 hari" },
  { v: "7h", label: "7 hari" },
  { v: "30h", label: "30 hari" },
  { v: "", label: "Tanpa batas waktu" },
];

function expiryLabel(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Berakhir";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `${Math.floor(h / 24)} hari lagi`;
  if (h >= 1) return `${h} jam lagi`;
  return `${Math.max(1, Math.floor(ms / 60_000))} menit lagi`;
}

function NewsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState(false);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // composer state
  const [cImage, setCImage] = useState<string | null>(null);
  const [cTitle, setCTitle] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cLink, setCLink] = useState("");
  const [cExpiry, setCExpiry] = useState("1h");
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await fetchFeed(user?.id ?? null);
    setPosts(data);
    setLoading(false);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function publish() {
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    const title = cTitle.trim();
    if (title.length < 3) {
      toast.error("Judul minimal 3 karakter.");
      return;
    }
    if (cLink.trim() && !/^https?:\/\/.+\..+/.test(cLink.trim())) {
      toast.error("Link harus diawali http:// atau https://");
      return;
    }
    setBusy(true);
    try {
      await createPost({
        userId: user.id,
        imageUrl: cImage,
        title: title.slice(0, 80),
        description: cDesc.trim().slice(0, 500) || null,
        linkUrl: cLink.trim() || null,
        expiresAt: expiryFromChoice(cExpiry),
      });
      toast.success("Promosi terbit di NewsJajan!");
      setComposer(false);
      setCImage(null);
      setCTitle("");
      setCDesc("");
      setCLink("");
      setCExpiry("1h");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menerbitkan promosi.");
    } finally {
      setBusy(false);
    }
  }

  async function like(p: PostView) {
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    setPosts((ps) =>
      ps.map((x) => (x.id === p.id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x)),
    );
    try {
      await toggleLike(p.id, user.id, p.liked);
    } catch {
      await load();
    }
  }

  async function openComments(postId: string) {
    if (commentsFor === postId) {
      setCommentsFor(null);
      return;
    }
    setCommentsFor(postId);
    setCommentDraft("");
    setComments(await fetchComments(postId));
  }

  async function sendComment(postId: string) {
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    const body = commentDraft.trim();
    if (!body) return;
    setCommentDraft("");
    try {
      await addComment(postId, user.id, body.slice(0, 300));
      setComments(await fetchComments(postId));
      setPosts((ps) => ps.map((x) => (x.id === postId ? { ...x, comments: x.comments + 1 } : x)));
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal mengirim komentar.");
    }
  }

  async function removeComment(id: string, postId: string) {
    await deleteComment(id);
    setComments(await fetchComments(postId));
    setPosts((ps) =>
      ps.map((x) => (x.id === postId ? { ...x, comments: Math.max(0, x.comments - 1) } : x)),
    );
  }

  async function removePost() {
    if (!confirmDel) return;
    const id = confirmDel;
    setConfirmDel(null);
    try {
      await deletePost(id);
      setPosts((ps) => ps.filter((p) => p.id !== id));
      toast.success("Postingan dihapus.");
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menghapus.");
    }
  }

  return (
    <Shell>
      <div className="news-head">
        <h1 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Newspaper size={20} color="var(--accent)" /> NewsJajan
        </h1>
        <button
          className="btn btn-gold btn-sm"
          onClick={() => (user ? setComposer(true) : nav({ to: "/auth" }))}
        >
          <Plus size={14} /> Promosi
        </button>
      </div>
      <p className="news-sub">
        Promosi, harga spesial, dan info terbaru dari para penjual. Postingan bisa dijadwalkan hapus
        otomatis.
      </p>

      <div className="news-feed">
        {loading && <p className="inbox-empty">Memuat promosi...</p>}
        {!loading && posts.length === 0 && (
          <div className="card" style={{ padding: 26, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)" }}>
              Belum ada promosi. Jadi yang pertama — tekan <b>Promosi</b> di atas!
            </p>
          </div>
        )}
        {posts.map((p) => {
          const exp = expiryLabel(p.expires_at);
          return (
            <article key={p.id} className="post-card">
              <div className="post-meta">
                <div className="avatar-sm">
                  {p.author?.avatar_url ? (
                    <img src={p.author.avatar_url} alt="" />
                  ) : (
                    (p.author?.display_name ?? p.author?.username ?? "?").slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="post-who">
                  <b>{p.author?.display_name ?? "Pengguna"}</b>
                  <span>
                    @{p.author?.username ?? "anon"} · {fmtDateTime(p.created_at)}
                  </span>
                </div>
                {exp && (
                  <span className="post-expiry">
                    <Clock size={9} style={{ marginRight: 3, verticalAlign: -1 }} />
                    {exp}
                  </span>
                )}
              </div>
              {p.image_url && (
                <img className="post-img" src={p.image_url} alt={p.title} loading="lazy" />
              )}
              <div className="post-body">
                <h2 className="post-title">{p.title}</h2>
                {p.description && <p className="post-desc">{p.description}</p>}
                {p.link_url && (
                  <a
                    href={p.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    <ExternalLink size={12} /> Buka tautan
                  </a>
                )}
              </div>
              <div className="post-actions">
                <button className={`post-act ${p.liked ? "liked" : ""}`} onClick={() => like(p)}>
                  <Heart size={15} fill={p.liked ? "currentColor" : "none"} /> {p.likes}
                </button>
                <button className="post-act" onClick={() => openComments(p.id)}>
                  <MessageCircle size={15} /> {p.comments}
                </button>
                {user?.id === p.user_id && (
                  <button
                    className="post-act"
                    style={{ marginLeft: "auto", color: "var(--danger)" }}
                    onClick={() => setConfirmDel(p.id)}
                  >
                    <Trash2 size={14} /> Hapus
                  </button>
                )}
              </div>
              {commentsFor === p.id && (
                <div className="post-comments">
                  {comments.length === 0 && (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>
                      Belum ada komentar.
                    </p>
                  )}
                  {comments.map((c) => (
                    <div key={c.id} className="comment-row">
                      <div className="avatar-sm">
                        {c.author?.avatar_url ? (
                          <img src={c.author.avatar_url} alt="" />
                        ) : (
                          (c.author?.display_name ?? "?").slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div className="comment-body">
                        <b>
                          {c.author?.display_name ?? "Pengguna"}
                          <span>{fmtDateTime(c.created_at)}</span>
                        </b>
                        {c.body}
                      </div>
                      {user?.id === c.user_id && (
                        <button
                          className="comment-del"
                          onClick={() => removeComment(c.id, p.id)}
                          aria-label="Hapus komentar"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="comment-input">
                    <input
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder={user ? "Tulis komentar..." : "Masuk dulu untuk berkomentar"}
                      disabled={!user}
                      maxLength={300}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void sendComment(p.id);
                      }}
                    />
                    <button
                      className="btn btn-gold btn-sm"
                      onClick={() => sendComment(p.id)}
                      disabled={!user || !commentDraft.trim()}
                      aria-label="Kirim komentar"
                    >
                      <Send size={13} />
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {composer && user && (
        <div className="sheet-overlay" onClick={() => setComposer(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 4px" }}>Buat Promosi</h3>
            <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 14px" }}>
              Terbit ke halaman publik NewsJajan. Atur kapan otomatis terhapus, atau hapus manual
              kapan saja.
            </p>
            <ImageUpload
              bucket="listings"
              userId={user.id}
              value={cImage}
              onChange={setCImage}
              label="Foto promosi (opsional)"
            />
            <div style={{ height: 12 }} />
            <label className="lbl">Judul</label>
            <input
              className="field"
              value={cTitle}
              onChange={(e) => setCTitle(e.target.value)}
              maxLength={80}
              placeholder="mis. Diskon 20% semua gorengan hari ini!"
            />
            <label className="lbl">Deskripsi (opsional)</label>
            <textarea
              className="field"
              value={cDesc}
              onChange={(e) => setCDesc(e.target.value)}
              maxLength={500}
              placeholder="Detail promo, harga, lokasi..."
            />
            <label className="lbl">Link (opsional)</label>
            <input
              className="field"
              value={cLink}
              onChange={(e) => setCLink(e.target.value)}
              placeholder="https://..."
            />
            <label className="lbl">Hapus otomatis setelah</label>
            <select className="field" value={cExpiry} onChange={(e) => setCExpiry(e.target.value)}>
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setComposer(false)}>
                Batal
              </button>
              <button className="btn btn-gold" style={{ flex: 1 }} onClick={publish} disabled={busy}>
                {busy ? "Menerbitkan..." : "Terbitkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus postingan ini?"
        message="Postingan, suka, dan komentarnya akan hilang permanen."
        confirmLabel="Ya, hapus"
        danger
        onConfirm={removePost}
        onCancel={() => setConfirmDel(null)}
      />
    </Shell>
  );
}
