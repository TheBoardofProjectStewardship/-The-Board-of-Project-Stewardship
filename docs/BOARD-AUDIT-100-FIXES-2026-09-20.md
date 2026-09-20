# BOARD AUDIT — 100 FIXES (2026-09-20 PT)

**Live:** https://boardofprojectstewardship.com/  
**Repo SoT:** `/workspace/bops-repo/generate_site.py`  
**Locks:** Independent Board look; PPG #1 hire only → https://pacificprogroup.com/; never edit PPG; no public AI/ChatGPT/Higgsfield; no invented prices/ROI/licenses/years/reviews; spell out Board of Project Stewardship.

**Composition:** Items 1–35 = Quill Astra live audit (verbatim intent). Items 36–100 = Steward depth/IA/CWV/a11y/orphan/schema wave.

**Evidence baseline:** ~82 HTML pages; ~45 under ~900 words; ~77 missing `#related-learning`; learn.html thin as spider; about.html + faq.html **404 live**.

---

### 1. [P0] IA — Ship real About page (about.html)
- Problem: Live /about.html 404; nav “About” points at index.html so label ≠ destination.
- Fix: Add about.html: Board bio, what we are/aren’t (not GC, not lead-gen), editorial email, How we rank + L&I. Point nav About → about.html; rename index nav to Home.
- Effort: M

### 2. [P0] IA — Ship sitewide FAQ hub (faq.html)
- Problem: Live /faq.html 404; no single FAQPage hub for homeowners.
- Fix: Add faq.html with 8–12 honest FAQs + FAQPage JSON-LD; footer + Learn deep-links.
- Effort: M

### 3. [P0] SEO — Add about.html + faq.html to sitemap + IndexNow
- Problem: New hubs won’t be discovered without sitemap lastmod + IndexNow ping.
- Fix: Include both in write_sitemap extras; ping IndexNow after push.
- Effort: S

### 4. [P1] Nav — Collapse primary nav to ~7–9 tops
- Problem: Mega-nav overload; city/cost links bury Learn/Verify.
- Fix: Primary: Home, About, Learn, Permits, Verify, How we rank, Blog (+ More for directories/tools).
- Effort: M

### 5. [P0] Nav — Rename nav About → Home for index
- Problem: Label “About” currently lands on homepage.
- Fix: Primary Home → index.html; About → about.html.
- Effort: S

### 6. [P0] Nav — Promote How We Rank + Verify Contractor
- Problem: Methodology differentiator buried under More.
- Fix: Put Verify + How we rank in primary row; keep ADU/Permits exposed.
- Effort: S

### 7. [P1] Home — Deduplicate homepage Mission copy
- Problem: Hero deck and Mission repeat the same sentence.
- Fix: Tighten Mission to one unique paragraph + link About.
- Effort: S

### 8. [P1] Honesty — Fence Project Calculator honesty
- Problem: Fixed $25,000 base can read like Board-endorsed deposit/PPG pricing.
- Fix: Keep illustrative / not a bid; add not PPG pricing; prefer ranges or remove fixed base.
- Effort: M

### 9. [P0] Contact — Deepen contact page
- Problem: Single thin H2; no purpose chips or response expectations.
- Fix: Add purpose chips (directory correction / source / press), response expectations, directories + L&I + related_learning_strip.
- Effort: M

### 10. [P1] Feature — Expand Another Story feature page
- Problem: Thin shell; Board-feature framing weak.
- Fix: Explain what it is, conceptual/not permit set, CTAs to tool + anotherstorysea.com + additions.
- Effort: M

### 11. [P1] Tools — Good Steward hub card hygiene
- Problem: Risk of duplicate embeds / unclear localStorage truth.
- Fix: One tool card each; link Site Visit + PM + Build Walkthrough; state browser-local save behavior.
- Effort: M

### 12. [P2] CWV — Strip full tool iframes from non-tool pages
- Problem: Heavy embeds on blog/dirs hurt CWV.
- Fix: Compact CTAs on posts/dirs; heavy embeds only on tool hosts + good-steward.
- Effort: L

### 13. [P2] Directories — Directory ranks 2–30 editorial depth
- Problem: Long-tail cards can read like a phonebook.
- Fix: ≥2 sentences editorial why or move tail to Also reviewed.
- Effort: L

### 14. [P1] Schema — ItemList AggregateRating hygiene
- Problem: Invented ratings for non-PPG firms would violate honesty lock.
- Fix: AggregateRating only where dated public aggregate exists (PPG Trustindex after re-verify).
- Effort: S

### 15. [P1] FAQ — Soften FAQ timelines that sound like promises
- Problem: e.g. “3–12 months” reads as Board guarantee.
- Fix: Frame as often/typically varies; ask AHJ and GC — or drop fixed months.
- Effort: S

### 16. [P1] City — City landing unique AHJ depth
- Problem: Some hubs risk spun boilerplate clones.
- Fix: Mention AHJ quirks, coastal/critical areas, official permit portals per city.
- Effort: M

### 17. [P0] Links — Bidirectional Learn ↔ directory body links
- Problem: Many pages only footer-link; 77 missing related-learning strip.
- Fix: related_learning_strip on every major page; body cross-links planning↔directory.
- Effort: M

### 18. [P1] Blog — Blog → directory modules
- Problem: Local posts may end without directory/How we rank/L&I.
- Fix: End Magnolia/etc posts with parent directory, How we rank, L&I Verify.
- Effort: M

### 19. [P0] Hire — Hire Questions real H2 sections
- Problem: Scan/SEO weak; groups may be H3-only.
- Fix: H2 sections: license, insurance, schedule, change orders, warranty + deepen prose.
- Effort: M

### 20. [P1] Glossary — Glossary terms link out
- Problem: Terms lack Learn/directory deep-links; some key terms thin.
- Fix: Link each term; ensure Permits, Dry-in, Change order, Punch list present.
- Effort: S

### 21. [P1] Permits — Permits hub comparison table
- Problem: Start-here paths for Edmonds vs unincorporated Snohomish vs Seattle not tabular.
- Fix: Table of official start-here URLs only; no invented clocks.
- Effort: M

### 22. [P1] ADU — ADU hub Edmonds vs Seattle honesty
- Problem: Risk of pasting Seattle dates onto Edmonds.
- Fix: Explicit Edmonds catalog status vs Seattle ADUniverse; re-verify live portals.
- Effort: S

### 23. [P2] Directories — Commercial/Spec depth or noindex
- Problem: Depth may lag Additions/Kitchen.
- Fix: Add editorial criteria + shortlists or noindex until depth matches.
- Effort: L

### 24. [P1] Trades — Trades index specialty vs GC intro
- Problem: When to hire specialty vs GC unclear.
- Fix: Intro paragraph + L&I reminder on each trade page.
- Effort: S

### 25. [P1] Schema — Organization JSON-LD completeness
- Problem: Logo/email/areaServed must stay Board-only (no parentOrganization PPG).
- Fix: Verify logo 200s, email editorial@, areaServed King+Snohomish.
- Effort: S

### 26. [P1] Schema — BreadcrumbList coverage
- Problem: Some thin pages may omit crumbs.
- Fix: BreadcrumbList on directories, Learn, posts, about, faq.
- Effort: S

### 27. [P1] a11y — Branded 404 depth
- Problem: 404 should route to Learn/Contact/about/faq.
- Fix: Update 404 cards: Home, About, Learn, FAQ, Contact, directories.
- Effort: S

### 28. [P1] a11y — Skip link + main + aria nav
- Problem: Standing a11y requirement.
- Fix: Confirm skip → #main-content; aria-label Primary; mobile aria-expanded.
- Effort: S

### 29. [P2] Media — Image depth on thin hubs
- Problem: Contact/Another Story/Good Steward image-thin vs home.
- Fix: ≥1 real or labeled-illustrative image each.
- Effort: M

### 30. [P1] Honesty — Alt text honesty
- Problem: AI/stock must say illustrative.
- Fix: Audit alts; never imply PPG job photos unless on-file.
- Effort: S

### 31. [P0] Official — L&I URL normalize sitewide
- Problem: Must be one canonical Verify URL.
- Fix: Use https://secure.lni.wa.gov/verify/ in OFFICIAL_LINKS helper + footer + dirs.
- Effort: S

### 32. [P2] Trust — Trustindex chip dating
- Problem: 4.9 · 190 must not bump without re-verify.
- Fix: Link public aggregate; date research pass.
- Effort: S

### 33. [P1] PPG — PPG #1 CTA copy hygiene
- Problem: Must not imply Board sells the job.
- Fix: Keep View Pacific Pro Group / process reasons; never Hire #1 via Board intake.
- Effort: S

### 34. [P0] Locks — Independent-org LOOK check
- Problem: Footer/schema/About must not claim ownership/parent.
- Fix: Short Board bio only; no associated-with PPG.
- Effort: S

### 35. [P0] QA — Post-ship curl QA
- Problem: about+faq must 200; IndexNow for changed URLs.
- Fix: curl about+faq 200; sample thin hubs; calculator disclaimer if present.
- Effort: S

### 36. [P0] Helpers — OFFICIAL_LINKS reusable helper
- Problem: Official .gov links duplicated ad hoc; easy to miss on thin pages.
- Fix: Add OFFICIAL_LINKS catalog + official_links_section() in generate_site.py.
- Effort: S

### 37. [P0] Helpers — Default related link packs
- Problem: related_learning_strip exists ~1938 but ~3 heavy call sites.
- Fix: Add RELATED_LINK_PACKS (permits, verify, learn, directories, cost-factors, hire-questions) + related_pack().
- Effort: S

### 38. [P0] Learn — Deepen learn.html as spider hub
- Problem: learn.html related=False; body official depth weak; ~879 words.
- Fix: Link cards to EVERY learn/tool/city/directory page + related strip + ≥2 official .gov + FAQ honesty.
- Effort: M

### 39. [P0] Learn — related_learning_strip on learn hub
- Problem: Spider hub itself lacked related strip.
- Fix: Append default pack + FAQ hub + about links.
- Effort: S

### 40. [P0] Hire — Deepen hire-questions educational prose
- Problem: Thin (~715 words); needs 300–600 words process guidance.
- Fix: Add H2 process guidance + official L&I/permits + related strip + FAQ.
- Effort: M

### 41. [P0] ADU — related strip + official on adu.html
- Problem: Missing related-learning; deepen Edmonds portal links.
- Fix: Add strip + L&I + Edmonds/MyBuildingPermit + FAQ if missing.
- Effort: S

### 42. [P0] ADU — Deepen adu-checklist
- Problem: Thin checklist-only (~690 words).
- Fix: Add process prose, official links, related strip, FAQ.
- Effort: M

### 43. [P0] Verify — related strip on verify-contractor
- Problem: Walkthrough exists but weak cross-links to hire/rank/learn.
- Fix: related_pack(verify) + FAQ honesty.
- Effort: S

### 44. [P0] Rank — related strip on how-we-rank
- Problem: Methodology page should spider to verify/hire/directories.
- Fix: Add related_learning_strip + official L&I.
- Effort: S

### 45. [P0] Glossary — Deepen glossary + related strip
- Problem: Thin (~728); terms not linked.
- Fix: Link terms to Learn/dirs; official section; related strip.
- Effort: M

### 46. [P0] Videos — Deepen videos index
- Problem: Thin editorial index.
- Fix: Add honesty copy, Learn/Good Steward links, related strip, official L&I.
- Effort: S

### 47. [P0] Materials — Deepen materials index
- Problem: Very thin (~631).
- Fix: 300+ words process guidance (no prices) + related strip + official links.
- Effort: M

### 48. [P0] Tools — energy-credit page depth + strip
- Problem: Iframe-heavy thin intro.
- Fix: Prose on WSEC-R honesty + SBCC/L&I links + related strip.
- Effort: M

### 49. [P0] Tools — site-visit page strip + official
- Problem: Thin landing above iframe.
- Fix: Process guidance + related pack + L&I/city portals.
- Effort: S

### 50. [P0] Tools — pm-dashboard page strip + official
- Problem: Thin educational template landing.
- Fix: Honesty (not schedule) + related strip + L&I.
- Effort: S

### 51. [P0] Tools — build-walkthrough strip + deepen
- Problem: Good intro but missing related strip.
- Fix: related_pack + official links + FAQ.
- Effort: S

### 52. [P0] Learn — change-orders related strip
- Problem: Has FAQ but no related-learning strip.
- Fix: Append related pack (hire/contract/bid).
- Effort: S

### 53. [P0] Learn — bid-comparison strip + deepen
- Problem: Thin (~725).
- Fix: Process prose + related + official L&I.
- Effort: M

### 54. [P0] Cost — related strip all cost-factor pages
- Problem: Five cost-factor pages missing related strips.
- Fix: Apply cost-factors pack + official links on remodel/kitchen/bath/addition/adu cost pages.
- Effort: M

### 55. [P0] City — related strip on all city hubs
- Problem: City hubs have FAQ/permits but no related-learning strip.
- Fix: Patch build_city_hub_page to append related_pack + ensure L&I in official list.
- Effort: M

### 56. [P0] City — Deepen thin city hubs (Ballard/Magnolia/etc.)
- Problem: Many city hubs ~760–810 words boilerplate risk.
- Fix: Unique AHJ paragraph + Learn/directory cross-links via city hub template.
- Effort: M

### 57. [P0] Dirs — Directory body cross-links weak
- Problem: additions/kitchen/bathrooms have strips; custom/trades/commercial weaker.
- Fix: Add related strips + Learn/planning links on custom-homes, trades hub, commercial, spec.
- Effort: M

### 58. [P1] Nav — Expose ADU in More + footer prominently
- Problem: Task requires Learn, Permits, ADU, Verify, How we rank exposed.
- Fix: Confirm ADU in footer explore + More Tools; primary has Learn/Permits/Verify/How we rank.
- Effort: S

### 59. [P1] Footer — Footer About → about.html; add FAQ
- Problem: Footer About still → index.
- Fix: Point About to about.html; add FAQ + Home entries.
- Effort: S

### 60. [P1] Schema — FAQPage on about + faq hubs
- Problem: New pages need FAQ schema where FAQs appear.
- Fix: faq_ld on about (if FAQs) and faq.html.
- Effort: S

### 61. [P1] Schema — BreadcrumbList Home label
- Problem: Crumbs say About for BASE_URL.
- Fix: Prefer Home → BASE_URL; About → about.html on new pages.
- Effort: S

### 62. [P1] Orphans — Soft-orphan educational pages
- Problem: materials/videos/glossary/contact soft orphans.
- Fix: Learn spider + related strips + footer ensure inbound.
- Effort: M

### 63. [P1] Official — ≥2–4 .gov links on listed thin pages
- Problem: Evidence: many pages weak on official outbound (body analysis).
- Fix: official_links_section with L&I + AHJ portals on each targeted page.
- Effort: M

### 64. [P1] FAQ — FAQ honesty pass on thin hubs
- Problem: Answers must not invent prices/ROI/timelines.
- Fix: Add/refresh FAQs: Board not GC; L&I source of truth; no invented fees.
- Effort: M

### 65. [P1] Learn — Hire questions ↔ red-flags ↔ verify triangle
- Problem: Hiring cluster under-linked.
- Fix: Cross-link all three in related packs + body.
- Effort: S

### 66. [P1] Cost — Cost-factor pages honesty fence
- Problem: Must stay qualitative drivers only.
- Fix: Explicit no-prices/no-ROI blurb + link bid-comparison.
- Effort: S

### 67. [P1] City — Ensure L&I on every city hub official list
- Problem: Some hubs only city portals.
- Fix: Prepend WA L&I Verify to city hub official section.
- Effort: S

### 68. [P1] Permits — Permits page related strip
- Problem: Strong official links but may miss related strip.
- Fix: Add related_learning_strip to permits builder.
- Effort: S

### 69. [P1] ADU — adu + checklist + cost-factors triangle
- Problem: ADU cluster soft gaps.
- Fix: Mutual related packs across adu/adu-checklist/adu-cost-factors.
- Effort: S

### 70. [P1] CWV — Font/iframe lazy notes
- Problem: Tool landings load heavy iframes.
- Fix: Keep loading=lazy; crawlable prose above fold (already pattern).
- Effort: S

### 71. [P1] a11y — related-learning aria-labelledby
- Problem: Strip already has aria; ensure new pages use helper not hand markup.
- Fix: Only emit via related_learning_strip().
- Effort: S

### 72. [P2] Posts — IndexNow after this ship
- Problem: Changed URLs need ping.
- Fix: python3 generate_site.py --indexnow or INDEXNOW_PING=1.
- Effort: S

### 73. [P2] 404 — 404 links to about + faq
- Problem: New hubs must be reachable from 404.
- Fix: Add About + FAQ + Learn cards on 404.
- Effort: S

### 74. [P2] Home — Homepage CTAs to about + faq
- Problem: Mission should deep-link new hubs.
- Fix: Add About / FAQ / Learn CTAs on home if missing.
- Effort: S

### 75. [P2] Contact — Contact purpose chips
- Problem: Quill #9 detail.
- Fix: Chips: Directory correction · Source question · Press/editorial.
- Effort: S

### 76. [P2] Videos — Videos → Learn + Blog
- Problem: Orphan risk.
- Fix: Inbound from Learn reference section (already) + related strip outbound.
- Effort: S

### 77. [P2] Materials — Materials → selecting-finishes
- Problem: Materials index orphan from finishes guide.
- Fix: Cross-link selecting-finishes + cost-factors.
- Effort: S

### 78. [P2] Energy — Link SBCC / WSEC resources officially
- Problem: energy-credit should cite official code path.
- Fix: Add sbcc.wa.gov or lni energy code outbound if accurate.
- Effort: S

### 79. [P2] Glossary — Punch list ↔ final-walkthrough
- Problem: Terms without page links.
- Fix: Link punch list → final-walkthrough; change order → change-orders.
- Effort: S

### 80. [P2] Hire — Insurance/bond H2 on hire-questions
- Problem: Quill #19 asks insurance section.
- Fix: Add Bonds & insurance H2 + link bonds-and-insurance.html.
- Effort: S

### 81. [P2] Dirs — Kitchen/Bath/Additions planning backlinks
- Problem: Planning pages exist; ensure dirs point back in body.
- Fix: related strips already on kb/additions — extend to planning pages if missing.
- Effort: S

### 82. [P2] City — Region hubs Seattle/King/Snohomish strips
- Problem: Region hubs need related pack too.
- Fix: Same city hub template fix covers them.
- Effort: S

### 83. [P2] Schema — FAQ on contact if FAQs added
- Problem: Contact deepen may add FAQs.
- Fix: Emit faq_ld when FAQs present.
- Effort: S

### 84. [P2] Nav — Contact in More remains
- Problem: Primary may drop Contact — keep in More + footer.
- Fix: Ensure contact in more_tools + footer.
- Effort: S

### 85. [P2] Honesty — No ChatGPT/AI public claims
- Problem: Lock: no public AI/ChatGPT/Higgsfield.
- Fix: Grep chrome/copy; keep Board editorial voice only.
- Effort: S

### 86. [P2] Copy — Spell out Board of Project Stewardship
- Problem: Avoid unexplained BOPS in user-facing H1s.
- Fix: Full name in titles/footers; BOPS only where already established.
- Effort: S

### 87. [P2] CWV — Avoid layout shift on related strip grids
- Problem: New grids on many pages.
- Fix: Reuse existing card classes; no CLS-heavy embeds in strip.
- Effort: S

### 88. [P2] a11y — FAQ details keyboard
- Problem: details/summary already used.
- Fix: Keep native details; first open OK.
- Effort: S

### 89. [P2] SEO — about/faq meta descriptions ≤160
- Problem: New pages need clamp_description.
- Fix: Use existing page_shell clamps.
- Effort: S

### 90. [P2] SEO — Canonical trailing consistency
- Problem: about.html and faq.html absolute canons.
- Fix: Pass canonical= f"{BASE_URL}about.html" etc.
- Effort: S

### 91. [P1] Learn — Directory section on Learn includes commercial/spec
- Problem: Learn directories list incomplete vs site.
- Fix: Add commercial, spec-homes, Edmonds custom to Learn cards.
- Effort: S

### 92. [P1] Official — MyBuildingPermit + SDCI pairing guidance
- Problem: Homeowners confuse portals.
- Fix: Official section blurb: Seattle=SDCI portal; many others=MyBuildingPermit — confirm AHJ.
- Effort: S

### 93. [P2] Tools — Good Steward localStorage honesty
- Problem: Quill #11 detail.
- Fix: State notes stay in-browser on site-visit/pm pages.
- Effort: S

### 94. [P2] Rank — Soften additions FAQ cost language
- Problem: Additions FAQ mentions $/sqft ranges — honesty risk.
- Fix: Rewrite to qualitative factors + link cost-factor guides; no invented prices.
- Effort: S

### 95. [P2] Blog — Learn hub card on blog index
- Problem: Blog may not point to Learn spider.
- Fix: Add Learn hub CTA on blog index if missing.
- Effort: S

### 96. [P1] Impl — Wire helpers into tool landings
- Problem: energy/site-visit/pm/build-walkthrough need shared footer blocks.
- Fix: Append official_links_section + related_learning_strip before page_shell close.
- Effort: M

### 97. [P1] Impl — Wire helpers into educational explainers
- Problem: change-orders, bid-comparison, coastal, red-flags, timeline, etc.
- Fix: Batch-append related packs where missing.
- Effort: M

### 98. [P0] Impl — generate_site.py + fix errors
- Problem: Must regenerate all HTML from SoT.
- Fix: Run python3 generate_site.py; fix exceptions.
- Effort: M

### 99. [P0] Ops — git commit + push main
- Problem: Live GitHub Pages only updates on push.
- Fix: git add/commit/push main (Board repo only).
- Effort: S

### 100. [P0] QA — DONE/SKIPPED appendix + live verify
- Problem: Need ship ledger for Steward report.
- Fix: Append DONE/SKIPPED by number; curl-verify about+faq+sample hubs.
- Effort: S

---

## DONE / SKIPPED

_Filled after implement pass._


---

## DONE (shipped 2026-09-20 PT)

1. **about.html** — dedicated About page (mission, what Board is/isn’t, ranking, L&I, PPG #1 outbound only).
2. **faq.html** — sitewide FAQ + FAQPage JSON-LD.
3. **Nav** — Home → index; About → about.html; Learn / Permits / Verify / How we rank in primary; FAQ in More + footer.
4. **Sitemap** — about.html + faq.html indexed.
5. **Contact** — deepened with purpose note + About/FAQ links.
6. **Audit list** — this 100-item file published under `docs/`.

Still open: mega-nav collapse (city list still long under More), calculator honesty fence, directory editorial depth, city uniqueness, related-strip coverage on thin hubs, CWV/a11y leftovers — continue from P0/P1 remaining.
