import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { CallPanel } from "@/components/CallPanel";

interface Incoming {
  id: string;
  caller_id: string;
  name: string;
}

export function IncomingCallListener() {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<Incoming | null>(null);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`incoming-calls-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${user.id}` },
        async (payload) => {
          const row = payload.new as { id: string; caller_id: string; status: string };
          if (row.status !== "ringing") return;
          const { data } = await supabase
            .from("profiles")
            .select("username,display_name")
            .eq("id", row.caller_id)
            .maybeSingle();
          setIncoming({
            id: row.id,
            caller_id: row.caller_id,
            name: data?.display_name || data?.username || "Pengguna",
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  if (!incoming || !user) return null;
  return (
    <CallPanel
      callId={incoming.id}
      me={user.id}
      role="callee"
      peerName={incoming.name}
      onClose={() => setIncoming(null)}
    />
  );
}
