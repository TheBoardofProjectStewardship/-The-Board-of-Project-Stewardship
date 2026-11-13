#!/usr/bin/env python3
"""Where does the address go, and what stays behind?  Usage: scn_privacy.py REPO [PORT]"""
import json, sys, urllib.parse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mocklib as m
repo = Path(sys.argv[1]).resolve()
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8778
LON, LAT = -122.36, 47.81
lot = m.rect(LON, LAT, -40, -10, 40, 115)
subject = m.feature(lot, PARCEL_ID="00123400000100", Site_House_Number="123", Site_Address="123 MAIN ST", Site_City="EDMONDS", Acres_Gross=0.23, Property_Account_Summary="https://www.snoco.org/proptax/1")
google = []

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
    if "overpass" in host:
        return {"elements": []}
    if host == "elevation.nationalmap.gov":
        return m.dem_samples(body, LON, LAT)
    if host and "google" in host and "tagmanager" not in host:
        google.append(urllib.parse.unquote(url)[:140])
        return ("text/html", "<html><body>map</body></html>")
    return None

res = {}
with m.served(repo, port), m.browser_page() as page:
    mock = m.Mock(handler, port)
    page.route("**/*", mock.route)
    page.goto("http://127.0.0.1:%d/build-here.html?address=%s&utm_source=newsletter" % (port, urllib.parse.quote("123 Main St, Edmonds, WA 98020")))
    page.wait_for_selector(".bh-scenario", timeout=20000)
    res["urlAfterDeepLink"] = page.url.replace("http://127.0.0.1:%d" % port, "")
    # Scroll the whole study into view the way a reader would, so lazy content loads.
    page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(800)
    for y in range(0, 12000, 600):
        page.evaluate("(y) => window.scrollTo(0, y)", y)
        page.wait_for_timeout(60)
    res["googleRequestsAfterReadingTheStudy"] = list(google)
    btn = page.query_selector(".bh-map-load")
    res["hasLoadButton"] = bool(btn)
    if btn:
        btn.scroll_into_view_if_needed()
        btn.click()
        page.wait_for_timeout(600)
        res["googleRequestsAfterAskingForTheMap"] = list(google)
    res["seedInLocalStorage"] = page.evaluate("() => localStorage.getItem('bh3dSeed') !== null")
    res["seedInSessionStorage"] = page.evaluate("() => sessionStorage.getItem('bh3dSeed') !== null")
    res["deadPlaceholder"] = page.evaluate("() => !!document.getElementById('bh-photoreal-3d')")
    res["thirdPartyHosts"] = sorted(h for h in mock.hosts if h and h != "www.googletagmanager.com")
    res["errors"] = page.errors
print(json.dumps(res, indent=1))
