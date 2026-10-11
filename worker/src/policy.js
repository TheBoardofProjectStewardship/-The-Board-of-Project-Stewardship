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

/**
 * Conservative microdollars per generated image, including a buffer over
 * listed output prices. Alex sets DAILY_SPEND_CAP_USD; there is no default.
 * gpt-image-1.5 remains selectable and is not the default backup.
 */
export const MODEL_COST_MICRO = {
  "gemini-3.1-flash-lite-image": 50_000,
  "gemini-3.1-flash-image": 120_000,
  "gemini-3-pro-image": 200_000,
  "gpt-image-1.5": 200_000,
  "gpt-image-2": 200_000,
  "gpt-image-1-mini": 40_000,
};

export const MODEL_COST_USD = Object.fromEntries(
  Object.entries(MODEL_COST_MICRO).map(([model, micro]) => [model, micro / 1_000_000]),
);

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
      model: env.IMAGE_MODEL || "gpt-image-2",
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

export function modelCostMicro(model) {
  return MODEL_COST_MICRO[model] ?? null;
}

/** Fail closed. An empty or non-numeric cap is not zero and not unlimited. */
export function readSpendCapMicro(env) {
  if (env.DAILY_SPEND_CAP_USD == null || String(env.DAILY_SPEND_CAP_USD).trim() === "") {
    return { ok: false, code: "cap_unset" };
  }
  const dollars = Number(env.DAILY_SPEND_CAP_USD);
  if (!Number.isFinite(dollars) || dollars < 0) return { ok: false, code: "cap_unset" };
  return { ok: true, micro: Math.round(dollars * 1_000_000) };
}

export function providerReady(selection, env) {
  if (!selection || !modelCostMicro(selection.model)) return false;
  if (selection.provider === "openai") {
    return Boolean(env.OPENAI_API_KEY) && String(selection.model).startsWith("gpt-image");
  }
  if (selection.provider === "gemini") {
    return Boolean(env.GEMINI_API_KEY) && String(selection.model).startsWith("gemini-");
  }
  return false;
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
 * Legacy counter helpers kept for unit tests. Request authorization uses
 * worker/src/ledger.js. Do not call these from a route.
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

const PROJECT_TYPES = new Set([
  "Second story",
  "Partial second story",
  "Home addition / bump-out",
  "ADU",
  "Dormer",
  "Garage conversion",
  "Kitchen remodel",
  "Bathroom remodel",
  "Whole-home remodel",
  "Other",
]);

const TIMELINES = new Set(["Within 3 months", "3–6 months", "6–12 months", "12+ months", "Just exploring"]);
const BUDGETS = new Set(["Under $50k", "$50k–$100k", "$100k–$250k", "$250k–$500k", "$500k+", "Not sure yet"]);
const RELATIONSHIPS = new Set(["I own it", "Buying it", "Renting", "Other"]);
const CONTACT_PREFS = new Set(["", "Email", "Phone call", "Text"]);
const BEST_TIMES = new Set(["", "Mornings", "Afternoons", "Evenings", "Weekends"]);
const PLANS = new Set(["", "Just ideas", "Have sketches/photos", "Working with an architect/designer", "Have drawings/permit set"]);
const MODES = new Set(["addition", "kitchen", "bathroom"]);
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"];

function boolField(value) {
  if (value === true) return { ok: true, value: true };
  if (value == null || value === false) return { ok: true, value: false };
  return { ok: false, value: false };
}

function enumField(value, allowed) {
  const text = String(value || "").trim();
  return allowed.has(text) ? text : null;
}

function projectTypes(value) {
  let list = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("[")) {
      try {
        list = JSON.parse(trimmed);
      } catch {
        return null;
      }
    } else {
      list = [trimmed];
    }
  }
  if (!Array.isArray(list) || !list.length || list.length > 8) return null;
  const clean = [];
  for (const item of list) {
    const text = String(item || "").trim();
    if (!PROJECT_TYPES.has(text) || clean.includes(text)) return null;
    clean.push(text);
  }
  return clean;
}

function bounded(value, max) {
  return String(value || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}

function plainUrl(value) {
  const text = bounded(value, 300);
  if (!text) return "";
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.origin + url.pathname;
  } catch {
    return "";
  }
}

export function sheetSafe(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

export function validateLead(body) {
  const errors = [];
  const source = body && typeof body === "object" ? body : {};
  if (String(source.company_website || "").trim()) errors.push("honeypot");
  if (source.consent_text_version !== CONSENT_TEXT_VERSION) errors.push("consent_version");
  const share = boolField(source.consent_share);
  const sms = boolField(source.consent_text);
  const news = boolField(source.consent_newsletter);
  if (!share.ok || !share.value) errors.push("consent_share");
  if (!sms.ok) errors.push("consent_text");
  if (!news.ok) errors.push("consent_newsletter");
  const name = bounded(source.name, 80);
  const email = bounded(source.email, 120).toLowerCase();
  if (!name) errors.push("name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("email");
  const projects = projectTypes(source.project_types);
  if (!projects) errors.push("project_type");
  const timeline = enumField(source.timeline, TIMELINES);
  const budget = enumField(source.budget, BUDGETS);
  const relationship = enumField(source.relationship, RELATIONSHIPS);
  const city = enumField(source.city, new Set([...SERVICE_CITIES, "Other"]));
  if (!timeline) errors.push("timeline");
  if (!budget) errors.push("budget");
  if (!relationship) errors.push("relationship");
  if (!city) errors.push("city");
  const zip = bounded(source.zip, 5);
  if (!/^\d{5}$/.test(zip)) errors.push("zip");
  const mode = source.mode == null || source.mode === "" ? "" : enumField(source.mode, MODES);
  if (source.mode && !mode) errors.push("mode");
  const address = bounded(source.address, 180);
  if (mode === "addition" && !address) errors.push("address");
  const phone = bounded(source.phone, 20);
  if (sms.value && !phone) errors.push("text_consent_without_phone");
  const note = bounded(source.note, 500);
  if (String(source.note || "").length > 500) errors.push("note_length");
  const contactPref = enumField(source.contact_pref || "", CONTACT_PREFS);
  const bestTime = enumField(source.best_time || "", BEST_TIMES);
  const plans = enumField(source.plans || "", PLANS);
  if (contactPref == null) errors.push("contact_pref");
  if (bestTime == null) errors.push("best_time");
  if (plans == null) errors.push("plans");
  const utm = {};
  for (const key of UTM_KEYS) utm[key] = bounded(source[key], 80).replace(/[^A-Za-z0-9._-]/g, "");
  const cleaned = {
    name,
    email,
    phone,
    city: city || "",
    zip,
    address,
    mode: mode || "",
    timeline: timeline || "",
    budget: budget || "",
    relationship: relationship || "",
    project_types: projects || [],
    plans: plans || "",
    contact_pref: contactPref || "",
    best_time: bestTime || "",
    note,
    utm,
    referrer: plainUrl(source.referrer),
    landing_page: plainUrl(source.landing_page),
  };
  const record = {
    ...cleaned,
    consent_text_version: CONSENT_TEXT_VERSION,
    checkboxes: {
      consent_share: Boolean(share.ok && share.value),
      consent_text: Boolean(sms.ok && sms.value),
      consent_newsletter: Boolean(news.ok && news.value),
    },
    priority: errors.length ? "" : priorityTag(cleaned),
  };
  return { ok: errors.length === 0, errors, record };
}

export function filterNote(raw, limit = 140) {
  const text = String(raw || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
  if (!text) return { ok: true, text: "" };
  if (/\b(ignore (all|any|previous|the) instructions|disregard (earlier|all|previous) (rules|instructions)|system prompt|jailbreak)\b/i.test(text)) {
    return { ok: false, text: "", refused: true };
  }
  if (/\b(nude|naked|weapon|gun|explosive)\b/i.test(text)) {
    return { ok: false, text: "", refused: true };
  }
  return { ok: true, text };
}
