# CHANGES: Build Here feasibility study, review of pull request 208

Prepared 2026-11-12 from the read-only snapshot of PR #208 at head `6fe4828d`. Updated 2026-11-13 with the owner's decision on finding C4 and plugin version 1.0.1.

This file lists every change in the fixed source tree, mapped to the finding it answers, with how each was checked. Nothing was merged, pushed or commented on GitHub. The work was done on files extracted from the review bundle.

- 76 findings: 4 Critical, 14 High, 29 Medium, 15 Low, 14 portability blockers.
- 43 commits on top of the snapshot. Every Critical, High and Medium finding has a code change. One Critical finding (C4) also needed a decision from the owner. It was made on 2026-11-13: keep the data.
- A WordPress plugin for Pacific Pro Group, built from the same source files. It is now version 1.0.1.

## What changed on 2026-11-13

The owner decided finding C4: **keep the Snohomish house-size data and every data source.** Two commits were added. Nothing was removed.

| Change | Detail |
| --- | --- |
| The decision is on record | `data/build-here/data-holds.json` carries it as the clearance for `assets/data/house-size/snoh`. The weekly check prints `ok` for that folder, with no warning. Source clearance is owner-accepted: the review still has not seen where those files come from, and the record says so. Commit `335474f`. |
| The weekly workflow is unchanged in what it does | It still builds and publishes the whole `assets/data/house-size` folder. Only a comment changed. A test pins that no step takes the Snohomish files out. |
| A missing data file is handled in plain words | Only when a data file is missing, unreadable or unreachable: the study leaves the house size out and says why. A file that is there is read exactly as before. See "Added on 2026-11-13" below. Commit `dc9b5fe`. |
| Plugin 1.0.1 | The same handling, built into the plugin script. Settings and the shortcode are the same as 1.0.0. |

Two things were **not** done. Tell the review if you want either one:

- **The study does not read the Snohomish house-size files.** No file in the bundle reads `assets/data/house-size/`. At a Snohomish County address the study makes no data-file request and asks the visitor for the house size, as before. To fill it in from those files, the review needs `scripts/build_index.py` or one sample file from `assets/data/house-size/snoh/`, to know their format. Guessing the format would put unchecked numbers in front of a client.
- **The index built from the county improvement records stays held.** `assets/data/sno-bldg` is a different dataset. Your own code keeps it off (`SNO_IMPR_ENABLED = false`) and your own test requires that. "Keep all data sources" was read as "remove nothing", not as "turn this one on".

## What is in the package

| File | What it is |
| --- | --- |
| `build-here-pr208-fixed-source.zip` | Every file from the review bundle with the fixes applied, plus the new files: tests, the data-hold check, the plugin with its build script, and this file. It also holds the 43 commits as one patch file. It does not hold what the bundle left out: `assets/data/**`, `index.html`, `generate_site.py`, `site.css` and the rest of the site. |
| `ppg-build-here-1.0.1.zip` | The installable WordPress plugin, version 1.0.1. Its `README.md` is the install guide for Stryker Digital, the SEO agency. It replaces `ppg-build-here-1.0.0.zip`. |
| `CHANGES.md` | This file. Also in the source zip at `docs/pr208-review/CHANGES.md`. |

## How to apply it

Both ways start from the PR branch at `6fe4828d`. Neither one needs GitHub until you choose to push.

**With the history (recommended).** The patch file replays the 43 commits one by one.

```
git checkout -b pr208-review 6fe4828d
git am --whitespace=nowarn /path/to/build-here-pr208-fixed/docs/pr208-review/build-here-pr208-review.mbox
```

The 20 files extracted from the bundle match its manifest in lines and bytes. The patch file was replayed on a clean copy of them before it was packed, and the result was identical to the fixed tree. Two patches in the series add a line that ends with a space, and a later commit trims both. `--whitespace=nowarn` keeps git from warning about them, or from stopping if your repository treats that as an error. If a patch still stops on your checkout, run `git am --abort` and use the second way.

**Without the history.** Copy the contents of `build-here-pr208-fixed/` over the checkout. It changes 13 files and adds 43, one of which is the patch file itself. It deletes nothing. Do not replace the checkout with the folder: the folder is not the whole site.

Then run the tests from the repository root:

```
python3 -m unittest discover -s tests -p "test_*.py"
python3 tests/e2e/run_all.py
```

The first command runs 90 tests. One of them, `test_report_tool_on_homepage`, fails until the homepage is regenerated (step 2 below). The second command needs Playwright and Chrome. It took 75 seconds on the review machine on 2026-11-13. See `tests/e2e/README.md`.

## Do these before you merge

1. **C4 is decided: the data stays.** The owner decided on 2026-11-13 to keep `assets/data/house-size/snoh` and every data source. Nothing is left to do in the code, and the weekly workflow runs with no warning. Two things are left for the record. Put the owner's name on the clearance line in `data/build-here/data-holds.json`. When someone has read `scripts/build_index.py`, write the source of those files on the same entry. The review still has not seen that script.
2. **Regenerate the homepage.** `index.html` is written by `generate_site.py`, which is outside the bundle. In `home_feasibility_tool_section()`, change the six `?v=20261109b` strings to `?v=20261113a`, add `?v=20261113a` to the stylesheet link in the same function, then regenerate. The function copies the tool's markup from `build-here.html`, so the homepage picks up the new privacy details and the export status line. Until you regenerate, `test_report_tool_on_homepage` fails: it compares the homepage with the section built from `build-here.html`, and that page has changed. The section the generator will write was built from the supplied excerpt and passes that test's checks on the section.
3. **Fix the generator's heading replace (L10).** The same function replaces `<h2 id="bh-step3" class="text-2xl font-black text-white">`. The page has `tabindex="-1"` after the class, so the replace never matches.
4. **Check the leftover-style removal (M25).** Run this in the full repository. If any file outside the tool still uses one of these names, drop commit `88443ce`.
   ```
   grep -rnE "b3-(media-grid|fig|chaps|hot|pin|off|tabs|frame-wrap)|bh-(study-media|example|cover|opt-|total)" --include=*.html --include=*.py --include=*.js .
   ```
5. **Keep the new folders off the published site.** Add `wordpress/`, `tests/` and `docs/pr208-review/` to `exclude:` in `_config.yml` if they are not already covered.
6. **If `build-here-3d.html` is generated,** port its changes to the generator: the menu link, the social title, the two position inputs, the input names, and the fallback script.
7. **Run the whole test suite of the repository.** The review ran the five test files in the bundle and its own new ones. Three tests in the bundle could not run (`test_page_is_linked_and_in_sitemap`, `test_report_tool_on_homepage`, `test_budget_calculator_removed`): they need `sitemap.xml`, the full `index.html` and the full `generate_site.py`. Test files that were not in the bundle were not seen at all.
8. **Try it against the live services** on a preview deploy. Every lookup in this review ran against recorded stand-ins. See "Not verified".

## Test results on the final tree

| Suite | Result |
| --- | --- |
| `tests/test_build_here_study.py` | 55 tests. 54 pass in the bundle tree. The 55th reads `_config.yml`, which is not in the bundle. It passes with a stand-in file that has the line it expects. |
| of which `ReviewRegressionTests` | 11 tests for the Critical and High fixes. On the PR head: 9 fail, 2 error. |
| of which `SecondPassTests` | 17 tests for the Medium and Low fixes. On the tree before those fixes: 14 of the first 15 fail. The 15th is a new guard that already held. Two were added later with their fixes. |
| of which `MissingDataFileTests` | 6 tests, added 2026-11-13, for a data file that is missing, unreadable or unreachable. On the tree before that change: the 2 that check a file that is there still pass, and the other 4 fail. |
| `tests/test_build_here.py` | 14 tests. 10 pass in the bundle tree. 1 more passes with the homepage and generator excerpts. 3 need files outside the bundle. |
| `tests/test_build_scripts.py` (new) | 9 pass. King County index builder and the data-hold check, with the owner's C4 decision. |
| `tests/test_wordpress_plugin.py` (new) | 11 pass. The plugin script matches the sources, adds one global, names one version everywhere, and the PHP lints and passes its checks. |
| `wordpress/tests/php-smoke.php` (new) | 87 checks pass against stand-ins for WordPress. |
| `tests/e2e/run_all.py` (new) | 105 checks pass in 15 browser scenarios, headless Chrome, every outside service answered by a stand-in. Two runs also use a real second server on the test machine, for a data folder on another host. |
| `tests/test_build_here_interact.py` | 1 test. Its script passes when driven by `tests/e2e/interact_pw.py`. The file itself needs the `websocket-client` module, which the review machine did not have. |
| All of `tests/` in one run | 90 tests. 84 pass in the bundle tree. The other 6 are the ones named above: each needs a file or a module the review machine did not have. |

"Checked by" in the tables below names the test or scenario. "Before" numbers were measured on the unmodified snapshot.

## Critical

| ID | Where (PR head) | What was wrong | What changed | Commit | Checked by |
| --- | --- | --- | --- | --- | --- |
| C1 | `build-here.js` `studyContext` L703 (`zoningCoded: !!rs`, L725); `build-here-measures.js` `scenarios` L273; `build-here-rules.js` `cityRules` L396, `snoUrbanVerify` L164 | Option cards claimed eligibility where the zone is not coded. Kent, which has no coded zones, showed the ADU card as Ready with "The coded ADU note for this zone is on the card". Kirkland RS 8.5 showed all five cards Ready. Unknown floor area ratio was printed as "This zone has no floor-area ratio". | Rule sets that only carry the state-law floor are flagged `coded: false`. Floor area ratio is three-valued: a cap, none, or not known. The ADU card is Ready only from a zone-specific standard. | `cd6884a` | Kent before and after in Chrome (e2e `king` B4). Kirkland by running the rule and card modules under Node: five Ready before, one after (Remodel). `ReviewRegressionTests`. |
| C2 | `build-here.js` `snoParcel` L321; `build-here-landscape.js` `analyze` L402 | Snohomish County building footprint was counted twice and included a neighbor's whole roof when its eave crossed the lot line. Test lot: 4,300 sf shown and "No coverage room left". Truth: 2,000 sf and 960 sf of room. | One source, clipped to the lot. | `28b1cb0` | e2e `edmonds`. |
| C3 | `build-here.js` `kingParcel` L296, `snoParcel` L321, `geocode` L136 | The study could run on the wrong lot without saying so. King County used the first of all parcels within 25 m (the lot across the street in the test). Snohomish County matched the same house number on another street 900 ft away. A street or city centroid from the fallback geocoder was accepted as the address. | Candidates ranked by distance to the point. Street words must match whole. A location match is flagged on the first screen and drops Ready cards to Partial. Only address-level geocodes are accepted. | `ffa5825` | e2e `king` B1, `sno_street`. |
| C4 | `.github/workflows/house-size-index.yml` L23; `scripts/build_index.py` (not in the bundle); `scripts/build_sno_bldg_index.py` | The weekly workflow publishes `assets/data/house-size/snoh` (132 files, 11 MB) while the Snohomish improvement records are under a county-use hold. No file in the bundle reads `assets/data/house-size/`. **Not verified:** the script that builds it was not in the bundle. | `scripts/check_data_holds.py` and `data/build-here/data-holds.json`. The workflow fails before it commits if a dataset marked held has files and no recorded clearance, and warns for one with no decision on record. **Owner decision, 2026-11-13: keep the data.** The decision is recorded as the clearance for `house-size/snoh`, so the weekly run prints `ok` for it and no warning. The workflow still builds and publishes the whole folder. No data was deleted. `assets/data/sno-bldg` stays held. | `dc93f4c`, `335474f` | `DataHoldTests`, 5 tests. **Decided.** Source clearance is owner-accepted. The source itself is still not verified. |

## High

| ID | Where (PR head) | What was wrong | What changed | Commit | Checked by |
| --- | --- | --- | --- | --- | --- |
| H1 | `build-here.css` L150 to L153; `build-here.js` `render` L913 | The parcel outline on the first-screen aerial was not drawn to the photo's scale. At 1,280 px wide it was 40% of the lot's size, centered on the house. | The outline uses the same crop as the photo, and the box has a fixed aspect ratio. | `015de66`, `14dcf05` | e2e `edmonds`: lot in photo and outline drawn both at [442, 67, 189, 295] px. |
| H2 | `build-here.css` print block L72 to L99; `build-here.js` `printReport` L1255 | Any page that loaded the stylesheet printed blank until a study existed. Buttons, iframes and videos on the host page were hidden in print. The five option cards were missing from the printed study. | No page-wide print rule. One print path for the button and for the browser's Print command. No animation in the copy. | `bc9d66f` | e2e `print`, `homeprint`. |
| H3 | `build-here.js` `studyContext` L703; `build-here-measures.js` `scenarios` L273 | Cards read Ready on a lot with a mapped hazard or ground steeper than 40%. | Those lots drop Ready cards to Partial with the reason. | `cd6884a` | `ReviewRegressionTests`. |
| H4 | `build-here-measures.js` `resolveStudy` L353 | With only an outbuilding on record, coverage was computed as if the house were 0 sf. | Building coverage is computed only when the house footprint is known. | `cd6884a` | `ReviewRegressionTests`. |
| H5 | `build-here-measures.js` `resolveStudy` L353; `build-here.js` `render` L898 | Assessor living area stood in for code-counted floor area without saying so, and a typed gross floor area was ignored. | A typed gross floor area is used. The capacity table names the figure it used. | `cd6884a` | `ReviewRegressionTests`. |
| H6 | `build-here-export.js` `PRINT_CSS` L53, `buildStudyFile` L78 | The downloaded study was 711 px wide on a 390 px phone, with the outline stacked under the photo, icons at 375 x 258 px and 19 printed pages. | Overlay rules, small icons, labeled table rows, margins. 390 px wide, 13 pages. | `b5b09fc` | Measured at 390 px. `ExportTests`. |
| H7 | `build-here.js` `render` L898, `fillForm` L863 | A typed lot size or zone drove every cap with no label. An auto-filled impervious figure was printed as "your entry". | Typed values are labeled beside the record figure. | `19480c9` | Interaction script. |
| H8 | `build-here.js` `zoning` L437 | In Seattle the assessor's zoning field overrode the city zoning map. An NR3 lot showed "SF 5000" and no coded math. | The city layer sets the zone. The assessor value is kept as a note. | `19480c9` | e2e `king` B2. |
| H9 | `build-here.js` `fillForm` L863 | Existing stories carried over from the previous address and was credited to the assessor. | Reset on every lookup, with a note when the record value was rounded. | `19480c9` | e2e `king` B3. |
| H10 | `build-here.js` `redFlags` L1112 | Text from map services was written into the page as HTML. A test attribute with an `onerror` handler ran. | Escaped. Links from map data must be http or https. | `c500fdc` | e2e `xss`. |
| H11 | `build-here-landscape.js` `osm` L139, `TIMEOUT` L9, `demSamples` L173 | A busy OpenStreetMap server held the whole study for 14 to 94 seconds. The lot's bounding box was sent to a mirror at maps.mail.ru. | Bounded waits. Two mirrors. The mail.ru mirror is gone. | `7f4e1cb` | e2e `slow`: 14.6 s before, 0.6 s after. |
| H12 | `build-here.js` `permits` L538, `hazards` L488 | "No permit records were found" and "No mapped hazard layer touched this parcel" were printed where nothing was searched or the layer had failed. | Searched and empty, searched and failed, and not searched are told apart. | `e6d8bdb` | e2e `king`. |
| H13 | `build-here.js` `render` L898 (map embed), L1063, `init` L1269; `build-here-landscape.js` `discoverParcel` L274 | The address text went to Google as soon as the map scrolled into view. The address stayed in the page link. The address and lot outline stayed in `localStorage`. Coordinates went to whatever server an auto-discovered layer named. | The map loads on request, pinned to the point. The address is taken out of the page link when the page opens. The seed lives for the tab. Discovery hosts are vetted and can be switched off. Not covered: a tag in the page head can send its page view before the link is cleaned (see "Not verified"). | `ea0b039` | e2e `privacy`. |
| H14 | `build-here-landscape.js` `applyParcelHit` L409 | Lot area or gross building area could be printed as "finished living area" from fields named `SQFT` or `BLDG_SQFT`. | Only unambiguous fields, only from layers in the registry. | `2cc3f09` | `ReviewRegressionTests`. |

## Medium

| ID | Where (PR head) | What was wrong | What changed | Commit | Checked by |
| --- | --- | --- | --- | --- | --- |
| M1 | `build-here.js` `snoBuildingFacts` L367 | Every Snohomish County study printed an internal note about joining a county workbook to owner names. | Reworded for a client. | `ab9c20a` | Existing tests. |
| M2 | `build-here.js` `init` L1269 | If drawing the study threw, the status said "Found" and nothing appeared. | Caught and reported. | `ab9c20a` | Read. |
| M3 | `build-here-landscape.js` `lotRows` L513; `build-here.js` `snoParcel` L321 | Lot area measured off mapped lines was labeled High confidence. The record acreage was requested and never shown. | Medium, with the record acreage beside it and a warning when the two differ by more than 5% of the lot (and at least 300 sf). | `15a0400` | e2e `services` S1. |
| M4 | `build-here.js` `studyContext` L743 | A driveway drawn from a centerline at an assumed 10 ft width was listed in the ledger as a Medium "paved-surface layer". | The ledger repeats the estimate label and Low confidence. | `15a0400` | Read. |
| M5 | `build-here.js` `num` L861 | `-5000` became a negative lot with a negative coverage cap. `0.25 acres` became a 0 sf lot. `12 000` became 12. | A strict parser. The box says what is wrong and is marked invalid. A typed impervious figure smaller than the buildings is not used. | `1d0d64e` | e2e `services` S4. `SecondPassTests`. |
| M6 | `build-here.js` `extras` L571 | Seattle's record names the newest building on the lot, and it overrode the county year. A 2015 backyard cottage hid a 1925 house and its asbestos and lead-paint flag. | Every year is kept. The oldest is shown and drives the flag. | `1d0d64e` | e2e `services` S3. `SecondPassTests`. |
| M7 | `scripts/build_kc_resbldg_index.py` L26; `build-here.js` `kingLivingSqft` L241 | The builder deleted the published shards before it started the download. A parcel's figure could be the sum of several buildings with no note. "As of" was the build date. | Built beside the index and swapped in whole. A file that parses to almost nothing is refused. Each record carries a building count, each shard the county file date, and the page shows both. | `dc93f4c`, `15a0400` | `KingCountyIndexTests`. e2e `services` S3. |
| M8 | `build-here-rules.js` `cityRules` L422 | Sammamish setbacks grow with house size. The diagram drew the smallest-house row for every lot. | The row for the largest house the floor cap allows. | `08a04bf` | `SecondPassTests`. |
| M9 | `build-here.js` `classifyEdges` L629 | A corner lot got two fronts. The interior side line was then read as the rear and the rear as a side. Test lot: 1,600 sf envelope. Truth: 2,100 sf. | One front, one street side at the front setback, one rear, one side. | `2c1592d` | e2e `geometry` G1. `SecondPassTests`. |
| M10 | `build-here.js` `seed3D` L787, `sitePlanSVG` L802 | A parcel record with several outline rings was drawn from the first ring. In the test that was a 100 sf sliver and a 0 sf envelope. | The largest ring, and the study says so. | `2c1592d` | e2e `geometry` G2. |
| M11 | `build-here-measures.js` `resolveStudy` L389, `pickPoint` L345 | A typed patio replaced the mapped hardscape total and counted as all the paving. With two figures of one kind, the last one drove the math without a word. | A patio is one part of hardscape. A note says which figure the math uses. | `15a0400` | `SecondPassTests`. |
| M12 | `build-here-landscape.js` L414; `build-here.js` `permits` L560 | Owner and mailing fields from statewide parcel layers were kept on the study object. A row id was shown as a permit number, and project names were shown. | Attributes are read for three values and discarded. No row id, no project name. | `dda3f39` | e2e `services` S1. |
| M13 | `build-here.js` `hazards` L506 | A neighbor's parcel number, recording number and permit number were printed in the client's study. | Only the kind of notice and a count. | `dda3f39` | e2e `services` S2. |
| M14 | `build-here-rules.js` L265; `build-here.js` `zoning` L437, L525 | Lynnwood's zone came from a layer named `Future_Zones_Draft_4_25` and was presented as the zoning map. Kenmore's zone came from the assessor with no label. | The draft is labeled and cards do not read Ready on it. Kenmore's source is labeled. | `08a04bf` | `SecondPassTests`. |
| M15 | `build-here.js` `buildImagery` L578 | An aerial photo that failed to load stayed a grey box under the county's credit. | Esri World Imagery once, then the parcel diagram, with the credit to match. | `649dd45` | e2e `resilience` R1, R2. |
| M16 | `build-here.js` `geocode` L136; `build-here-landscape.js` `osm` L139 | No way to turn off the Esri geocoder, World Imagery, OpenStreetMap, the Microsoft footprints or the Google map. OpenStreetMap data carried no credit. | `BuildHereConfig.services` switches, and the credit. | `dda3f39` | e2e `services` S1. |
| M17 | `build-here.js` `sitePlanSVG` L802 | Setback figures in the site plan were about 7 px tall on a phone and hidden from screen readers. | The same figures as a text key under the diagram. | `2c1592d` | e2e `geometry`. |
| M18 | `build-here.js` L1189; `build-here-stage.js` L49; `build-here-3d.html` L96 | Removing a typed number dropped keyboard focus and left the note reading "Added". Card titles sat at the same heading level as their section. The 3D number boxes had no names, and a box could only be moved by dragging. | Focus and note fixed. Card titles are `h4`. Named inputs and typed positions. | `649dd45`, `b7f24d7` | e2e `resilience` R5, R6. e2e `3d` T3. |
| M19 | `build-here.js` `seed3D` and `sitePlanSVG`, L1030; `build-here-3d.js` L142 | The envelope raster ran up to three times per redraw. The second copy of the aerial was fetched again in CORS mode, and would not load from a server without the header. The 3D scene was redrawn on every frame. | One raster. No `crossorigin`. Drawn on change. | `2c1592d`, `649dd45`, `b7f24d7` | `SecondPassTests`. e2e `3d` T4. |
| M20 | `build-here.js` `downloadStudy` L1165 | Download gave no feedback, and did nothing at all where the browser blocks files made in the page. | A status line with the file name and what to do. | `649dd45` | e2e `resilience` R3. |
| M21 | `build-here.js` `init` L1304 | `?sample=1` drew a sample study on the live page for anyone. | Only on a local test server, or when the site turns it on. | `649dd45` | e2e `resilience` R4. |
| M22 | `build-here-3d.js` L102, L133, L30 | The sketch judged an invented house box against the setbacks, tested only four corners, tested the mirror image of a turned box, and showed a blank page without WebGL or the CDN. | The stand-in is not judged until moved. The outline is sampled every 2 ft. The sign is fixed. Failures get a message. | `e289eb9`, `b7f24d7` | e2e `3d`, with a stand-in for three.js. |
| M23 | `build-here.html` L149 | The privacy notice did not name Esri or OpenStreetMap. | A "Where the address goes" block. The asserted help line is unchanged. The block first said that only the lot's location goes to the county servers. The county parcel lookup is a search by street address, and the block now says so. | `dda3f39`, `413e739` | `SecondPassTests`. |
| M24 | `build-here.js` `lead` L1136 | "Copy the message" did nothing when the clipboard was unavailable. The inbox was hard-coded. | Copy reports the failure and shows the text. The inbox is a setting. | `649dd45` | e2e `resilience` R7. |
| M25 | `build-here.css` L88, L121; `build-here-3d.html` | Styles for removed third-party media ("Pascal / CivilCraft") and older layouts were still shipped. | Removed. See "Do these before you merge", step 4. | `88443ce` | `SecondPassTests`. |
| M26 | `build-here.js` L1081, L750; `build-here-landscape.js` L585 | "Setbacks not fully verified" was shown when the setbacks were known and left no envelope. The open-area share went stale after an edit. An unknown share was printed as "none". | Each says what is true. A zero envelope drops Ready cards to Partial. | `2c1592d`, `15a0400`, `08a04bf` | `SecondPassTests`. |
| M27 | `build-here.js` `jsonp` L55, `geocode` L136 | The Census lookup loads another origin's answer as a script, which a strict Content-Security-Policy blocks. | `geocodeUrl`: a same-origin relay. It fails soft to the old route. The plugin ships the relay. | `dda3f39`, `fbc4ae9` | e2e `services` S1, S5. e2e `wp` W3, W7. |
| M28 | `build-here-landscape.js` `discoverParcel` L288 | An auto-discovered parcel layer was used on a nearest-lot guess. | It must carry the address or contain the point. | `dda3f39` | `SecondPassTests`. |
| M29 | `build-here.js` L1099; `build-here-export.js` `sourceItems` L43 | The source list said "Did not answer" for a source that answered with nothing. A lookup service that was down was reported as an address that could not be matched. | "No data from", "Not used", and a separate message for a service that is down. | `dda3f39` | e2e `services` S5b. |

## Low

| ID | Where (PR head) | What was wrong | What changed | Commit |
| --- | --- | --- | --- | --- |
| L1 | `build-here.js` L904 | The footer place line read "ORLEANS PARISH COUNTY". | Fixed. | `649dd45` |
| L2 | `build-here.js` `render` L898 | "Not in a browser-callable record." | Plain words. | `1d0d64e` |
| L3 | `build-here.js` L1095; `build-here.css` L97 | On paper the call to action kept its heading and lost its links, because the print rules hide every button-style link. | The links print as text with their full addresses. | `649dd45` |
| L4 | `build-here.js` L882 | "not a survey.. Edit if you know better." | One period. | `96e0045` |
| L5 | `build-here-3d.html` L19 | The 3D page's social title was the main tool's title, and its menu entry linked to itself. | Fixed. | `b7f24d7`, `e289eb9` |
| L6 | `data/build-here/jurisdictions.json`; `build-here-rules.js` `CITY` L219 | Nothing checked that the data file and the rule table agree. They do today. | A test. | `efc87de` |
| L7 | `build-here-rules.js` `seattleNR` L44 | The diagram keeps 15 ft front and rear setbacks when three or more homes are chosen. The page cannot tell a principal unit from an ADU. | The numbers stay cautious. A note says when 10 ft could apply, and when the home count is over the lot's base allowance. | `08a04bf` |
| L8 | `build-here.html` L148 | `autocomplete="street-address"` fills the street line only, without city and ZIP. | Not changed in the page. The plugin uses `off`. |  |
| L9 | `tests/test_build_here_interact.py` | Needs `websocket-client` and a fixed port. | `tests/e2e/interact_pw.py` runs the same script with Playwright. | `a6e162e` |
| L10 | `generate_site.py` `home_feasibility_tool_section` (excerpt line 10) | The heading replace never matches. | Not in the bundle. See step 3 above. |  |
| L11 | `build-here-stage.js` L62 | The "Edit the facts" link is an in-page fragment (`#bh-confirm`). It works on the page. A browser cannot follow it once the tool is mounted in a shadow root. | Followed by script, and keyboard focus moves to the section heading. | `649dd45` |
| L12 | `build-here.js` L1063 | The 3D seed was stored even when no sketch page exists to read it. | Stored only when a massing page is configured. | `96e0045` |
| L13 | `build-here.js` `ctaHtml` (new), `CFG.links` | A link from configuration with a `javascript:` or `data:` scheme would have been written into the page. | Only relative paths and http(s). | `96e0045` |
| L14 | `scripts/build_kc_resbldg_index.py` | The builder had no offline input and no test. | `--zip`, `--out`, and tests. | `dc93f4c` |
| L15 | `build-here.html`, `build-here-3d.html` | The stylesheet link had no version, so a returning visitor could get new scripts with an old stylesheet. | Versioned. | `efc87de` |

## Portability blockers for the WordPress embed

| ID | Blocker in the PR head | What changed in the source | In the plugin |
| --- | --- | --- | --- |
| W1 | Data read from `/assets/data/` with `credentials: "same-origin"`. | `dataBase`, fetched without credentials. (`00f005d`) | Reads `wp-content/uploads/ppg-build-here/`, or a Data address setting. |
| W2 | Site links hard-coded: permits, bids, rankings, the massing page. | `links`, `massingUrl`, `showRankingsCta`, `cta`. An empty link is left out. (`00f005d`, `649dd45`) | Call-to-action settings. No rankings block. |
| W3 | "Board of Project Stewardship" and its base address written into the study and the saved file. | `brand`, `siteBase`, `contactLine`. (`00f005d`, `649dd45`) | Brand and contact line settings. |
| W4 | Lead form inbox and "Sent from" line hard-coded. | `leadEmail`, `leadSource`. (`649dd45`) | An optional email setting. No form when it is empty. |
| W5 | `document.getElementById`, fixed ids, and a script that starts itself: the tool could not be mounted anywhere but its own page. | `root`, `autoInit`, `init()`. (`e030e04`) | Mounted in a shadow root. No tool id is in the page document. |
| W6 | Six globals on `window` (`BuildHere`, `BuildHereRules`, and four more). | Unchanged on the source site. | One global, `PPGBuildHere`. The build rewrites the rest to a private object. |
| W7 | The stylesheet assumes the source site: dark page, `rem` sizes, viewport media queries, Tailwind utility classes in the markup, page-wide print rules. | Print rules scoped (`bc9d66f`). | Its own markup and base styles in a shadow root. Sizes follow a variable, not the theme's root font size. Layout follows the tool's width. |
| W8 | Printing relied on the page stylesheet. | The print copy carries its styles when mounted in a shadow root. (`e030e04`, `fbc4ae9`) | Print works from inside the shadow root. |
| W9 | The Census lookup needs a script from another origin (JSONP). | `geocodeUrl`. (`dda3f39`, `fbc4ae9`) | A REST route on the site asks the Census from the server. |
| W10 | Data hosting and CORS. A cross-origin data address needs an `Access-Control-Allow-Origin` header. | None needed. | Same-origin by default. The README gives the `curl` check for another host. |
| W11 | GitHub Pages and Jekyll: root-absolute `/assets/` paths, hand-bumped `?v=` strings, a homepage include written by `generate_site.py`, `_config.yml` excludes. | None. These stay on the source site. | One versioned script. No Jekyll. |
| W12 | The 3D sketch needs an import map and three.js from a CDN. | The page reports a missing library. (`b7f24d7`) | Not included. The study leaves out the link. |
| W13 | Outside services are called from the visitor's browser. Terms of use and consent are the embedding site's to settle. | `services` switches. (`dda3f39`) | A checkbox per service. The privacy notice is written from the settings. |
| W14 | The page carries the source site's analytics tag, header and footer. | None. | None of it is in the plugin. |

## Added on 2026-11-13: a missing data file

Asked for by the owner with the C4 decision: handle a missing data file gracefully, and only then. This is not one of the 76 findings.

The page reads one kind of data file, the King County building index (`kc-resbldg/<two digits>.json`). It makes no data-file request at a Snohomish County address.

| Where | Before | After | Commit | Checked by |
| --- | --- | --- | --- | --- |
| `build-here.js` `kingLivingSqft`, `fillForm` | With the file missing, the study appeared, and the list of sources read "HTTP 404". A host that answered the missing file with a web page put the browser's parser message there. The box for the figure said the parcel was not in the county extract, which was not what had happened. A data host that never answered could hold the study: this was the one lookup with no time limit. | The house size is left out and the study is whole. The Data sources page says the file "was not found", "could not be read" or "could not be loaded". The box says the file could not be loaded and asks for the figure. The request has the 20 second limit every map layer has. One request per lookup, no retry. A file that is there is read exactly as before. | `dc9b5fe` | `MissingDataFileTests` under Node: 404 and 410, nine unreadable bodies, a 503, a refused request, a dropped connection, a host that never answers. e2e `king` B5 to B7 in Chrome. B8 and B9 with a real second server: with no `Access-Control-Allow-Origin` header the browser keeps the answer and the figure is left out, and with the header the figure is read. |
| The plugin script, `README.md`, `readme.txt` | The same reader. A new install shows this state until the data folder is uploaded. | The same handling. The README says what each message means and what to check. Version 1.0.1. | `dc9b5fe` | e2e `wp` W12: the folder never uploaded, a web page in its place, and a data address whose request fails. Each time: five cards, eleven pages, "Not entered", a plain note, one request, no script error. |

## A defect this review introduced and then fixed

Commit `015de66` (H1) gave the first-screen map box an aspect ratio and kept `min-height: 14rem`. A minimum height on a box with an aspect ratio becomes a minimum width. The study was then 13 px wider than a 390 px phone and 43 px wider than a 360 px phone. The PR head had no sideways scroll at those widths. The plugin test found it. Commit `14dcf05` removes the minimum height, and a test pins it. Measured after: no sideways scroll from 360 px to 800 px.

## Commits in order

The IDs in this file are final. Two early commit messages use working labels: `e289eb9` says "M-3D" (M22 here), and `00f005d` says "W1 to W4" (W1 to W3 here; the lead-form inbox moved to a setting later, in `649dd45`).

| Commit | Subject | Findings |
| --- | --- | --- |
| `cd6884a` | Option cards: never word "not known" as "none", "coded" or zero | C1, H3, H4, H5 |
| `28b1cb0` | Snohomish County: one clipped footprint source, no double count | C2 |
| `ffa5825` | Parcel selection: rank candidates, prefer the address, flag a location match | C3 |
| `19480c9` | Label typed lot size and zone, trust the city zoning layer, reset stories | H7, H8, H9 |
| `015de66` | First-screen aerial: draw the parcel outline where the parcel is | H1 |
| `bc9d66f` | Print: isolate the study without touching the host page, and print the cards | H2 |
| `b5b09fc` | Downloaded study: overlay, icons, tables and margins that work on a phone | H6 |
| `c500fdc` | Escape hazard labels and allow only http(s) links from map data | H10 |
| `7f4e1cb` | Bound the wait on slow map layers and drop the mail.ru Overpass mirror | H11 |
| `e6d8bdb` | Say "nothing found" only about what was searched | H12 |
| `ea0b039` | Privacy: map on request, scrubbed deep link, tab-scoped seed, vetted discovery hosts | H13 |
| `00f005d` | Move site-specific values into window.BuildHereConfig | W1, W2, W3 |
| `e289eb9` | 3D sketch: check the box that is drawn, and link back to the tool | M22, L5 |
| `11c8f8b` | Tests: regression guards for the review fixes | tests |
| `d276d0c` | Bump asset versions on the tool pages | versions |
| `2cc3f09` | National parcels: read finished area only from unambiguous fields | H14 |
| `ab9c20a` | Plain wording for the held county dataset, and a visible failure message | M1, M2 |
| `15a0400` | Ledger and coverage table: say how each figure was made | M3, M4, M7, M11, M26 |
| `1d0d64e` | Read typed numbers strictly, and keep every year-built record | M5, M6, L2 |
| `08a04bf` | Zoning inputs say where they came from; Sammamish envelope uses the matching row | M8, M14, M26, L7 |
| `2c1592d` | One reading of the lot lines for the diagram, the cards and the 3D seed | M9, M10, M17, M19, M26 |
| `dda3f39` | Take less, show less, and give every outside service a switch | M12, M13, M16, M23, M27, M28, M29, W9, W13 |
| `649dd45` | Failures the visitor can see and recover from, and keyboard gaps | M15, M18, M19, M20, M21, M24, L1, L3, L11, W2, W3, W4 |
| `b7f24d7` | 3D sketch: stand-in house is not judged, whole outline is checked, failures are reported | M18, M19, M22, L5, W12 |
| `88443ce` | Remove styles left behind by removed third-party media sections | M25 |
| `dc93f4c` | King County index: count building rows, publish atomically; add a data-hold check | C4, M7, L14 |
| `e030e04` | Let the tool be mounted outside the page's own document | W5, W8 |
| `efc87de` | Tests for the second-pass fixes, and asset versions | tests, L6, L15 |
| `14dcf05` | First-screen map: drop the minimum height that became a minimum width | H1 (regression) |
| `fbc4ae9` | Embed hooks: print wrapper class, and a geocoder relay that fails soft | M27, W8 |
| `96e0045` | Three small fixes found while building the embed | L4, L12, L13 |
| `7809608` | WordPress plugin for Pacific Pro Group: [ppg_build_here] | W1 to W14 |
| `a6e162e` | Browser scenarios with checks (tests/e2e) | tests, L9 |
| `c0bb027` | King County index builder: say Downloading only when it downloads | M7 |
| `229331f` | Plugin: keep typed backslashes, carry settings safely, load the script on cached pages | plugin |
| `ad820a4` | Remove two trailing spaces | whitespace |
| `413e739` | Privacy notice: say that the matched address reaches the map servers | M23 |
| `2b416ae` | Plugin: hold the page still while the script loads, and keep a width in content-sized layouts | plugin |
| `f3c98c5` | Plugin: an extra copy of the shortcode's element gives back its reserve | plugin |
| `96dc2bd` | Plugin: README for Stryker Digital with security notes, and nonce checks that can fail | plugin |
| `335474f` | Data holds: the Snohomish house-size files stay published, by owner decision | C4 (owner decision) |
| `dc9b5fe` | A missing data file: say so in plain words and leave the house size out (plugin 1.0.1) | owner request, plugin |
| (last) | Review notes: CHANGES.md | this file |

## The WordPress plugin

`wordpress/ppg-build-here/` in the source tree, and `ppg-build-here-1.0.1.zip`. Version 1.0.1 differs from 1.0.0 in one thing: what the study does when a data file is missing (see "Added on 2026-11-13"). Upload the new zip over the old one. Settings and data files stay.

| Part | File | What it does |
| --- | --- | --- |
| Shortcode | `includes/class-ppgbh-shortcode.php` | `[ppg_build_here]` prints one element with the settings as JSON in an attribute, and loads one deferred script on that page only. A second shortcode on the page prints nothing. A page whose content holds the shortcode gets the script even when a cache serves a saved copy of the shortcode's HTML. The element reserves the tool's starting height, so the page below it does not move when the script runs. |
| Script | `assets/js/ppg-build-here.js` | The whole tool. Built by `wordpress/build.py` from the site's own source files. It mounts the tool in a shadow root and adds one name to `window`. About 345 KB, about 100 KB gzipped. |
| Settings | `includes/class-ppgbh-settings.php`, `class-ppgbh-options.php` | Settings > PPG Build Here: data address, brand name and color, light or dark cards, call to action, contact line, optional email form, a switch per outside service, custom CSS. Every value is cleaned when saved and escaped when printed. The settings form and the connection test each carry a nonce, and both need the `manage_options` capability. |
| Address relay | `includes/class-ppgbh-rest.php` | `POST /wp-json/ppg-build-here/v1/geocode`. Asks the US Census from the server. Refuses other sites' browsers, text that is not an address, and more than 30 lookups a minute from one connection. Stores nothing. It has no nonce, on purpose: visitors are not signed in, and a nonce in a cached page expires. |
| Removal | `uninstall.php` | Deletes the settings. Leaves the data files. |
| Guide | `README.md`, `readme.txt` | Written for Stryker Digital. Install steps, data files, caching plugins, SEO, privacy and security notes, ten checks to run after install, troubleshooting. |

Checked by e2e `wp` on a page whose theme uses a 10 px root font, `!important` rules on every form element, and rules that reuse the tool's class names and ids:

- No theme rule reached the tool. The tool changed no theme element.
- A lookup ran through the relay. The browser never called the Census.
- A 420 px column on a 1,280 px screen got the phone layout. Nothing was wider than a 390 px phone.
- Print and Download worked from inside the shadow root. The saved file carried the plugin's brand and none of the source site's.
- Settings that carried markup and `javascript:` links did nothing.
- The page below the tool did not move when the script ran: 0 px at 320, 390, 800 and 1,280 px wide, in a 420 px column, and with the email form.
- In a layout that is only as wide as its content, the tool kept a phone's width (288 px).
- Before the data folder was uploaded, with a web page in its place, and with a data address whose request failed, the study appeared whole. The house size was left out, with a plain note and no script error.

Six defects in the plugin itself were found after it first passed its tests: four on a last read of the PHP against how WordPress and Elementor behave, two by measuring the page around the tool. The test stand-ins and the test theme had shared the code's blind spots. All six are fixed, in `229331f` and `2b416ae`, each with a check that fails on the earlier code.

| Defect | Effect | Fix |
| --- | --- | --- |
| The settings callback removed slashes a second time. WordPress removes them before it calls the callback. | A backslash typed in a setting was lost, such as a CSS escape in the custom styles box. | Nothing is unslashed in the callback. Cleaning a clean value returns the same value. |
| A setting typed with text that looks like an HTML entity, such as `&quot;`, broke the JSON in the settings attribute. | The tool fell back to its built-in defaults without any message: no relay, no data address, no call to action. | The JSON is written so that it holds no character HTML reads. |
| The script was registered only on `wp_enqueue_scripts`. A block theme renders the content before that hook. | On a block theme the script might not load. Hello Elementor is a classic theme and was not affected. | The shortcode registers the script when nobody has. |
| A settings field posted as a list stopped PHP with a type error. | An error page on a crafted save, for an administrator only. | Such a field is treated as empty. |
| In a layout that is only as wide as its content (a row of a flex layout, a centered flex column, an inline-block) the tool was 0 px wide. | The tool was on the page and could not be seen. | The tool claims a phone's width there. The README says how to give it the full width. |
| The shortcode reserved 440 px. The tool starts at about 400 px in a wide column and at 626 to 691 px on a phone. | The page below the tool moved down by 186 to 251 px on phones when the script ran, which counts against the page's layout-shift score. | The reserve follows the width the tool is given. Measured after: 0 px. |

One more guard came from Elementor's documentation: a widget's saved HTML can be served without running the shortcode, and the page would then have no script. The plugin now also loads the script on any page whose content holds the shortcode.

**The plugin has not been run inside WordPress, with Elementor, or in Firefox or Safari.** The PHP was linted and run against stand-ins for the WordPress functions. Install it on staging first and run the ten checks in its README.

## Not verified

- **C4, the source.** Whether `assets/data/house-size/snoh` comes from the held county records. The owner accepted that open question on 2026-11-13 and keeps the data. The review saw neither `scripts/build_index.py` nor the files.
- **The Snohomish house-size files in the study.** No file in the bundle reads them, so the review could not check how the study would use them. See "What changed on 2026-11-13".
- **The zoning law itself.** The review checked that the code applies its own rule tables honestly. It did not check the tables against the municipal codes. Three entries are worth a second look. `KC_URBAN` gives King County R-1 an 8% impervious limit, with a note that 30% is allowed under a condition. The Seattle floor-area note reads "0.8 or 1.0" and "1.0 or 1.2" at two density steps, and the code uses the lower figure of each pair. A Kenmore R-1 lot under 15,000 sf is switched to the R-4 table, and its density row then reads 4 units per acre.
- **Live services.** Every lookup ran against stand-ins. Not checked: that each live service still answers as the code expects, sends the headers a browser needs, and permits this use. Read the terms for the Esri World Geocoder, Esri World Imagery, the public Overpass servers and the Google Maps embed before relying on them commercially.
- **GitHub Pages CORS.** Whether the source site's data files are served with `Access-Control-Allow-Origin`, which matters only if the plugin's Data address is pointed at them.
- **The 3D page with the real three.js.** The CDN was not reachable. The page's logic ran against a stand-in that draws nothing.
- **Browsers.** Chrome only. Printing in Firefox and Safari was not tried.
- **The site menu.** Both tool pages still link to `pascal-editor.html` ("Pascal Editor Sketch") in the site menu, and `build-here.html` also in its footer. The repository's own test requires that name to be gone from the page body. The linked page is not in the bundle, so the review cannot say whether the entry is a dead link. The menu is written by the site generator.
- **Deep links and analytics.** The tool takes an address out of the page link when the page opens. A tag in the page head, such as the Google tag on the source site, can send its page view before that. Whether it does was not tested: the tag was answered by a stand-in in every run. Do not publish links with a street address in them.
- **Pacific Pro Group's brand colors.** The review could read the text of pacificprogroup.com but not its stylesheets or logo colors. The plugin's default color is the tool's own dark green, `#14532d`, on light cards. Set the real brand color under Settings > PPG Build Here.
- **Three repository tests** that need files outside the bundle (step 7 above).
- **Files outside the bundle.** `site.css`, `index.html`, `generate_site.py`, `_config.yml`, `sitemap.xml`, `scripts/build_index.py` and `assets/data/**` were not reviewed, apart from the two excerpts supplied.

## New files

| Path | Purpose |
| --- | --- |
| `scripts/check_data_holds.py`, `data/build-here/data-holds.json` | The data-hold check and its list. |
| `tests/test_build_scripts.py` | Tests for the King County index builder and the data-hold check. |
| `tests/test_wordpress_plugin.py` | Tests that the plugin script is current and its PHP passes. |
| `tests/e2e/` | Browser scenarios with checks, their stand-in service layer, and a stand-in for three.js. |
| `wordpress/` | The plugin, its build script, its source pieces and its tests. |
| `docs/pr208-review/` | This file and the patch series. |
