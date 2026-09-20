# STEWARD-PREFINDINGS — Board deep audit 2026-09-20

**Author:** Steward · **Site:** https://boardofprojectstewardship.com only
**Hard stop:** no pacificprogroup.com edits
**Repo:** /workspace/bops-repo (`generate_site.py`)
**Tip at write:** see SHIP-LOG.md (Batch 1 P0s F003–F006/F009–F010)
**Companion SoT:** `FIX-100.md` (present) · Quill Astra audit · inventory.json

## Status vs CoS plan

| Step | Status |
|---|---|
| Multi-model audit (Nexus/Quill/Grok/Gemini) | Received — FIX-100.md on disk |
| STEWARD-PREFINDINGS.md | This file |
| P0 broken images/links sweep | Live asset HEAD sample: 0 broken on home/about/faq/learn/kitchen/good-steward/contact/another-story |
| Mass ship | Starting Batch 1 remaining P0s now that FIX-100 exists |

## Already shipped (do not re-open)

- `about.html` live **200** (~1040 words) — Quill #1 / FIX F007
- `faq.html` live **200** (~1100 words + FAQPage) — Quill #2 / FIX F008
- Nav Home ≠ About; Learn / Permits / Verify / How we rank in primary — Quill #4–6 partial
- Contact deepened with About/FAQ links — Quill #9 partial
- Sitemap includes about + faq

## Thin pages (<900 words) — deepen + link

| Words | Page |
|---:|---|
| 625 | `videos.html` |
| 636 | `materials.html` |
| 647 | `contact.html` |
| 665 | `energy-credit.html` |
| 669 | `site-visit.html` |
| 673 | `pm-dashboard.html` |
| 689 | `another-story.html` |
| 693 | `adu-checklist.html` |
| 693 | `build-walkthrough.html` |
| 700 | `coastal-waterproofing.html` |
| 725 | `hire-questions.html` |
| 734 | `bid-comparison.html` |
| 734 | `glossary.html` |
| 757 | `red-flags-hiring.html` |
| 759 | `selecting-finishes.html` |
| 760 | `change-orders.html` |
| 777 | `project-timeline.html` |
| 784 | `living-through-remodel.html` |
| 845 | `bathroom-waterproofing-guide.html` |
| 845 | `home-addition-planning.html` |
| 875 | `financing-and-draws.html` |
| 876 | `learn.html` |
| 883 | `design-build-vs-bid.html` |
| 893 | `contractor-contract-basics.html` |

**Count:** 24 / 82 root HTML pages under 900 words.

## Related-learning strip gaps

Pages **with** `#related-learning` (live regen): **23**.
Pages **missing** related strip (inventory flag): **59**.

Priority to strip next (also thin):
- `videos.html`
- `materials.html`
- `contact.html`
- `energy-credit.html`
- `site-visit.html`
- `pm-dashboard.html`
- `another-story.html`
- `adu-checklist.html`
- `hire-questions.html`
- `glossary.html`
- `learn.html`

## Internal linking gaps (from FIX-100 + crawl)

- No `directory.html` hub (FIX F004) — nav/directories expectation → **404**
- Plural slug 404s: `kitchens.html` → `kitchen.html` (F005); `plumbing.html` → `plumber.html` (F006)
- Learn ↔ directory body links still one-way on many pillars
- Blog outro module (directory + How we rank + L&I) incomplete on older posts
- City hubs risk spun clones (unique AHJ depth still uneven)


## DONE — Batch 1 remaining P0s (2026-09-20 PT)

Steward ship after Factor Guide (F001/F002 already on main).

| Fix | Status |
|---|---|
| F001/F002 calculator honesty | DONE prior — Project Factor Guide; no $275–$550 / no $25k BASE_FEE |
| F003 write.html Netlify kill | DONE — mailto:editorial@boardofprojectstewardship.com; zero data-netlify |
| F004 directory.html hub | DONE — 8 directory cards + L&I Verify CTA; sitemap + primary nav |
| F005 kitchens.html → kitchen.html | DONE — meta refresh + link + JS replace |
| F006 plumbing.html → plumber.html | DONE — meta refresh + link + JS replace |
| F009 prose-bops → prose-board | DONE prior + regen; zero prose-bops in public HTML |
| F010 blog.js BOPS scrub | DONE — comment → Board blog magazine filters |

**Ship SHA:** `dbed06ee6ac9f64ae11fb097dd6d4af2b6686c2c`

**Live verify (passed):** calculator chrome has no $25,000/$275; directory.html 200; kitchens.html + plumbing.html resolve; write.html no data-netlify; prose-bops absent on sample page.


## P0 remaining (Batch 1 after About/FAQ)

1. **F001/F002** — Strip unsourced calculator $ bands / $25k base; label not-PPG-pricing
2. **F003** — `write.html` Netlify Forms → mailto/Issue (GH Pages)
3. **F004** — Ship `directory.html` hub
4. **F005/F006** — Redirect kitchens.html / plumbing.html
5. **F009/F010** — Scrub public `BOPS` / `prose-bops` / blog.js identifiers
6. **F011+** — write noindex policy after form fix; embed title; independence LOOK

## Broken images

- Local regen check: **0** missing local `<img src>` targets on root HTML
- Live HEAD sample (8 pages): **0** broken `/assets|/images` assets
- Prior IMAGE-AUDIT-2026-09-20.md retained for photo depth (not 404s)

## Honesty / independence locks (carry into every batch)

- No invented prices, ROI, licenses, years, review counts
- PPG = directory #1 hire only → https://pacificprogroup.com/ (no ownership chrome / no parentOrganization)
- No public AI / ChatGPT / Higgsfield / LLM wording
- Spell out **Board of Project Stewardship** (no BOPS in public HTML/CSS/JS)

## Next actions (Steward)

1. Ship remaining Batch 1 P0s from FIX-100.md (calculator, write form, directory hub, redirects, BOPS scrub)
2. Regenerate → push main → live curl + IndexNow
3. Continue Batches 2–N; append DONE marks into FIX-100 or ship log
4. Hold Ghost pipeline until Alex clarifies scope (unlocked but not this P0 batch)

## Note to Nexus / CoS

FIX-100.md already present under this folder — Steward treating it as SoT for mass ship order. Prefinding inventory aligns with F001–F010 + thin-page list above.
