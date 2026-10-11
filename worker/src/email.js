/**
 * Lead and confirmation messages. Delivery is a stub until Resend or
 * Cloudflare Email credentials exist. Nothing here contains a secret.
 */

function cell(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

export function buildLeadMessage(lead, notifyEmail) {
  const lines = [
    "New concept request",
    "Priority: " + cell(lead.priority || "standard"),
    "Lead: " + cell(lead.leadId || ""),
    "Name: " + cell(lead.name || ""),
    "Email: " + cell(lead.email || ""),
    "Phone: " + cell(lead.phone || ""),
    "City: " + cell(lead.city || ""),
    "ZIP: " + cell(lead.zip || ""),
    "Address: " + cell(lead.address || ""),
    "Mode: " + cell(lead.mode || ""),
    "Project types: " + cell((lead.project_types || []).join(", ")),
    "Timeline: " + cell(lead.timeline || ""),
    "Budget range (visitor's own estimate): " + cell(lead.budget || ""),
    "Relationship: " + cell(lead.relationship || ""),
    "Consent text version: " + cell(lead.consent_text_version || ""),
    "Checkbox states: " + cell(JSON.stringify(lead.checkboxes || {})),
    "SMS program enabled: " + (lead.sms_enabled ? "yes" : "no"),
    "Image ids: " + cell((lead.image_ids || []).join(", ")),
    "Images stay in private storage. They are not a design, bid, or permit document.",
    "Do not text the visitor unless the SMS program is enabled and consent_text is true.",
  ];
  return {
    to: notifyEmail,
    subject: "[" + cell(lead.priority || "standard") + "] Concept request — " + cell(lead.city || "city not set"),
    text: lines.join("\n"),
  };
}

/** Fixed template. No visitor note, photo, or other caller-controlled prose. */
export function buildVisitorMessage(lead) {
  return {
    to: lead.email,
    subject: "We received your project request",
    text: [
      "Board of Project Stewardship received your project request.",
      "With the sharing consent you checked, that request is shared only with Pacific Pro Group.",
      "Images, if any, are concepts only. They are not designs, bids, or permit documents.",
      "This message does not promise a response time.",
      "Questions about this message: editorial@boardofprojectstewardship.com",
    ].join("\n"),
  };
}

export function buildSubscribeMessage(email) {
  return {
    to: email,
    subject: "Confirm planning guides",
    text: [
      "Board of Project Stewardship received a request to email planning guides to this address.",
      "Guides are not sent until this subscription is confirmed. Unsubscribe at any time from any guide we send.",
      "If you did not ask for this, you can ignore this message.",
      "Questions: editorial@boardofprojectstewardship.com",
    ].join("\n"),
  };
}

export function sheetRow(lead) {
  return {
    lead_id: cell(lead.leadId || ""),
    received_at_utc: cell(lead.received_at_utc || ""),
    priority: cell(lead.priority || ""),
    name: cell(lead.name || ""),
    email: cell(lead.email || ""),
    phone: cell(lead.phone || ""),
    city: cell(lead.city || ""),
    zip: cell(lead.zip || ""),
    address: cell(lead.address || ""),
    mode: cell(lead.mode || ""),
    project_types: cell((lead.project_types || []).join(", ")),
    timeline: cell(lead.timeline || ""),
    budget: cell(lead.budget || ""),
    relationship: cell(lead.relationship || ""),
    consent_text_version: cell(lead.consent_text_version || ""),
    consent_share: lead.checkboxes?.consent_share === true,
    consent_text: lead.checkboxes?.consent_text === true,
    consent_newsletter: lead.checkboxes?.consent_newsletter === true,
  };
}

export async function deliverEmail(env, message) {
  const provider = String(env.EMAIL_PROVIDER || "resend").toLowerCase();
  if (provider === "resend" && env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || "Board of Project Stewardship <editorial@boardofprojectstewardship.com>",
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    return { ok: response.ok, provider: "resend", status: response.status };
  }
  if (provider === "cloudflare" && env.EMAIL && typeof env.EMAIL.send === "function") {
    await env.EMAIL.send(message);
    return { ok: true, provider: "cloudflare" };
  }
  return { ok: false, stub: true, provider, reason: "email_not_configured" };
}

export async function forwardSheet(env, lead) {
  if (!env.SHEET_WEBHOOK_URL) return { ok: false, stub: true, reason: "sheet_not_configured" };
  const headers = { "Content-Type": "application/json" };
  if (env.SHEET_WEBHOOK_TOKEN) headers.Authorization = "Bearer " + env.SHEET_WEBHOOK_TOKEN;
  const response = await fetch(env.SHEET_WEBHOOK_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(sheetRow(lead)),
  });
  return { ok: response.ok, status: response.status };
}
