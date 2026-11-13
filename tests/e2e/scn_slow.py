#!/usr/bin/env python3
"""How long does a study take when the public Overpass servers refuse the request
at once (HTTP 429, the common busy answer)? Everything else answers instantly.
Usage: scn_slow.py REPO [PORT]"""
import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mocklib as m
repo = Path(sys.argv[1]).resolve()
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8777
LON, LAT = -122.36, 47.81
lot = m.rect(LON, LAT, -40, -10, 40, 115)
subject = m.feature(lot, PARCEL_ID="00123400000100", Site_House_Number="123", Site_Address="123 MAIN ST", Site_City="EDMONDS", Acres_Gross=0.23, Property_Account_Summary="https://www.snoco.org/proptax/1")
asked = []

def handler(host, path, p, body, url):
    if host == "geocoding.geo.census.gov":
        return m.census("123 MAIN ST, EDMONDS, WA, 98020", LON, LAT, "Snohomish County", "WA", "Washington", "Edmonds city")
    if host == "gis.snoco.org":
        if "SAS_Parcels" in path:
            return {"features": [subject]}
        if "BUILDINGS__roofprints" in path:
            return {"features": [m.feature(m.rect(LON, LAT, -25, 20, 25, 60))]}
        if "SAS_Cities" in path:
            return {"features": [{"attributes": {"NAME": "EDMONDS"}}]}
        if "SAS_Imagery" in path:
            return ("image/svg+xml", m.aerial_svg([float(x) for x in p["bbox"].split(",")], [lot]))
    if host == "maps.edmondswa.gov":
        return {"features": [{"attributes": {"ZONING": "LDR-M"}}]}
    if "overpass" in host or host == "maps.mail.ru":
        asked.append(host)
        return "BUSY"
    if host == "elevation.nationalmap.gov":
        return m.dem_samples(body, LON, LAT)
    return None

class Busy(m.Mock):
    def route(self, route, request):
        import urllib.parse
        h = urllib.parse.urlsplit(request.url).hostname or ""
        if "overpass" in h or h == "maps.mail.ru":
            asked.append(h)
            route.fulfill(status=429, headers={"Access-Control-Allow-Origin": "*"}, body="rate limited")
            return
        super().route(route, request)

with m.served(repo, port), m.browser_page() as page:
    page.route("**/*", Busy(handler, port).route)
    t = time.time()
    status = m.run_lookup(page, port, "123 Main St, Edmonds, WA 98020", wait_ms=120000)
    print({"secondsToStudy": round(time.time() - t, 1), "overpassHostsAsked": asked, "cards": page.evaluate("() => document.querySelectorAll('.bh-scenario').length"), "driveway": page.evaluate("() => { const r = [...document.querySelectorAll('table.bh-land tbody tr')].find(r => /Driveway/.test(r.textContent)); return r ? r.children[1].textContent : null; }")})
