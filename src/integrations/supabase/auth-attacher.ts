import { createMiddleware } from '@tanstack/react-start'
import { getIdToken } from '@/integrations/auth0/client'

// Must be registered as a global `functionMiddleware` in `src/start.ts`; otherwise
// the browser never attaches the bearer token to serverFn RPCs.
// Uses Auth0's ID token (not the access token -- see src/integrations/auth0/client.ts
// for why), matching what src/integrations/supabase/client.ts forwards to Supabase.
export const attachSupabaseAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const token = getIdToken()
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  },
)
