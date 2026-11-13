#!/usr/bin/env python3
"""Scenario A: an Edmonds (Snohomish County) lot with a house, a detached garage,
and a neighbor's roof that pokes 1 ft over the mapped lot line.

Ground truth built into the mocks:
  lot 80 x 125 ft = 10,000 sf, zone LDR-M (35% coverage cap = 3,500 sf)
  house roof 50 x 40 = 2,000 sf, detached garage roof 20 x 25 = 500 sf
  neighbor roof 45 x 40 = 1,800 sf, of which 1 x 40 = 40 sf is over the line
  buildings truly on this lot = 2,540 sf, so coverage room = 960 sf

Usage: python3 scn_edmonds.py REPO_DIR OUT_DIR [PORT]
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mocklib as m  # noqa: E402

repo = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
port = int(sys.argv[3]) if len(sys.argv) > 3 else 8771
out.mkdir(parents=True, exist_ok=True)

LON, LAT = -122.36, 47.81
lot = m.rect(LON, LAT, -40, -10, 40, 115)
east = m.rect(LON, LAT, 40, -10, 120, 115)
west = m.rect(LON, LAT, -120, -10, -40, 115)
north = m.rect(LON, LAT, -40, 115, 40, 240)
house = m.rect(LON, LAT, -25, 20, 25, 60)
garage = m.rect(LON, LAT, 10, 80, 30, 105)
nbr_roof = m.rect(LON, LAT, 39, 20, 84, 60)

subject = m.feature(lot, PARCEL_ID="00123400000100", Site_House_Number="123", Site_Address="123 MAIN ST", Site_City="EDMONDS",
                    Acres_Gross=0.23, Property_Account_Summary="https://www.snoco.org/proptax/00123400000100")


def handler(host, path, p, body, url):
    if host == "geocoding.geo.census.gov":
        return m.census("123 MAIN ST, EDMONDS, WA, 98020", LON, LAT, "Snohomish County", "WA", "Washington", "Edmonds city")
    if host == "gis.snoco.org":
        if "SAS_Parcels" in path:
            if "where" in p:
                return {"features": [subject]}
            return {"features": [subject, m.feature(east, PARCEL_ID="E"), m.feature(west, PARCEL_ID="W"), m.feature(north, PARCEL_ID="N")]}
        if "BUILDINGS__roofprints" in path:
            return {"features": [m.feature(house), m.feature(garage), m.feature(nbr_roof)]}
        if "SAS_Cities" in path:
            return {"features": [{"attributes": {"NAME": "EDMONDS"}}]}
        if "SAS_Imagery" in path:
            return ("image/svg+xml", m.aerial_svg([float(x) for x in p["bbox"].split(",")], [lot]))
    if host == "maps.edmondswa.gov":
        return {"features": [{"attributes": {"ZONING": "LDR-M"}}]}
    if "overpass" in host or host == "maps.mail.ru":
        return {"elements": []}
    if host == "elevation.nationalmap.gov":
        return m.dem_samples(body, LON, LAT)
    return None


mock = m.Mock(handler, port)
res = {}
with m.served(repo, port), m.browser_page() as page:
    page.route("**/*", mock.route)
    res["status"] = m.run_lookup(page, port, "123 Main St, Edmonds, WA 98020")
    res["footprintField"] = page.input_value("#bh-footprint")
    res["footprintSource"] = page.inner_text("#bh-footprint-src")
    res["cards"] = page.evaluate(m.CARDS_JS)
    res["coverageCap"] = page.evaluate(m.ROW_JS, "Lot coverage cap")
    res["footprintRoom"] = page.evaluate(m.ROW_JS, "Footprint room left")
    res["landscapeRows"] = page.evaluate("""() => [...document.querySelectorAll('table.bh-land tbody tr')].map(r => r.querySelector('th').textContent + ' = ' + r.querySelector('td').textContent + ' [' + r.children[3].textContent + ']')""")
    res["ledger"] = page.evaluate("""() => [...document.querySelectorAll('table.bh-measures tbody tr')].map(r => r.querySelector('th').textContent + ' = ' + r.querySelector('td').textContent)""")
    res["overlay"] = page.evaluate("""() => {
      const map = document.querySelector('.bh-stage-map'), img = map.querySelector('img'), svg = map.querySelector('svg'), path = svg.querySelector('path');
      const mb = map.getBoundingClientRect(), pb = path.getBoundingClientRect();
      const nums = path.getAttribute('d').match(/-?[0-9.]+/g).map(Number);
      const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const cs = getComputedStyle(img), fit = cs.objectFit;
      const s = fit === 'cover' ? Math.max(mb.width / 800, mb.height / 600) : Math.min(mb.width / 800, mb.height / 600);
      const ox = (mb.width - 800 * s) / 2, oy = (mb.height - 600 * s) / 2;
      return { stageBox: [Math.round(mb.width), Math.round(mb.height)], imgFit: fit, svgPreserve: svg.getAttribute('preserveAspectRatio') || '(default xMidYMid meet)',
        photoScale: +s.toFixed(3),
        lotInPhotoPx: [Math.round(ox + x0 * s), Math.round(oy + y0 * s), Math.round((x1 - x0) * s), Math.round((y1 - y0) * s)],
        outlineDrawnPx: [Math.round(pb.left - mb.left), Math.round(pb.top - mb.top), Math.round(pb.width), Math.round(pb.height)] };
    }""")
    page.locator(".bh-stage-map").screenshot(path=str(out / "stage_desktop.png"))
    with page.expect_download() as dl:
        page.click("#bh-download")
    dl.value.save_as(str(out / "feasibility-study.html"))
    res["hosts"] = dict(sorted(mock.hosts.items()))
    res["pageErrors"] = page.errors
    # Phone-width pass of the same lookup.
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(100)
    res["overlayPhone"] = page.evaluate("""() => { const map = document.querySelector('.bh-stage-map'), path = map.querySelector('svg path'); const mb = map.getBoundingClientRect(), pb = path.getBoundingClientRect(); return { stageBox: [Math.round(mb.width), Math.round(mb.height)], outlineDrawnPx: [Math.round(pb.left - mb.left), Math.round(pb.top - mb.top), Math.round(pb.width), Math.round(pb.height)] }; }""")
    page.locator(".bh-stage-map").screenshot(path=str(out / "stage_phone.png"))

for key in ("status", "footprintField", "footprintSource", "coverageCap", "footprintRoom"):
    print(key + ":", res[key])
print("landscape rows:")
for r in res["landscapeRows"]:
    print("   ", r)
print("ledger:")
for r in res["ledger"]:
    print("   ", r)
print("cards:")
for c in res["cards"]:
    print("    [%s] %s :: %s\n        %s" % (c["state"].upper(), c["title"], c["metric"], c["line"]))
print("overlay desktop:", json.dumps(res["overlay"]))
print("overlay phone:", json.dumps(res["overlayPhone"]))
print("hosts contacted:", json.dumps(res["hosts"]))
print("page errors:", res["pageErrors"])
(out / "edmonds.json").write_text(json.dumps(res, indent=1))
