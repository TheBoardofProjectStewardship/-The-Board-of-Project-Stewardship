# Board of Project Stewardship Editorial + SEO Audit

Date: 2026-09-20

Scope: boardofprojectstewardship.com only. This audit keeps the Board voice independent, preserves Pacific Pro Group as Board directory #1 hire only, avoids invented prices / ROI / licenses, and prioritizes deeper educational copy, denser internal links, official WA/city outbound links, FAQ honesty, schema, and information architecture.

## 50 concrete fixes

1. **Implemented in this PR:** Replace the sitewide pricing / partner widget with a Board-only next-steps module that pushes readers toward verification, permit, bid-comparison, and learn resources instead of invented price math.
2. **Implemented in this PR:** Remove the sitewide lead-gen tone and replace it with neutral Board guidance that reinforces the site as an editorial publisher, not a contractor dispatch layer.
3. **Implemented in this PR:** Add visible breadcrumb navigation on non-post pages so users and crawlers can see hierarchy without relying only on JSON-LD.
4. **Implemented in this PR:** Add a page-level `WebPage` schema object to every generated page so page intent is not inferred only from `ItemList`, `FAQPage`, or `Article`.
5. **Implemented in this PR:** Expand the “How we rank” block with explicit next actions: read methodology, verify at WA L&I, confirm permit jurisdiction, then compare written scopes.
6. **Implemented in this PR:** Add a “How to use this additions directory” section so the page teaches dry-in planning, permit ownership, exclusions, and staging before homeowners request bids.
7. **Implemented in this PR:** Rewrite the additions cost FAQ so it stops implying pseudo-price ranges and instead points readers to cost drivers and written local bids.
8. **Implemented in this PR:** Add official Edmonds / MyBuildingPermit / WA links directly on the additions page so the ranking page has state and city authority links, not just internal advice.
9. **Implemented in this PR:** Add a “How to use this kitchen or bathroom directory” section that teaches allowance matching, inspection responsibility, and waterproofing / layout diligence.
10. **Implemented in this PR:** Add official Edmonds / MyBuildingPermit / WA outbound links to the kitchen and bathroom directory templates.
11. **Implemented in this PR:** Add a “How to use this custom-home directory” section so the page teaches parcel authority, site constraints, and permit-package ownership before interviews.
12. **Implemented in this PR:** Add a “How to use the Edmonds Top 30” section to the Edmonds custom page so the filterable ranking is surrounded by real homeowner process guidance.
13. **Implemented in this PR:** Replace the Edmonds custom permit panel’s PPG process-PDF CTA with official permit-path links such as MyBuildingPermit and Edmonds permit assistance.
14. **Implemented in this PR:** Add a “How to use this commercial directory” section focused on occupancy, TI scope boundaries, permit responsibility, and comparable written scope.
15. **Implemented in this PR:** Add a “How to use this spec-homes directory” section so shoppers understand the difference between production inventory, hybrids, and owner-custom work.
16. **Implemented in this PR:** Add a “How to use this trade directory” section so direct-hire specialty pages teach permit ownership, GC-vs-direct comparisons, and legal-name verification.
17. **Implemented in this PR:** Add a “Next steps for homeowners” section to every city and county hub, linking users into verification, bid-comparison, permit, and learn resources.
18. **Implemented in this PR:** Add a city-hub FAQ answer that clearly states the Board does not publish city-specific price bands, fee invoices, or ROI claims.
19. **Implemented in this PR:** Expand the permit hub with more official city permit portals so it better covers Lynnwood, Mukilteo, Kirkland, Bothell, Mountlake Terrace, Lake Forest Park, and Mill Creek.
20. **Implemented in this PR:** Add end-of-post panels to every article that pair official jurisdiction links with Board directories / planning pages / verification tools.
21. Add a “Start here” triage module to the homepage that routes homeowners by project type: kitchen, bath, addition, ADU, custom, trades, or permit question.
22. Add a parallel “Official sources the Board keeps pointing to” module on the homepage so state and city links are one click away from the front door.
23. Update the permit-hub meta description to reflect the broadened jurisdiction coverage rather than naming only Edmonds, Seattle, King County, Snohomish County, and Shoreline.
24. Add visible cross-links from every ranking page to its matching cost-factor page near the top, not only in lower related-learning strips.
25. Add a short “who this page is for / who it is not for” paragraph on the commercial directory to reduce mismatch between light-commercial remodel users and full commercial GC searches.
26. Add the same “who this page is for / not for” framing to the spec-homes page so buyers do not confuse production inventory pages with owner-custom planning pages.
27. Add “last researched / reviewed” text in a more prominent visible location on every high-value directory page, not only implied by a year in hero copy.
28. Add a data-freshness FAQ answer to every major directory explaining that licensing, staffing, and permit appetite can change after publication.
29. Add an honesty FAQ answer to every ranking page clarifying what the Board cannot know from public research: final price, final schedule, crew assignment, or live backlog.
30. Add stronger official code / ordinance links to the Edmonds custom page, including direct code or permit-assistance references alongside the permit guide.
31. Add Seattle-fee source links inside Seattle neighborhood hubs, not just broad SDCI links, for queries that specifically imply permit cost context.
32. Add internal links from each cost-factor page back to the matching directory and planning page near the top, so readers can move from “drivers” to “who to interview.”
33. Run a FAQ honesty sweep on timeline-oriented pages so every duration is labeled as “often,” “orientation,” or “AHJ-dependent,” never as expectation.
34. Run a citation sweep on review-count mentions so every visible aggregate reference includes source type and research-pass timing in nearby copy.
35. Add “compare allowance lists” reminders anywhere the site tells readers to compare bids, not only on bid-comparison and kitchen-planning pages.
36. Add “who owns permits and inspections?” reminders anywhere the site discusses kitchens, baths, additions, ADUs, or commercial tenant improvements.
37. Add “occupied-home staging / temporary living plan” reminders to more pages that target live-in-place remodel searches.
38. Add stronger internal links from city hubs to the most relevant planning page for that city’s dominant post topics, not only to directories and permit hubs.
39. Add a “related city hubs” cluster on the county pages so neighborhood hubs do not remain mostly discoverable through footer or nav only.
40. Add a compact “official WA homeowner resources” box to Good Steward pages so the tools sit closer to L&I, hiring guidance, and permit orientation.
41. Add `CollectionPage` schema explicitly to major directory pages so list pages have a page-type object alongside `ItemList`.
42. Add `AboutPage` schema to the homepage and a more specific page-type strategy (`CollectionPage`, `AboutPage`, `Article`) instead of using a generic `WebPage` everywhere.
43. Add a section-level jump nav or table of contents to long pages such as Learn, Permit Hub, and Edmonds Top 30.
44. Add a visible “related posts” module at the bottom of directory pages to circulate blog equity back into ranking and planning pages.
45. Add contextual links inside blog body copy where the phrasing naturally matches a Board page, rather than relying only on end-of-article resource panels.
46. Add official outbound links to more educational guide pages when they reference a specific permit path, state requirement, or city handout.
47. Add a stronger IA bridge between county hubs and the neighborhood pages they summarize, including clearer “start in county / then drill to city” copy.
48. Add an editorial “decision tree” page that helps users choose between addition, second story, ADU, teardown, kitchen, bath, custom, or direct-trade paths.
49. Add a plain-language glossary callout near permit-heavy guides so first-time homeowners can decode AHJ, TI, CO, allowance, dry-in, and punch-list language faster.
50. Add a persistent “before you request bids” checklist page to the primary IA and cross-link it from every ranking page, city hub, and planning hub.
