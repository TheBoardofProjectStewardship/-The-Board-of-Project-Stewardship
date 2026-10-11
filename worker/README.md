# Concept visualizer Worker

Cloudflare Worker for the homepage tool “See your addition / remodel”.
This pull request does **not** deploy it. No API keys are committed.

Routes, all `POST`, CORS limited to `https://boardofprojectstewardship.com`:

| Path | Role |
| --- | --- |
| `/api/streetview-meta` | Street View metadata only. Never returns image bytes. |
| `/api/upload` | Stores a visitor photo in R2 under `anon/`. |
| `/api/render` | Sends that stored photo to the configured image model. |
| `/api/lead` | Checks consent, then emails Pacific Pro Group’s notify inbox and the visitor. |
| `/api/subscribe` | Newsletter consent, kept separate from the project request. |

Only the visitor’s uploaded photo is eligible to be sent to a model. Street View stays in a Maps Embed frame on the page and is display-only.

## Accounts Alex creates

Agents do not create these accounts.

1. **BOPS Google account** (Alex creates it). Under it:
   - Paid Gemini API key, billing on, budget alert and cap.
   - Maps Platform project with Places API (New), Maps Embed API, and Street View metadata. Two restricted keys: one HTTP-referrer key for the browser (`data-maps-key` on the homepage section) and one server key for metadata (`MAPS_SERVER_KEY`).
2. **Optional OpenAI API account** (platform.openai.com, separate from ChatGPT) for `IMAGE_PROVIDER=openai` and model `gpt-image-1.5`.
3. **Cloudflare** Workers Paid, R2, KV, Turnstile, and DNS for `api.boardofprojectstewardship.com`.
4. **Email**: Resend (or Cloudflare Email) on the Board domain with SPF/DKIM. Notify address is `editorial@boardofprojectstewardship.com`.
5. **Optional** Google Sheet webhook (`SHEET_WEBHOOK_URL`) under the BOPS Google account.

## Secrets

From `worker/`:

```bash
wrangler secret put GEMINI_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put TURNSTILE_SECRET
wrangler secret put MAPS_SERVER_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put IP_HASH_SALT
```

Non-secret vars live in `wrangler.toml` (`IMAGE_PROVIDER`, `IMAGE_MODEL`, `DAILY_SPEND_CAP_USD`, `LEAD_NOTIFY_EMAIL`, `ALLOWED_ORIGIN`). Copy `worker/.dev.vars.example` to `worker/.dev.vars` for local dev. Do not commit `.dev.vars`.

Replace the placeholder KV namespace id before deploy. Default model is `gemini-3.1-flash-lite-image`. Set `IMAGE_PROVIDER=openai` and `IMAGE_MODEL=gpt-image-1.5` for the backup.

## R2 lifecycle

Anonymous uploads use the `anon/` prefix and should expire after 7 days. Lead objects, if copied under `leads/`, are kept with the lead.

```bash
npx wrangler r2 bucket lifecycle set see-project-uploads --body r2-lifecycle.json
```

Confirm the lifecycle command against the current Wrangler docs before running it. The JSON in `r2-lifecycle.json` records the intended rule: prefix `anon/`, max age 604800 seconds.

## Turnstile, DNS, budget alerts

- Create a Turnstile widget allowed on `boardofprojectstewardship.com`. Put the site key in `data-turnstile-sitekey` on `#plan-home-hero` when it exists. The secret is `TURNSTILE_SECRET`.
- DNS: `api.boardofprojectstewardship.com` proxied to this Worker. Do not attach the Worker until the keys and the spend cap are set.
- Set budget alerts on the Gemini, Maps, and (if used) OpenAI accounts. `DAILY_SPEND_CAP_USD` in the Worker is a second stop. When it trips, the API tells the page to collect details instead of calling the model.
- Rate limits: 1 concept per visitor per mode per day before a lead, up to 6 per lead per day, and 12 per IP per day.

## Local checks

```bash
node --test worker/test/policy.test.js
```

`wrangler deploy` is intentionally not part of this pull request.
