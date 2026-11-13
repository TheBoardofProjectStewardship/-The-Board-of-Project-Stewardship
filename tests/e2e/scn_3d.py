#!/usr/bin/env python3
"""The massing sketch page, run with a stand-in for three.js (the CDN is not reachable from the test
machine, so nothing is drawn; the page's own logic is what runs).

T1  A seeded lot: 50 x 100 ft, envelope 40 x 70 ft, 1,200 sf footprint on record.
    What does the page say about the stand-in house box?
T2  An L-shaped envelope and a thin box laid across the notch: all four corners are inside.
T3  Move a box from the keyboard.
T4  Idle: does the scene keep redrawing?
T5  No WebGL.  T6  The 3D library does not arrive.

Usage: python3 scn_3d.py REPO_DIR OUT_DIR [PORT]
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mocklib as m  # noqa: E402

repo = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
port = int(sys.argv[3]) if len(sys.argv) > 3 else 8795
out.mkdir(parents=True, exist_ok=True)
STUB = Path(__file__).resolve().parent / "stub"
cdn = {"ok": True}
RING = [[-25, -50], [25, -50], [25, 50], [-25, 50], [-25, -50]]


def handler(host, path, p, body, url):
    if host == "cdn.jsdelivr.net":
        if not cdn["ok"]:
            return (404, "not found")
        name = "OrbitControls.js" if "OrbitControls" in path else "three.module.js"
        return ("text/javascript", (STUB / name).read_text())
    return None


def seed(env_rows, footprint):
    s = {"address": "100 TEST ST", "zone": "NR3", "lot": 5000, "footprint": footprint, "stories": 1, "coverage": 2500, "height": 32,
         "setbacks": {"front": 15, "side": 5, "rear": 15}, "ring": RING, "env": {"rows": env_rows, "area": 2800}, "front": {"x": 0, "y": -50}}
    # Both stores: the PR head read the seed from localStorage, the patched page reads sessionStorage.
    return "sessionStorage.setItem('bh3dSeed', JSON.stringify(%s)); localStorage.setItem('bh3dSeed', sessionStorage.getItem('bh3dSeed'));" % json.dumps(s)


ROWS = "() => Object.fromEntries([...document.querySelectorAll('#b3-check tr')].map(r => [r.querySelector('th').textContent, r.querySelector('td').textContent]))"
res = {}
with m.served(repo, port), m.browser_page() as page:
    page.route("**/*", m.Mock(handler, port).route)
    url = "http://127.0.0.1:%d/build-here-3d.html" % port
    # T1
    page.goto(url)
    page.evaluate(seed([[-20, -35, 40, 70]], 1200))
    page.reload()
    page.wait_for_selector("#b3-check tr", state="attached", timeout=8000)
    res["T1"] = {"info": page.inner_text("#b3-info"), "rows": page.evaluate(ROWS)}
    # T4 idle redraws
    a = page.evaluate("() => window.__renders")
    page.wait_for_timeout(700)
    res["T4"] = {"rendersInIdle700ms": page.evaluate("() => window.__renders") - a}
    # T3 keyboard move
    labels = page.evaluate("() => ['b3-w','b3-d','b3-f','b3-r','b3-x','b3-y'].map(id => { const e = document.getElementById(id); return e ? e.getAttribute('aria-label') : null; })")
    page.select_option("#b3-kind", "adu")
    page.click("#b3-add")
    hasXY = bool(page.query_selector("#b3-x"))
    if hasXY:
        page.fill("#b3-x", "0"); page.fill("#b3-y", "0")
        inside = page.evaluate(ROWS)["Inside setbacks"]
        page.fill("#b3-x", "15")
        res["T3"] = {"inputLabels": labels, "atCenter": inside, "after15ftEast": page.evaluate(ROWS)["Inside setbacks"]}
    else:
        res["T3"] = {"inputLabels": labels, "keyboardMove": "no position inputs on this page"}
    # T2 L-shaped envelope, thin box across the notch
    page.evaluate(seed([[-20, -35, 40, 30], [-20, -5, 15, 40]], None))
    page.reload()
    page.wait_for_selector("#b3-check tr", state="attached", timeout=8000)
    page.select_option("#b3-kind", "deck")
    page.click("#b3-add")
    page.fill("#b3-w", "56"); page.fill("#b3-d", "4"); page.fill("#b3-r", "61.6")
    if hasXY:
        page.fill("#b3-x", "1.5"); page.fill("#b3-y", "5")
    res["T2"] = {"rows": page.evaluate(ROWS).get("Inside setbacks")}
    # T5 no WebGL
    page.add_init_script("window.__noWebGL = true;")
    page.reload()
    page.wait_for_timeout(600)
    res["T5"] = {"info": page.inner_text("#b3-info")}
    res["pageErrors"] = page.errors[:]

with m.served(repo, port + 1), m.browser_page() as page:
    cdn["ok"] = False
    page.route("**/*", m.Mock(handler, port + 1).route)
    page.goto("http://127.0.0.1:%d/build-here-3d.html" % (port + 1))
    page.wait_for_timeout(7000)
    res["T6"] = {"info": page.inner_text("#b3-info")}

print(json.dumps(res, indent=1))
(out / "sketch.json").write_text(json.dumps(res, indent=1))
