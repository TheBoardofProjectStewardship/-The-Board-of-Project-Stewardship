#!/usr/bin/env python3
"""What the visitor sees when something outside the page fails, and a few keyboard paths.

R1  The county aerial server answers 500. What is on the first screen?
R2  The county aerial and Esri World Imagery both fail.
R3  Download study: is anything said?
R4  ?sample=1 on a host that is not a local test server.
R5  Remove a typed number with the keyboard: where is focus afterwards?
R6  Option-card heading levels, and the Edit the facts link.
R7  Lead form: the clipboard is unavailable. What does Copy the message do?

Usage: python3 scn_resilience.py REPO_DIR OUT_DIR [PORT]
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mocklib as m  # noqa: E402

repo = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
port = int(sys.argv[3]) if len(sys.argv) > 3 else 8789
out.mkdir(parents=True, exist_ok=True)

LON, LAT = -122.340, 47.690
LOT = m.feature(m.rect(LON, LAT, -25, 5, 25, 105), PIN="4444444444", ADDR_FULL="100 FIRST ST", CTYNAME="SEATTLE", LOTSQFT=5000, KCA_ZONING="NR3", PREUSE_DESC="Single Family(Res Use/Zone)")
mode = {"county": "fail", "world": "ok"}


def handler(host, path, p, body, url):
    if host == "local":
        return {"src": "mock", "asOf": "2026-10-20", "b": {"4444444444": [1800, 1962, 1, 1800, 0, 1]}}
    if host == "geocoding.geo.census.gov":
        return m.census("100 FIRST ST, SEATTLE, WA, 98103", LON, LAT, "King County", "WA", "Washington", "Seattle city")
    if host == "gismaps.kingcounty.gov":
        if "KingCo_PropertyInfo" in path:
            if "PIN=" in p.get("where", ""):
                return {"features": [{"attributes": {"MAJOR": "444444", "MINOR": "4444", "PLAT_NAME": "EXAMPLE ADD"}}]}
            return {"features": [LOT]}
        if "KingCo_Aerial" in path:
            return (500, "{}") if mode["county"] == "fail" else ("image/svg+xml", m.aerial_svg([float(x) for x in p["bbox"].split(",")], LOT["geometry"]["rings"]))
        return None
    if host == "services.arcgisonline.com":
        return (500, "{}") if mode["world"] == "fail" else ("image/svg+xml", m.aerial_svg([float(x) for x in p["bbox"].split(",")], LOT["geometry"]["rings"]))
    if host == "services.arcgis.com":
        if "Current_Land_Use_Zoning_Detail" in path:
            return {"features": [{"attributes": {"ZONING": "NR3", "ZONELUT": "NR3"}}]}
        if "Building_Outlines_2023" in path:
            return {"features": [m.feature(m.rect(LON, LAT, -15, 30, 15, 80))]}
        return None
    if "overpass" in host or host == "maps.mail.ru":
        return {"elements": []}
    if host == "elevation.nationalmap.gov":
        return m.dem_samples(body, LON, LAT, 0.01, 0.01)
    return None


STAGE_JS = """() => { const map = document.querySelector('#bh-report .bh-stage-map'); const img = map && map.querySelector('img');
  return { img: img ? { host: new URL(img.src).host, loaded: img.complete && img.naturalWidth > 0 } : null, diagram: !!(map && map.querySelector('svg.bh-siteplan')),
    caption: (document.querySelector('#bh-report .bh-aerial figcaption') || {}).textContent || null,
    note: [...document.querySelectorAll('#bh-report .bh-muted')].map(e => e.textContent).filter(t => /aerial photo/.test(t))[0] || null }; }"""

res = {}
with m.served(repo, port), m.browser_page() as page:
    mock = m.Mock(handler, port, sites={"widget.example": repo})
    page.route("**/*", mock.route)
    m.run_lookup(page, port, "100 First St, Seattle, WA 98103")
    page.wait_for_timeout(700)
    res["R1"] = page.evaluate(STAGE_JS)
    page.locator(".bh-stage-map").screenshot(path=str(out / "r1_stage.png"))
    mode["county"] = "ok"
    # R3
    with page.expect_download(timeout=5000) as dl:
        page.click("#bh-download")
    res["R3"] = {"file": dl.value.suggested_filename, "status": page.evaluate("() => (document.getElementById('bh-export-status') || document.getElementById('bh-status')).textContent")}
    # R5: add a number, then remove it from the keyboard
    page.select_option("#bh-man-kind", "driveway")
    page.fill("#bh-man-sf", "400")
    page.fill("#bh-man-source", "Survey sheet 2")
    page.select_option("#bh-man-method", "survey")
    page.evaluate("() => document.getElementById('bh-manual-form').requestSubmit()")
    page.focus("#bh-manual-list [data-man-del]")
    page.keyboard.press("Enter")
    page.wait_for_timeout(150)
    res["R5"] = {"focusOn": page.evaluate("() => document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null"), "note": page.inner_text("#bh-man-note")}
    # R6
    res["R6"] = {
        "headings": page.evaluate("() => [...document.querySelectorAll('#bh-report .bh-stage-page h2, #bh-report .bh-stage-page h3, #bh-report .bh-stage-page h4')].map(h => h.tagName + ': ' + h.textContent.slice(0, 28))"),
        "kickerStyle": page.evaluate("() => { const c = getComputedStyle(document.querySelector('.bh-scenario-kicker')); return [c.fontSize, c.textTransform, c.letterSpacing, c.marginBottom, c.fontWeight].join(' '); }"),
    }
    page.click('#bh-report a[href="#bh-confirm"]')
    page.wait_for_timeout(150)
    res["R6"]["afterEditLink"] = page.evaluate("() => ({ focus: document.activeElement.id || document.activeElement.tagName, top: Math.round(document.getElementById('bh-confirm').getBoundingClientRect().top) })")
    # R7: no clipboard at all
    page.evaluate("() => { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); document.execCommand = () => false; window.__nav = []; }")
    page.fill("#bh-lead-name", "Test Person")
    page.fill("#bh-lead-email", "test@example.com")
    page.evaluate("() => { const f = document.getElementById('bh-lead'); f.addEventListener('submit', () => {}, true); }")
    page.route("mailto:*", lambda r: r.abort())
    page.evaluate("() => document.getElementById('bh-lead').requestSubmit()")
    page.wait_for_timeout(200)
    if page.query_selector("#bh-lead-copy"):
        page.click("#bh-lead-copy")
        page.wait_for_timeout(150)
        res["R7"] = {"button": page.inner_text("#bh-lead-copy"), "textShown": bool(page.query_selector("#bh-lead-text")), "textStart": (page.input_value("#bh-lead-text")[:40] if page.query_selector("#bh-lead-text") else None)}
    else:
        res["R7"] = {"error": "no copy button", "status": page.inner_text("#bh-lead-status")}
    # R4: the sample hook on another host name
    page.goto("http://widget.example/build-here.html?sample=1")
    page.wait_for_timeout(600)
    res["R4"] = {"host": page.evaluate("() => location.hostname"), "cards": page.evaluate("() => document.querySelectorAll('.bh-scenario').length"), "status": page.inner_text("#bh-status")}
    res["pageErrors"] = page.errors

# R2 in a fresh browser, so the World Imagery picture from R1 is not answered from the image cache.
mode["county"] = "fail"; mode["world"] = "fail"
with m.served(repo, port + 1), m.browser_page() as page:
    page.route("**/*", m.Mock(handler, port + 1).route)
    m.run_lookup(page, port + 1, "100 First St, Seattle, WA 98103")
    page.wait_for_timeout(900)
    res["R2"] = page.evaluate(STAGE_JS)
    page.locator(".bh-stage-map").screenshot(path=str(out / "r2_stage.png"))
    res["pageErrors"] += page.errors

print(json.dumps(res, indent=1))
(out / "resilience.json").write_text(json.dumps(res, indent=1))
