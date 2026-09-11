import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { initAuth0, getCachedUser, type AppUser } from "@/integrations/auth0/client";

export interface AuthState {
  session: AppUser | null;
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
}

// Tracks whether we've already upserted the profile/role for the current
// browser session, so we don't call ensure_profile() on every mount.
let ensuredFor: string | null = null;

export function useAuth(): AuthState {
  const [user, setUser] = useState<AppUser | null>(getCachedUser());
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    initAuth0().then(async (u) => {
      if (cancelled) return;
      setUser(u);
      setLoading(false);
      if (u && ensuredFor !== u.id) {
        ensuredFor = u.id;
        const { error } = await supabase.rpc("ensure_profile", {
          _id: u.id,
          _display_name: u.name ?? null,
          _avatar_url: u.picture ?? null,
          _username_hint: u.name ?? u.email ?? null,
        });
        if (error) {
          console.error("ensure_profile failed", error);
          ensuredFor = null; // allow retry on next mount
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user?.id]);

  return { session: user, user, loading, isAdmin };
}
