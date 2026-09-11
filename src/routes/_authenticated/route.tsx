import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { initAuth0 } from "@/integrations/auth0/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await initAuth0();
    if (!user) throw redirect({ to: "/auth" });
    // Wajib onboarding: username + nama tampilan + foto sebelum masuk area akun.
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    const onboarded = (profile as { onboarded?: boolean } | null)?.onboarded;
    if (!onboarded) throw redirect({ to: "/onboarding" });
    return { user };
  },
  component: () => <Outlet />,
});
