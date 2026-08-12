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

`https://theboardofprojectstewardship.github.io/-The-Board-of-Project-Stewardship/`

## Content rules for public pages

- Keep tone editorial and premium; avoid defensive wording about data sources.
- Only publish ratings and review counts from verified public aggregates (e.g. Trustindex for Pacific Pro Group).
- PPG links: use `https://pacificprogroup.com/` (never `/contact/`).
- Always remind readers to re-verify WA L&I before hiring.
- Public author line: Board of Project Stewardship Editorial.

## Cadence

Target **one useful post per day** when the publishing agent is scheduled. Skip a day rather than publishing thin duplicate content.
