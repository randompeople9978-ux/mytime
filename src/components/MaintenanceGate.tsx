import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";

export function MaintenanceGate({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [state, setState] = useState<{ on: boolean; message: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data } = await supabase
        .from("site_settings")
        .select("maintenance_mode, maintenance_message")
        .eq("id", "global")
        .maybeSingle();
      if (alive) setState({ on: !!data?.maintenance_mode, message: data?.maintenance_message ?? null });
    }
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [pathname]);

  const allowed = pathname === "/auth" || pathname.startsWith("/privacy") || pathname.startsWith("/terms");

  if (!state?.on || allowed || loading || isAdmin) return <>{children}</>;

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card" style={{ maxWidth: 420, padding: 28, textAlign: "center" }}>
        <Wrench size={34} style={{ color: "var(--gold)" }} />
        <h1 style={{ fontSize: 20, margin: "12px 0 6px" }}>Situs sedang perbaikan</h1>
        <p style={{ fontSize: 13.5, color: "var(--ink-soft)", margin: 0 }}>
          {state.message || "Kami sedang melakukan perbaikan singkat. Silakan kembali beberapa saat lagi."}
        </p>
        <Link to="/auth" className="btn btn-outline btn-sm" style={{ marginTop: 18 }}>
          Masuk sebagai admin
        </Link>
      </div>
    </div>
  );
}
