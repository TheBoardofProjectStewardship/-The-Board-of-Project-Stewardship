# Build Here visual directions

Reviewed 2026-11-09 for Alex before merge. This note records what was actually seen on the reference sites, the rules used here, and three layout directions. Direction A is the one in the tool.

## What the reference review actually saw

The public page at feasydoesit.com is a landing: full-bleed Seattle aerial imagery credited to King County, USDA, and USGS, thin white parcel-style polygon outlines, a dark green fade, one centered address control, and the promise "See what you can build". A short verification disclaimer and secondary links for zoning and how it works sit with that landing.

The logged-out Instagram grid was not readable. No property-results screen, no mobile results example, and no print or download flow was observed. This study does not copy a Feasy results layout, and it does not claim Feasy's calculations. Feasy names, colors as a brand system, and code are not used.

The address control on this site stays the Board form. The reference cues show up on the first result after that address is entered.

## Design rules

1. The first result after a matched address is a property stage: this lot's aerial when a public image was returned, otherwise the parcel diagram or a plain no-photo state. A thin white line traces the parcel when the aerial exists. A dark green fade carries the address, the date, and the planning-estimate disclaimer.
2. Five paths sit under that stage before the technical pages: addition, ADU, garage or shop, teardown, and remodel. Each card is Ready, Partial, or No data yet. The words carry the state. Color is extra.
3. A card states a square-foot figure only when that figure comes from a coded rule and a measurement on this lot. Otherwise it says what is missing. Zoning that is not coded is not treated as a permit answer.
4. Roof outline, finished living area, gross floor area, first-floor area, attached garage floor area, and detached footprints stay in separate rows. They are not added together.
5. Unknown driveway, garage, and hardscape stay blank. They are not stored as zero. Lot area minus a roof outline is labeled unclassified open area, not landscaping, until paving is actually classified.
6. Every stored number keeps a source name, source page when there is one, the date it was read, the method, and a confidence. If two readings of the same measure disagree, both stay visible.
7. Motion is a short rise on the cards, about a third of a second, and it is off when the visitor asks for reduced motion.
8. Phone layout stacks the cards and the measurement rows. Print and the downloaded file use the printer's paper (Letter or A4), break after each study page, and omit buttons, video, and map iframes. The site-plan diagram remains as the map fallback.
9. The Board palette stays: charcoal page, green #166534 and #4ade80, paper #fbfaf7 for the study sheets. No second brand.

## Direction A, in the tool

Property stage on top, five comparison cards under it, technical study after that (facts, code, zoning, site plan, landscape, massing, records, sources). Edit-the-facts sits under the study so a correction updates the cards.

Why this one: it uses aerial and parcel data the tool already fetches, it keeps partial and empty states readable on a phone, and it does not hide the working calculations. The Feasy landing cues (photo, white line, green fade, one promise) are limited to that first stage.

## Direction B, not shipped

Desktop split: parcel aerial on the left, a single selected path on the right, with the other four paths as a text list. Stronger for a long comparison on a wide screen. Weaker on a phone, where the list drops below the fold, and it makes one path look chosen before the visitor has compared them. Kept as a review option only.

## Direction C, not shipped

Chips floating on the aerial, with no separate card text. Closest to a map-only landing. Rejected for the tool because partial facts, confidence, and disagreements need sentences, and the reference review did not show a results screen to match. The technical study would still have to follow. Not built.

## Deferred

Automated Redfin or Zillow reads are not implemented. No supported public endpoint was verified, and the study does not scrape those sites. A visitor can type a listing figure and it is labeled as their entry, with the page address and date they supply.

Google photorealistic 3D tiles stay off unless a key is already configured. No map-tile cap was changed.
