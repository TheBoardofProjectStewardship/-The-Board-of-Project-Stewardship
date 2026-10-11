/**
 * Server-issued session tokens. The client cannot choose the session id,
 * and a presented visitorId or leadId is never an authorization.
 */

const VERSION = 1;

function bytesToB64url(bytes) {
  let binary = "";
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlToBytes(text) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function sameText(left, right) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmac(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToB64url(signature);
}

export function signingKey(env) {
  const key = String(env.SESSION_SIGNING_KEY || "");
  if (key.length < 16) return "";
  return key;
}

export async function issueSessionToken(env, sessionId, expiresAt) {
  const secret = signingKey(env);
  if (!secret) return "";
  const payload = bytesToB64url(new TextEncoder().encode(JSON.stringify({
    v: VERSION,
    sid: sessionId,
    exp: expiresAt,
  })));
  return payload + "." + await hmac(secret, payload);
}

export async function readSessionToken(env, token) {
  const secret = signingKey(env);
  if (!secret) return null;
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = await hmac(secret, parts[0]);
  if (!sameText(expected, parts[1])) return null;
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  } catch {
    return null;
  }
  if (!parsed || parsed.v !== VERSION || typeof parsed.sid !== "string" || !parsed.sid) return null;
  if (!Number.isFinite(parsed.exp) || parsed.exp * 1000 <= Date.now()) return null;
  return { sid: parsed.sid, exp: parsed.exp };
}

export function bearer(request) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
  return match ? match[1] : "";
}
