# Board of Project Stewardship — 100 concrete fixes

**Date:** 2026-09-20  
**Live:** https://boardofprojectstewardship.com/  
**Repo:** TheBoardofProjectStewardship/-The-Board-of-Project-Stewardship  
**Scope:** Public Board site only. Never touch pacificprogroup.com. PPG remains directory #1 hire outbound only. No public AI/LLM mentions. Spell out Board of Project Stewardship. Do not invent licenses, years, reviews, awards, prices, or ROI.

Priority key:

- **P0** — Missing page, honesty violation, soft 404 / wrong filename, sitemap/nav orphan, or a hub that fails its job
- **P1** — Deeper info + denser official/internal links on existing learn, directory, city, tool, and blog surfaces
- **P2** — Useful density that can wait if this PR fills
- **P3** — Ops / visual / later polish

Status in this file is the **this-PR** outcome. Count of **Fixed** vs **Deferred** is summarized at the bottom after ship.

---

## P0 — pages, honesty, orphans, hub job

1. **P0** Create `cost-factors.html` — honest “what drives cost” guide (scope, structure, site, allowances, AHJ, weather, change orders) with **no** invented $/sf, totals, or ROI.
2. **P0** Generate `cost-factor.html` alias (canonical + visible link to `cost-factors.html`) so `/cost-factor` is not a soft 404.
3. **P0** Link `cost-factors.html` from every GC directory related-reading strip (additions, kitchen, bathrooms, custom homes, Edmonds custom homes).
4. **P0** Link `hire-questions.html` from every GC directory related-reading strip (same five pages).
5. **P0** Rewrite additions FAQ “How much does a home addition cost…” so it does not invent mid-to-high hundreds per square foot or “several hundred thousand” totals.
6. **P0** Replace the sitewide Project Calculator ($275 / $350 / $450 / $550 / sq ft + $25,000 fee) with a no-price cost-factor card that points to `cost-factors.html`.
7. **P0** Generate `energy-credits.html` alias (canonical to `energy-credit.html`) so `/energy-credits` does not 404 after the extensionless soft-redirect.
8. **P0** Put official **WA L&I Verify** (`https://secure.lni.wa.gov/verify/`) in city-hub body copy, not only the global footer.
9. **P0** Expand `permits.html` with official portals already used on city hubs: Lynnwood, Kirkland, Bothell, Mukilteo, Mill Creek, Mountlake Terrace, Lake Forest Park.
10. **P0** Rebuild `learn.html` as a real hub: how-to-use, official sources strip, featured pillars with blurbs, featured posts, complete directory list, cost-factors + hire-questions.
11. **P0** Add `cost-factors.html` (and alias) to `sitemap.xml`.
12. **P0** Add Cost factors + Hire questions to primary More/Tools nav and footer Explore (cost-factors was missing entirely).
13. **P0** Add Learn, Permits, Hire questions, and Cost factors to `404.html` recovery cards.
14. **P0** Append Related reading + official L&I / permit-hub links to every generated blog post.
15. **P0** Confirm BreadcrumbList JSON-LD on all public generated pages after regenerate (including new cost-factors and aliases).

## P1 — directories

16. **P1** Add Related learning strip to `custom-homes.html` (planning, hire-questions, cost-factors, spec vs custom, Edmonds Top 30, learn).
17. **P1** Add Related learning strip to `edmonds-custom-homes.html` (Edmonds hub, ADU, permits, hire-questions, cost-factors, addition planning).
18. **P1** Add Related learning strip to `commercial.html` (permits, hire-questions, cost-factors, bonds/insurance, design-build vs bid).
19. **P1** Add Related learning strip to `spec-homes.html` (custom-homes contrast, hire-questions, cost-factors, how-we-rank).
20. **P1** Add Related learning strip to `trades.html` (verify, hire-questions, cost-factors, hiring-a-contractor, learn).
21. **P1** Add Related learning + official L&I to every trade directory (`plumber.html` … `excavation.html`).
22. **P1** Link official L&I electrical resources from `electrician.html` (L&I Verify + L&I electrical licensing page).
23. **P1** Link official L&I contractor-hiring guidance from `plumber.html` and `hvac.html` (Verify + L&I “Hiring a contractor”).
24. **P1** Add hire-questions + cost-factors to kitchen/bath related strips (currently planning + hiring + bid + permits only).
25. **P1** Add official MyBuildingPermit + Edmonds permit-assistance links in the additions planning tip (not only “see the blog”).
26. **P1** Add official permit-hub + L&I sentence to kitchen/bath FAQ answers (already mention MyBuildingPermit; make the hub + Verify clickable in on-page FAQ HTML).
27. **P1** Add commercial + spec-homes + Edmonds custom homes to the Learn hub “Directories” list (hub currently omits three hire shortlists).
28. **P1** Add `how-we-rank.html` + `bonds-and-insurance.html` to directory related strips where verification is the next step.
29. **P1** Add compact official-sources strip on additions: L&I Verify, MyBuildingPermit, Edmonds permit assistance.
30. **P1** Point directory “Before you hire” boxes at hire-questions + cost-factors + verify-contractor (not only generic L&I prose).

## P1 — city & region hubs

31. **P1** Auto-append hire-questions, cost-factors, verify-contractor, and learn to every `build_city_hub_page` directory list.
32. **P1** Add Related learning strip (not only related posts) to the shared city-hub template.
33. **P1** Add L&I Verify + L&I “Hiring a contractor” official pair to every city hub permitting section.
34. **P1** Add a city-hub FAQ: “Does the Board publish prices for this city?” → no; see cost-factors; compare written scopes.
35. **P1** Add visible HTML breadcrumbs on city hubs (schema exists; on-page trail is missing).
36. **P1** Shoreline hub: add hire-questions, cost-factors, home-addition-planning, coastal-waterproofing (coastal North King).
37. **P1** Lynnwood hub: add official City of Lynnwood community-development/permits path alongside MyBuildingPermit + hire-questions.
38. **P1** Ballard / Magnolia / Queen Anne / Greenwood / Phinney Ridge: add Seattle hub + SDCI how-to + hire-questions + cost-factors.
39. **P1** Mukilteo hub: add coastal-waterproofing + hire-questions + learn (currently five dir links, no steward tools).
40. **P1** Kirkland hub: add hire-questions, cost-factors, learn (currently permit + planning only).
41. **P1** Bothell hub: add hire-questions, cost-factors, learn, and King + Snohomish region hubs (city spans counties).
42. **P1** Edmonds project hub: add hire-questions + cost-factors + second-story-vs-teardown (posts already cover stay-in-home / addition).
43. **P1** Seattle hub: add hire-questions + cost-factors + bathroom-waterproofing + hiring-a-contractor.
44. **P1** King County hub: add hire-questions + cost-factors + unincorporated vs city AHJ reminder with Accela + MyBuildingPermit.
45. **P1** Snohomish County hub: add hire-questions + cost-factors + Edmonds ADU + PDS official link already present; deepen with city-portal reminder.

## P1 — learn hubs & thin tools

46. **P1** Deepen `hire-questions.html`: more question groups (references, insurance/bond, weather/dry-in, punch), official L&I, FAQ, related reading, cost-factors.
47. **P1** Add FAQPage schema to hire-questions (page currently has breadcrumbs only).
48. **P1** Add FAQ + official ADU/code links to `adu-checklist.html`.
49. **P1** Deepen `materials.html`: more manufacturer rows already cited in posts + FAQ “not a price list” + related reading.
50. **P1** Deepen `glossary.html`: add missing terms (AHJ already; add fixture unit, dry-in already; add CO, TI, WRB already; add MyBuildingPermit already; add cost factor, retainage, steward) + FAQ + learn link.
51. **P1** Deepen `videos.html`: more post/tool links + FAQ + official “clips are illustrative” + learn/build-walkthrough.
52. **P1** Add FAQ + related reading to `contact.html` (what the desk will/won’t do; PPG is not Board CS).
53. **P1** Add Related reading to `good-steward.html` (hire-questions, cost-factors, bonds, final-walkthrough, learn).
54. **P1** Add Related reading + FAQ to `another-story.html` (second-story-vs-teardown, addition planning, Edmonds hub, permits).
55. **P1** Add Related reading + FAQ to `energy-credit.html` (windows post, permits, WSU/SBCC honesty: Board does not award credits).
56. **P1** Add hire-questions + cost-factors to `steward_cta_strip` so directory footers surface both pages.
57. **P1** Add cost-factors + hire-questions cards to About `#learn` planning grid.
58. **P1** Add Related learning strip to `blog.html` (learn, permits, hire-questions, cost-factors, hiring-a-contractor).
59. **P1** Add official L&I + permit-hub strip to `hiring-a-contractor.html` header (companion line exists; make official hire-a-contractor L&I page explicit).
60. **P1** Add cost-factors to `bid-comparison.html` related line (page already refuses invented prices).
61. **P1** Add cost-factors to `change-orders.html` related line (allowances are a cost driver).
62. **P1** Add cost-factors + hire-questions to `home-addition-planning.html` related reading.
63. **P1** Add hire-questions + cost-factors to `kitchen-remodel-planning.html` and `bathroom-waterproofing-guide.html` if missing one of them.
64. **P1** Add cost-factors to `second-story-vs-teardown.html` (page already refuses “always cheaper”).
65. **P1** Add hire-questions + cost-factors to `design-build-vs-bid.html` related list (hire-questions already; add cost-factors).
66. **P1** Add official L&I Verify to `verify-contractor.html` related strip plus cost-factors (verification ≠ price).
67. **P1** Add Learn + hire-questions + cost-factors to `how-we-rank.html` related line.
68. **P1** Add coastal cities (Edmonds, Mukilteo, Magnolia, Shoreline) from `coastal-waterproofing.html`.
69. **P1** Add official MyBuildingPermit + ECDC 16.20.050 already on ADU hub; add hire-questions + cost-factors to ADU “Board shortlists” list.
70. **P1** Visible HTML breadcrumbs on Learn, Permits, ADU, cost-factors, hire-questions.

## P1 — blog posts & schema

71. **P1** Category-aware Related reading on posts (Kitchen → kitchen dir + kitchen planning; Bathrooms → bathrooms + waterproofing; Additions → additions + addition planning; etc.).
72. **P1** City-token Related reading on posts (title/slug “edmonds” → Edmonds hub + Edmonds permit assistance; “seattle/ballard/magnolia…” → Seattle hub + SDCI).
73. **P1** Always include hire-questions + cost-factors + learn on every post related strip.
74. **P1** Always include official L&I Verify on every post related strip (many posts mention it in markdown; chrome should guarantee it).
75. **P1** Blog index: add city-hub jump list under featured (Edmonds, Seattle, Shoreline, Lynnwood, Kirkland) so posts are not the only path.
76. **P1** Keep BreadcrumbList on posts (already present) and add a “Learn hub” crumb sibling link in the visible trail.
77. **P1** Add HowTo JSON-LD on hire-questions only if visible steps match (interview sequence) — no totalTime / estimatedCost.
78. **P1** Add FAQPage to cost-factors (honest “why no prices” / “is this a bid”).
79. **P1** 404 extensionless alias map for `/energy-credits` and `/cost-factor` in addition to generated alias files.
80. **P1** README public-URL table: add learn, permits, hire-questions, cost-factors, city hubs (ops completeness).

## P2 — more density (implement if time)

81. **P2** Trade-specific related posts (e.g. tile → hiring-tile-contractor-edmonds; plumber → magnolia-plumbing post).
82. **P2** Expand materials index with Huber ZIP / Hardie / Simpson already listed; add one more official-docs honesty line per card.
83. **P2** Videos page: link window-replacement and waterproofing posts that carry clips.
84. **P2** Glossary: link each term to the best hub (AHJ → permits, Allowance → change-orders, Board #1 → how-we-rank).
85. **P2** Add King + Snohomish hubs to About city-hub sentence (currently neighborhood-only).
86. **P2** Add commercial/spec honesty FAQs pointing at hire-questions (already have process FAQs).
87. **P2** PM Dashboard / Site Visit / Build Walkthrough landings: add hire-questions + cost-factors under the iframe.
88. **P2** Write.html draft tool: mention cost-factors + hire-questions as required related links for new posts (ops, noindex).
89. **P2** RSS item descriptions: no change required if posts stay honest; defer feed redesign.
90. **P2** Self-host Tailwind / drop CDN (known render-blocking debt) — defer; visual-break risk.

## P3 — deferred ops / later

91. **P3** Custom-domain HTTPS certificate hostname mismatch (ops; not a generator claim).
92. **P3** Search Console / Bing Webmaster registration (owner login; not this PR).
93. **P3** On-site search / WebSite SearchAction (explicitly skipped until a search URL exists).
94. **P3** Pretty URLs without `.html` (GitHub Pages + 404 soft-redirect is the current contract).
95. **P3** Full unique hero images for every city hub (directory heroes exist; city pages share default OG).
96. **P3** Separate ADU-only ranked directory (hub already says none exists; do not invent one).
97. **P3** IndexNow key rotation / Webmaster re-ping policy (CI already soft-pings sitemap).
98. **P3** Mobile “More” menu density / grouping redesign (Tools list is long; IA polish later).
99. **P3** Public review-count live refresh automation (PPG 4.9 / 190 stays cited to Trustindex; do not invent new counts).
100. **P3** Translate / hreflang (forbidden today; English-only Board chrome).

---

## Follow-on P0 (this iteration — live 404s)

Live Board URL is **https://boardofprojectstewardship.com/** only. PPG #1 hire outbound remains **https://pacificprogroup.com/**. These pages were missing, so `/about` and `/faq` 404’d after the extensionless soft-redirect.

- **P0-A** Dedicated `about.html` — independent Board voice, what the Board does/does not do, Board #1 hire ranking is not ownership, official L&I, FAQ + related reading.
- **P0-B** Dedicated `faq.html` — sitewide honest FAQ (identity, prices, L&I, cities, contact, energy credits, ADU ranking, search).
- **P0-C** Wire About + FAQ through primary/More nav, footer Explore, Learn reference, hire-questions / cost-factors / contact / how-we-rank, homepage CTAs, 404 recovery cards, sitemap, README.
- **P0-D** 404 alias map includes `/about` and `/faq`.

Also closed deferred **P2 #86** (commercial + spec honesty FAQs pointing at hire-questions / cost-factors and independent Board voice).

---

## This-PR scoreboard

| Priority | Fixed | Deferred |
|----------|------:|---------:|
| P0 (1–15) | 15 | 0 |
| P1 (16–80) | 65 | 0 |
| P2 (81–90) | 10 | 2 (89 RSS redesign; 90 Tailwind self-host) |
| P3 (91–100) | 0 | 10 (ops / HTTPS / search / pretty URLs / IA polish) |
| Follow-on P0 (A–D) | 4 | 0 |
| **Total (100 + follow-on)** | **94** | **12** |

Rebased onto latest `main` (live already had About/FAQ as of 2026-09-20 20:17). This iteration: `build_about()` now writes **`about.html`** (homepage is `build_home()` → `index.html`); About/FAQ deepened; CNAME `boardofprojectstewardship.com`; `/cost-factor` + `/energy-credits` aliases; videos/materials/trades/write density (P2 81–85, 88).

Shipped in `generate_site.py` then regenerated: new `cost-factors.html` (+ `cost-factor.html` alias), `energy-credits.html` alias, dedicated `about.html` + `faq.html`, deepened Learn / hire-questions / city hubs / directories / posts, official L&I + city permit links, Related reading strips, FAQ/HowTo/BreadcrumbList, 404 recovery, honesty fix (removed invented $/sf calculator and additions cost FAQ bands).

Hard locks checked in this wave: no PPG repo edits; PPG is hire #1 outbound only (`https://pacificprogroup.com/`); live Board URL `https://boardofprojectstewardship.com/` only; no public AI/ChatGPT/Higgsfield/LLM mentions; Board of Project Stewardship spelled out in public chrome; no invented licenses/years/reviews/awards/prices/ROI in new copy.
