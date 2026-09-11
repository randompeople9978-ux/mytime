// Auth0 is now the *only* auth system in this app (Supabase Auth has been
// retired -- see supabase/migrations/20260905090000_auth0_native_migration.sql).
// Supabase Postgres/Storage/Realtime still trust us via "Third-Party Auth":
// https://supabase.com/docs/guides/auth/third-party/auth0
//
// Required env vars (put these in .env / .env.local):
//   VITE_AUTH0_DOMAIN        e.g. "your-tenant.us.auth0.com"
//   VITE_AUTH0_CLIENT_ID     the SPA application's Client ID
//   VITE_AUTH0_AUDIENCE      optional: only needed if you also call your own APIs
//
// One-time setup you must do in the Auth0 dashboard (this code can't do it
// for you -- it needs your live tenant):
//   1. Create an Application of type "Single Page Application".
//   2. Allowed Callback URLs / Web Origins / Logout URLs = your site's origin
//      (e.g. https://maujajan.example.com, and http://localhost:3000 for dev).
//   3. Advanced Settings -> OAuth -> JsonWebToken Signature Algorithm = RS256.
//   4. Add a Login Action that runs `api.idToken.setCustomClaim('role', 'authenticated')`
//      -- Supabase's Data API assigns the Postgres role from this claim, and
//      it MUST be on the ID token (Auth0 strips unnamespaced claims from the
//      access token).
//   5. In Supabase Dashboard -> Authentication -> Third-Party Auth, add an
//      Auth0 integration with your tenant ID/region.

import { Auth0Client, type User } from "@auth0/auth0-spa-js";

export interface AppUser {
  id: string; // Auth0 `sub` -- now the app-wide user id (text, not uuid)
  email?: string;
  name?: string;
  picture?: string;
}

function readEnv(key: string): string | undefined {
  return (import.meta.env as Record<string, string | undefined>)[key];
}

let _client: Auth0Client | undefined;
let _idToken: string | null = null;
let _user: AppUser | null = null;

function getClient(): Auth0Client {
  if (typeof window === "undefined") {
    throw new Error("Auth0 client is browser-only");
  }
  if (!_client) {
    const domain = readEnv("VITE_AUTH0_DOMAIN");
    const clientId = readEnv("VITE_AUTH0_CLIENT_ID");
    const audience = readEnv("VITE_AUTH0_AUDIENCE");
    if (!domain || !clientId) {
      throw new Error(
        "Missing VITE_AUTH0_DOMAIN / VITE_AUTH0_CLIENT_ID. Set these in your .env (see src/integrations/auth0/client.ts).",
      );
    }
    _client = new Auth0Client({
      domain,
      clientId,
      authorizationParams: {
        redirect_uri: window.location.origin,
        ...(audience ? { audience } : {}),
      },
      cacheLocation: "localstorage",
      useRefreshTokens: true,
    });
  }
  return _client;
}

function toAppUser(u: User | undefined): AppUser | null {
  if (!u?.sub) return null;
  return { id: u.sub, email: u.email, name: u.name, picture: u.picture };
}

/** Call once on app start (client-only). Handles the Auth0 redirect callback
 * if we just came back from Universal Login, then refreshes the cached
 * user + ID token. Safe to call multiple times. */
export async function initAuth0(): Promise<AppUser | null> {
  const client = getClient();
  const params = new URLSearchParams(window.location.search);
  if (params.has("code") && params.has("state")) {
    try {
      await client.handleRedirectCallback();
    } catch (e) {
      console.error("Auth0 redirect callback failed", e);
    }
    // Strip ?code&state from the URL bar without a reload.
    window.history.replaceState({}, "", window.location.pathname);
  }
  return refreshAuthState();
}

export async function refreshAuthState(): Promise<AppUser | null> {
  const client = getClient();
  try {
    const isAuthenticated = await client.isAuthenticated();
    if (!isAuthenticated) {
      _idToken = null;
      _user = null;
      return null;
    }
    const claims = await client.getIdTokenClaims();
    _idToken = claims?.__raw ?? null;
    _user = toAppUser(await client.getUser());
    return _user;
  } catch (e) {
    console.error("Auth0 refreshAuthState failed", e);
    _idToken = null;
    _user = null;
    return null;
  }
}

export function getCachedUser(): AppUser | null {
  return _user;
}

/** The Auth0 ID token -- this (not the access token) is what carries the
 * `role: authenticated` claim Supabase needs. Pass this as the bearer token
 * to Supabase and to this app's own server functions. */
export function getIdToken(): string | null {
  return _idToken;
}

export async function login(options?: { screenHint?: "signup" }) {
  const client = getClient();
  await client.loginWithRedirect({
    authorizationParams: options?.screenHint ? { screen_hint: options.screenHint } : undefined,
  });
}

export async function loginWithGoogle() {
  const client = getClient();
  await client.loginWithRedirect({
    authorizationParams: { connection: "google-oauth2" },
  });
}

export async function logout() {
  const client = getClient();
  _idToken = null;
  _user = null;
  await client.logout({ logoutParams: { returnTo: window.location.origin } });
}

/** Sends the "reset your password" email via Auth0's public Authentication
 * API (no secret needed -- this is a client-safe endpoint). Only works for
 * accounts created with the Auth0 "Database" connection (email/password);
 * Google-only accounts don't have a password to reset. */
export async function requestPasswordReset(email: string) {
  const domain = readEnv("VITE_AUTH0_DOMAIN");
  const clientId = readEnv("VITE_AUTH0_CLIENT_ID");
  const connection = readEnv("VITE_AUTH0_DB_CONNECTION") || "Username-Password-Authentication";
  if (!domain || !clientId) {
    throw new Error("Missing VITE_AUTH0_DOMAIN / VITE_AUTH0_CLIENT_ID.");
  }
  const res = await fetch(`https://${domain}/dbconnections/change_password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, email, connection }),
  });
  if (!res.ok) {
    throw new Error("Gagal mengirim email reset kata sandi.");
  }
}
