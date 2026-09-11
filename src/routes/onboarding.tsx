import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser, initAuth0 } from "@/integrations/auth0/client";
import { Shell } from "@/components/Shell";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import { Check, X, Loader2 } from "lucide-react";
import logoAsset from "@/assets/maujajan-logo.png.asset.json";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lengkapi Profil — MAUJAJAN INDONESIA" },
      { name: "description", content: "Buat username unik, nama tampilan, dan foto profil sebelum mulai jajan." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

type UStatus = "idle" | "checking" | "ok" | "taken" | "invalid";

function OnboardingPage() {
  const nav = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [ustatus, setUstatus] = useState<UStatus>("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const authUser = (await initAuth0()) ?? getCachedUser();
      if (!authUser) {
        nav({ to: "/auth", replace: true });
        return;
      }
      setUid(authUser.id);
      const { data: p } = await supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
      const prof = p as { onboarded?: boolean; username?: string; display_name?: string | null; avatar_url?: string | null } | null;
      if (prof?.onboarded) {
        nav({ to: "/", replace: true });
        return;
      }
      setUsername(prof?.username ?? "");
      setDisplayName(prof?.display_name ?? authUser.name ?? "");
      setAvatar(prof?.avatar_url ?? authUser.picture ?? null);
      setReady(true);
    })();
  }, []);

  // Cek ketersediaan username secara realtime (debounce)
  useEffect(() => {
    const v = username.trim().toLowerCase();
    if (!v) return setUstatus("idle");
    if (!/^[a-z0-9._]{3,20}$/.test(v)) return setUstatus("invalid");
    setUstatus("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id").ilike("username", v).maybeSingle();
      setUstatus(data && data.id !== uid ? "taken" : "ok");
    }, 450);
    return () => clearTimeout(t);
  }, [username, uid]);

  async function finish() {
    if (!uid) return;
    const uname = username.trim().toLowerCase();
    const name = displayName.trim();
    if (!/^[a-z0-9._]{3,20}$/.test(uname)) {
      toast.error("Username 3-20 karakter: huruf kecil, angka, titik, garis bawah.");
      return;
    }
    if (name.length < 2) {
      toast.error("Nama tampilan minimal 2 karakter.");
      return;
    }
    if (ustatus === "taken") {
      toast.error("Username sudah dipakai, pilih yang lain.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({
      id: uid,
      username: uname,
      display_name: name,
      avatar_url: avatar,
      onboarded: true,
    } as any);
    setBusy(false);
    if (error) {
      toast.error(/username/i.test(error.message) ? "Username sudah dipakai, pilih yang lain." : error.message);
      return;
    }
    toast.success("Profil siap. Selamat datang di MAUJAJAN!");
    nav({ to: "/", replace: true });
  }

  if (!ready)
    return (
      <Shell hideNav>
        <p style={{ padding: 40, textAlign: "center", color: "var(--ink-soft)" }}>Memuat...</p>
      </Shell>
    );

  return (
    <Shell hideNav>
      <div className="auth-wrap" style={{ justifyContent: "flex-start", paddingTop: 44, minHeight: "70vh" }}>
        <img src={logoAsset.url} alt="MAUJAJAN INDONESIA" style={{ height: 84, width: 84, marginBottom: 16 }} />
        <h1 style={{ fontSize: 26 }}>Satu langkah lagi!</h1>
        <p style={{ marginBottom: 20 }}>
          Buat username unik, nama tampilan, dan foto profil. Username tidak bisa sama dengan pengguna lain.
        </p>
        <div className="card fade-in" style={{ padding: 18, width: "100%", maxWidth: 340, textAlign: "left" }}>
          {uid && <ImageUpload bucket="avatars" userId={uid} value={avatar} onChange={setAvatar} label="Foto profil" />}
          <label className="lbl">Username (unik)</label>
          <div style={{ position: "relative" }}>
            <input
              className="field"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
              placeholder="mis. budi.jajan"
              maxLength={20}
              style={{ marginBottom: 4, paddingRight: 34 }}
            />
            <span style={{ position: "absolute", right: 12, top: 13 }}>
              {ustatus === "checking" && <Loader2 size={15} className="spin" color="var(--ink-soft)" />}
              {ustatus === "ok" && <Check size={15} color="var(--success)" />}
              {(ustatus === "taken" || ustatus === "invalid") && <X size={15} color="var(--danger)" />}
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              display: "block",
              marginBottom: 10,
              color:
                ustatus === "ok" ? "var(--success)" : ustatus === "idle" || ustatus === "checking" ? "var(--ink-soft)" : "var(--danger)",
            }}
          >
            {ustatus === "ok"
              ? "Username tersedia!"
              : ustatus === "taken"
                ? "Sudah dipakai akun lain."
                : ustatus === "invalid"
                  ? "3-20 karakter: huruf kecil, angka, titik, garis bawah."
                  : "Huruf kecil, angka, titik, garis bawah."}
          </span>
          <label className="lbl">Nama tampilan</label>
          <input
            className="field"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nama yang dilihat pembeli"
            maxLength={40}
          />
          <button
            className="btn btn-gold btn-block"
            onClick={finish}
            disabled={busy || ustatus === "taken" || ustatus === "invalid"}
          >
            {busy ? "Menyimpan..." : "Mulai Jajan"}
          </button>
        </div>
      </div>
    </Shell>
  );
}
