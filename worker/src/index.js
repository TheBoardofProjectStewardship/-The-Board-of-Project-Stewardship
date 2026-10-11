/**
 * Cloudflare Worker for the concept visualizer.
 * Not deployed by this pull request. LIVE_ENABLED defaults off.
 * Secrets stay in `wrangler secret put`. No spend is recorded unless a
 * provider call reports a billed success.
 */
import { buildLeadMessage, buildSubscribeMessage, buildVisitorMessage, deliverEmail, forwardSheet } from "./email.js";
import { inspectImage, sha256Hex, UPLOAD_MAX_BYTES } from "./images.js";
import { DailyLedger, ledgerTransact } from "./ledger.js";
import {
  CONSENT_TEXT_VERSION,
  dayKey,
  providerReady,
  readSpendCapMicro,
  selectProvider,
  modelCostMicro,
  validateLead,
} from "./policy.js";
import { buildModelRequest, buildPrompt, normalizeOptions } from "./prompts.js";
import { bearer, issueSessionToken, readSessionToken, signingKey } from "./session.js";

const DEFAULT_ORIGIN = "https://boardofprojectstewardship.com";
const IMAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function liveEnabled(env) {
  return env.LIVE_ENABLED === "true";
}

function originAllowed(request, env) {
  const allowed = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
  const origin = request.headers.get("Origin") || "";
  return origin === allowed ? allowed : "";
}

function corsHeaders(request, env) {
  const allowed = originAllowed(request, env);
  if (!allowed) return { "Cache-Control": "no-store" };
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

function json(request, env, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request, env) },
  });
}

function unavailable(request, env, code = "unavailable") {
  return json(request, env, 503, { ok: false, error: code });
}

async function readJson(request) {
  const type = (request.headers.get("Content-Type") || "").toLowerCase();
  if (!type.startsWith("application/json")) return { error: "type" };
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > 200_000) return { error: "too_large" };
  const text = await request.text();
  if (text.length > 200_000) return { error: "too_large" };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { error: "json" };
  }
}

function turnstileHost(env) {
  return env.TURNSTILE_HOSTNAME || "boardofprojectstewardship.com";
}

function acceptTurnstile(data, env, action) {
  const ok = Boolean(data && (data.success || data.ok));
  if (!ok) return { ok: false, reason: "turnstile_failed" };
  if ((data.hostname || "") !== turnstileHost(env)) return { ok: false, reason: "turnstile_failed" };
  if (action && data.action !== action) return { ok: false, reason: "turnstile_failed" };
  return { ok: true, hostname: data.hostname, action: data.action || action };
}

async function verifyTurnstile(token, env, ip, action) {
  if (typeof env.turnstileVerify === "function") {
    return acceptTurnstile(await env.turnstileVerify(token, action, ip), env, action);
  }
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
  return acceptTurnstile(data, env, action);
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "0.0.0.0";
}

async function hashIp(ip, env) {
  const salt = String(env.IP_HASH_SALT || "");
  if (salt.length < 16) return "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + "|" + ip));
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function bump(env, key, max, code, day) {
  return ledgerTransact(env, { type: "bump", key, max, code, day });
}

async function loadSession(request, env) {
  if (!env.LIMITS) return null;
  const parsed = await readSessionToken(env, bearer(request));
  if (!parsed) return null;
  const raw = await env.LIMITS.get("session:" + parsed.sid);
  if (!raw) return null;
  const record = JSON.parse(raw);
  if (!record || record.expiresAt <= Date.now()) return null;
  return record;
}

async function saveSession(env, record) {
  await env.LIMITS.put("session:" + record.sid, JSON.stringify(record));
}

function kvReady(env) {
  return Boolean(env.LIMITS && signingKey(env));
}

async function session(request, env) {
  if (!liveEnabled(env)) return unavailable(request, env);
  if (!kvReady(env)) return unavailable(request, env);
  const ipHash = await hashIp(clientIp(request), env);
  if (!ipHash) return unavailable(request, env);
  const parsed = await readJson(request);
  if (parsed.error) return json(request, env, 400, { ok: false, error: parsed.error });
  const gate = await verifyTurnstile(parsed.body.turnstile_token, env, clientIp(request), "session");
  if (!gate.ok) return json(request, env, 403, { ok: false, error: "turnstile_failed" });
  const day = dayKey();
  const ipLimit = await bump(env, "session-ip:" + ipHash, 20, "session_limit", day);
  if (!ipLimit.ok && ipLimit.code !== "limits_not_configured") {
    return json(request, env, ipLimit.code === "limits_not_configured" ? 503 : 429, { ok: false, error: ipLimit.code });
  }
  if (!ipLimit.ok) return unavailable(request, env, "limits_not_configured");
  const globalLimit = await bump(env, "session-global", 2000, "session_limit", day);
  if (!globalLimit.ok) return json(request, env, 429, { ok: false, error: "session_limit" });
  const sid = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const token = await issueSessionToken(env, sid, Math.floor(expiresAt / 1000));
  await saveSession(env, {
    sid,
    ipHash,
    createdAt: new Date().toISOString(),
    expiresAt,
    leadId: null,
    imageIds: [],
    renderIds: [],
  });
  return json(request, env, 200, { ok: true, token, expiresAt });
}

async function streetviewMeta(request, env) {
  if (!liveEnabled(env)) return unavailable(request, env);
  const current = await loadSession(request, env);
  if (!current) return json(request, env, 401, { ok: false, error: "session" });
  const parsed = await readJson(request);
  if (parsed.error) return json(request, env, 400, { ok: false, error: parsed.error });
  const address = String(parsed.body.address || "").trim();
  if (!address || address.length > 180) return json(request, env, 400, { ok: false, error: "address" });
  const day = dayKey();
  const sessionLimit = await bump(env, "sv:" + current.sid, 30, "streetview_limit", day);
  if (!sessionLimit.ok) return json(request, env, sessionLimit.code === "limits_not_configured" ? 503 : 429, { ok: false, error: sessionLimit.code });
  const ipLimit = await bump(env, "sv-ip:" + current.ipHash, 60, "streetview_limit", day);
  if (!ipLimit.ok) return json(request, env, 429, { ok: false, error: ipLimit.code });
  if (!env.MAPS_SERVER_KEY) return json(request, env, 200, { ok: false, coverage: false, reason: "maps_key_not_configured" });
  const url = new URL("https://maps.googleapis.com/maps/api/streetview/metadata");
  url.searchParams.set("location", address);
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
  if (!liveEnabled(env)) return unavailable(request, env);
  const current = await loadSession(request, env);
  if (!current) return json(request, env, 401, { ok: false, error: "session" });
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > UPLOAD_MAX_BYTES + 64_000) return json(request, env, 400, { ok: false, error: "too_large" });
  const room = await bump(env, "upload:" + current.sid, 6, "upload_limit", dayKey());
  if (!room.ok) return json(request, env, room.code === "limits_not_configured" ? 503 : 429, { ok: false, error: room.code });
  const form = await request.formData();
  const file = form.get("photo");
  if (!file || typeof file.arrayBuffer !== "function") return json(request, env, 400, { ok: false, error: "photo_required" });
  if (file.size > UPLOAD_MAX_BYTES) return json(request, env, 400, { ok: false, error: "too_large" });
  const inspected = inspectImage(new Uint8Array(await file.arrayBuffer()));
  if (!inspected.ok) return json(request, env, 400, { ok: false, error: inspected.error });
  if (!env.IMAGES) return unavailable(request, env);
  const imageId = crypto.randomUUID();
  const storageKey = "anon/" + imageId + "." + inspected.ext;
  const createdAt = new Date().toISOString();
  const expiresAt = Date.now() + IMAGE_TTL_MS;
  await env.IMAGES.put(storageKey, inspected.bytes, {
    httpMetadata: { contentType: inspected.mime },
    customMetadata: { kind: "anonymous", uploadedAt: createdAt },
  });
  const record = {
    imageId,
    ownerSessionId: current.sid,
    storageKey,
    source: "visitor-upload",
    mime: inspected.mime,
    width: inspected.width,
    height: inspected.height,
    sha256: await sha256Hex(inspected.bytes),
    createdAt,
    expiresAt,
    leadId: null,
  };
  await env.LIMITS.put("image:" + imageId, JSON.stringify(record), { expirationTtl: 7 * 24 * 60 * 60 });
  current.imageIds = [...(current.imageIds || []), imageId].slice(-6);
  await saveSession(env, current);
  return json(request, env, 200, { ok: true, imageId, expiresAt });
}

async function ownedImage(env, imageId, session) {
  if (!/^[0-9a-f-]{36}$/i.test(String(imageId || ""))) return null;
  const raw = await env.LIMITS.get("image:" + imageId);
  if (!raw) return null;
  const record = JSON.parse(raw);
  if (!record || record.ownerSessionId !== session.sid) return null;
  if (record.expiresAt <= Date.now()) return null;
  if (record.source !== "visitor-upload") return null;
  return record;
}

async function render(request, env) {
  if (!liveEnabled(env)) return unavailable(request, env);
  const current = await loadSession(request, env);
  if (!current) return json(request, env, 401, { ok: false, error: "session" });
  const parsed = await readJson(request);
  if (parsed.error) return json(request, env, 400, { ok: false, error: parsed.error });
  const body = parsed.body || {};
  const mode = String(body.mode || "");
  if (mode !== "addition" && mode !== "kitchen" && mode !== "bathroom") {
    return json(request, env, 400, { ok: false, error: "mode" });
  }
  const options = normalizeOptions(mode, body.options || {});
  if (!options.ok) return json(request, env, 400, { ok: false, error: "option" });
  const built = buildPrompt(mode, body.options || {}, body.note || "");
  if (!built.ok) return json(request, env, 400, { ok: false, error: built.noteRefused ? "note_refused" : "option" });
  const image = await ownedImage(env, body.imageId, current);
  if (!image) return json(request, env, 404, { ok: false, error: "image" });
  const selection = selectProvider(env);
  if (!providerReady(selection, env)) return unavailable(request, env);
  const cap = readSpendCapMicro(env);
  if (!cap.ok) return unavailable(request, env, "cap_unset");
  const cost = modelCostMicro(selection.model);
  if (!env.IMAGES) return unavailable(request, env);
  const object = await env.IMAGES.get(image.storageKey);
  if (!object) return json(request, env, 404, { ok: false, error: "image" });
  const bytes = new Uint8Array(await object.arrayBuffer());
  const modelRequest = buildModelRequest(selection, built.prompt, bytes, image.mime);
  if (typeof env.providerCall !== "function") {
    return json(request, env, 501, { ok: false, error: "provider_call_pending_keys" });
  }
  const reservationId = crypto.randomUUID();
  const held = await ledgerTransact(env, {
    type: "hold",
    reservationId,
    costMicro: cost,
    capMicro: cap.micro,
    sessionId: current.sid,
    ipHash: current.ipHash,
    mode,
    leadId: current.leadId || "",
    day: dayKey(),
  });
  if (!held.ok) return json(request, env, held.code === "limits_not_configured" ? 503 : 429, { ok: false, error: held.code });
  let outcome;
  try {
    outcome = await env.providerCall(modelRequest);
  } catch {
    await ledgerTransact(env, { type: "unknown", reservationId });
    return unavailable(request, env);
  }
  if (outcome && outcome.ok && outcome.billed) {
    await ledgerTransact(env, { type: "settle", reservationId });
    const renderId = crypto.randomUUID();
    current.renderIds = [...(current.renderIds || []), renderId];
    await saveSession(env, current);
    return json(request, env, 200, { ok: true, renderId, status: "received" });
  }
  if (outcome && outcome.unbilled) {
    await ledgerTransact(env, { type: "release", reservationId });
    return unavailable(request, env);
  }
  await ledgerTransact(env, { type: "unknown", reservationId });
  return unavailable(request, env);
}

async function lead(request, env) {
  if (!liveEnabled(env)) return unavailable(request, env);
  const current = await loadSession(request, env);
  if (!current) return json(request, env, 401, { ok: false, error: "session" });
  const parsed = await readJson(request);
  if (parsed.error) return json(request, env, 400, { ok: false, error: parsed.error });
  const gate = await verifyTurnstile(parsed.body.turnstile_token, env, clientIp(request), "lead");
  if (!gate.ok) return json(request, env, 403, { ok: false, error: "turnstile_failed" });
  const checked = validateLead(parsed.body);
  if (!checked.ok) return json(request, env, 400, { ok: false, errors: checked.errors });
  const idem = String(request.headers.get("Idempotency-Key") || "").slice(0, 80);
  if (idem) {
    const prior = await env.LIMITS.get("idem:" + current.sid + ":" + idem);
    if (prior) return json(request, env, 202, JSON.parse(prior));
  }
  const day = dayKey();
  const ipLimit = await bump(env, "lead-ip:" + current.ipHash, 5, "lead_limit", day);
  if (!ipLimit.ok) return json(request, env, ipLimit.code === "limits_not_configured" ? 503 : 429, { ok: false, error: ipLimit.code });
  const sessionLimit = await bump(env, "lead-session:" + current.sid, 3, "lead_limit", day);
  if (!sessionLimit.ok) return json(request, env, 429, { ok: false, error: sessionLimit.code });
  const imageIds = Array.isArray(parsed.body.image_ids) ? parsed.body.image_ids.slice(0, 6) : [];
  const owned = [];
  for (const imageId of imageIds) {
    const image = await ownedImage(env, imageId, current);
    if (image) owned.push(image.imageId);
  }
  const leadId = crypto.randomUUID();
  const receivedAt = new Date().toISOString();
  const smsEnabled = env.SMS_ENABLED === "true";
  const stored = {
    ...checked.record,
    leadId,
    sessionId: current.sid,
    received_at_utc: receivedAt,
    image_ids: owned,
    render_ids: current.renderIds || [],
    sms_enabled: smsEnabled,
    turnstile_action: gate.action,
    turnstile_hostname: gate.hostname,
    consent_event_id: crypto.randomUUID(),
  };
  if (stored.checkboxes.consent_text && !smsEnabled) stored.checkboxes.consent_text = false;
  await env.LIMITS.put("lead:" + leadId, JSON.stringify(stored));
  await env.LIMITS.put("consent:" + stored.consent_event_id, JSON.stringify({
    consent_event_id: stored.consent_event_id,
    lead_id: leadId,
    session_id: current.sid,
    received_at_utc: receivedAt,
    consent_text_version: CONSENT_TEXT_VERSION,
    share: stored.checkboxes.consent_share,
    sms: stored.checkboxes.consent_text,
    newsletter: stored.checkboxes.consent_newsletter,
    image_ids: owned,
    render_ids: stored.render_ids,
  }));
  current.leadId = leadId;
  await saveSession(env, current);
  const notify = env.LEAD_NOTIFY_EMAIL || "editorial@boardofprojectstewardship.com";
  const editorial = await deliverEmail(env, buildLeadMessage(stored, notify));
  let visitor = { ok: false, skipped: true };
  const mailLimit = await bump(env, "mail:" + stored.email, 2, "recipient_limit", day);
  if (mailLimit.ok) visitor = await deliverEmail(env, buildVisitorMessage(stored));
  const sheet = await forwardSheet(env, stored);
  const payload = {
    ok: true,
    leadId,
    status: "received",
    priority: stored.priority,
    email: editorial.ok ? "queued" : "pending",
    visitor: visitor.ok ? "queued" : "pending",
    sheet: sheet.ok ? "queued" : "pending",
  };
  if (idem) await env.LIMITS.put("idem:" + current.sid + ":" + idem, JSON.stringify(payload));
  return json(request, env, 202, payload);
}

async function subscribe(request, env) {
  if (!liveEnabled(env)) return unavailable(request, env);
  const current = await loadSession(request, env);
  if (!current) return json(request, env, 401, { ok: false, error: "session" });
  const parsed = await readJson(request);
  if (parsed.error) return json(request, env, 400, { ok: false, error: parsed.error });
  const gate = await verifyTurnstile(parsed.body.turnstile_token, env, clientIp(request), "subscribe");
  if (!gate.ok) return json(request, env, 403, { ok: false, error: "turnstile_failed" });
  const email = String(parsed.body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(request, env, 400, { ok: false, error: "email" });
  if (parsed.body.consent_newsletter !== true) return json(request, env, 400, { ok: false, error: "newsletter_consent" });
  const day = dayKey();
  const ipLimit = await bump(env, "sub-ip:" + current.ipHash, 10, "subscribe_limit", day);
  if (!ipLimit.ok) return json(request, env, ipLimit.code === "limits_not_configured" ? 503 : 429, { ok: false, error: ipLimit.code });
  const existing = await env.LIMITS.get("sub:" + email);
  if (!existing) {
    await env.LIMITS.put("sub:" + email, JSON.stringify({
      status: "pending",
      at: new Date().toISOString(),
      sessionId: current.sid,
    }));
    const mailLimit = await bump(env, "mail-sub:" + email, 1, "recipient_limit", day);
    if (mailLimit.ok) await deliverEmail(env, buildSubscribeMessage(email));
  }
  return json(request, env, 200, { ok: true });
}

export async function handle(request, env = {}) {
  const requestId = crypto.randomUUID();
  try {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      if (!originAllowed(request, env)) return new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } });
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (request.method !== "POST") return json(request, env, 405, { ok: false, error: "method" });
    if (!originAllowed(request, env)) return json(request, env, 403, { ok: false, error: "origin" });
    if (url.pathname === "/api/session") return session(request, env);
    if (url.pathname === "/api/streetview-meta") return streetviewMeta(request, env);
    if (url.pathname === "/api/upload") return upload(request, env);
    if (url.pathname === "/api/render") return render(request, env);
    if (url.pathname === "/api/lead") return lead(request, env);
    if (url.pathname === "/api/subscribe") return subscribe(request, env);
    return json(request, env, 404, { ok: false, error: "not_found" });
  } catch (error) {
    console.error(JSON.stringify({ requestId, message: error && error.name ? error.name : "error" }));
    return json(request, env, 500, { ok: false, error: "unavailable", requestId });
  }
}

export { DailyLedger };
export default { fetch: handle };
