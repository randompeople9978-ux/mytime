import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Send,
  Phone,
  Pencil,
  Trash2,
  ImagePlus,
  Ban,
  Check,
  CheckCheck,
  X,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { CallPanel } from "@/components/CallPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { uploadImage, validateImageFile } from "@/lib/imageUpload";
import { blockUser, unblockUser, getBlock, fmtTime, type MiniProfile } from "@/lib/social";

export const Route = createFileRoute("/_authenticated/chat/$userId")({
  component: ChatPage,
});

interface Msg {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string | null;
  attachment_url: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  read_at: string | null;
  created_at: string;
}

const SELECT =
  "id,sender_id,recipient_id,body,attachment_url,edited_at,deleted_at,read_at,created_at";

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Hari ini";
  if (same(d, yest)) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/** Centang satu = terkirim, centang biru ganda = sudah dibaca penerima. */
function Ticks({ read }: { read: boolean }) {
  return (
    <span className={`tick ${read ? "read" : ""}`} title={read ? "Dibaca" : "Terkirim"}>
      {read ? <CheckCheck size={13} /> : <Check size={13} />}
    </span>
  );
}


function ChatPage() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [peer, setPeer] = useState<MiniProfile | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<Msg | null>(null);
  const [busy, setBusy] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [block, setBlock] = useState({ iBlocked: null as string | null, blockedMe: false });
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url,location")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => setPeer((data as MiniProfile) ?? null));
    getBlock(user.id, userId).then(setBlock);
  }, [user?.id, userId]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select(SELECT)
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`,
        )
        .order("created_at", { ascending: true })
        .limit(300);
      if (alive) setMsgs((data as Msg[]) ?? []);
      await supabase
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", user.id)
        .eq("sender_id", userId)
        .is("read_at", null);
    })();

    const ch = supabase
      .channel(`dm-${[user.id, userId].sort().join("-")}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, (payload) => {
        const row = (payload.new ?? payload.old) as Msg;
        const relevant =
          (row.sender_id === user.id && row.recipient_id === userId) ||
          (row.sender_id === userId && row.recipient_id === user.id);
        if (!relevant) return;
        setMsgs((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((m) => m.id !== row.id);
          const next = prev.filter((m) => m.id !== row.id);
          return [...next, payload.new as Msg].sort((a, b) => a.created_at.localeCompare(b.created_at));
        });
        // Pesan masuk saat layar chat terbuka -> langsung tandai dibaca (centang biru untuk pengirim).
        if (payload.eventType === "INSERT" && row.recipient_id === user.id && !row.read_at) {
          void supabase
            .from("direct_messages")
            .update({ read_at: new Date().toISOString() })
            .eq("id", row.id);
        }
      })
      .subscribe();


    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [user?.id, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function send() {
    if (!user) return;
    const body = text.trim();
    if (!body) return;
    if (body.length > 2000) return toast.error("Pesan maksimal 2000 karakter.");
    setBusy(true);
    if (editing) {
      const { error } = await supabase
        .from("direct_messages")
        .update({ body, edited_at: new Date().toISOString() })
        .eq("id", editing.id);
      setBusy(false);
      if (error) return toast.error(error.message);
      setMsgs((p) => p.map((m) => (m.id === editing.id ? { ...m, body, edited_at: new Date().toISOString() } : m)));
      setEditing(null);
      setText("");
      return;
    }
    const { data, error } = await supabase
      .from("direct_messages")
      .insert({ sender_id: user.id, recipient_id: userId, body })
      .select(SELECT)
      .maybeSingle();
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("row-level") ? "Tidak bisa mengirim: kamu atau dia memblokir." : error.message);
      return;
    }
    if (data) setMsgs((p) => [...p, data as Msg]);
    setText("");
  }

  async function sendImage(file: File) {
    if (!user) return;
    const err = validateImageFile(file);
    if (err) return toast.error(err);
    setBusy(true);
    try {
      const url = await uploadImage("listings", user.id, file);
      const { data } = await supabase
        .from("direct_messages")
        .insert({ sender_id: user.id, recipient_id: userId, attachment_url: url, attachment_type: "image" })
        .select(SELECT)
        .maybeSingle();
      if (data) setMsgs((p) => [...p, data as Msg]);
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal mengunggah gambar");
    } finally {
      setBusy(false);
    }
  }

  async function softDelete() {
    if (!confirmDel) return;
    const id = confirmDel;
    setConfirmDel(null);
    const { error } = await supabase
      .from("direct_messages")
      .update({ deleted_at: new Date().toISOString(), body: null, attachment_url: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setMsgs((p) => p.map((m) => (m.id === id ? { ...m, deleted_at: new Date().toISOString(), body: null, attachment_url: null } : m)));
  }

  async function startCall() {
    if (!user) return;
    const { data, error } = await supabase
      .from("calls")
      .insert({ caller_id: user.id, callee_id: userId })
      .select("id")
      .maybeSingle();
    if (error || !data) return toast.error(error?.message ?? "Gagal memulai panggilan");
    setCallId(data.id);
  }

  async function toggleBlock() {
    if (!user) return;
    try {
      if (block.iBlocked) {
        await unblockUser(block.iBlocked);
        toast.success("Blokir dibuka.");
      } else {
        await blockUser(user.id, userId);
        toast.success("Pengguna diblokir.");
      }
      setBlock(await getBlock(user.id, userId));
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal");
    }
  }

  const peerName = peer?.display_name || peer?.username || "Pengguna";
  const locked = !!block.iBlocked || block.blockedMe;

  return (
    <Shell>
      <div className="chat-head">
        <button className="btn btn-outline btn-sm" onClick={() => nav({ to: "/messages" })} aria-label="Kembali">
          <ArrowLeft size={14} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{peerName}</div>
          {peer && <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>@{peer.username}</span>}
        </div>
        <button className="btn btn-primary btn-sm" onClick={startCall} disabled={locked} aria-label="Panggilan suara">
          <Phone size={14} />
        </button>
        <button className="btn btn-outline btn-sm" onClick={toggleBlock} aria-label="Blokir">
          <Ban size={14} />
        </button>
      </div>

      <div className="chat-body">
        {msgs.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: 12.5, padding: 20 }}>
            Belum ada pesan. Kamu bisa langsung tanya soal produk tanpa harus berteman.
          </p>
        )}
        {msgs.map((m, idx) => {
          const mine = m.sender_id === user?.id;
          const prev = msgs[idx - 1];
          const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
          const grouped = !!prev && !newDay && prev.sender_id === m.sender_id;
          return (
            <div key={m.id}>
              {newDay && <div className="chat-day">{dayLabel(m.created_at)}</div>}
              <div className={`bubble-row ${mine ? "mine" : ""} ${grouped ? "grouped" : ""}`}>
                <div className={`bubble ${mine ? "mine" : ""}`}>
                  {m.deleted_at ? (
                    <i style={{ opacity: 0.6, fontSize: 12.5 }}>Pesan dihapus</i>
                  ) : (
                    <>
                      {m.attachment_url && (
                        <img src={m.attachment_url} alt="Lampiran pesan" className="bubble-img" />
                      )}
                      {m.body && <span className="bubble-text">{m.body}</span>}
                    </>
                  )}
                  <div className="bubble-meta">
                    <span className="bubble-time">{fmtTime(m.created_at)}</span>
                    {m.edited_at && !m.deleted_at ? <span>diedit</span> : null}
                    {mine && <Ticks read={!!m.read_at} />}
                    {mine && !m.deleted_at && (
                      <span className="bubble-tools">
                        <button
                          onClick={() => {
                            setEditing(m);
                            setText(m.body ?? "");
                          }}
                          aria-label="Edit pesan"
                        >
                          <Pencil size={11} />
                        </button>
                        <button onClick={() => setConfirmDel(m.id)} aria-label="Hapus pesan">
                          <Trash2 size={11} />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>


      {locked ? (
        <div className="chat-input">
          <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: 0 }}>
            {block.iBlocked ? "Kamu memblokir pengguna ini." : "Kamu diblokir oleh pengguna ini."}
          </p>
        </div>
      ) : (
        <div className="chat-input">
          {editing && (
            <div className="edit-strip">
              Mengedit pesan
              <button onClick={() => { setEditing(null); setText(""); }} aria-label="Batal edit">
                <X size={12} />
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void sendImage(f);
              e.target.value = "";
            }}
          />
          <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()} aria-label="Kirim gambar">
            <ImagePlus size={15} />
          </button>
          <input
            className="field"
            style={{ margin: 0, flex: 1 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Tulis pesan..."
            maxLength={2000}
          />
          <button className="btn btn-primary btn-sm" onClick={send} disabled={busy} aria-label="Kirim">
            {editing ? <Check size={15} /> : <Send size={15} />}
          </button>
        </div>
      )}

      {callId && user && (
        <CallPanel callId={callId} me={user.id} role="caller" peerName={peerName} onClose={() => setCallId(null)} />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus pesan ini?"
        message="Pesan akan ditandai sebagai dihapus untuk kedua pihak."
        confirmLabel="Ya, hapus"
        danger
        onConfirm={softDelete}
        onCancel={() => setConfirmDel(null)}
      />
    </Shell>
  );
}
