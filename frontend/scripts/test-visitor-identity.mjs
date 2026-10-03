import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const compiled = await build({ entryPoints: ["packages/chatty-react/src/visitor-identity.ts"], bundle: true, platform: "node", format: "esm", write: false });
const { VisitorIdentityClient } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const backend = "https://api.example.com";
const bot = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const anon = { visitor_token: "a".repeat(43), session_id: "ci-aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", expires_at: "2099-01-01" };
const verified = { ...anon, visitor_token: "b".repeat(43), session_id: "ci-bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb" };
globalThis.location = { href: "https://website.example.com" };
function storage() {
  const data = {};
  globalThis.localStorage = new Proxy({
    getItem: key => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
    removeItem: key => { delete data[key]; },
  }, { ownKeys: () => Object.keys(data), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
  return data;
}
test("signed token not persisted; switching clears cached profiles and aborts requests", async () => {
  const data = storage();
  let pendingSignal;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/identity")) return Response.json(JSON.parse(options.body).identity_token ? verified : anon);
    pendingSignal = options.signal;
    return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }));
  };
  const client = new VisitorIdentityClient(bot, backend);
  await client.initialize();
  localStorage.setItem(`chatty_msgs_${bot}_host`, "private previous profile");
  const pending = client.fetch(`${backend}/api/widget/poll`);
  const aborted = assert.rejects(pending, { name: "AbortError" });
  await client.identify("server-signed-token");
  await aborted;
  assert.equal(pendingSignal.aborted, true);
  assert.equal(data[`chatty_msgs_${bot}_host`], undefined);
  assert.equal(JSON.stringify(data).includes("server-signed-token"), false);
  assert.equal(client.value.session_id, verified.session_id);
});
test("logout clears locally before network and rotates anonymous identity", async () => {
  storage();
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return Response.json(url.endsWith("logout") ? { ok: true } : anon); };
  const client = new VisitorIdentityClient(bot, backend);
  client.value = verified;
  const done = client.logout();
  assert.equal(client.value, null);
  await done;
  assert.equal(new Headers(calls[0].options.headers).get("X-Chatty-Visitor"), verified.visitor_token);
  assert.equal(client.value.visitor_token, anon.visitor_token);
});
test("credentials never sent to external origins", async () => {
  storage();
  let headers;
  globalThis.fetch = async (_url, options) => { headers = new Headers(options.headers); return Response.json({}); };
  const client = new VisitorIdentityClient(bot, backend);
  client.value = anon;
  await client.fetch("https://other.example.com/file");
  assert.equal(headers.has("X-Chatty-Visitor"), false);
  await client.fetch(`${backend}/api/widget/poll`);
  assert.equal(headers.get("X-Chatty-Visitor"), anon.visitor_token);
});
test("failed identification stays unmounted, never falls back to previous account", async () => {
  storage();
  globalThis.fetch = async () => new Response("denied", { status: 401 });
  const client = new VisitorIdentityClient(bot, backend);
  client.value = verified;
  await assert.rejects(client.identify("expired-token"));
  assert.equal(client.value, null);
  await assert.rejects(client.fetch(`${backend}/api/widget/poll`));
});

test("logout cancels queued identify, rather than silently restoring a verified user", async () => {
  storage();
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push(JSON.parse(options.body || "{}")); return Response.json(url.endsWith("logout") ? { ok: true } : anon); };
  const client = new VisitorIdentityClient(bot, backend);
  client.value = verified;
  const identify = assert.rejects(client.identify("queued-signed-token"), { name: "AbortError" });
  await client.logout();
  await identify;
  assert.equal(client.value.visitor_token, anon.visitor_token);
  assert.equal(calls.some(call => call.identity_token), false);
});
