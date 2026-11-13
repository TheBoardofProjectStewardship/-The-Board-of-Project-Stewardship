#!/usr/bin/env python3
"""Lot-line reading on two parcel shapes, through the real page.

G1  A 50 x 100 ft corner lot in Seattle NR3: street on the south and east,
    neighbors on the north and west. Setbacks 15 front, 15 rear, 5 side.
    One front, one street side, one rear, one side leaves 30 x 70 = 2,100 sf.
    Two fronts and two rears leaves 20 x 70 = 1,400 sf.
G2  A mid-block 50 x 100 ft lot whose parcel record has two rings: a 5 x 20 ft
    sliver first, then the lot. The envelope of the lot is 40 x 70 = 2,800 sf.

Usage: python3 scn_geometry.py REPO_DIR OUT_DIR [PORT]
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mocklib as m  # noqa: E402

repo = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
port = int(sys.argv[3]) if len(sys.argv) > 3 else 8781
out.mkdir(parents=True, exist_ok=True)

BASE = {"g1": (-122.340, 47.690), "g2": (-122.350, 47.700)}
ADDR = {
    "100 Corner St, Seattle, WA 98103": ("g1", "100 CORNER ST, SEATTLE, WA, 98103"),
    "200 Sliver St, Seattle, WA 98103": ("g2", "200 SLIVER ST, SEATTLE, WA, 98103"),
}
cur = {"k": None}


def lot(key, pin, addr, x0, y0, x1, y1, extra_ring=None):
    lon, lat = BASE[key]
    f = m.feature(m.rect(lon, lat, x0, y0, x1, y1), PIN=pin, ADDR_FULL=addr, CTYNAME="SEATTLE", LOTSQFT=5000, KCA_ZONING="NR3", PREUSE_DESC="Single Family(Res Use/Zone)")
    if extra_ring:
        f["geometry"]["rings"].insert(0, m.rect(lon, lat, *extra_ring))
    return f


PARCELS = {
    "g1": {"true": lot("g1", "7000000001", "100 CORNER ST", -25, 5, 25, 105),
           "north": lot("g1", "7000000002", "104 CORNER ST", -25, 105, 25, 205),
           "west": lot("g1", "7000000003", "96 CORNER ST", -75, 5, -25, 105)},
    "g2": {"true": lot("g2", "7100000001", "200 SLIVER ST", -25, 5, 25, 105, extra_ring=(-140, 5, -135, 25)),
           "north": lot("g2", "7100000002", "1 BACK ST", -25, 105, 25, 205),
           "west": lot("g2", "7100000003", "196 SLIVER ST", -75, 5, -25, 105),
           "east": lot("g2", "7100000004", "204 SLIVER ST", 25, 5, 75, 105)},
}


def handler(host, path, p, body, url):
    if host == "local":
        return {"src": "mock", "asOf": "2026-10-01", "b": {}}
    if host == "geocoding.geo.census.gov":
        key, matched = ADDR[p["address"]]
        cur["k"] = key
        lon, lat = BASE[key]
        return m.census(matched, lon, lat, "King County", "WA", "Washington", "Seattle city")
    k = cur["k"]
    lon, lat = BASE[k] if k else (0, 0)
    if host == "gismaps.kingcounty.gov":
        if "KingCo_PropertyInfo" in path:
            where = p.get("where", "")
            if "ADDR_FULL LIKE" in where:
                return {"features": [PARCELS[k]["true"]]}
            if "PIN=" in where:
                return {"features": [{"attributes": {"MAJOR": "700000", "MINOR": "0001", "PLAT_NAME": "EXAMPLE ADD"}}]}
            return {"features": list(PARCELS[k].values())}
        if "KingCo_Aerial" in path:
            return ("image/svg+xml", m.aerial_svg([float(x) for x in p["bbox"].split(",")], PARCELS[k]["true"]["geometry"]["rings"]))
        return None
    if host == "services.arcgis.com":
        if "Current_Land_Use_Zoning_Detail" in path:
            return {"features": [{"attributes": {"ZONING": "NR3", "ZONELUT": "NR3"}}]}
        if "Building_Outlines_2023" in path:
            return {"features": [m.feature(m.rect(lon, lat, -12, 35, 12, 75))]}
        return None
    if "overpass" in host or host == "maps.mail.ru":
        return {"elements": []}
    if host == "elevation.nationalmap.gov":
        return m.dem_samples(body, lon, lat, 0.005, 0.005)
    return None


EDGES_JS = """() => { const svg = [...document.querySelectorAll('#bh-report svg.bh-siteplan')].pop(); if (!svg) return null;
  const n = (c) => svg.querySelectorAll('line.bh-edge-' + c).length;
  return { front: n('front'), street: n('street'), side: n('side'), rear: n('rear') }; }"""

res = {}
with m.served(repo, port), m.browser_page() as page:
    page.route("**/*", m.Mock(handler, port).route)
    for tag, address in (("G1", "100 Corner St, Seattle, WA 98103"), ("G2", "200 Sliver St, Seattle, WA 98103")):
        m.run_lookup(page, port, address)
        res[tag] = {
            "envelope": page.evaluate(m.ROW_JS, "Buildable envelope"),
            "edges": page.evaluate(EDGES_JS),
            "key": page.evaluate("() => [...document.querySelectorAll('#bh-report .bh-plan-key li')].map(li => li.textContent)"),
            "caption": page.evaluate("() => { const svg = [...document.querySelectorAll('#bh-report svg.bh-siteplan')].pop(); const p = svg && svg.parentNode.querySelector('p.bh-muted'); return p ? p.textContent : null; }"),
            "cards": [(c["title"], c["state"], c["metric"]) for c in page.evaluate(m.CARDS_JS)],
            "addition": page.evaluate(m.CARDS_JS)[0]["line"],
        }
        svg = page.locator("#bh-report svg.bh-siteplan").last
        if svg.count():
            svg.screenshot(path=str(out / (tag.lower() + "_siteplan.png")))
    res["pageErrors"] = page.errors

print(json.dumps(res, indent=1))
(out / "geometry.json").write_text(json.dumps(res, indent=1))
