#!/usr/bin/env python3
"""A map-service attribute that contains markup: does it reach the page as HTML?
The City of Kenmore shoreline layer's designation text is the carrier here.
Usage: scn_xss.py REPO [PORT]"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mocklib as m
repo = Path(sys.argv[1]).resolve()
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8776
LON, LAT = -122.245, 47.757
lot = m.feature(m.rect(LON, LAT, -30, 5, 30, 125), PIN="7777777777", ADDR_FULL="18000 EXAMPLE PL NE", CTYNAME="KENMORE", LOTSQFT=7200, KCA_ZONING="R6", PREUSE_DESC="Single Family")
PAYLOAD = 'Shoreline Residential<img src=x onerror="window.__injected=1">'

def handler(host, path, p, body, url):
    if host == "geocoding.geo.census.gov":
        return m.census("18000 EXAMPLE PL NE, KENMORE, WA, 98028", LON, LAT, "King County", "WA", "Washington", "Kenmore city")
    if host == "gismaps.kingcounty.gov" and "KingCo_PropertyInfo" in path:
        return {"features": [lot]}
    if host == "gwa.kenmorewa.gov" and "Shoreline_Designations" in path:
        return {"features": [{"attributes": {"env_des_LF": PAYLOAD}}]}
    if "overpass" in host or host == "maps.mail.ru":
        return {"elements": []}
    if host == "elevation.nationalmap.gov":
        return m.dem_samples(body, LON, LAT)
    return None

with m.served(repo, port), m.browser_page() as page:
    page.route("**/*", m.Mock(handler, port).route)
    m.run_lookup(page, port, "18000 Example Pl NE, Kenmore, WA 98028")
    page.wait_for_timeout(300)
    print({"scriptRan": page.evaluate("() => window.__injected === 1"), "injectedImgTags": page.evaluate("() => document.querySelectorAll('#bh-report img[src=\"x\"]').length"), "errors": page.errors})
