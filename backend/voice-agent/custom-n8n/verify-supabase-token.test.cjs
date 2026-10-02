'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign, createHmac } = require('node:crypto');
const { verifySupabaseToken } = require('./verify-supabase-token.cjs');
const supabaseUrl = 'https://example.supabase.co';
const claims = () => ({ iss: `${supabaseUrl}/auth/v1`, aud: 'authenticated', role: 'authenticated',
  sub: 'test-user', email: 'test@example.com', exp: Math.floor(Date.now() / 1000) + 300 });
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

for (const alg of ['ES256', 'RS256']) {
  test(`${alg} validates signed claims and rejects changed claims`, async () => {
    const pair = alg === 'ES256' ? generateKeyPairSync('ec', { namedCurve: 'prime256v1' }) :
      generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...pair.publicKey.export({ format: 'jwk' }), kid: 'test', alg };
    const options = { supabaseUrl, loadKeys: async (url) => {
      assert.equal(url, `${supabaseUrl}/auth/v1/.well-known/jwks.json`);
      return [jwk];
    }};
    const tokenFor = (body) => {
      const input = `${encode({ alg, kid: 'test' })}.${encode(body)}`;
      return `${input}.${sign('sha256', Buffer.from(input), { key: pair.privateKey,
        dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
    };
    const body = claims();
    assert.deepEqual(await verifySupabaseToken(tokenFor(body), options), body);
    const valid = tokenFor(body).split('.');
    valid[1] = encode({ ...body, email: 'changed@example.com' });
    await assert.rejects(verifySupabaseToken(valid.join('.'), options));
    for (const update of [{ exp: 0 }, { iss: 'https://other.example/auth/v1' },
      { aud: 'service_role' }, { role: 'service_role' }, { email: '' }, { nbf: body.exp + 300 }]) {
      await assert.rejects(verifySupabaseToken(tokenFor({ ...body, ...update }), options));
    }
  });
}

test('legacy signing requires an explicitly configured secret', async () => {
  const body = claims();
  const input = `${encode({ alg: 'HS256' })}.${encode(body)}`;
  const token = `${input}.${createHmac('sha256', 'test-secret').update(input).digest('base64url')}`;
  assert.deepEqual(await verifySupabaseToken(token, { supabaseUrl, legacySecret: 'test-secret' }), body);
  await assert.rejects(verifySupabaseToken(token, { supabaseUrl, legacySecret: 'wrong-secret' }));
});

test('unsigned and malformed tokens are rejected', async () => {
  for (const token of ['', 'invalid', `${encode({ alg: 'none' })}.${encode(claims())}.`,
    `${encode(null)}.${encode(null)}.`]) {
    await assert.rejects(verifySupabaseToken(token, { supabaseUrl }));
  }
  await assert.rejects(verifySupabaseToken('invalid', { supabaseUrl: 'http://example.com' }));
});
