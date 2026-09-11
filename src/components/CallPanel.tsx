import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Circle, Download, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDuration } from "@/lib/social";
import { toast } from "sonner";

type Status = "ringing" | "accepted" | "declined" | "ended" | "missed";

interface Props {
  callId: string;
  me: string;
  role: "caller" | "callee";
  peerName: string;
  onClose: () => void;
}

const ICE = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

export function CallPanel({ callId, me, role, peerName, onClose }: Props) {
  const [status, setStatus] = useState<Status>("ringing");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [myConsent, setMyConsent] = useState(false);
  const [peerConsent, setPeerConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordUrl, setRecordUrl] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef<number | null>(null);

  // ---- timer
  useEffect(() => {
    if (status !== "accepted") return;
    if (startedRef.current == null) startedRef.current = Date.now();
    const t = setInterval(() => {
      setSeconds(Math.floor((Date.now() - (startedRef.current ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  // ---- call row realtime (status + consents)
  useEffect(() => {
    let alive = true;
    supabase
      .from("calls")
      .select("status,caller_record_consent,callee_record_consent")
      .eq("id", callId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        setStatus(data.status as Status);
        applyConsents(data.caller_record_consent, data.callee_record_consent);
      });

    const ch = supabase
      .channel(`call-row-${callId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${callId}` },
        (payload) => {
          const row = payload.new as {
            status: Status;
            caller_record_consent: boolean;
            callee_record_consent: boolean;
          };
          setStatus(row.status);
          applyConsents(row.caller_record_consent, row.callee_record_consent);
        },
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
    function applyConsents(caller: boolean, callee: boolean) {
      setMyConsent(role === "caller" ? caller : callee);
      setPeerConsent(role === "caller" ? callee : caller);
    }
  }, [callId, role]);

  // ---- media + signaling
  useEffect(() => {
    let disposed = false;
    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        toast.error("Mikrofon tidak bisa diakses. Izinkan akses mikrofon untuk panggilan suara.");
        await endCall("ended");
        return;
      }
      if (disposed) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localRef.current = stream;

      const pc = new RTCPeerConnection(ICE);
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.ontrack = (e) => {
        const [rs] = e.streams;
        remoteRef.current = rs ?? null;
        if (audioRef.current && rs) {
          audioRef.current.srcObject = rs;
          void audioRef.current.play().catch(() => {});
        }
      };

      const ch = supabase.channel(`call-sig-${callId}`, { config: { broadcast: { self: false } } });
      chanRef.current = ch;

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          void ch.send({ type: "broadcast", event: "ice", payload: { from: me, candidate: e.candidate.toJSON() } });
        }
      };

      ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.from === me || role !== "callee") return;
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        void ch.send({ type: "broadcast", event: "answer", payload: { from: me, sdp: answer } });
      });

      ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.from === me || role !== "caller") return;
        if (pc.signalingState !== "stable") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        }
      });

      ch.on("broadcast", { event: "ice" }, async ({ payload }) => {
        if (payload.from === me) return;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch {
          /* ignore */
        }
      });

      ch.on("broadcast", { event: "ready" }, async ({ payload }) => {
        if (payload.from === me || role !== "caller") return;
        await makeOffer();
      });

      await ch.subscribe();

      if (role === "callee") {
        void ch.send({ type: "broadcast", event: "ready", payload: { from: me } });
      }

      async function makeOffer() {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        void ch.send({ type: "broadcast", event: "offer", payload: { from: me, sdp: offer } });
      }
    })();

    return () => {
      disposed = true;
      cleanupMedia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, role, me]);

  // ---- recording when both consented
  useEffect(() => {
    if (status !== "accepted") return;
    if (myConsent && peerConsent && !recording) void startRecording();
    if ((!myConsent || !peerConsent) && recording) stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myConsent, peerConsent, status]);

  async function startRecording() {
    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();
      if (localRef.current) ctx.createMediaStreamSource(localRef.current).connect(dest);
      if (remoteRef.current) ctx.createMediaStreamSource(remoteRef.current).connect(dest);
      const rec = new MediaRecorder(dest.stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > 0) setRecordUrl(URL.createObjectURL(blob));
      };
      rec.start(1000);
      recRef.current = rec;
      setRecording(true);
      toast.success("Perekaman dimulai — kedua pihak sudah setuju.");
    } catch {
      toast.error("Perangkat ini tidak mendukung perekaman.");
    }
  }

  function stopRecording() {
    recRef.current?.state === "recording" && recRef.current.stop();
    recRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    setRecording(false);
  }

  function cleanupMedia() {
    stopRecording();
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (chanRef.current) supabase.removeChannel(chanRef.current);
    chanRef.current = null;
  }

  async function toggleConsent() {
    const next = !myConsent;
    setMyConsent(next);
    const patch =
      role === "caller" ? { caller_record_consent: next } : { callee_record_consent: next };
    await supabase.from("calls").update(patch).eq("id", callId);
  }

  async function accept() {
    await supabase.from("calls").update({ status: "accepted", started_at: new Date().toISOString() }).eq("id", callId);
    setStatus("accepted");
  }

  async function endCall(next: "declined" | "ended") {
    stopRecording();
    await supabase
      .from("calls")
      .update({
        status: next,
        ended_at: new Date().toISOString(),
        duration_seconds: seconds,
      })
      .eq("id", callId);
    setStatus(next);
  }

  function toggleMute() {
    const tracks = localRef.current?.getAudioTracks() ?? [];
    const next = !muted;
    tracks.forEach((t) => (t.enabled = !next));
    setMuted(next);
  }

  const finished = status === "ended" || status === "declined" || status === "missed";

  useEffect(() => {
    if (finished) cleanupMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  return (
    <div className="call-overlay" role="dialog" aria-modal="true" aria-label={`Panggilan suara dengan ${peerName}`}>
      <div className="call-card">
        <div className="call-avatar">{peerName.slice(0, 1).toUpperCase()}</div>
        <h3>{peerName}</h3>
        <p className="call-state">
          {status === "ringing" && (role === "caller" ? "Memanggil..." : "Panggilan masuk")}
          {status === "accepted" && <span className="call-timer">{fmtDuration(seconds)}</span>}
          {status === "declined" && "Panggilan ditolak"}
          {status === "ended" && `Panggilan selesai • ${fmtDuration(seconds)}`}
          {status === "missed" && "Tidak terjawab"}
        </p>

        {status === "accepted" && (
          <div className="call-consent">
            <label>
              <input type="checkbox" checked={myConsent} onChange={toggleConsent} /> Saya setuju direkam
            </label>
            <span className={peerConsent ? "ok" : "wait"}>
              {peerConsent ? `${peerName} setuju` : `Menunggu izin ${peerName}`}
            </span>
            {recording && (
              <span className="rec">
                <Circle size={9} fill="currentColor" /> Merekam
              </span>
            )}
          </div>
        )}

        {recordUrl && (
          <div className="call-record">
            <audio controls src={recordUrl} style={{ width: "100%" }} />
            <a className="btn btn-outline btn-sm" href={recordUrl} download={`panggilan-${callId}.webm`}>
              <Download size={13} /> Unduh rekaman
            </a>
          </div>
        )}

        <div className="call-actions">
          {status === "ringing" && role === "callee" && (
            <>
              <button className="btn btn-primary" onClick={accept}>
                <Phone size={16} /> Terima
              </button>
              <button className="btn btn-danger" onClick={() => endCall("declined")}>
                <PhoneOff size={16} /> Tolak
              </button>
            </>
          )}
          {status === "accepted" && (
            <button className="btn btn-outline" onClick={toggleMute}>
              {muted ? <MicOff size={16} /> : <Mic size={16} />} {muted ? "Suara mati" : "Mic aktif"}
            </button>
          )}
          {!finished && (status !== "ringing" || role === "caller") && (
            <button className="btn btn-danger" onClick={() => endCall("ended")}>
              <PhoneOff size={16} /> {status === "ringing" ? "Batalkan" : "Akhiri"}
            </button>
          )}
          {finished && (
            <button className="btn btn-primary" onClick={onClose}>
              Tutup
            </button>
          )}
        </div>
      </div>
      <audio ref={audioRef} autoPlay />
    </div>
  );
}
