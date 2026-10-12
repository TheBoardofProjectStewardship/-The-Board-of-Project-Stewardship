import assert from "node:assert/strict";
import test from "node:test";
import { handle } from "../src/index.js";
import { inspectImage } from "../src/images.js";
import { createLedger } from "../src/ledger.js";
import { CONSENT_TEXT_VERSION, memoryKV } from "../src/policy.js";

const ORIGIN = "https://boardofprojectstewardship.com";
const PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
));

function env(extra = {}) {
  return {
    LIVE_ENABLED: "true",
    ALLOWED_ORIGIN: ORIGIN,
    SESSION_SIGNING_KEY: "test-signing-key-0123456789",
    IP_HASH_SALT: "test-ip-salt-0123456789",
    TURNSTILE_HOSTNAME: ORIGIN.replace("https://", ""),
    LEAD_NOTIFY_EMAIL: "editorial@boardofprojectstewardship.com",
    LIMITS: memoryKV(),
    ledger: createLedger(),
    turnstileVerify: async (token, action) => ({
      ok: token === "ok",
      hostname: "boardofprojectstewardship.com",
      action,
    }),
    ...extra,
  };
}

function post(path, body, headers = {}) {
  return new Request("https://worker.test" + path, {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function session(box) {
  const response = await handle(post("/api/session", { turnstile_token: "ok" }), box);
  assert.equal(response.status, 200);
  return (await response.json()).token;
}

const leadBody = {
  turnstile_token: "ok",
  name: "Ada Homeowner",
  email: "ada@example.com",
  project_types: ["Second story"],
  timeline: "Within 3 months",
  budget: "Not sure yet",
  relationship: "I own it",
  city: "Edmonds",
  zip: "98020",
  address: "1 Main St",
  mode: "addition",
  consent_share: true,
  consent_text: false,
  consent_newsletter: false,
  consent_text_version: CONSENT_TEXT_VERSION,
  note: "UNIQUE-NOTE-SHOULD-NOT-EMAIL",
  company_website: "",
};

test("image inspection uses bytes, not the caller content type", () => {
  const png = inspectImage(PNG);
  assert.equal(png.ok, true);
  assert.equal(png.mime, "image/png");
  assert.equal(png.width, 1);
  assert.equal(png.height, 1);
  const fake = inspectImage(new Uint8Array([1, 2, 3, 4]));
  assert.equal(fake.ok, false);
});

test("POST from an unapproved origin is rejected", async () => {
  const response = await handle(post("/api/session", { turnstile_token: "ok" }, { Origin: "https://evil.example" }), env());
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("live routes stay off until LIVE_ENABLED is true", async () => {
  const response = await handle(post("/api/session", { turnstile_token: "ok" }), env({ LIVE_ENABLED: "false" }));
  assert.equal(response.status, 503);
});

test("a forged lead id does not spend or grant a lead allowance", async () => {
  const box = env({
    GEMINI_API_KEY: "present",
    DAILY_SPEND_CAP_USD: "1",
    IMAGES: { async get() { return { arrayBuffer: async () => PNG.buffer }; } },
  });
  const token = await session(box);
  await box.LIMITS.put("image:11111111-1111-4111-8111-111111111111", JSON.stringify({
    imageId: "11111111-1111-4111-8111-111111111111",
    ownerSessionId: JSON.parse(new TextDecoder().decode(Uint8Array.from(Buffer.from(token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/") + "==", "base64")))).sid,
    storageKey: "anon/x.png",
    source: "visitor-upload",
    mime: "image/png",
    expiresAt: Date.now() + 60_000,
  }));
  const response = await handle(post("/api/render", {
    imageId: "11111111-1111-4111-8111-111111111111",
    mode: "addition",
    leadId: "forged-lead",
    visitorId: "forged-visitor",
    options: { additionType: "dormer", additionStyle: "craftsman", roof: "match" },
    note: "Keep the porch",
  }, { Authorization: "Bearer " + token }), box);
  const payload = await response.json();
  assert.equal(response.status, 501);
  assert.equal(payload.error, "provider_call_pending_keys");
  assert.equal(payload.model, undefined);
  assert.equal(box.ledger.snapshot().committedMicro, 0);
  assert.equal(Object.keys(box.ledger.snapshot().reservations).length, 0);
});

test("missing provider configuration does not reserve spend", async () => {
  const box = env({ DAILY_SPEND_CAP_USD: "" });
  const token = await session(box);
  const sid = JSON.parse(new TextDecoder().decode(Uint8Array.from(Buffer.from(token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/") + "==", "base64")))).sid;
  await box.LIMITS.put("image:22222222-2222-4222-8222-222222222222", JSON.stringify({
    imageId: "22222222-2222-4222-8222-222222222222",
    ownerSessionId: sid,
    storageKey: "anon/y.png",
    source: "visitor-upload",
    mime: "image/png",
    expiresAt: Date.now() + 60_000,
  }));
  const response = await handle(post("/api/render", {
    imageId: "22222222-2222-4222-8222-222222222222",
    mode: "kitchen",
    options: { kitchenScope: "refresh", kitchenStyle: "northwest-modern" },
  }, { Authorization: "Bearer " + token }), box);
  assert.equal(response.status, 503);
  assert.equal(box.ledger.snapshot().committedMicro, 0);
});

test("spend settles only after a billed provider result", async () => {
  const box = env({
    GEMINI_API_KEY: "present",
    DAILY_SPEND_CAP_USD: "1",
    IMAGES: { async get() { return { arrayBuffer: async () => PNG.buffer }; } },
    providerCall: async () => ({ ok: true, billed: true }),
  });
  const token = await session(box);
  const sid = JSON.parse(new TextDecoder().decode(Uint8Array.from(Buffer.from(token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/") + "==", "base64")))).sid;
  const imageId = "33333333-3333-4333-8333-333333333333";
  await box.LIMITS.put("image:" + imageId, JSON.stringify({
    imageId,
    ownerSessionId: sid,
    storageKey: "anon/z.png",
    source: "visitor-upload",
    mime: "image/png",
    expiresAt: Date.now() + 60_000,
  }));
  const headers = { Authorization: "Bearer " + token };
  const body = {
    imageId,
    mode: "addition",
    leadId: "forged-lead",
    options: { additionType: "second-story", additionStyle: "match-existing", roof: "match" },
  };
  const first = await handle(post("/api/render", body, headers), box);
  assert.equal(first.status, 200);
  assert.equal(box.ledger.snapshot().committedMicro, 50_000);
  const second = await handle(post("/api/render", body, headers), box);
  assert.equal(second.status, 429);
  assert.equal((await second.json()).error, "free_limit");
});

test("lead is stored before mail and the confirmation cannot carry a note", async () => {
  const sent = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.resend.com")) {
      sent.push(JSON.parse(init.body));
      return new Response("{}", { status: 200 });
    }
    return original(url, init);
  };
  try {
    const box = env({ RESEND_API_KEY: "test", EMAIL_PROVIDER: "resend" });
    const token = await session(box);
    const response = await handle(post("/api/lead", leadBody, {
      Authorization: "Bearer " + token,
      "Idempotency-Key": "lead-1",
    }), box);
    const payload = await response.json();
    assert.equal(response.status, 202);
    assert.equal(payload.status, "received");
    const stored = JSON.parse(await box.LIMITS.get("lead:" + payload.leadId));
    assert.equal(stored.email, "ada@example.com");
    assert.equal(stored.note, "UNIQUE-NOTE-SHOULD-NOT-EMAIL");
    assert.equal(sent.length, 2);
    for (const message of sent) {
      assert.equal(JSON.stringify(message).includes("UNIQUE-NOTE-SHOULD-NOT-EMAIL"), false);
    }
    const visitor = sent.find((message) => message.to[0] === "ada@example.com");
    assert.match(visitor.text, /received your project request/);
    const again = await handle(post("/api/lead", leadBody, {
      Authorization: "Bearer " + token,
      "Idempotency-Key": "lead-1",
    }), box);
    assert.equal(again.status, 202);
    assert.equal(sent.length, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test("street view and subscribe require a session and a challenge", async () => {
  const box = env();
  const open = await handle(post("/api/streetview-meta", { address: "1 Main St" }), box);
  assert.equal(open.status, 401);
  const token = await session(box);
  const subscribed = await handle(post("/api/subscribe", {
    email: "ada@example.com",
    consent_newsletter: true,
    turnstile_token: "ok",
    note: "please spam this inbox",
  }, { Authorization: "Bearer " + token }), box);
  assert.equal(subscribed.status, 200);
  assert.deepEqual(await subscribed.json(), { ok: true });
  const row = JSON.parse(await box.LIMITS.get("sub:ada@example.com"));
  assert.equal(row.status, "pending");
});
