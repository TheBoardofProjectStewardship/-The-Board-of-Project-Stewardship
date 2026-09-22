# Daily blog posting workflow (publishing agent)

This document is for the company publishing agent that commits one SEO post per day to the Board of Project Stewardship static site. It is an **ops** doc — not a public page.

## Controlled intake (required before a new post)

Specialist agents do not publish and do not edit `posts/`, `posts.json`, `blog.html`, `sitemap.xml`, or `blog/rss.xml` directly. They submit a packet under `intake/inbox/<submission-id>/`. **Steward is the only publisher.**

```bash
python3 tools/board_intake.py validate intake/inbox/<submission-id>
python3 tools/board_intake.py publish intake/inbox/<submission-id> --dry-run
# Steward only, after the dry-run JSON is clean:
python3 tools/board_intake.py publish intake/inbox/<submission-id> --apply
```

Post markdown media must use repo `../assets/images/posts/...` and `../assets/videos/posts/...` paths. CloudFront URLs are rejected: `generate_site.py` would otherwise rewrite polished HTML that already uses those repo assets. Full contract, failure states, and rollback: `docs/AGENT-INTAKE.md`.

## Frontmatter (required)

Every new post lives in `posts/` as a Markdown file with YAML frontmatter:

```yaml
---
title: "Clear SEO title"
date: "YYYY-MM-DD"
description: "One-sentence meta description."
category: "Guides"
slug: "kebab-case-slug"
---
```

Body Markdown follows the second `---`. Author on generated HTML is always **Board of Project Stewardship Editorial**.

## Naming

- Prefer source files like `YYYY-MM-DD-slug.md` (matches seed posts).
- The generator emits `posts/YYYY-MM-DD-slug.html`.
- Copy `posts/_template.md` when starting a draft.

## Daily steps

1. Add one new `posts/*.md` article (local homeowner SEO: permits, hiring, trades, kitchen/bath/additions).
2. Include internal links to directory pages (`../index.html`, `../kitchen.html`, `../bathrooms.html`, `../trades.html`, or a trade page).
3. From the site root, regenerate:

   ```bash
   cd /path/to/bops-site
   python3 generate_site.py
   ```

4. Review the new HTML under `posts/` and the updated `blog.html`.
5. Commit and push (example):

   ```bash
   git add posts/*.md posts/*.html blog.html
   git commit -m "Add blog post: <title>"
   git push
   ```

GitHub Pages serves from the repository root (or configured Pages branch). Relative links must keep working under:

`https://boardofprojectstewardship.com/`

## Content rules for public pages

- Keep tone editorial and premium; avoid defensive wording about data sources.
- Only publish ratings and review counts from verified public aggregates (e.g. Trustindex for Pacific Pro Group).
- PPG links: use `https://pacificprogroup.com/` (never `/contact/`).
- Always remind readers to re-verify WA L&I before hiring.
- Public author line: Board of Project Stewardship Editorial.

## Cadence

Target **one useful post per day** when the publishing agent is scheduled. Skip a day rather than publishing thin duplicate content.


## Community submissions (live)

- Public contribute page: `write.html` (form may still reference Netlify until Forge/Steward rewires; live site is GitHub Pages — do not treat Netlify as the web host).
- Magazine index: `blog.html` + `blog.js` + `posts.json`.
- Submissions are **review-only** until Alex/Steward publish a Markdown post and regenerate.


## Daily cadence (Alex 2026-09-17, intake entrypoint 2026-09-22)

There is one morning schedule. Do not add a second cron, GitHub Action schedule, or agent timer.

- **Every day at 10:00 AM PT:** the existing Nexus routine `BOPS daily blog post` is the only run. After local agents are recoded and this intake path has passed Steward/Forge review, that routine calls the repo entrypoint below. Until that review, do not point the routine at `--apply`.
- Ghost remains **OFF**. Publish target is Board of Project Stewardship only.
- One vetted post per Pacific morning. Specialist agents never publish. Skip a day rather than ship a second post or thin duplicate content.

The routine does three steps, in order, and stops on a fail-closed result:

1. **Aggregate.** Before 10:00 AM PT, Hermes leaves sources, OpenClaw leaves the SEO brief, Ollama leaves the draft, and Grok Build leaves repo-path media. Chief of Staff copies those into **one** `post-bundle` whose `post.date` is that Pacific date. Loose specialist packets stay in the inbox and are not posts.
2. **Validate, fail closed.** The entrypoint checks that single bundle. A validation error publishes nothing. Two bundles dated that morning publish nothing (`multiple_ready`). An empty morning publishes nothing (`skipped`).
3. **One Steward publish.** Only this command writes the site, and only for that one bundle:

```bash
python3 tools/board_intake.py morning --apply
```

Commit and push only when the JSON says `"commit": true` (status `published`). `already_published` and `skipped` exit 0 and must not commit again. `python3 tools/board_intake.py morning` without `--apply` is the dry-run. This pull request does not run `--apply` and does not install the schedule.


## Rich media recipe (Alex 2026-09-19)

Every new BOPS article must be Magnolia-class (structure only — Ghost publish forbidden):

1. **Multiple photos** — new unique assets per post (hero + in-body). Generation may happen off-repo. The committed markdown must reference repo files such as `../assets/images/posts/your-shot.webp`. Do not put CloudFront URLs in post markdown. Do not reuse the same image set forever.
2. **Materials we use** — link to real product/brand pages (tile, fixtures, cabinets, waterproofing, etc.) honestly. No invented prices or fake “preferred” claims.
3. **YouTube construction process** — embed or link relevant process videos; use **new / post-specific** links, not one recycled video on every article.
4. **Create video** — generate short construction/process clips with Higgsfield when no licensed job video exists; file URLs in the post.
5. **Astra Extra High** — run the draft through ChatGPT Astra Extra High before generate_site / push. Dual-check with Grok Heavy when producing polished client-facing HTML if Nexus/Alex requires.
6. **Home-PC agent code** — fold OpenClaw `seo-specialist` recipe from Allan SEO_PLAN_PacificProGroup into this workflow; Ghost Admin API stays forever blocked.

Honesty: L&I Verify + PACIFPG765OF only when mentioning PPG; no invented ROI, reviews, awards, or founding-date selling points.


## Public copy lock (Alex 2026-09-20)

**Public site must never mention AI.** Operator tools named in this ops doc (Higgsfield, ChatGPT Astra Extra High / Astra Extra High polish, Grok) are **internal only** and may stay in POSTING.md.

Forbidden on the live site (HTML, meta, og/twitter, alt, figcaption, visible body, visitor-facing JS UI strings):
AI, A.I., AI-assisted, AI-generated, Illustrative AI, ChatGPT, Higgsfield, artificial intelligence, LLM, "Generate AI preview", "AI CONCEPT", "AI-ASSISTED CONCEPT".

Use public phrasing such as: "design preview only", "concept preview only", "Illustrative editorial photo — not a project photograph", "Illustrative process clip", "Stock or concept frames are labeled illustrative".


## Rich media posts (required for daily ship)

Every daily post must ship with richer media — not text-only. Checklist before regenerate/commit:

1. **≥3 in-article photos** — Higgsfield-generated or real PPG job photos. Store under `assets/images/posts/` and reference with Markdown images (relative paths from the post HTML, e.g. `../assets/images/posts/your-shot.webp`).
2. **≥3 material manufacturer links** — pick from `posts/_materials_catalog.json`, rotate fresh each post (track in `/workspace/state/bops/blog-upgrade/media-rotation.json`). Link the manufacturer pages; **do not invent prices or licenses**.
3. **≥1 YouTube construction-process embed** — real public video; prefer a new link per post when possible. Put the URL (or `youtube:VIDEOID`) on its own line.
4. **≥1 short Higgsfield video when credits allow** — store under `assets/video/posts/` or embed a hosted URL.
5. **Always polish the draft through ChatGPT Astra Extra High** before ship.
6. **Honesty lock unchanged** — no invented ratings, review counts, licenses, dollar amounts, or fake job claims. **Ghost publish stays OFF**; ship only to Board of Project Stewardship.

### Markdown examples

Images (alt becomes figcaption when non-empty):

```markdown
![Framing a second-story addition in Edmonds](../assets/images/posts/edmonds-framing.webp)

![](../assets/images/posts/roof-detail.webp)
```

YouTube embeds (whole line, any of these forms):

```markdown
https://www.youtube.com/watch?v=VIDEO_ID_HERE
https://youtu.be/VIDEO_ID_HERE
https://www.youtube.com/embed/VIDEO_ID_HERE
youtube:VIDEO_ID_HERE
```

Material links stay normal Markdown links (rotate catalog URLs):

```markdown
- [Simpson Strong-Tie connectors](https://www.strongtie.com/) for hold-downs and framing hardware
- [ZIP System sheathing & tape](https://www.huberwood.com/zip-system) for PNW weather planes
- [James Hardie fiber-cement siding](https://www.jameshardie.com/) for coastal-ready cladding
```
