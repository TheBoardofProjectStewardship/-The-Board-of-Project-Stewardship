# Week 48 audit: stranger judge and internal links

Date: 2026-11-24. Site: Board of Project Stewardship (`boardofprojectstewardship.com` as published from this repo). Read-only. No page, asset, template, or config was edited.

Pages judged:

- Homepage: `index.html`
- Daily post: `posts/2026-11-24-detached-garage-marysville-wa.html` (dated the day of this audit)
- News story: `news/seattle-environmentally-critical-areas-update.html` (published Friday, October 16, 2026)
- Feasibility study: `feasibility-study.html`

Each page was read in source and rendered locally at 1440×900. Reference homepages were read the same day: [Dwell](https://www.dwell.com/), [This Old House](https://www.thisoldhouse.com/), and [Sweeten](https://www.sweeten.com/).

## Summary

- The first screen of the homepage is a real object (`section#scroll-house`), and it is the only one of the four pages that does not look assembled from a dark-grid kit. It still does not say what a stranger can do here. The visible title is "The house, taken apart." The only `h1` is `h1.sr-only`, below that screen. The first firm named is Pacific Pro Group, in `p.sh-project`.
- Every article wears the same closing machinery. All 112 blog posts and all 44 news pages include the headings "Directory · ranking method · L&I Verify", "Planning tools · Directory #1 · Service region", "Site visit and PM checklists", and "Another Story". The string "Live Feasibility & Estimate Calculator" is on 249 published HTML pages.
- Blog posts are one mold. All 112 open with `h2` "Key Takeaways" and the byline "By Board of Project Stewardship Editorial". 108 of 112 have `h2` "Materials Worth Knowing". 58 of 112 have `h2` "Where Pacific Pro Group fits".
- Internal links do not reach the articles. Of 156 blog and news HTML pages, 14 have a single referring page. Thirteen of those are linked only from `blog.html`. The septic-grant news story is linked only from `news.html`. `feasibility-study.html` has zero inbound anchors from any other published page.
- Twenty published HTML pages have zero inbound `<a href>` from another page. That count is the orphan count. Three of them are section fragments that some pages embed with `<iframe>` and never link. The feasibility study is a full page in that list.

## Stranger judge

References, from their public homepages on 2026-11-24:

- **Dwell** leads with specific houses and a named writer. The homepage text included "Who Needs Doors? Not This Two-Level Cabin in Slovakia" by Grace Bernard, a Budapest flat before-and-after, and a Joshua Tree prefab budget breakdown.
- **This Old House** leads with a job and people. Season 48, episode 8 names Kevin, homeowner Ethan, architect Dan Kopec, and Zack on a trim and tile sequence, and the page lists a cost guide ("Gutter Installation Cost").
- **Sweeten** leads with one offer and one path: "Your renovation, our expertise", then three steps (three contractors, competitive bids, renovate), then named households with the rooms they did (Chrissy & Matt, kitchen and laundry; Barbra, entire home).

A 10 would be as clear as Sweeten's first screen, as specific as a Dwell story, and as human as a This Old House segment. Scores below are for the whole page a stranger gets, not for the research inside the Marysville or Seattle copy.

| Page | Score (1–10) | What the first screen actually is |
| --- | ---: | --- |
| `index.html` | 5 | A drawn house with stage buttons. No offer, no visible `h1`. |
| `posts/2026-11-24-detached-garage-marysville-wa.html` | 4 | A keyword headline, an organizational byline, and "Key Takeaways" under a flawless gray garage. |
| `news/seattle-environmentally-critical-areas-update.html` | 5 | A serif headline and a dek, then the same "Key Takeaways" block and a hillside that could be any wet city. |
| `feasibility-study.html` | 4 | A contractor's name as the `h1`, two dense paragraphs, an address box, and a contact form before any result. |

### What looks generic, templated, or machine-made

Worst first. Counts are from the published HTML crawl described in Method notes.

1. **One closer pasted onto every story.** `section#tools` (`h2` "Planning tools · Directory #1 · Service region", `h3.feas-title` "Live Feasibility & Estimate Calculator", `#calc_total_display` defaulting to `$62,000` on `index.html` line 1085), `section#post-outro` / `section#news-outro`, `aside#good-steward-cta`, and `section#another-story-cta` are on all 112 posts and all 44 news pages. Dwell ends a story. This Old House ends a segment. These pages end by restarting the whole site.
2. **The blog is a form with the city swapped in.** `div.prose-board > h2` "Key Takeaways" is the first heading on 112 of 112 posts. The byline under `h1` is "By Board of Project Stewardship Editorial" on 112 of 112, with no person. "Materials Worth Knowing" is on 108 of 112 and, on the Marysville post, is a list of Clopay, Amarr, LiftMaster, and Rust-Oleum. "Where Pacific Pro Group fits" is on 58 of 112. The Marysville `h1` is a search string: "Detached Garage Marysville WA — Permits, Setbacks, Foundations, Power and Building It Right". The kicker is `div` "ADDITIONS · 2026-11-24". Captions on `figure` and `figure.post-figure` all start "Marysville, WA detached garage".
3. **The news pages share a wire template.** 43 of 44 news HTML files contain "Key Takeaways". The exception is `news/snohomish-health-septic-permit-grant.html`, which is also the news page with the fewest inbound links. 42 of 44 have both "History and background" and "What it means for homeowners". On the Seattle story, `#news-related` points at a King County permit panel, an Edmonds tree ordinance, a Mount Baker groundbreaking, and a Snohomish County lot-split vote. Those share a week, not a subject. `#news-sources a` uses the raw URL as the link text. `.news-byline` prints "By Board of Project Stewardship Editorial", then `span.news-dateline` "King County", then the date, with no separator, so the 1440px render reads as one gray run-on line.
4. **The whole site sits on one dark kit.** `body.bg-obsidian.bg-grid-pattern` is a black field with a faint graph-paper grid (`#0a0a0a` in `assets/css/site.css`). Type is Inter (`tailwind.config.js` does not set a display face; news headlines are Georgia). The accent is `#4ade80` (`secondary`) and the buttons are `#166534` (`primary`). `nav.site-nav-desktop` is eleven uppercase links at `text-xs` and `tracking-widest`: Home, Directories, Locations, Learn, Permits, Verify, How we rank, Blog, News, 3D Walkthrough, More. The More menu is a second site map. Font Awesome icons (`i.fas`) mark the charcoal cards. At 1440px the nav fits, and it still looks like a dashboard, not a magazine or a service.
5. **The homepage does not introduce itself.** At 1440×900 the first screen is `section#scroll-house`: kicker "Pacific Northwest · King & Snohomish · Seattle", `p#scroll-house-title` "The house, taken apart", and `p.sh-project` "Magnolia house, ADU and garage, built and permitted by Pacific Pro Group." The drawing and the House / Front / Roof / Main / ADU / Slab buttons are the part that does not look generated. Under them, `p.sh-learn-aside.sh-key` is a paragraph of small green-gray type (the 27 SF dining addition, furniture, cabinet doors) that does not read at that width. The real `h1` is `h1.sr-only` at line 830, after `#bh-home` and `#why-ppg-number-one`. Below the drawing the page stacks `section#why-ppg-number-one` (trophy icon, "Why Pacific Pro Group ranks #1", the same "4.9 · 190 reviews" text as a badge and again as a button), a wrap of uppercase pill links, three identical `bg-charcoal border rounded-xl` cards, seven more of them under "What a good steward does", then `section#mission`, `section#integrity-shield`, and `section#topic-carousel`, each an iframe with a fixed height and a rounded black frame. `section#home-hero.flashlight-hero.is-supporting` is a second hero, placed after the directories.
6. **The feasibility page is a lead form wearing a study.** The breadcrumb and `h1` say "Pacific Pro Group's Feasibility Study". The kicker is "Pacific Pro Group · Feasibility". Two paragraphs mention FinSize, FEMA, and USDA before `section.bh-card` "1. Find the lot". On the 1440px render, `#bh-lead-card` ("Want a second look?") is already on screen: name, email, phone, project. `#bh-report-wrap` and `#bh-confirm` are `hidden`, so a stranger never sees a sample sheet. No other published HTML file contains the string `feasibility-study`. The homepage tool links to `build-here.html` instead (`#bh-home` "Open the full tool page"). Ten published pages link to `build-here.html`. Zero link here.

### Three changes that would raise each score

**Homepage (`index.html`), from 5.**

1. Put a visible `h1` in `.sh-top` that states the offer in one sentence, and demote `p#scroll-house-title`. Move `p.sh-project` off the first screen. Sweeten's first line is the service. This first line is a project credit.
2. Delete `p.sh-learn-aside.sh-key` from the opening view, and delete the later duplicates: `section#mission`, `section#integrity-shield`, `section#topic-carousel`, and `section#home-hero`. One drawing is the page. Four framed embeds are a kit.
3. Replace the pill row under "Explore the Board's listings" (`a.uppercase.tracking-wider`) with three named project types and a photograph each, the way Sweeten lists Bathroom, Kitchen, and ADU and Dwell shows a specific house. Cut `nav.site-nav-desktop` to four items so the row is not a site map.

**Marysville garage post, from 4.**

1. Rewrite the `h1` as a sentence a person would say, and replace "By Board of Project Stewardship Editorial" with a name. Dwell's homepage byline is Grace Bernard. This Old House names the carpenter and the homeowner.
2. Remove the first `h2` "Key Takeaways", the `h2` "Materials Worth Knowing" product list, and the `h2` "Where Pacific Pro Group fits". The MMC 22C.180 setback paragraph is the story. The product list and the ranking paragraph are the mold (108 and 58 posts).
3. Keep two figures that show a decision (the site-plan table, the slab forms) and write captions that name a number from the article, such as the 120-square-foot exemption or the 5-foot side setback. Drop `section#tools` and `section#another-story-cta` from the article footer.

**Seattle critical-areas story, from 5.**

1. Delete `h2` "Key Takeaways". The `p.news-dek` already says there are four sessions from October 22–29. Open the body on who those sessions are for (a steep-slope owner), the way This Old House opens on a room and a person.
2. Replace `#news-related` with Seattle code stories already on the site: `news/seattle-nr-cleanup-setback-options.html`, `news/seattle-treesub-early-tree-coaching.html`, and `news/seattle-nr-eca-lot-area-density.html`. The current four are date neighbors.
3. Give each `#news-sources a` the document's title instead of the URL, put a middot in `.news-byline` between the desk and the dateline, and delete the Pacific Pro Group sentence at the end of "What it means for homeowners". A code calendar is not a directory ad.

**Feasibility study (`feasibility-study.html`), from 4.**

1. Title the page as the Board of Project Stewardship lot study. The `h1`, the breadcrumb, and the kicker currently name a contractor before they name the tool. Link the page from `nav.site-nav-desktop` and from `#bh-home` on `index.html`. Today it is an orphan.
2. Show one finished sheet (the SP-1 / F-1 the intro promises) above `section.bh-card`. `#bh-report-wrap` stays `hidden` until a lookup, so the first visit is an empty form. Sweeten shows a finished kitchen before it asks for anything.
3. Hide `#bh-lead-card` until a report exists, and remove `section#another-story-cta` from this page. On the 1440px render the contact form (name, email, phone) sits directly under "Look it up".

## Internal link stats

Corpus: 366 published HTML pages, all parsed. Zero files failed to parse. Three HTML files were left out because Jekyll would not publish them: `pages/stamp-of-trust.html` (the `pages` exclude prefix), `wordpress/src/widget.html`, and `wordpress/tests/theme-page.html`.

An inbound link is another published HTML page with at least one `<a href>` that resolves to this page. A second raw count includes repeated anchors on the same page (the desktop nav and the mobile nav both count). Self-links do not count. `<iframe src>` does not count; it is noted on orphans where it exists.

| | |
| --- | ---: |
| Published HTML pages parsed | 366 |
| Blog posts (`posts/*.html`) | 112 |
| News stories (`news/*.html`) | 44 |
| Orphans (0 inbound pages) | 20 |
| Blog/news pages with exactly 1 inbound page | 14 |
| Unique inbound, all pages, minimum / median / maximum | 0 / 5 / 350 |
| Unresolved internal `<a href>` targets | 2 targets, 2 anchors |

Blog and news inbound histogram (unique referring pages → how many stories):

| Unique inbound | Stories |
| ---: | ---: |
| 1 | 14 |
| 2 | 21 |
| 3 | 24 |
| 4 | 19 |
| 5 | 33 |
| 6 | 15 |
| 7 | 5 |
| 8 | 1 |
| 9 | 2 |
| 10 | 3 |
| 11 | 3 |
| 14 | 1 |
| 16 | 3 |
| 17 | 5 |
| 18 | 1 |
| 19 | 2 |
| 37 | 1 |
| 49 | 1 |
| 53 | 2 |

The most-linked pages are chrome. `/` has 350 unique inbound pages (1,781 raw anchors). `/learn/` has 346. `/stamp-of-trust/` has 346. Individual stories never get that treatment: the busiest blog/news URLs in the histogram top out at 53 referring pages, and the bottom 14 have one.

### Orphans (20)

| URL | File | Also embedded by iframe from |
| --- | --- | --- |
| `/404.html` | `404.html` | — |
| `/build-here-3d.html` | `build-here-3d.html` | — |
| `/directories.html` | `directories.html` | — |
| `/embed/magnolia-house.html` | `embed/magnolia-house.html` | — |
| `/energy-credits/` | `energy-credits/index.html` | — |
| `/feasibility-study.html` | `feasibility-study.html` | — |
| `/pm-dashboard/` | `pm-dashboard/index.html` | — |
| `/projects/magnolia-house-adu-garage/embed.html` | `projects/magnolia-house-adu-garage/embed.html` | — |
| `/search.html` | `search.html` | — |
| `/sections/circular-directory.html` | `sections/circular-directory.html` | `index.html`, `directory.html`, `edmonds.html` |
| `/sections/integrity-shield-showcase.html` | `sections/integrity-shield-showcase.html` | `index.html`, `about.html`, `how-we-rank.html` |
| `/sections/mesh-flow-backdrop.html` | `sections/mesh-flow-backdrop.html` | `index.html`, `about.html` |
| `/sections/scroll-house.html` | `sections/scroll-house.html` | — |
| `/site-visit/` | `site-visit/index.html` | — |
| `/tools/another-story/embed-snippet.html` | `tools/another-story/embed-snippet.html` | — |
| `/tools/build-walkthrough/` | `tools/build-walkthrough/index.html` | `build-walkthrough.html` |
| `/tools/energy-credit/` | `tools/energy-credit/index.html` | `energy-credit.html`, `posts/2026-09-20-window-replacement-edmonds-coastal-wa.html` |
| `/tools/energy-credits/` | `tools/energy-credits/index.html` | — |
| `/tools/pm-dashboard/` | `tools/pm-dashboard/index.html` | `pm-dashboard.html`, `good-steward.html` |
| `/tools/site-visit/` | `tools/site-visit/index.html` | `site-visit.html`, `good-steward.html` |

`/404.html` and `/search.html` are real destinations that nothing links to. `/directories.html` is a second directories URL; `/directory.html` is in the primary nav and has 318 unique inbound pages. `/feasibility-study.html` is the planning tool named in the task, and it is an orphan. The four `sections/` files and the `tools/` copies are fragments or twins. Three section files are iframed and still have no `<a>`. `sections/scroll-house.html` is neither linked nor iframed. It is also the source of both broken internal anchors: `href` values that resolve to `/sections/plan-walkthrough/` and `/sections/learn/`, and neither path is a published HTML page.

`/pm-dashboard/` and `/site-visit/` are the directory URLs. The homepage links `./pm-dashboard.html` and `./site-visit.html`, which are different files and are not in this list.

### Weakest 20 blog and news pages

Sorted by unique referring pages, then raw `<a>` count, then path. Fourteen stories are tied at 1 unique inbound. The twentieth row is one of 21 stories tied at 2. The next file, `posts/2026-09-25-home-addition-mountlake-terrace-wa.html`, is also at 2 unique and 2 raw, and it sorts later by path, so it is not in the twenty. Thirty-five blog/news pages are at or below that unique-inbound number.

Body inbound matches unique inbound on every row below. The single referrer is not a nav or footer link. It is the index.

| # | URL | Unique | Raw `<a>` | Referring pages |
| ---: | --- | ---: | ---: | --- |
| 1 | `/news/snohomish-health-septic-permit-grant.html` | 1 | 1 | `/news.html` |
| 2 | `/posts/2026-08-11-hire-design-build-edmonds.html` | 1 | 1 | `/blog.html` |
| 3 | `/posts/2026-08-15-primary-suite-addition-edmonds.html` | 1 | 1 | `/blog.html` |
| 4 | `/posts/2026-08-17-heated-floors-edmonds-bathrooms.html` | 1 | 1 | `/blog.html` |
| 5 | `/posts/2026-08-19-eastside-vs-coastal-bath-remodel.html` | 1 | 1 | `/blog.html` |
| 6 | `/posts/2026-08-30-coastal-moisture-primary-bath-edmonds.html` | 1 | 1 | `/blog.html` |
| 7 | `/posts/2026-09-02-edmonds-custom-home-planning.html` | 1 | 1 | `/blog.html` |
| 8 | `/posts/2026-10-02-window-replacement-lynnwood-wa.html` | 1 | 1 | `/blog.html` |
| 9 | `/posts/2026-10-05-roof-replacement-ballard-wa.html` | 1 | 1 | `/blog.html` |
| 10 | `/posts/2026-10-18-hiring-a-bathroom-remodeler-seattle-edmonds.html` | 1 | 1 | `/blog.html` |
| 11 | `/posts/2026-11-04-fence-installation-lake-forest-park-wa.html` | 1 | 1 | `/blog.html` |
| 12 | `/posts/2026-11-05-standby-generator-installation-maple-valley-wa.html` | 1 | 1 | `/blog.html` |
| 13 | `/posts/2026-11-16-egress-window-installation-monroe-wa.html` | 1 | 1 | `/blog.html` |
| 14 | `/news/kirkland-driveway-lot-split-unit-lot-rules.html` | 1 | 3 | `/news.html` (three anchors on that one page) |
| 15 | `/posts/2026-08-10-electrical-upgrades-bathroom-remodels-wa.html` | 2 | 2 | `/blog.html`, `/learn/electrical/` |
| 16 | `/posts/2026-08-13-bathroom-remodel-phinney-ridge.html` | 2 | 2 | `/blog.html`, `/phinney-ridge.html` |
| 17 | `/posts/2026-08-27-kitchen-remodel-mukilteo-wa.html` | 2 | 2 | `/blog.html`, `/mukilteo.html` |
| 18 | `/posts/2026-09-11-bathroom-remodel-shoreline-wa.html` | 2 | 2 | `/blog.html`, `/shoreline.html` |
| 19 | `/posts/2026-09-13-bathroom-remodel-edmonds-wa.html` | 2 | 2 | `/blog.html`, `/edmonds.html` |
| 20 | `/posts/2026-09-22-siding-replacement-edmonds-coastal-wa.html` | 2 | 2 | `/blog.html`, `/materials.html` |

## Proposed links

Up to three per weak page. Each anchor is an exact substring of the source file (tags ignored; the characters are in the file). None of these sources already link to the target. Where a third contextual page does not exist, the row is omitted and the gap is named. No anchor was invented.

The Marysville garage post from this same day is not in the twenty. Its body already links the Marysville water-heater guide, the Everett garage conversion, and the Sammamish shed. The weak set is mostly August and September 2026, plus the Lake Forest Park fence, Maple Valley generator, and Monroe egress posts, and two news stories. Those three November posts are linked from the blog index and from nowhere else.

| Target | Source | Anchor already on the source | Why |
| --- | --- | --- | --- |
| `/news/snohomish-health-septic-permit-grant.html` | `/woodway.html` | septic clearance via Snohomish Health District | Same agency and the same system (septic). |
| `/news/snohomish-health-septic-permit-grant.html` | `/posts/2026-11-11-asbestos-survey-before-remodel-everett-wa.html` | Snohomish Health District | Everett remodel checklist already sends readers to that district. |
| `/news/snohomish-health-septic-permit-grant.html` | `/posts/2026-09-28-second-story-addition-woodinville-wa.html` | septic/well/critical areas | Same sentence names unincorporated Snohomish and septic. |
| `/posts/2026-08-11-hire-design-build-edmonds.html` | `/posts/2026-10-18-hiring-a-bathroom-remodeler-seattle-edmonds.html` | local design-build firm | Edmonds hiring piece, same delivery model. That hiring post is also in this weak twenty, so the link runs between two orphans-of-the-index. |
| `/posts/2026-08-11-hire-design-build-edmonds.html` | `/additions.html` | Edmonds design-build remodeler doing whole-home | Directory row for the same city and model. |
| `/posts/2026-08-11-hire-design-build-edmonds.html` | `/custom-homes.html` | Edmonds-based design-build firm | Same city, same model, on the custom-home directory. |
| `/posts/2026-08-15-primary-suite-addition-edmonds.html` | `/news/edmonds-deer-creek-aquifer-interim-rules.html` | additions or large hardscape in south Edmonds | Edmonds news already talking about additions. |
| `/posts/2026-08-15-primary-suite-addition-edmonds.html` | `/news/edmonds-landmark-tree-ordinance-extension.html` | planning a new custom home, an addition | Same city, addition is in the sentence. |
| `/posts/2026-08-15-primary-suite-addition-edmonds.html` | `/news/edmonds-permanent-tree-code-council-review.html` | some home additions could come | Edmonds tree rules applied to additions. |
| `/posts/2026-08-17-heated-floors-edmonds-bathrooms.html` | `/posts/2026-10-28-aging-in-place-remodel-edmonds-wa.html` | a fan and a heated floor | Edmonds bath rough-in, the floor is named. |
| `/posts/2026-08-17-heated-floors-edmonds-bathrooms.html` | `/posts/2026-09-01-hiring-tile-contractor-edmonds.html` | If heated floors are included | Edmonds tile sequence that already depends on the floor. |
| `/posts/2026-08-17-heated-floors-edmonds-bathrooms.html` | `/posts/2026-08-10-electrical-upgrades-bathroom-remodels-wa.html` | Adding heated floors | Same project type. The electrical post is also in this twenty. |
| `/posts/2026-08-19-eastside-vs-coastal-bath-remodel.html` | `/posts/2026-08-11-hire-design-build-edmonds.html` | coastal detailing and permitting | Edmonds bath/kitchen sentence. Source is also in this twenty. |
| `/posts/2026-08-19-eastside-vs-coastal-bath-remodel.html` | `/posts/2026-09-23-bathroom-remodel-bothell-wa.html` | waterfront Edmonds envelope job | Eastside bath post contrasting itself with Edmonds. |
| `/posts/2026-08-19-eastside-vs-coastal-bath-remodel.html` | `/posts/2026-08-08-another-story-method-weatherproof-first.html` | nearby coastal communities | Edmonds and Shoreline named as coastal weather. |
| `/posts/2026-08-30-coastal-moisture-primary-bath-edmonds.html` | `/posts/2026-09-13-bathroom-remodel-edmonds-wa.html` | moisture control sized for marine air | Edmonds bath post. That post is also in this twenty. |
| `/posts/2026-08-30-coastal-moisture-primary-bath-edmonds.html` | `/posts/2026-09-22-siding-replacement-edmonds-coastal-wa.html` | wind-driven wetting and marine air pressure | Same coast, the wall instead of the bath. Source is also in this twenty. |
| `/posts/2026-08-30-coastal-moisture-primary-bath-edmonds.html` | `/posts/2026-09-18-kitchen-remodel-mill-creek-wa.html` | winter moisture and cooking steam | Mill Creek kitchen contrasting itself with Edmonds marine air. |
| `/posts/2026-09-02-edmonds-custom-home-planning.html` | `/edmonds-custom-homes.html` | Building a custom home in Edmonds | The city directory's own sentence. |
| `/posts/2026-09-02-edmonds-custom-home-planning.html` | `/news/edmonds-landmark-tree-ordinance-extension.html` | planning a new custom home | Edmonds owners planning a custom home. |
| `/posts/2026-09-02-edmonds-custom-home-planning.html` | `/adu.html` | Edmonds custom homes and additions | Same city, custom homes named next to additions. |
| `/posts/2026-10-02-window-replacement-lynnwood-wa.html` | `/lynnwood.html` | white-trimmed windows on light siding under an overcast sky in Lynnwood | City page caption on a Lynnwood window photograph. The image links to `/windows.html`; the caption text is not a link. |
| `/posts/2026-10-02-window-replacement-lynnwood-wa.html` | `/posts/2026-11-09-patio-cover-lynnwood-wa.html` | window awnings | Same city. The sentence is the permit exemption that covers awnings and not a full window replacement. |
| `/posts/2026-10-02-window-replacement-lynnwood-wa.html` | `/windows.html` | Focus: Windows & Doors · Lynnwood | Directory row for Lynnwood window firms. |
| `/posts/2026-10-05-roof-replacement-ballard-wa.html` | `/ballard.html` | synthetic roof underlayment and a metal drip edge at the eave in Ballard | City caption of a roof eave. The image links to `/roofing.html`; the caption is not a link. |
| `/posts/2026-10-05-roof-replacement-ballard-wa.html` | `/news/seattle-nr-cleanup-setback-options.html` | blocks like these in Ballard | Same neighborhood. The story is zoning, not roofs. A third link is not proposed: other pages that contain both words do it in shared chrome or a city list, not in a sentence about a Ballard roof. |
| `/posts/2026-10-18-hiring-a-bathroom-remodeler-seattle-edmonds.html` | `/tile.html` | Edmonds-area bath remodel | Tile directory, same city and room. |
| `/posts/2026-10-18-hiring-a-bathroom-remodeler-seattle-edmonds.html` | `/posts/2026-09-05-hire-bathroom-remodeler-king-snohomish.html` | King & Snohomish bath hiring | Same task (hiring a bath remodeler) at county scale. |
| `/posts/2026-10-18-hiring-a-bathroom-remodeler-seattle-edmonds.html` | `/posts/2026-08-11-hire-design-build-edmonds.html` | kitchen/bath remodels | Edmonds hiring post. Source is also in this twenty. |
| `/posts/2026-11-04-fence-installation-lake-forest-park-wa.html` | `/posts/2026-11-02-backyard-shed-home-office-sammamish-wa.html` | not a fence | Setback sentence: measure from the property line, not a fence. Same decision the Lake Forest Park guide is about. |
| `/posts/2026-11-04-fence-installation-lake-forest-park-wa.html` | `/posts/2026-11-20-foundation-crack-repair-kent-wa.html` | short fences | Kent permit-exemption list names fences as a category. |
| `/posts/2026-11-04-fence-installation-lake-forest-park-wa.html` | `/news/mountlake-terrace-shed-permit-exemption-flat-fees.html` | Lake Forest Park | Fee comparison already lists the city beside Edmonds, Mill Creek, Shoreline, and Lynnwood. |
| `/posts/2026-11-05-standby-generator-installation-maple-valley-wa.html` | `/maple-valley.html` | City of Maple Valley Community Development | The city's own permit paragraph. The generator guide is the electrical-versus-mechanical split under that desk. |
| `/posts/2026-11-05-standby-generator-installation-maple-valley-wa.html` | `/black-diamond.html` | not Maple Valley | Neighbor-city warning that names Maple Valley as a different building department. |
| `/posts/2026-11-05-standby-generator-installation-maple-valley-wa.html` | `/posts/2026-10-22-ev-charger-installation-redmond-wa.html` | Photovoltaic Systems and generators | Redmond permit sentence. Different city, same class of exterior equipment. `blog.html` also contains "standby generator" because it lists this post, and that link already exists. |
| `/posts/2026-11-16-egress-window-installation-monroe-wa.html` | `/monroe.html` | City of Monroe Community Development | City permit desk. The egress guide is a Monroe remodel permit. |
| `/posts/2026-11-16-egress-window-installation-monroe-wa.html` | `/projects/magnolia-house-adu-garage/index.html` | the new egress window | Same opening type, on the Magnolia house drawing. Different city. |
| `/posts/2026-11-16-egress-window-installation-monroe-wa.html` | `/news/snohomish-county-school-impact-fees-by-bedroom.html` | Edmonds and Monroe | Monroe appears in a school-district fee list, not in a window sentence. It is the only other news sentence that names the city as a place rather than a smashed table cell. |
| `/news/kirkland-driveway-lot-split-unit-lot-rules.html` | `/news/kirkland-middle-housing-smaller-homes.html` | how many homes fit on a single-family lot | Kirkland lot-size story, the subject this ordinance changes. |
| `/news/kirkland-driveway-lot-split-unit-lot-rules.html` | `/posts/2026-09-19-home-addition-kirkland-wa.html` | ADU-related utility upgrade | Kirkland addition post. The ordinance covers ADU garages and driveways. |
| `/news/kirkland-driveway-lot-split-unit-lot-rules.html` | `/posts/2026-11-19-whole-house-repiping-kirkland-wa.html` | laid out on the driveway | Same city. The driveway here is where the pipe sits, not the new depth rule. A Bothell driveway guide exists, and its body does not mention Kirkland, so it is not used. |
| `/posts/2026-08-10-electrical-upgrades-bathroom-remodels-wa.html` | `/posts/2026-08-13-bathroom-remodel-phinney-ridge.html` | fixtures or circuits change | Bath post that already flags trade permits when circuits change. Source is also in this twenty. |
| `/posts/2026-08-10-electrical-upgrades-bathroom-remodels-wa.html` | `/posts/2026-08-12-edmonds-home-addition-permit-basics.html` | electrical, plumbing, and mechanical permits | Edmonds addition permits, electrical named. |
| `/posts/2026-08-10-electrical-upgrades-bathroom-remodels-wa.html` | `/posts/2026-10-28-aging-in-place-remodel-edmonds-wa.html` | need an electrical permit | Edmonds bath circuits, including heated floors. |
| `/posts/2026-08-13-bathroom-remodel-phinney-ridge.html` | `/posts/2026-09-06-seattle-bathroom-remodel-permits.html` | Phinney Ridge | Seattle bath-permit paragraph lists the neighborhood with Magnolia, Ballard, and Queen Anne. |
| `/posts/2026-08-13-bathroom-remodel-phinney-ridge.html` | `/posts/2026-09-04-kitchen-remodel-ballard-seattle.html` | Crown Hill or Phinney | Ballard kitchen post on dumpster logistics for the next neighborhood. |
| `/posts/2026-08-27-kitchen-remodel-mukilteo-wa.html` | `/posts/2026-09-18-kitchen-remodel-mill-creek-wa.html` | Mukilteo waterfront homes | Kitchen ventilation paragraph comparing Mill Creek with Mukilteo. |
| `/posts/2026-08-27-kitchen-remodel-mukilteo-wa.html` | `/posts/2026-08-28-bathroom-remodel-mukilteo-wa.html` | paired remodel | Mukilteo bath post pointing at a kitchen done in the same scope. `/mukilteo.html` already links this target, so it is not proposed again. No third article sentence names Mukilteo in a kitchen context. |
| `/posts/2026-09-11-bathroom-remodel-shoreline-wa.html` | `/posts/2026-09-30-bathroom-remodel-lake-forest-park-wa.html` | Shoreline, Kenmore, and Edmonds bath scopes | Neighbor-city bath comparison. The match is the city name Shoreline, not the noun "shoreline". |
| `/posts/2026-09-11-bathroom-remodel-shoreline-wa.html` | `/posts/2026-08-24-second-story-addition-shoreline.html` | related Shoreline addition posts | Shoreline addition post that already points readers at bath work when rooms move upstairs. |
| `/posts/2026-09-11-bathroom-remodel-shoreline-wa.html` | `/bathrooms.html` | serving Shoreline–Edmonds–Lynnwood | Directory row for a Shoreline bath firm. |
| `/posts/2026-09-13-bathroom-remodel-edmonds-wa.html` | `/posts/2026-08-17-heated-floors-edmonds-bathrooms.html` | Edmonds heated bath floors | Edmonds bath floors. Source is also in this twenty. The words sit inside `<strong>` and are contiguous. |
| `/posts/2026-09-13-bathroom-remodel-edmonds-wa.html` | `/posts/2026-08-15-primary-suite-addition-edmonds.html` | bedroom, bath, and often closet | Edmonds primary suite, the bath is part of the addition. Source is also in this twenty. |
| `/posts/2026-09-13-bathroom-remodel-edmonds-wa.html` | `/posts/2026-08-30-coastal-moisture-primary-bath-edmonds.html` | Edmonds primary baths | Same city and room. Source is also in this twenty. |
| `/posts/2026-09-22-siding-replacement-edmonds-coastal-wa.html` | `/posts/2026-11-18-gutter-downspout-replacement-edmonds-wa.html` | a reroof, siding, a porch | Edmonds gutter guide listing siding as part of the same exterior scope. |
| `/posts/2026-09-22-siding-replacement-edmonds-coastal-wa.html` | `/posts/2026-08-15-primary-suite-addition-edmonds.html` | cedar siding | Edmonds addition described with the cladding. |
| `/posts/2026-09-22-siding-replacement-edmonds-coastal-wa.html` | `/coastal-waterproofing.html` | Fiber-cement cladding context for coastal Edmonds | Same city, same assembly. |

Gaps, so the table does not pretend a third link exists:

- Ballard roof: no third page mentions both the neighborhood and a roof.
- Ballard roof: no third article sentence is about a Ballard roof.
- Mukilteo kitchen: the city hub already links the post. Two further sentences are in the table.
- Phinney Ridge bath: two article sentences name the neighborhood and are in the table. `phinney-ridge.html` already links the post. `seattle.html` links a "Phinney Ridge hub", which is the neighborhood page, not this post. `blog.html`, `learn.html`, `directory.html`, and `locations.html` also contain the name in lists and are not proposed.

## Method notes

**Stranger judge.** The four Board of Project Stewardship pages were read as HTML and CSS (`assets/css/site.css`, `tailwind.config.js` color tokens) and rendered locally at 1440×900 on 2026-11-24. Reference notes come from the public homepages of Dwell, This Old House, and Sweeten fetched the same day as text. Their stylesheets were not compared pixel for pixel. Scores judge the page a stranger gets, including the shared footer blocks, not the accuracy of the code citations inside the Marysville post.

**Template counts.** "Key Takeaways", "Materials Worth Knowing", "Where Pacific Pro Group fits", "By Board of Project Stewardship Editorial", "Directory · ranking method · L&I Verify", "Planning tools · Directory #1 · Service region", "Site visit and PM checklists", and "Another Story" were counted by exact string on the parsed published HTML. "Live Feasibility & Estimate Calculator" was counted the same way across all 366 pages (249 hits). The news file without "Key Takeaways" is `news/snohomish-health-septic-permit-grant.html`.

**What was crawled.** Every `*.html` file that `published()` in `scripts/check_jekyll_publish.py` would copy under Jekyll 3.9, using `_config.yml` exclude and include. Underscore and dot path segments are dropped unless included. The `pages` exclude prefix also drops `pages/stamp-of-trust.html`. All 366 files parsed with Python `html.parser`. None returned a decode error, a parser exception, or zero tags.

**What counts as a link.** `<a href>` only. Unique referring pages are the inbound number. Raw `<a>` counts repeats on one page. The resolver accepts root-relative, relative, and `https://boardofprojectstewardship.com` URLs, ignores fragments, and collapses `index.html` with its directory URL when that file is in the corpus. `mailto:`, `tel:`, `javascript:`, and other hosts are ignored. A link to the same file does not count. `<link rel="canonical">` and `og:url` do not count, which is why a page that only mentions itself is still an orphan. `<iframe src>` is recorded and does not add inbound.

**Broken links.** Two anchors on `sections/scroll-house.html` point at `/sections/plan-walkthrough/` and `/sections/learn/`. Neither resolves to a file in the corpus.

**Weakest twenty.** `posts/*.html` and `news/*.html` only. Sort: unique inbound ascending, raw `<a>` ascending, path ascending. Take 20. Tie at the cut is documented above.

**Proposed anchors.** Each phrase was checked as a literal substring of the source file after HTML unescape. Sources that already link the target were excluded (`/mukilteo.html` already links the Mukilteo kitchen post; `/phinney-ridge.html`, `/shoreline.html`, `/edmonds.html`, and `/materials.html` already link their rows). Chrome (header, footer, nav) was not used as a source. A few proposals run between two pages that are both in the weak twenty. That is stated in the Why column. Where a same-city or same-project sentence could not be found, the table stops at two and says so.
