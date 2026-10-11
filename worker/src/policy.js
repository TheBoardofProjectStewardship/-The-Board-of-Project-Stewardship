/**
 * Pure policy for the visualizer Worker: rate limits, spend cap,
 * provider selection, consent checks, and lead priority.
 * No network. No secrets.
 */

export const CONSENT_TEXT_VERSION = "2026-10-11.1";

export const SERVICE_CITIES = [
  "Seattle",
  "Edmonds",
  "Shoreline",
  "Lynnwood",
  "Mountlake Terrace",
  "Bothell",
  "Kirkland",
  "Bellevue",
  "Mercer Island",
  "Everett",
  "Mukilteo",
  "Mill Creek",
  "Lake Forest Park",
  "Redmond",
];

/** Approximate USD per concept image. Alex sets the daily cap separately. */
export const MODEL_COST_USD = {
  "gemini-3.1-flash-lite-image": 0.034,
  "gemini-3.1-flash-image": 0.067,
  "gemini-3-pro-image": 0.134,
  "gpt-image-1.5": 0.06,
  "gpt-image-2": 0.09,
  "gpt-image-1-mini": 0.02,
};

const NEAR_TERM = new Set(["Within 3 months", "3–6 months", "3-6 months", "6–12 months", "6-12 months"]);

export function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function selectProvider(env = {}) {
  const provider = String(env.IMAGE_PROVIDER || "gemini").trim().toLowerCase();
  if (provider === "openai") {
    return {
      provider: "openai",
      model: env.IMAGE_MODEL || "gpt-image-1.5",
    };
  }
  return {
    provider: "gemini",
    model: env.IMAGE_MODEL || "gemini-3.1-flash-lite-image",
  };
}

export function modelCost(model) {
  return MODEL_COST_USD[model] ?? null;
}

export function memoryKV() {
  const map = new Map();
  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value) {
      map.set(key, String(value));
    },
  };
}

async function readCount(kv, key) {
  const raw = await kv.get(key);
  const n = Number(raw || 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 1 free concept per visitor per mode per day.
 * After a lead id is present, up to 6 per lead per day.
 * Per-IP ceiling is 12 concepts per day.
 * Spend is reserved before the provider call.
 */
export async function consumeRender(kv, spec) {
  const day = spec.day || dayKey(spec.now || new Date());
  const ipKey = `ip:${spec.ipHash}:${day}`;
  const ipCount = await readCount(kv, ipKey);
  if (ipCount >= 12) {
    return { ok: false, code: "ip_limit", day };
  }
  if (spec.leadId) {
    const leadKey = `lead:${spec.leadId}:${day}`;
    const leadCount = await readCount(kv, leadKey);
    if (leadCount >= 6) return { ok: false, code: "lead_limit", day };
    await kv.put(leadKey, String(leadCount + 1));
  } else {
    const freeKey = `free:${spec.visitorId}:${spec.mode}:${day}`;
    const freeCount = await readCount(kv, freeKey);
    if (freeCount >= 1) return { ok: false, code: "free_limit", day };
    await kv.put(freeKey, String(freeCount + 1));
  }
  await kv.put(ipKey, String(ipCount + 1));
  return { ok: true, day };
}

export async function reserveSpend(kv, spec) {
  const day = spec.day || dayKey(spec.now || new Date());
  const cost = Number(spec.costUsd);
  const cap = Number(spec.capUsd);
  if (!Number.isFinite(cost) || cost < 0) {
    return { ok: false, code: "unknown_cost", day };
  }
  if (!Number.isFinite(cap) || cap < 0) {
    return { ok: false, code: "cap_unset", day };
  }
  const key = `spend:${day}`;
  const spent = await readCount(kv, key);
  if (spent + cost > cap + 1e-9) {
    return { ok: false, code: "spend_cap", day, spent };
  }
  await kv.put(key, String(Math.round((spent + cost) * 10000) / 10000));
  return { ok: true, day, spent: spent + cost };
}

export function priorityTag(lead) {
  const owner = lead.relationship === "I own it";
  const cityOk = SERVICE_CITIES.includes(lead.city);
  const soon = NEAR_TERM.has(lead.timeline);
  if (owner && cityOk && soon) return "Priority";
  if (!cityOk || lead.city === "Other") return "out of area";
  return "standard";
}

function truthy(value) {
  return value === true || value === "true" || value === "yes" || value === "on";
}

export function validateLead(body) {
  const errors = [];
  const source = body || {};
  if (String(source.company_website || "").trim()) errors.push("honeypot");
  if (!truthy(source.consent_share)) errors.push("consent_share");
  if (source.consent_text_version !== CONSENT_TEXT_VERSION) errors.push("consent_version");
  if (!String(source.name || "").trim()) errors.push("name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(source.email || "").trim())) errors.push("email");
  if (!String(source.project_types || "").trim()) errors.push("project_type");
  if (!String(source.timeline || "").trim()) errors.push("timeline");
  if (!String(source.budget || "").trim()) errors.push("budget");
  if (!String(source.relationship || "").trim()) errors.push("relationship");
  if (!String(source.city || "").trim()) errors.push("city");
  if (!/^\d{5}$/.test(String(source.zip || "").trim())) errors.push("zip");
  if (source.mode === "addition" && !String(source.address || "").trim()) errors.push("address");
  const phone = String(source.phone || "").trim();
  if (truthy(source.consent_text) && !phone) errors.push("text_consent_without_phone");
  const note = String(source.note || "");
  if (note.length > 500) errors.push("note_length");
  const record = {
    consent_text_version: CONSENT_TEXT_VERSION,
    checkboxes: {
      consent_share: truthy(source.consent_share),
      consent_text: truthy(source.consent_text),
      consent_newsletter: truthy(source.consent_newsletter),
    },
    priority: errors.length ? "" : priorityTag(source),
  };
  return { ok: errors.length === 0, errors, record };
}

export function filterNote(raw, limit = 140) {
  const text = String(raw || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
  if (!text) return { ok: true, text: "" };
  if (/\b(ignore (all|previous|the) instructions|system prompt|child|nude|weapon)\b/i.test(text)) {
    return { ok: false, text: "", refused: true };
  }
  return { ok: true, text };
}
