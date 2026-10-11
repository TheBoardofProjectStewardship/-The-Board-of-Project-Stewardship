/**
 * Lead and confirmation messages. Delivery is a stub until Resend or
 * Cloudflare Email credentials exist. Nothing here contains a secret.
 */

export function buildLeadMessage(lead, notifyEmail) {
  const lines = [
    "New concept request",
    "Priority: " + (lead.priority || "standard"),
    "Name: " + (lead.name || ""),
    "Email: " + (lead.email || ""),
    "Phone: " + (lead.phone || ""),
    "City: " + (lead.city || ""),
    "ZIP: " + (lead.zip || ""),
    "Address: " + (lead.address || ""),
    "Mode: " + (lead.mode || ""),
    "Timeline: " + (lead.timeline || ""),
    "Budget range (visitor's own estimate): " + (lead.budget || ""),
    "Relationship: " + (lead.relationship || ""),
    "Consent text version: " + (lead.consent_text_version || ""),
    "Checkbox states: " + JSON.stringify(lead.checkboxes || {}),
    "Images are linked from storage when a bucket is configured. They are not a design, bid, or permit document.",
  ];
  return {
    to: notifyEmail,
    subject: "[" + (lead.priority || "standard") + "] Concept request — " + (lead.city || "city not set"),
    text: lines.join("\n"),
  };
}

export function buildVisitorMessage(lead) {
  return {
    to: lead.email,
    subject: "We received your concept request",
    text: [
      "Board of Project Stewardship received your request and, with your consent, will share it with Pacific Pro Group.",
      "The images are concepts only, not designs, bids, or permit documents.",
      "Questions about this message: editorial@boardofprojectstewardship.com",
    ].join("\n"),
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
  const response = await fetch(env.SHEET_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
  return { ok: response.ok, status: response.status };
}
