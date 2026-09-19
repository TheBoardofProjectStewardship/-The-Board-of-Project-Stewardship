# Daily blog posting workflow (publishing agent)

This document is for the company publishing agent that commits one SEO post per day to the BOPS static site. It is an **ops** doc — not a public page.

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


## Daily cadence (Alex 2026-09-17)

- **Every day at 10:00 AM PT:** Nexus routine `BOPS daily blog post` writes one original post and ships to this site.
- Ghost remains **OFF**. Publish target is Board of Project Stewardship only.
- Skip a day rather than ship thin duplicate content.


## Rich media recipe (Alex 2026-09-19)

Every new BOPS article must be Magnolia-class (structure only — Ghost publish forbidden):

1. **Multiple photos** — new unique assets per post (hero + in-body). Prefer Higgsfield (`user-Higgsfield`); CDN URLs OK. Do not reuse the same image set forever.
2. **Materials we use** — link to real product/brand pages (tile, fixtures, cabinets, waterproofing, etc.) honestly. No invented prices or fake “preferred” claims.
3. **YouTube construction process** — embed or link relevant process videos; use **new / post-specific** links, not one recycled video on every article.
4. **Create video** — generate short construction/process clips with Higgsfield when no licensed job video exists; file URLs in the post.
5. **Astra Extra High** — run the draft through ChatGPT Astra Extra High before generate_site / push. Dual-check with Grok Heavy when producing polished client-facing HTML if Nexus/Alex requires.
6. **Home-PC agent code** — fold OpenClaw `seo-specialist` recipe from Allan SEO_PLAN_PacificProGroup into this workflow; Ghost Admin API stays forever blocked.

Honesty: L&I Verify + PACIFPG765OF only when mentioning PPG; no invented ROI, reviews, awards, or founding-date selling points.


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
