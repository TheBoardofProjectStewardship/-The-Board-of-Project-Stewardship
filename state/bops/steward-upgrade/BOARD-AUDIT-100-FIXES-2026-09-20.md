# Board of Project Stewardship — Audit 100 Fixes

**Date:** Sunday, Sep 20, 2026 (PT)  
**Live:** https://boardofprojectstewardship.com/  
**Repo:** `/workspace/bops-repo` · SoT `generate_site.py`  
**Locks:** Independent Board LOOK · PPG = #1 hire → https://pacificprogroup.com/ only · never edit PPG site · no public AI/ChatGPT/Higgsfield/LLM strings · honesty (no invented licenses/years/reviews/awards/prices/ROI)

**Method:** Live deep-dive (home, learn, blog, directories, tools, permits/ADU/cities/cost-factors/hiring) + generator/sitemap/schema/a11y/meta/CWV + competitor patterns (L&I Verify + Hire Smart adjacency, permit hubs, city FAQs) without copying invented stats.

---

## 1. [P0] Nav
- **Problem:** Learn hub buried under More despite being primary educational IA
- **Fix:** Promote Learn to primary nav so pillars/permits/ADU are discoverable without opening More
- **Effort:** S

## 2. [P0] Nav
- **Problem:** SEO-40 #6 open: no Board #1 utility chip in header
- **Fix:** Add subtle header utility Board #1 · Pacific Pro Group → https://pacificprogroup.com/ with rel=noopener; never in brand slot
- **Effort:** S

## 3. [P0] Nav
- **Problem:** More dropdown dumps 70+ items in narrow w-56 panel
- **Fix:** Widen More panel, add max-height scroll, keep Directories vs Tools group labels
- **Effort:** M

## 4. [P0] Footer
- **Problem:** Footer Explore is one flat 60+ link list; contact email duplicated with contact strip
- **Fix:** Regroup footer into Directories, Learn, and Tools columns; remove redundant contact_strip from page_shell (keep footer email + #contact)
- **Effort:** M

## 5. [P0] Verify
- **Problem:** Verify page lacks L&I Hire Smart / ProtectMyHome adjacency
- **Fix:** Add Official L&I sources section: Hire Smart Step-by-Step, Hiring a Contractor, Hire Smart worksheet PDF, ProtectMyHome
- **Effort:** S

## 6. [P0] Hiring
- **Problem:** hiring-a-contractor.html missing official L&I Hire Smart outbound
- **Fix:** Add L&I Hire Smart + worksheet links beside Board hiring path; L&I remains source of truth
- **Effort:** S

## 7. [P0] City hubs
- **Problem:** City hubs thin (~750 words), generic FAQs, shallow next steps
- **Fix:** Deepen build_city_hub_page with Good Steward next-steps, related_learning strip, optional extra FAQs — no invented stats
- **Effort:** L

## 8. [P0] Seattle hub
- **Problem:** Seattle hub omits SDCI fee orientation present on permits.html
- **Fix:** Add SDCI fees overview + Fee Subtitle PDF links + cost-factors cross-links (qualitative only)
- **Effort:** S

## 9. [P0] Permits
- **Problem:** Permit hub missing Lynnwood/Mukilteo cards adjacent to city hubs
- **Fix:** Add Lynnwood + Mukilteo jurisdiction cards with official city + MyBuildingPermit outbound; link city hubs
- **Effort:** M

## 10. [P0] ADU checklist
- **Problem:** adu-checklist.html has no FAQ/HowTo schema and thin cross-links
- **Fix:** Add FAQ + HowTo schema + links to adu.html, adu-cost-factors, learn, L&I
- **Effort:** M

## 11. [P0] Coastal
- **Problem:** coastal-waterproofing.html thin, no FAQ
- **Fix:** Add FAQ + cross-links to bathroom guide, bath cost factors, bathrooms directory, PNW waterproofing post
- **Effort:** S

## 12. [P0] Materials
- **Problem:** materials.html thinnest index (4 cards, no FAQ)
- **Fix:** Expand editorial manufacturer refs + FAQ + links to coastal/windows/siding/trades; label not endorsements
- **Effort:** M

## 13. [P0] Glossary
- **Problem:** glossary.html only 12 terms, no FAQ, weak outbound
- **Fix:** Expand ~24 terms (bond, UBI, retainage, lien, MEP, critical area, eTRAKiT, Accela, fixture units) + FAQ + Learn CTA
- **Effort:** M

## 14. [P0] Videos
- **Problem:** videos.html thin orphan-feeling index
- **Fix:** Categorize links (additions/kitchen/bath/tools), add FAQ, Learn + blog CTAs
- **Effort:** S

## 15. [P0] Contact
- **Problem:** contact.html thin; write.html linked without noindex context
- **Fix:** Add FAQ (editorial vs hire vs PPG); clarify write.html is draft/noindex; link Learn + directories
- **Effort:** S

## 16. [P0] Cross-links
- **Problem:** related_learning_strip missing on city hubs and thin tools
- **Fix:** Inject related_learning_strip into city hubs + materials/glossary/videos/contact/adu-checklist/coastal
- **Effort:** M

## 17. [P0] Learn hub
- **Problem:** No Start-here path above long section cards
- **Fix:** Add ordered Start-here: Verify → Permits → Planning pillar → Directory → Site Visit
- **Effort:** S

## 18. [P0] Directories
- **Problem:** Additions FAQ uses soft timeline/cost ranges that skirt honesty lock
- **Fix:** Rewrite FAQ to qualitative drivers only; point to addition-cost-factors + written bids; remove invented month/$ ranges
- **Effort:** M

## 19. [P0] Planning↔dirs
- **Problem:** Kitchen/bath planning ↔ cost-factor ↔ directory links not fully mutual
- **Fix:** Ensure bidirectional related strips on planning + cost-factor + directory pages
- **Effort:** S

## 20. [P0] Schema
- **Problem:** Only 3 pages emit HowTo; hiring path is natural HowTo
- **Fix:** Add HowTo JSON-LD to hiring-a-contractor and ADU checklist
- **Effort:** S

## 21. [P0] Duplicate chrome
- **Problem:** Live pages show Public contact twice (strip + footer)
- **Fix:** Remove contact_strip_html from page_shell; put id=contact on footer contact line
- **Effort:** S

## 22. [P0] Blog
- **Problem:** Blog shows No posts match your filters despite visible posts
- **Fix:** Fix blog.js empty-state to render only when active filter yields zero results
- **Effort:** S

## 23. [P0] Homepage
- **Problem:** Planning hubs omit Learn/Permits/Verify as parent CTAs
- **Fix:** Add Learn hub + Permit hub + Verify CTAs in homepage planning section
- **Effort:** S

## 24. [P0] Hire questions
- **Problem:** hire-questions lacks L&I Hire Smart worksheet outbound
- **Fix:** Add official L&I sources block beside Board question banks
- **Effort:** S

## 25. [P0] Competitor pattern
- **Problem:** Official-sources callout inconsistent across permits/verify/hiring/city
- **Fix:** Add reusable Official sources callout component on those hubs
- **Effort:** S

## 26. [P1] Verify
- **Problem:** Verify FAQ missing bond lawsuit / workers' comp signals L&I surfaces
- **Fix:** Add FAQ on bond lawsuits, workers' comp account, ads must show registration # — cite L&I patterns, no invented stats
- **Effort:** S

## 27. [P1] Bonds
- **Problem:** bonds-and-insurance.html weak L&I outbound depth
- **Fix:** Deep-link L&I hiring/insurance guidance + verify walkthrough
- **Effort:** S

## 28. [P1] Red flags
- **Problem:** red-flags-hiring thinner than Hire Smart red-flag patterns
- **Fix:** Add red flags: cash-only, owner-pulled permit alone, no written change orders; link L&I Hire Smart
- **Effort:** S

## 29. [P1] Bid comparison
- **Problem:** bid-comparison missing cost-factor cross-links
- **Fix:** Add related strip to remodel/kitchen/bath/addition cost factors + contract basics
- **Effort:** S

## 30. [P1] Contract basics
- **Problem:** contractor-contract-basics missing L&I consumer contract adjacency
- **Fix:** Add outbound to L&I hiring/contract consumer guidance (official URLs only)
- **Effort:** S

## 31. [P1] Financing
- **Problem:** financing-and-draws thin on draws hygiene
- **Fix:** Deepen draws vs retainage via glossary links + final-walkthrough; no APR/ROI
- **Effort:** S

## 32. [P1] Living remodel
- **Problem:** living-through-remodel missing stay-in-home post links
- **Fix:** Link stay-in-home second-story Edmonds post + site-visit + PM dashboard
- **Effort:** S

## 33. [P1] Selecting finishes
- **Problem:** selecting-finishes missing materials + cost-factor links
- **Fix:** Add related_learning_strip to materials, cost factors, directories
- **Effort:** S

## 34. [P1] Project timeline
- **Problem:** project-timeline not mapped to Build Walkthrough / permits
- **Fix:** Add editorial stage→tool crosswalk (not a schedule commitment)
- **Effort:** M

## 35. [P1] Final walkthrough
- **Problem:** final-walkthrough thin on punch photo habits
- **Fix:** Expand checklist + link PM dashboard + hiring final-pay habits
- **Effort:** S

## 36. [P1] Design-build
- **Problem:** design-build-vs-bid missing hiring/how-we-rank strip
- **Fix:** Add related strip to hiring, how-we-rank, directories
- **Effort:** S

## 37. [P1] Second story
- **Problem:** second-story-vs-teardown missing Another Story + coastal links
- **Fix:** Add CTAs to another-story, coastal, addition-cost-factors, additions directory
- **Effort:** S

## 38. [P1] Addition planning
- **Problem:** home-addition-planning weak jurisdiction routing
- **Fix:** Route readers to permits hub + Edmonds/Seattle/King/Snohomish city hubs
- **Effort:** S

## 39. [P1] Kitchen planning
- **Problem:** kitchen-remodel-planning missing geo post examples
- **Fix:** Add 2–3 related posts + kitchen directory + cost factors
- **Effort:** S

## 40. [P1] Bath guide
- **Problem:** bathroom-waterproofing-guide missing materials index adjacency
- **Fix:** Link materials index; label any manufacturer links as not endorsements
- **Effort:** S

## 41. [P1] ADU hub
- **Problem:** adu.html shortlists omit Learn/hiring for conversion paths
- **Fix:** Add Learn hub + hiring-a-contractor + kitchen/bath dirs for conversion ADUs
- **Effort:** S

## 42. [P1] Edmonds hub
- **Problem:** edmonds.html vs edmonds-custom-homes cannibalization
- **Fix:** Differentiate ledes: project hub = permits/ADU/planning; directory = ranked builders; mutual see-also
- **Effort:** M

## 43. [P1] King County
- **Problem:** king-county.html thin on city vs unincorporated
- **Fix:** Deepen Accela + MyBuildingPermit + FAQ distinguishing Seattle/cities vs unincorporated
- **Effort:** S

## 44. [P1] Snohomish
- **Problem:** snohomish-county.html thin on PDS vs city paths
- **Fix:** Deepen + link Lynnwood/Mukilteo/Edmonds/Mill Creek hubs
- **Effort:** S

## 45. [P1] Trades hub
- **Problem:** trades.html weak learn/hiring adjacency
- **Fix:** Add related_learning_strip: verify, hire guides, permits, hiring posts
- **Effort:** S

## 46. [P1] Trade pages
- **Problem:** Individual trade pages lack planning/verify strips
- **Fix:** Add strip: verify, hire-questions, parent trades hub, materials for envelope trades
- **Effort:** M

## 47. [P1] Custom homes
- **Problem:** custom-homes vs Edmonds Top 30 SERP overlap
- **Fix:** Add clarifying see-also boxes reinforcing metro vs Edmonds-specific intent
- **Effort:** M

## 48. [P1] Commercial/Spec
- **Problem:** commercial/spec-homes lack educational adjacency
- **Fix:** Add permit hub + verify + how-we-rank related strips; no invented ROI
- **Effort:** S

## 49. [P1] Posts
- **Problem:** Post footers lack systematic hub CTAs
- **Fix:** In build_post_page ensure Learn + city hub (if tagged) + directory + verify strip
- **Effort:** M

## 50. [P1] Sitemap
- **Problem:** tools/energy-credit and tools/energy-credits both listed
- **Fix:** Canonicalize to one tools path; drop duplicate sitemap entry
- **Effort:** S

## 51. [P1] robots
- **Problem:** write.html noindex but still Allow:/ discoverable
- **Fix:** Add Disallow: /write.html in robots.txt
- **Effort:** S

## 52. [P1] IndexNow
- **Problem:** Content wave needs IndexNow ping
- **Fix:** Run generate_site.py --indexnow after push; verify key file live
- **Effort:** S

## 53. [P1] OG
- **Problem:** Hub og:image:alt often generic
- **Fix:** Pass topic-specific og_image_alt in city/learn/permits/adu builders
- **Effort:** S

## 54. [P1] Meta
- **Problem:** Neighborhood hub descriptions too similar
- **Fix:** Differentiate metas (e.g. SDCI vs eTRAKiT vs MyBuildingPermit)
- **Effort:** S

## 55. [P1] A11y
- **Problem:** FAQ/details focus visibility uneven
- **Fix:** Ensure faq_section controls have visible focus rings matching skip-link pattern
- **Effort:** S

## 56. [P1] A11y
- **Problem:** External official links lack new-window hint for AT
- **Fix:** Add visually hidden opens-in-new-window text on key outbounds
- **Effort:** S

## 57. [P1] Breadcrumbs
- **Problem:** City/pillar crumbs skip Learn parent
- **Fix:** Use About → Learn → Page breadcrumbs for learn-child hubs
- **Effort:** S

## 58. [P1] Homepage
- **Problem:** Cost literacy cards missing from homepage planning
- **Fix:** Add cost-factor card row (5 pages) with honesty line
- **Effort:** M

## 59. [P1] Calculator
- **Problem:** $25,000 base coordination fee reads like invented Board price
- **Fix:** Strengthen illustrative/not-a-bid labeling; avoid presenting as market price
- **Effort:** M

## 60. [P1] Widgets
- **Problem:** Review widgets on non-directory shells dilute independence
- **Fix:** Confirm include_widgets=False on all learn/city/tool hubs; dirs+home only
- **Effort:** S

## 61. [P1] Good Steward
- **Problem:** good-steward.html missing new pillars index
- **Fix:** Expand grid: hiring, verify, permits, ADU, cost factors
- **Effort:** M

## 62. [P1] Energy credit
- **Problem:** energy-credit.html thin
- **Fix:** Add official WA energy-code outbound if stable + FAQ; no credit $ inventions
- **Effort:** S

## 63. [P1] Tool landings
- **Problem:** site-visit/pm-dashboard landings thin around iframes
- **Fix:** Add educational lede + related learning + when-to-use FAQ
- **Effort:** M

## 64. [P1] Build walkthrough
- **Problem:** Stage 3/12 lack companion links
- **Fix:** Link permits hub + L&I + final-walkthrough from walkthrough page lede
- **Effort:** S

## 65. [P1] Another Story
- **Problem:** another-story missing second-story learning adjacency
- **Fix:** Related strip: second-story-vs-teardown, coastal, additions, Shoreline second-story post
- **Effort:** S

## 66. [P1] City posts
- **Problem:** Some hubs only 2 related posts
- **Fix:** Backfill with nearest topic posts or Learn pillars — no doorway duplicate posts
- **Effort:** M

## 67. [P1] Cost factors
- **Problem:** Cost-factor footers incomplete
- **Fix:** Each cost-factor page links matching directory + planning + permits + verify + learn
- **Effort:** S

## 68. [P1] Remodel cost parent
- **Problem:** remodel-cost-factors should parent category cost pages
- **Fix:** Child links grid + reinforce national Cost vs Value ≠ local quote
- **Effort:** S

## 69. [P1] Honesty scrub
- **Problem:** Grep soft $/month ranges across directory FAQs
- **Fix:** Replace invented numeric ranges with qualitative + written-estimate CTAs
- **Effort:** M

## 70. [P1] Nav label
- **Problem:** Primary Edmonds points at custom-homes directory, confuses vs Edmonds hub
- **Fix:** Relabel primary to Edmonds Top 30; keep Edmonds hub under More/Learn
- **Effort:** S

## 71. [P1] RSS
- **Problem:** RSS only in head alternate
- **Fix:** Visible RSS subscribe link on blog.html
- **Effort:** S

## 72. [P1] 404
- **Problem:** 404 helpful links thin
- **Fix:** Link Learn, additions/kitchen/bath, verify, contact
- **Effort:** S

## 73. [P1] Change orders
- **Problem:** change-orders related line omits contract-basics + financing
- **Fix:** Expand related links
- **Effort:** S

## 74. [P1] Windows trade
- **Problem:** windows trade page missing window-replacement post + coastal links
- **Fix:** Add related strip to latest windows post, coastal, materials
- **Effort:** S

## 75. [P1] AI scrub
- **Problem:** Ensure generated HTML stays free of AI/ChatGPT/Higgsfield/LLM strings
- **Fix:** Re-grep after regenerate; keep internal POSTING.md only
- **Effort:** S

## 76. [P1] Icons a11y
- **Problem:** Decorative Font Awesome icons may miss aria-hidden
- **Fix:** Audit hub CTAs/firm cards for aria-hidden=true
- **Effort:** S

## 77. [P1] sameAs
- **Problem:** Organization sameAs only GitHub
- **Fix:** Do not invent social profiles; expand only if Board-controlled accounts confirmed
- **Effort:** S

## 78. [P1] Lynnwood permits
- **Problem:** Lynnwood hub may need official building-department deep link
- **Fix:** Add stable City of Lynnwood building/permit page if URL verified
- **Effort:** S

## 79. [P1] Soft 404
- **Problem:** Extensionless GH Pages paths soft-dupe .html
- **Fix:** Keep internal links as .html; document GH Pages behavior — no fake redirects
- **Effort:** S

## 80. [P1] Editorial
- **Problem:** Astra Extra High: repetitive mission ledes on thin hubs
- **Fix:** Shorten hub ledes to first-sentence utility; cut twin disclaimers
- **Effort:** M

## 81. [P1] How we rank
- **Problem:** how-we-rank.html should deep-link Learn + verify + hiring cluster
- **Fix:** Add related_learning_strip and L&I Hire Smart outbound for methodology adjacency
- **Effort:** S

## 82. [P1] Permit FAQ
- **Problem:** permits.html FAQ could add inspection-before-cover habit
- **Fix:** Add FAQ on not covering work before inspection + link verify/hiring
- **Effort:** S

## 83. [P1] Footer a11y
- **Problem:** Footer link farm still large even when regrouped
- **Fix:** Add landmark aria-label on footer nav groups; keep lists under ~15 links each
- **Effort:** S

## 84. [P1] Primary nav count
- **Problem:** After adding Learn, primary may wrap on mid widths
- **Fix:** Keep ≤8 primary slots; Spec/Commercial remain in More; test 1024px
- **Effort:** S

## 85. [P1] Steward CTA
- **Problem:** steward_cta_strip may omit Learn hub
- **Fix:** Ensure Good Steward CTA strip links Learn + verify + permits
- **Effort:** S

## 86. [P2] CWV
- **Problem:** Tailwind CDN still render-blocking long-term debt
- **Fix:** Self-host purged Tailwind from class inventory; remove CDN — high visual-reg risk
- **Effort:** L

## 87. [P2] Search
- **Problem:** No on-site search; SearchAction correctly omitted
- **Fix:** Add search only when real index exists — never fake SearchAction
- **Effort:** L

## 88. [P2] ADU directory
- **Problem:** No ADU-only ranking page
- **Fix:** Optional future shortlist; for now additions/custom hubs + honesty note
- **Effort:** L

## 89. [P2] Cities
- **Problem:** Everett/Bellevue/Redmond hubs absent
- **Fix:** Add only with posts + official permit links — avoid thin doorway pages
- **Effort:** L

## 90. [P2] Print CSS
- **Problem:** Checklists not print-optimized
- **Fix:** Add @media print styles for adu-checklist / hire-questions
- **Effort:** M

## 91. [P2] Calculator UX
- **Problem:** Sqft×finish calculator still bid-like
- **Fix:** Replace with factor-only wizard in a later wave
- **Effort:** L

## 92. [P2] Bid tool
- **Problem:** bid-comparison is static
- **Fix:** Optional localStorage interactive tool later
- **Effort:** L

## 93. [P2] Images
- **Problem:** OG/apple-touch quality debt
- **Fix:** Recompress heroes; consistent width/height attributes
- **Effort:** M

## 94. [P2] Content ops
- **Problem:** New geo posts can orphan from hubs
- **Fix:** Process: every post updates matching city hub related_posts
- **Effort:** M

## 95. [P2] PPG lock
- **Problem:** Never edit pacificprogroup.com
- **Fix:** Hard lock — Board outbound hire link only
- **Effort:** S

## 96. [P2] Map
- **Problem:** No service-area map
- **Fix:** Optional static SVG later — avoid tracking map embeds
- **Effort:** M

## 97. [P2] PWA
- **Problem:** No manifest/service worker
- **Fix:** Skip unless product requests
- **Effort:** L

## 98. [P2] i18n
- **Problem:** Single locale only
- **Fix:** No hreflang until real translations
- **Effort:** S

## 99. [P2] Analytics
- **Problem:** No first-party analytics
- **Fix:** Add only if Alex requests privacy-preserving analytics
- **Effort:** S

## 100. [P2] IndexNow multi
- **Problem:** Single IndexNow endpoint
- **Fix:** Optional multi-engine endpoints later
- **Effort:** S

---

## Astra Extra High style notes

Editorial polish bar for this pass (applied where shipped):

1. **First sentence = utility.** Open hubs with what the reader should do next (verify, open portal, shortlist), not mission restatement.
2. **Cut twin paragraphs.** Mission / How the Board works / disclaimer should not triple-say the honesty lock.
3. **Official > ornamental.** When L&I or an AHJ publishes the rule, link it; Board prose is the bridge.
4. **Cross-link like a steward.** Every thin page earns Learn ↔ directory ↔ post ↔ tool links before more adjectives.
5. **Specific nouns.** Prefer MyBuildingPermit, SDCI Services Portal, eTRAKiT, ECDC 16.20.050 over 'local codes'.
6. **Honesty cadence.** Qualitative cost drivers + obtain written estimates — never soft dollar/month ranges as Board facts.
7. **Board ≠ builder.** PPG appears as ranked #1 outbound only; chrome stays Board-branded.
8. **FAQ answers must be quotable.** Short complete sentences that survive snippets without inventing numbers.
9. **Trim chrome noise.** One public contact path; denser footer IA; fewer repeated strips.
10. **Dark UI contrast.** Secondary green links on slate; visible focus states (skip-link is the model).

---

## DONE / SKIPPED

_(Filled after implementation pass.)_
