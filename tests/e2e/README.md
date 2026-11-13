# Browser scenarios

These scripts open the real pages in headless Chrome and check what a visitor would see. They were written during the review of pull request 208 to confirm each finding on the unmodified code and each fix after it.

```
python3 tests/e2e/run_all.py            # every scenario, with its checks (a minute or two; longer on a busy machine)
python3 tests/e2e/run_all.py wp king    # only the named scenarios
```

Needs Python 3.9 or newer with Playwright (`pip install playwright`) and a Chrome or Chromium that Playwright can start.

## Nothing leaves the machine

`mocklib.py` answers every request the page makes: the US Census geocoder, the county and city map servers, USGS, OpenStreetMap, Esri, Google, and the three.js CDN. No real address is sent anywhere, and the run works offline.

The answers are small made-up lots whose correct result is known. A 50 x 100 ft corner lot with 15, 15 and 5 ft setbacks has a 30 x 70 ft envelope, so a study that says 2,100 sf is right and one that says 1,600 sf is wrong. That is what makes the numbers checkable.

This is also the limit of these tests. They show what the code does with a given answer. They do not show that a live service still gives that answer, still sends the headers a browser needs, or still exists.

One pair of runs uses a real second server on this machine, not a written answer: `scn_king.py` B8 and B9, a data folder on another host. Whether a page may read another host's file is the browser's decision, made from the header that host sends. An answer written by `mocklib.py` cannot show a refusal, because Playwright adds that header to every answer it writes.

## What each scenario covers

| Script | What it asks |
| --- | --- |
| `interact_pw.py` | Runs the repository's own interaction script (`tests/test_build_here_interact.py`) with Playwright, for machines without the `websocket-client` module. |
| `scn_edmonds.py` | A Snohomish County lot with a neighbor's roof over the line. Is the house counted once, clipped to the lot? Is the parcel outline drawn where the parcel is in the photo? |
| `scn_king.py` | The county address search finds nothing: which nearby lot is used? Assessor zone or city zone? Do stories carry over between addresses? What do the cards say in a city with no coded zones? What does the study do when the data file for a parcel is not there, is a web page, cannot be fetched, or sits on a host that does not let the page read it? |
| `scn_sno_street.py` | A same-number address on another street 900 ft away. Which lot is used? |
| `scn_geometry.py` | A corner lot, and a parcel record with two outline rings. |
| `scn_services.py` | Embed settings: geocoder relay, service switches. A neighbor's record numbers. Year built from two records. Typed lot sizes such as `-5000`. A relay that is down. |
| `scn_resilience.py` | A failed aerial photo. Download feedback. The sample-study hook on another host. Keyboard focus. Heading levels. A blocked clipboard. |
| `scn_print.py`, `scn_homeprint.py` | Printing: a host page that only loads the stylesheet, the browser's own Print command, the Print button, and whether the option cards reach the paper. |
| `scn_xss.py` | Markup inside a map-service attribute. |
| `scn_slow.py` | OpenStreetMap servers that answer "busy". How long does the study take? |
| `scn_privacy.py` | Where the address goes, when Google is called, and what stays in the browser. |
| `scn_config.py` | Does the page honor `window.BuildHereConfig`? |
| `scn_3d.py` | The massing sketch page, with a stand-in for three.js (`stub/`). Nothing is drawn. The page's own logic is what runs. |
| `scn_wp.py` | The WordPress plugin's script on a page whose theme is written to break an embedded widget (`wordpress/tests/theme-page.html`). Also the plugin before its data folder is uploaded. |

Most scripts can also be pointed at another checkout to compare before and after:

```
python3 tests/e2e/scn_geometry.py /path/to/other/checkout /tmp/out 8781
```
