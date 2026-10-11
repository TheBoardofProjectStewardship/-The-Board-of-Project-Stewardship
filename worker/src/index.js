/**
 * Cloudflare Worker for the concept visualizer.
 * Not deployed by this pull request. Secrets stay in `wrangler secret put`.
 *
 * Routes: /api/streetview-meta, /api/upload, /api/render, /api/lead, /api/subscribe
 * Only a visitor-uploaded image is ever forwarded to an image model.
 */
import { buildLeadMessage, buildVisitorMessage, deliverEmail, forwardSheet } from "./email.js";
import { CONSENT_TEXT_VERSION, consumeRender, modelCost, reserveSpend, selectProvider, validateLead } from "./policy.js";
import { buildModelRequest, buildPrompt } from "./prompts.js";

const DEFAULT_ORIGIN = "https://boardofprojectstewardship.com";

function originAllowed(request, env) {
  const allowed = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
  const origin = request.headers.get("Origin") || "";
  return origin === allowed ? allowed : "";
}

function corsHeaders(request, env) {
  const allowed = originAllowed(request, env);
  if (!allowed) return {};
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(request, env, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request, env),
    },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function verifyTurnstile(token, env, ip) {
  if (!env.TURNSTILE_SECRET) return { ok: false, reason: "turnstile_not_configured" };
  const body = new URLSearchParams();
  body.set("secret", env.TURNSTILE_SECRET);
  body.set("response", token || "");
  if (ip) body.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const data = await response.json();
  return { ok: Boolean(data.success), reason: data.success ? "" : "turnstile_failed" };
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "0.0.0.0";
}

async function hashIp(ip, env) {
  const salt = env.IP_HASH_SALT || "see-project";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + "|" + ip));
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function streetviewMeta(request, env) {
  const body = await readJson(request);
  if (!body || !body.address) return json(request, env, 400, { ok: false, error: "address_required" });
  if (!env.MAPS_SERVER_KEY) {
    return json(request, env, 200, { ok: false, coverage: false, reason: "maps_key_not_configured" });
  }
  const url = new URL("https://maps.googleapis.com/maps/api/streetview/metadata");
  url.searchParams.set("location", String(body.address).slice(0, 180));
  url.searchParams.set("source", "outdoor");
  url.searchParams.set("key", env.MAPS_SERVER_KEY);
  const response = await fetch(url);
  const data = await response.json();
  const coverage = data.status === "OK";
  return json(request, env, 200, {
    ok: true,
    coverage,
    pano: coverage ? data.pano_id || "" : "",
    lat: coverage ? data.location?.lat : null,
    lng: coverage ? data.location?.lng : null,
    image: null,
  });
}

async function upload(request, env) {
  const ip = clientIp(request);
  const form = await request.formData();
  const token = String(form.get("turnstile_token") || "");
  const gate = await verifyTurnstile(token, env);
  if (!gate.ok) return json(request, env, 403, { ok: false, error: gate.reason });
  const file = form.get("photo");
  if (!file || typeof file.arrayBuffer !== "function") {
    return json(request, env, 400, { ok: false, error: "photo_required" });
  }
  const type = file.type || "";
  if (!/^image\/(jpeg|png|webp)$/.test(type)) {
    return json(request, env, 400, { ok: false, error: "type" });
  }
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > 8 * 1024 * 1024) return json(request, env, 400, { ok: false, error: "too_large" });
  if (!env.IMAGES) return json(request, env, 503, { ok: false, error: "bucket_not_configured" });
  const id = crypto.randomUUID();
  const key = "anon/" + id + ".jpg";
  await env.IMAGES.put(key, bytes, {
    httpMetadata: { contentType: "image/jpeg" },
    customMetadata: { kind: "anonymous", uploadedAt: new Date().toISOString(), ipHash: await hashIp(ip, env) },
  });
  return json(request, env, 200, { ok: true, key, deleteAfterDays: 7 });
}

async function render(request, env) {
  const body = await readJson(request);
  if (!body) return json(request, env, 400, { ok: false, error: "json" });
  const gate = await verifyTurnstile(body.turnstile_token, env, clientIp(request));
  if (!gate.ok) return json(request, env, 403, { ok: false, error: gate.reason });
  const key = String(body.uploadKey || "");
  if (!key.startsWith("anon/") && !key.startsWith("leads/")) {
    return json(request, env, 400, { ok: false, error: "upload_key" });
  }
  if (/streetview|pano|maps\.googleapis/i.test(key)) {
    return json(request, env, 400, { ok: false, error: "streetview_not_allowed" });
  }
  const selection = selectProvider(env);
  const cost = modelCost(selection.model);
  const cap = Number(env.DAILY_SPEND_CAP_USD || "");
  const kv = env.LIMITS;
  if (!kv) return json(request, env, 503, { ok: false, error: "limits_not_configured" });
  const ipHash = await hashIp(clientIp(request), env);
  const slot = await consumeRender(kv, {
    ipHash,
    visitorId: String(body.visitorId || ipHash),
    mode: String(body.mode || ""),
    leadId: String(body.leadId || ""),
  });
  if (!slot.ok) return json(request, env, 429, { ok: false, error: slot.code });
  if (!env.IMAGES) return json(request, env, 503, { ok: false, error: "bucket_not_configured" });
  const object = await env.IMAGES.get(key);
  if (!object) return json(request, env, 404, { ok: false, error: "upload_missing" });
  const bytes = await object.arrayBuffer();
  const spend = await reserveSpend(kv, { costUsd: cost, capUsd: cap });
  if (!spend.ok) {
    return json(request, env, 429, {
      ok: false,
      error: spend.code,
      message: "Leave your details and we will send concepts when the daily budget allows.",
    });
  }
  const built = buildPrompt(body.mode, body.options || {}, body.note || "");
  if (built.noteRefused) return json(request, env, 400, { ok: false, error: "note_refused" });
  const modelRequest = buildModelRequest(selection, built.prompt, bytes);
  if (!env.GEMINI_API_KEY && !env.OPENAI_API_KEY) {
    return json(request, env, 503, { ok: false, error: "image_provider_not_configured", modelRequest: { provider: modelRequest.provider, model: modelRequest.model } });
  }
  return json(request, env, 501, { ok: false, error: "provider_call_pending_keys", model: selection.model });
}

async function lead(request, env) {
  const body = await readJson(request);
  const checked = validateLead(body);
  if (!checked.ok) return json(request, env, 400, { ok: false, errors: checked.errors });
  const notify = env.LEAD_NOTIFY_EMAIL || "editorial@boardofprojectstewardship.com";
  const payload = { ...body, ...checked.record };
  const message = buildLeadMessage(payload, notify);
  const sent = await deliverEmail(env, message);
  const visitor = await deliverEmail(env, buildVisitorMessage(payload));
  const sheet = await forwardSheet(env, payload);
  const leadId = crypto.randomUUID();
  return json(request, env, 200, {
    ok: true,
    leadId,
    priority: checked.record.priority,
    email: sent,
    visitor,
    sheet,
    consent_text_version: CONSENT_TEXT_VERSION,
  });
}

async function subscribe(request, env) {
  const body = await readJson(request);
  if (!body || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email || ""))) {
    return json(request, env, 400, { ok: false, error: "email" });
  }
  if (!body.consent_newsletter) return json(request, env, 400, { ok: false, error: "newsletter_consent" });
  const message = buildLeadMessage({
    name: "Newsletter",
    email: body.email,
    priority: "newsletter",
    city: "",
    consent_text_version: CONSENT_TEXT_VERSION,
    checkboxes: { consent_newsletter: true },
  }, env.LEAD_NOTIFY_EMAIL || "editorial@boardofprojectstewardship.com");
  message.subject = "Planning guides signup";
  const sent = await deliverEmail(env, message);
  return json(request, env, 200, { ok: true, email: sent });
}

export async function handle(request, env = {}) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    if (!originAllowed(request, env)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  if (request.method !== "POST") return json(request, env, 405, { ok: false, error: "method" });
  if (url.pathname === "/api/streetview-meta") return streetviewMeta(request, env);
  if (url.pathname === "/api/upload") return upload(request, env);
  if (url.pathname === "/api/render") return render(request, env);
  if (url.pathname === "/api/lead") return lead(request, env);
  if (url.pathname === "/api/subscribe") return subscribe(request, env);
  return json(request, env, 404, { ok: false, error: "not_found" });
}

export default { fetch: handle };
