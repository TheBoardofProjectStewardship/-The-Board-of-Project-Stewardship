/**
 * Authoritative daily quota and spend ledger.
 * Operations run inside one synchronous transaction so concurrent requests
 * cannot share a stale counter. KV is not used to authorize spending.
 *
 * Spend is an outstanding hold only while a provider call is in flight.
 * A successful billed call settles it. A known-unbilled failure releases it.
 * Timeouts stay "unknown" and keep counting against the cap.
 */

export function emptyState() {
  return { committedMicro: 0, reservations: {}, counts: {} };
}

function deny(code) {
  return { ok: false, code, commit: false };
}

function countOf(state, key) {
  return state.counts[key] || 0;
}

function outstandingMicro(state) {
  let sum = 0;
  for (const row of Object.values(state.reservations)) {
    if (row.status === "open" || row.status === "unknown") sum += row.micro;
  }
  return sum;
}

function hold(state, op) {
  const id = String(op.reservationId || "");
  if (!id) return deny("reservation");
  if (state.reservations[id]) {
    return { ok: true, duplicate: true, reservationId: id, commit: false };
  }
  const cost = Number(op.costMicro);
  const cap = Number(op.capMicro);
  if (!Number.isInteger(cost) || cost < 0) return deny("unknown_cost");
  if (!Number.isInteger(cap) || cap < 0) return deny("cap_unset");
  const mode = op.mode;
  if (mode !== "addition" && mode !== "kitchen" && mode !== "bathroom") return deny("mode");
  const ipKey = "ip:" + op.ipHash;
  const freeKey = "free:" + op.sessionId + ":" + mode;
  const leadKey = op.leadId ? "lead:" + op.leadId : "";
  if (countOf(state, ipKey) >= 12) return deny("ip_limit");
  if (leadKey) {
    if (countOf(state, leadKey) >= 6) return deny("lead_limit");
  } else if (countOf(state, freeKey) >= 1) {
    return deny("free_limit");
  }
  if (state.committedMicro + outstandingMicro(state) + cost > cap) return deny("spend_cap");
  state.counts[ipKey] = countOf(state, ipKey) + 1;
  if (leadKey) state.counts[leadKey] = countOf(state, leadKey) + 1;
  else state.counts[freeKey] = countOf(state, freeKey) + 1;
  state.reservations[id] = {
    micro: cost,
    status: "open",
    ipKey,
    quotaKey: leadKey || freeKey,
  };
  return { ok: true, reservationId: id };
}

function takeReservation(state, op, next) {
  const row = state.reservations[String(op.reservationId || "")];
  if (!row || row.status !== "open") return deny("reservation");
  if (next === "settled") state.committedMicro += row.micro;
  if (next === "released") {
    state.counts[row.ipKey] = Math.max(0, countOf(state, row.ipKey) - 1);
    state.counts[row.quotaKey] = Math.max(0, countOf(state, row.quotaKey) - 1);
  }
  row.status = next;
  return { ok: true, reservationId: op.reservationId, status: next };
}

function bump(state, op) {
  const key = String(op.key || "");
  const max = Number(op.max);
  if (!key || !Number.isInteger(max) || max < 1) return deny("limit");
  if (countOf(state, key) >= max) return deny(op.code || "limit");
  state.counts[key] = countOf(state, key) + 1;
  return { ok: true, count: state.counts[key] };
}

export function applyOp(state, op) {
  if (!op || typeof op !== "object") return deny("op");
  if (op.type === "hold") return hold(state, op);
  if (op.type === "settle") return takeReservation(state, op, "settled");
  if (op.type === "release") return takeReservation(state, op, "released");
  if (op.type === "unknown") return takeReservation(state, op, "unknown");
  if (op.type === "bump") return bump(state, op);
  return deny("op");
}

export function createLedger(seed) {
  let state = seed || emptyState();
  let chain = Promise.resolve();
  return {
    transact(op) {
      const run = chain.then(() => {
        const draft = structuredClone(state);
        const value = applyOp(draft, op);
        if (!value || value.commit !== false) state = draft;
        return value;
      });
      chain = run.then(() => {}, () => {});
      return run;
    },
    snapshot() {
      return structuredClone(state);
    },
  };
}

export class DailyLedger {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.ready = ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS ledger (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
      );
    });
  }

  async fetch(request) {
    await this.ready;
    const op = await request.json();
    const result = this.ctx.storage.transactionSync(() => {
      const rows = this.ctx.storage.sql.exec("SELECT value FROM ledger WHERE key = 'state'").toArray();
      const state = rows.length ? JSON.parse(rows[0].value) : emptyState();
      const value = applyOp(state, op);
      if (!value || value.commit !== false) {
        const encoded = JSON.stringify(state);
        this.ctx.storage.sql.exec("DELETE FROM ledger WHERE key = 'state'");
        this.ctx.storage.sql.exec("INSERT INTO ledger (key, value) VALUES ('state', ?)", encoded);
      }
      return value;
    });
    return Response.json(result);
  }
}

export async function ledgerTransact(env, op) {
  if (env.ledger) return env.ledger.transact(op);
  if (env.LEDGER && typeof env.LEDGER.idFromName === "function") {
    const day = op.day || "today";
    const stub = env.LEDGER.get(env.LEDGER.idFromName(String(day)));
    const response = await stub.fetch("https://ledger.internal/", {
      method: "POST",
      body: JSON.stringify(op),
    });
    return response.json();
  }
  return { ok: false, code: "limits_not_configured" };
}
