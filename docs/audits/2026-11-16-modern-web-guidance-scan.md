# Modern Web Guidance legacy scan — 2026-11-16

Read-only audit of the Board of Project Stewardship site (`boardofprojectstewardship.com`). No templates, published posts, site scripts, or deploy config were changed.

The scanner is [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) 1.0.1 (Apache-2.0). It looks for legacy web-platform patterns. It does not grade performance, accessibility, or on-page SEO.

## Command and version

```text
npx --yes modern-web-guidance@latest --version
# 1.0.1

npx --yes modern-web-guidance@latest legacy-scan .
npx --yes modern-web-guidance@latest legacy-scan . --json
```

`npx --yes` is the non-interactive form of the requested `npx modern-web-guidance@latest legacy-scan .`. The CLI matches that command (`legacy-scan [path]`, default path `.`). `--json` was a second pass of the same scan so counts and line numbers could be checked; the text run and the JSON run both report 38 findings. Guides for the non-JS hits were read with:

```text
npx --yes modern-web-guidance@latest retrieve customize-scrollbar-color-and-thickness,dynamic-sibling-animations,ime-safe-enter-submit,secure-external-subresources
```

The JavaScript hits live under one guide id, `js`. `retrieve js/abort-signal-timeout` (and the other `js/…` rule ids) returns "No guide found"; the write-up for those rules is the `js` guide, which does not print a Baseline badge. Baseline for those APIs is taken from the [Web features explorer](https://web-platform-dx.github.io/web-features-explorer/all/) as fetched on 2026-11-16, and from MDN for `replaceChildren()`.

## Raw summary counts

Scanner header, verbatim:

> Modern Web Guidance Analyzer — .
> Found 38 modernization opportunities across 5 guides (scanned 38 guides with deterministic rules; ~20% of the guidance corpus):
> Note: Static analysis results are provisional — verify against the Keep/Drop criteria below.
> Skipped 10 docs and test files (pass --include-docs-and-tests to scan).

JSON totals: `totalFindings` 38, `activeGuideCount` 38, `activeRuleCount` 52, `skippedDocsAndTestsCount` 10. The note on the JSON result: checked 38 guides (52 deterministic rules; about 20% of the guidance corpus). A clean result here does not mean the rest of the catalog was applied.

| Guide | Rule | Count |
| --- | --- | --- |
| `secure-external-subresources` | `secure-external-subresources` | 1 |
| `ime-safe-enter-submit` | `ime-safe-enter-submit` | 2 |
| `js` | `js/replace-children-innerhtml` | 13 |
| `js` | `js/copying-array-methods` | 8 |
| `customize-scrollbar-color-and-thickness` | `customize-scrollbar-color-and-thickness` | 6 |
| `js` | `js/abort-signal-timeout` | 4 |
| `js` | `js/structured-clone` | 2 |
| `js` | `js/object-group-by` | 1 |
| `dynamic-sibling-animations` | `dynamic-sibling-animations` | 1 |
| **Total** | | **38** |

City pages, trade directories, and `posts/` produced no findings. Every hit is in an interactive tool or a shared script (`assets/js/`, `tools/`, `blog.js`, `search.html`).

Effort in the table below: **S** is a local call or attribute change, **M** needs a fallback or an error-name audit, **L** would be a cross-cutting rewrite. Nothing in this scan is L.

## Top 15 findings, by impact

Impact here means harm in the code as it runs today (security, input correctness, then latent parser / Trusted Types exposure on pages a visitor actually uses). Cosmetic modernizations are listed after the table. Line numbers are from the 1.0.1 scan.

| # | File | Pattern | Modern replacement | Baseline | Effort | Layout / SEO risk |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `tools/energy-credit/index.html:39` | Version-pinned `cdnjs` module script for pdf.js 4.4.168, no `integrity` | `integrity="sha384-…"`, `crossorigin="anonymous"`, `referrerpolicy="no-referrer"` | Subresource Integrity on `<script>` / `<link>` is **Widely available** (Baseline high date 2020-10-30). CSS `url()` `integrity()` is a different feature and is **Limited availability**; this hit is an HTML script, so the widely available path applies. | S | Layout: none. SEO: none (`noindex` tool page). A wrong hash stops the PDF worker from loading, which is a tool outage, not a layout or ranking change. The Google tag on line 8 is unversioned, so the scanner correctly left it alone. |
| 2 | `assets/js/floor-plan-3d.js:359` | `keydown` on a text input treats Enter as "save label and remove the field" with `preventDefault`, and does not check composition | Skip the handler while `event.isComposing` or `event.keyCode === 229` | `KeyboardEvent.isComposing` is **Limited availability** (Chrome 56, Edge 79, Firefox 31; the guide says unsupported in Safari). The `keyCode === 229` check is the cross-browser half of the guide's fallback. | S | Layout: none. SEO: none. Confirming a CJK composition with Enter currently saves and destroys the field mid-composition. |
| 3 | `assets/js/plan-walkthrough.js:2071` | Window `keydown`: Enter while focus is `#pw-room` calls `blur()` with no composition check | Same guard, before `blur()` | Same as row 2 | S | Layout: none. SEO: none. The listener is on `window`, which the scanner's drop notes treat cautiously for global hotkeys. This branch still targets one text field, so the IME bug is real; other keys in that listener (undo, Escape, wall-commit) should stay as they are. |
| 4 | `assets/js/floor-plan-3d.js:212` | `svg.innerHTML = ''` clears the plan SVG through the HTML parser | `svg.replaceChildren()` | `Element.replaceChildren()` is **Widely available** (MDN: across browsers since October 2020) | S | Layout: none if called with no arguments (same clear). SEO: none. Do not pass markup strings to `replaceChildren`; it will not parse them. |
| 5 | `assets/js/floor-plan-3d.js:546` | `fp-iso` (the non-WebGL axonometric fallback) is cleared with `innerHTML = ''` before it is redrawn | `box.replaceChildren()` | Widely available, as above | S | Layout: low. This is the picture visitors get when WebGL is missing, but an empty `replaceChildren()` draws the same blank slate the redraw already expects. SEO: none. |
| 6 | `assets/js/visualizer.js:620` | `#see-step-errors` is emptied with `innerHTML = ''`, then rebuilt with `createElement` | `box.replaceChildren()` and keep the DOM build that follows | Widely available | S | Layout: none. SEO: none. This is visitor-facing validation copy on the visualizer. |
| 7 | `assets/js/plan-walkthrough.js:1191` | PDF thumbnail strip cleared with `innerHTML = ''`, then filled with canvas buttons | `box.replaceChildren()` | Widely available | S | Layout: none. SEO: none. |
| 8 | `assets/js/plan-walkthrough.js:310` | Storey tabs cleared with `innerHTML = ''`, then rebuilt | `tabs.replaceChildren()` | Widely available | S | Layout: none. SEO: none. |
| 9 | `blog.js:124` | Empty blog-filter result does `elGrid.innerHTML = ''` | `elGrid.replaceChildren()` on that branch only | Widely available | S | Layout: none. SEO: low, and only if someone also rewrites line 129. That line assigns real card markup with `innerHTML` and must stay a parser assignment (or move to DOM APIs on purpose). Crawlers still see the static index in the HTML. |
| 10 | `search.html:231` | Empty query clears `#search-results` with `innerHTML = ''` | `list.replaceChildren()` on that branch only | Widely available | S | Layout: none. SEO: none for the clear itself. Line 235 assigns escaped result markup and is out of scope for this rule. |
| 11 | `assets/js/floor-plan-3d.js:66` | `clone` is `JSON.parse(JSON.stringify(o))` for plan state | `structuredClone(o)` when the value is plain data | `structuredClone()` is **Widely available** (since 2024-09-14; Chrome 98, Firefox 94, Safari 15.4) | S | Layout: none. SEO: none. JSON cloning drops `undefined`, turns `Date` into strings, and breaks cycles. These plans are plain numbers and strings today, so the current bug is latent. `structuredClone` throws `DataCloneError` on functions and DOM nodes; don't point it at a live element. |
| 12 | `assets/js/plan-walkthrough.js:76` | Same JSON deep-copy helper for the walkthrough project | `structuredClone(obj)` under the same constraint | Widely available, as above | S | Same as row 11. Undo history that relied on JSON to strip `undefined` would start keeping those keys. |
| 13 | `tools/site-visit/parcel-lookup.js:13` | `AbortController` plus `setTimeout(() => ctl.abort(), ms)` around county GIS `fetch` | `AbortSignal.timeout(ms)` on that `fetch` | **Newly available** since 2024-04-18 (Web features explorer: Chrome 124, Firefox 100, Safari 16). Not Widely available yet. | M | Layout: none. SEO: none. The rejection name changes from `AbortError` to `TimeoutError`. This file surfaces `e.message`, so the words a visitor sees can change even though the lookup still fails the same way. |
| 14 | `assets/js/build-here.js:206` | Same timeout scaffold on the Census geocode relay | `AbortSignal.timeout(TIMEOUT)`, and handle `TimeoutError` anywhere the caller currently assumes `AbortError` | Newly available, as above | M | Layout: none. SEO: none. The catch already falls through to JSONP unless the message is "census nomatch" or "too many", so a timeout still falls back. There is a second, unflagged scaffold at line 356 whose error path *does* branch on `e.name === "AbortError"` to explain a slow assessor file. Switching that one without updating the branch would report a timeout as a generic load failure. |
| 15 | `assets/js/build-here-landscape.js:70` | `getOnce` uses the same AbortController timeout for map layers | Same replacement, file-wide, not one call site at a time | Newly available, as above | M | Layout: none. SEO: none. Line 164 (Overpass retry, its own controller, not flagged) maps `e.name === "AbortError"` to the word "timeout". A partial migration in this file would retry with the raw error text instead. `assets/js/build-here.js:97` is the fourth flagged scaffold (shared `getJSON`) and has the same `TimeoutError` caveat. |

The other eight `innerHTML = ''` hits are the same rule as rows 4–10 and are lower stakes because they sit in noindex tools: `assets/js/build-here.js:1742`, `tools/energy-credit/index.html` lines 255, 269, 282, and 552, and `tools/site-visit/parcel-ui.js:32`. Same replacement, same Baseline, effort S, no layout or SEO change.

## Below the cut

These are real scanner hits. They are not bugs a visitor hits today.

**Copying array methods (8).** `slice().sort` / `[...arr].sort` in `assets/js/build-here.js:565`, `build-here-landscape.js:361`, `house-model.js:430`, `house-model-magnolia.js` (84, 122), `scroll-house.js:55`, and `scroll-house-magnolia.js` (97, 135). Replacement is `toSorted()`. **Widely available** since 2026-01-04 (Chrome 110, Firefox 115, Safari 16). Effort S. Layout and SEO: none. These arrays are dense lists of numbers or plain objects, which is the safe case. Not a quick win: the copy-then-sort already avoids mutating the source.

**Scrollbars (6).** `textarea::-webkit-scrollbar` width and thumb color in `tools/pm-dashboard/index.html` (54, 56, 57) and `tools/site-visit/index.html` (60, 62, 63). Add `scrollbar-color` and `scrollbar-width` on the textarea, and keep the WebKit rules inside `@supports not (scrollbar-color: auto)`. `scrollbar-width` is **Newly available** since 2024-12-11 (Safari 18.2). `scrollbar-color` is **Newly available** since 2025-12-12 (Safari 26.2). Effort S if the fallback stays. Layout: none (thumb paint only). SEO: none. Firefox currently ignores the vendor rules, so the standard properties are polish on two internal tools, not a fix for public pages.

**`Object.groupBy` (1).** `assets/js/build-here-measures.js:166` groups measure rows with an object accumulator. Replacement is `Object.groupBy(list, (m) => m.kind)`. **Newly available** since 2024-03-05 (Chrome 117, Firefox 119, Safari 17.4). Effort S at this call site: the code uses `Object.keys`, not `hasOwnProperty`. The new object has a null prototype, which would throw if a later edit called `groups.hasOwnProperty`. Layout and SEO: none.

**`sibling-index()` (1).** `assets/css/build-here.css:174` is the first of four stagger delays, `nth-child(2)` through `nth-child(5)`, under `prefers-reduced-motion: no-preference`. Replacement is one rule, `animation-delay: calc(sibling-index() * 0.04s)`, gated with `@supports (animation-delay: calc(sibling-index() * 0.1s))`. **Newly available** since 2026-08-18 (Chrome 138, Edge 138, Firefox 154, Safari 26.2). Effort M. Layout: the stagger is 6px and fades; a naive swap can compute the delay as `0s` on browsers that accept the declaration while parsing and then drop it (the guide's explicit warning). SEO: none. Leave this until the fallback is written with it. The reduced-motion guard already on the block should stay.

## Three quick wins

1. **Pin pdf.js with Subresource Integrity.** On `tools/energy-credit/index.html:39`, hash the known 4.4.168 bytes and add `integrity`, `crossorigin="anonymous"`, and `referrerpolicy="no-referrer"`. One tag, Widely available, no visual change. Confirm cdnjs sends `Access-Control-Allow-Origin: *` for that URL before shipping, or the browser will block the script.

2. **Guard both Enter handlers for IME.** In `floor-plan-3d.js` and the `#pw-room` branch of `plan-walkthrough.js`, return early when `event.isComposing || event.keyCode === 229`. Two conditions, no layout change. `isComposing` alone misses Safari; the guide treats `229` as the check that covers composition there.

3. **Clear nodes with `replaceChildren()`.** Swap the standalone `innerHTML = ''` assignments (rows 4–10, plus the six tool-only leftovers) for `replaceChildren()`. Widely available since 2020, and it matches what the visualizer and thumbnail code already do on the next line (build real nodes). Leave every `innerHTML = someHtml` assignment alone, especially `blog.js:129` and `search.html:235`.

Do not spend the same pass on `AbortSignal.timeout` (error name becomes `TimeoutError`, and this repo already branches on `AbortError`), on `sibling-index()` (Baseline since August 2026, fallback required), or on `toSorted` / scrollbar colors (harmless, and not visitor-facing bugs).

## Scope limits

- Deterministic rules only, about a fifth of the Modern Web Guidance catalog. The scanner's own next step for everything else is `npx modern-web-guidance search <topic>`.
- Ten docs and test files were skipped. This run did not pass `--include-docs-and-tests`.
- Hits were checked against the published keep/drop notes. The IME window-level listener and the AbortSignal sites are marked M for that reason. The other rows matched the keep notes.
- No deploy, no publish, no merge.
