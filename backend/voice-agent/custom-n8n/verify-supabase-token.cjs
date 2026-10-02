'use strict';

const { createPublicKey, createHmac, timingSafeEqual, verify } = require('node:crypto');
const jwksCache = new Map();

async function loadKeys(url) {
  const cached = jwksCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.keys;
  const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
  if (!response.ok) throw new Error('Signing keys unavailable');
  const body = await response.json();
  if (!Array.isArray(body.keys)) throw new Error('Invalid signing keys');
  jwksCache.set(url, { keys: body.keys, expires: Date.now() + 300000 });
  return body.keys;
}

async function verifySupabaseToken(token, options = {}) {
  const baseUrl = (options.supabaseUrl || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!baseUrl || new URL(baseUrl).protocol !== 'https:') throw new Error('Supabase URL required');
  if (typeof token !== 'string' || token.length > 16384) throw new Error('Invalid access token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid access token');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  const signature = Buffer.from(parts[2], 'base64url');
  const input = Buffer.from(`${parts[0]}.${parts[1]}`);
  let valid = false;
  if (header.alg === 'HS256') {
    const secret = options.legacySecret || process.env.SUPABASE_JWT_SECRET;
    if (!secret) throw new Error('Signing configuration required');
    const expected = createHmac('sha256', secret).update(input).digest();
    valid = signature.length === expected.length && timingSafeEqual(signature, expected);
  } else if (header.alg === 'ES256' || header.alg === 'RS256') {
    if (typeof header.kid !== 'string' || !header.kid) throw new Error('Signing key required');
    const keys = await (options.loadKeys || loadKeys)(`${baseUrl}/auth/v1/.well-known/jwks.json`);
    const key = keys.find((candidate) => candidate.kid === header.kid &&
      (!candidate.alg || candidate.alg === header.alg) && (!candidate.use || candidate.use === 'sig') &&
      (header.alg === 'ES256' ? candidate.kty === 'EC' && candidate.crv === 'P-256' : candidate.kty === 'RSA'));
    if (!key) throw new Error('Signing key unavailable');
    valid = verify('sha256', input, {
      key: createPublicKey({ key, format: 'jwk' }),
      dsaEncoding: 'ieee-p1363',
    }, signature);
  }
  const now = Math.floor(Date.now() / 1000);
  if (!valid || claims.iss !== `${baseUrl}/auth/v1` ||
      !(claims.aud === 'authenticated' || Array.isArray(claims.aud) && claims.aud.includes('authenticated')) ||
      !Number.isFinite(claims.exp) || claims.exp <= now ||
      (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now)) ||
      claims.role !== 'authenticated' || typeof claims.sub !== 'string' || !claims.sub ||
      typeof claims.email !== 'string' || !claims.email) throw new Error('Invalid access token');
  return claims;
}

module.exports = { verifySupabaseToken };
