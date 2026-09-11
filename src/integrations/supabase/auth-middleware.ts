// Verifies an Auth0-issued ID token for this app's own server functions.
// (Supabase's own PostgREST/Storage verify the token separately via
// "Third-Party Auth" -- this middleware is for server functions that want
// `context.userId` without going through Supabase at all.)
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createRemoteJWKSet, jwtVerify } from 'jose'

let _jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks(domain: string) {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
  }
  return _jwks;
}

export const requireAuth0Auth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const AUTH0_DOMAIN = process.env.VITE_AUTH0_DOMAIN || process.env.AUTH0_DOMAIN;
    const AUTH0_CLIENT_ID = process.env.VITE_AUTH0_CLIENT_ID || process.env.AUTH0_CLIENT_ID;

    if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) {
      const missing = [
        ...(!AUTH0_DOMAIN ? ['VITE_AUTH0_DOMAIN'] : []),
        ...(!AUTH0_CLIENT_ID ? ['VITE_AUTH0_CLIENT_ID'] : []),
      ];
      throw new Error(`Missing Auth0 environment variable(s): ${missing.join(', ')}.`);
    }

    const request = getRequest();

    if (!request?.headers) {
      throw new Error('Unauthorized: No request headers available');
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header provided');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized: Only Bearer tokens are supported');
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token || token.split('.').length !== 3) {
      throw new Error('Unauthorized: Invalid token');
    }

    let claims;
    try {
      const { payload } = await jwtVerify(token, getJwks(AUTH0_DOMAIN), {
        issuer: `https://${AUTH0_DOMAIN}/`,
        audience: AUTH0_CLIENT_ID, // ID tokens are audienced to the SPA's client id
      });
      claims = payload;
    } catch (e) {
      throw new Error('Unauthorized: Invalid token');
    }

    if (!claims.sub) {
      throw new Error('Unauthorized: No user ID found in token');
    }

    return next({
      context: {
        userId: claims.sub,
        claims,
      },
    });
  },
);
