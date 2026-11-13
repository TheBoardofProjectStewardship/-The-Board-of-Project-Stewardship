#!/usr/bin/env python3
"""Data minimization, service switches, typed numbers and year built, through the real page.

S1  Unincorporated Snohomish County with the embed configuration: geocoder relay on, Esri geocoder,
    OpenStreetMap and the Google map off. Which hosts does the browser call, and what do the permit
    rows show when the layer has a row id and a project name but no permit number?
S2  Kent: a sensitive-area notice is recorded on a neighboring parcel. What is printed about the neighbor?
S3  Seattle: the county extract says the parcel has two buildings, the earliest from 1925. The city record
    names the newest building, 2015. Which year is shown, and is the asbestos flag raised?
S4  Typed lot sizes: "-5000", "0.25 acres", "12 000".
S5  The relay is down: does the lookup fall back to the browser? And with the fallback off (S5b)?

Usage: python3 scn_services.py REPO_DIR OUT_DIR [PORT] [--plain]   (--plain: no embed configuration, for the PR head)
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mocklib as m  # noqa: E402

repo = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
port = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].isdigit() else 8783
plain = "--plain" in sys.argv
out.mkdir(parents=True, exist_ok=True)

BASE = {"s1": (-122.10, 47.95), "s2": (-122.230, 47.380), "s3": (-122.340, 47.690)}
ADDR = {
    "123 Rural Rd, Snohomish, WA 98290": ("s1", "123 RURAL RD, SNOHOMISH, WA, 98290", "Snohomish County", ""),
    "900 Kent Rd, Kent, WA 98030": ("s2", "900 KENT RD, KENT, WA, 98030", "King County", "Kent city"),
    "100 First St, Seattle, WA 98103": ("s3", "100 FIRST ST, SEATTLE, WA, 98103", "King County", "Seattle city"),
}
cur = {"k": None, "relayDown": False, "relayBodies": []}


def king(key, pin, addr, city, zone):
    lon, lat = BASE[key]
    return m.feature(m.rect(lon, lat, -25, 5, 25, 105), PIN=pin, ADDR_FULL=addr, CTYNAME=city, LOTSQFT=5000, KCA_ZONING=zone, PREUSE_DESC="Single Family(Res Use/Zone)")


SNO = m.feature(m.rect(*BASE["s1"], -40, -10, 40, 115), PARCEL_ID="00123400000100", Site_House_Number="123", Site_Address="123 RURAL RD", Site_City="SNOHOMISH", Acres_Gross=0.23, Property_Account_Summary="https://www.snoco.org/proptax/1")
KENT = king("s2", "6666666666", "900 KENT RD", "KENT", "SR-6")
SEA = king("s3", "4444444444", "100 FIRST ST", "SEATTLE", "NR3")
#          living, year, stories, first floor, garage, building records
SHARDS = {"4444444444": [3900, 1925, 2, 1500, 400, 2], "6666666666": [1800, 1978, 1, 1800, 0, 1]}


def census_for(address):
    key, matched, county, place = ADDR[address]
    cur["k"] = key
    lon, lat = BASE[key]
    return m.census(matched, lon, lat, county, "WA", "Washington", place)


def handler(host, path, p, body, url):
    if host == "local":
        if path.startswith("/relay-"):
            cur["relayBodies"].append(body)
            if cur["relayDown"]:
                return (503, "{}")
            return census_for(json.loads(body)["address"])
        pre = path.rsplit("/", 1)[-1][:2]
        return {"src": "mock", "asOf": "2026-10-20", "srcDate": "2026-10-14", "b": {k: v for k, v in SHARDS.items() if k[:2] == pre}}
    if host == "geocoding.geo.census.gov":
        return census_for(p["address"])
    k = cur["k"]
    lon, lat = BASE[k] if k else (0, 0)
    if host == "gis.snoco.org":
        if "SAS_Parcels" in path:
            return {"features": [SNO]}
        if "BUILDINGS__roofprints" in path:
            return {"features": [m.feature(m.rect(lon, lat, -25, 20, 25, 60))]}
        if "SAS_Cities" in path:
            return {"features": []}
        if "SAS_Imagery" in path:
            return ("image/svg+xml", m.aerial_svg([float(x) for x in p["bbox"].split(",")], SNO["geometry"]["rings"]))
        if "PLANNING__zoning" in path:
            return {"features": [{"attributes": {"abbrev": "R-5", "label": "Rural 5 Acre"}}]}
        if "PLANNING__active_permits" in path:
            return {"features": [{"attributes": {"objectid": 77, "project_name": "SMITH RESIDENCE ADDITION", "status": "Issued", "permit_type": "Residential addition"}}]}
        return None
    if host == "gismaps.kingcounty.gov":
        feat = KENT if k == "s2" else SEA
        if "KingCo_PropertyInfo" in path:
            if "PIN=" in p.get("where", ""):
                return {"features": [{"attributes": {"MAJOR": "444444", "MINOR": "4444", "PLAT_NAME": "EXAMPLE ADD"}}]}
            return {"features": [feat]}
        if "KingCo_Aerial" in path:
            return ("image/svg+xml", m.aerial_svg([float(x) for x in p["bbox"].split(",")], feat["geometry"]["rings"]))
        if "KingCo_SensitiveAreas/MapServer/12" in path:
            return {"features": [{"attributes": {"PIN": "9999999999", "LANDSLIDE": "Y", "EROSION": None, "STEEPSLOPE": "Y", "RECORDING_": "20050101000123", "PERMIT_NO": "B05L0001"}}]}
        return None
    if host == "services.arcgis.com":
        if "Current_Land_Use_Zoning_Detail" in path:
            return {"features": [{"attributes": {"ZONING": "NR3", "ZONELUT": "NR3"}}]}
        if "Building_Outlines_2023" in path or "MSBFP2" in path:
            return {"features": [m.feature(m.rect(lon, lat, -15, 30, 15, 80))]}
        if "ADUniverse" in path:
            return {"features": [{"attributes": {"YEAR_BUILT": 2015}}]}
        return None
    if "overpass" in host or host == "maps.mail.ru":
        return {"elements": []}
    if host == "elevation.nationalmap.gov":
        return m.dem_samples(body, lon, lat, 0.01, 0.01)
    return None


CONFIG = """window.BuildHereConfig = { geocodeUrl: "/relay-geocode", services: { esriGeocoder: false, openStreetMap: false, googleMap: false } };"""
TEXT = "() => document.getElementById('bh-report').innerText"
res = {}

# S1 and S5 run with the embed configuration (patched tree only).
if not plain:
    with m.served(repo, port), m.browser_page() as page:
        mock = m.Mock(handler, port)
        page.route("**/*", mock.route)
        page.add_init_script(CONFIG)
        m.run_lookup(page, port, "123 Rural Rd, Snohomish, WA 98290")
        text = page.evaluate(TEXT)
        res["S1"] = {
            "hosts": sorted(mock.hosts),
            "relayBody": cur["relayBodies"][-1] if cur["relayBodies"] else None,
            "scriptTagsToCensus": page.evaluate("() => [...document.scripts].filter(s => /census/.test(s.src)).length"),
            "lotRow": page.evaluate("() => { const r = [...document.querySelectorAll('.bh-land tr')].find(r => (r.querySelector('th') || {}).textContent === 'Lot area'); return r ? r.innerText.replace(/\\s+/g, ' ') : null; }"),
            "lotHelp": page.inner_text("#bh-lot-src"),
            "permitRow": page.evaluate("() => { const r = document.querySelector('.bh-permits tbody tr'); return r ? r.innerText.replace(/\\s+/g, ' ') : null; }"),
            "projectNameShown": "SMITH" in text,
            "rowIdShownAsPermit": page.evaluate("() => { const c = document.querySelector('.bh-permits tbody td'); return c ? c.textContent.trim() === '77' : false; }"),
            "mapPage": "See this lot on the map" in text,
            "osmSource": [x for x in page.evaluate("() => [...document.querySelectorAll('#bh-report li')].map(li => li.textContent)") if "OpenStreetMap" in x],
            "pageErrors": page.errors,
        }
        # S5: the relay answers 503. The lookup falls back to asking the Census from the browser.
        cur["relayDown"] = True
        res["S5"] = {"status": m.run_lookup(page, port, "900 Kent Rd, Kent, WA 98030"), "censusFromBrowser": "geocoding.geo.census.gov" in mock.hosts}
        cur["relayDown"] = False

    # S5b: the same failure with the fallback turned off, and the Esri geocoder off.
    with m.served(repo, port + 2), m.browser_page() as page:
        mock = m.Mock(handler, port + 2)
        page.route("**/*", mock.route)
        page.add_init_script(CONFIG.replace("geocodeUrl:", "geocodeFallback: false, geocodeUrl:"))
        cur["relayDown"] = True
        res["S5b"] = {"status": m.run_lookup(page, port + 2, "900 Kent Rd, Kent, WA 98030"), "censusFromBrowser": "geocoding.geo.census.gov" in mock.hosts, "esriCalled": "geocode.arcgis.com" in mock.hosts}
        cur["relayDown"] = False

with m.served(repo, port + 1), m.browser_page() as page:
    mock = m.Mock(handler, port + 1)
    page.route("**/*", mock.route)
    m.run_lookup(page, port + 1, "900 Kent Rd, Kent, WA 98030")
    flags = page.evaluate("() => [...document.querySelectorAll('#bh-report .bh-flags li')].map(li => li.textContent)")
    text = page.evaluate(TEXT)
    res["S2"] = {"neighborFlag": [f for f in flags if "neighboring parcel" in f], "neighborPinPrinted": "9999999999" in text, "recordingNumberPrinted": "20050101000123" in text, "permitNumberPrinted": "B05L0001" in text}
    m.run_lookup(page, port + 1, "100 First St, Seattle, WA 98103")
    flags = page.evaluate("() => [...document.querySelectorAll('#bh-report .bh-flags li')].map(li => li.textContent)")
    res["S3"] = {
        "yearBuilt": page.evaluate(m.ROW_JS, "Year built"),
        "asbestosFlag": [f for f in flags if "asbestos" in f.lower()],
        "existing": page.evaluate(m.ROW_JS, "Existing finished area"),
        "livingLedger": page.evaluate("() => { const r = [...document.querySelectorAll('.bh-measures tr')].find(r => (r.querySelector('th') || {}).textContent === 'Finished living area'); return r ? r.innerText.replace(/\\s+/g, ' ') : null; }"),
    }
    typed = {}
    for value in ("-5000", "0.25 acres", "12 000", "5,000 sf"):
        page.fill("#bh-lot", value)
        page.evaluate("() => document.getElementById('bh-confirm-form').requestSubmit()")
        page.wait_for_timeout(120)
        typed[value] = {
            "lotRow": page.evaluate(m.ROW_JS, "Lot area"),
            "coverageCap": page.evaluate(m.ROW_JS, "Lot coverage cap"),
            "floorCap": page.evaluate(m.ROW_JS, "Floor area cap (FAR)"),
            "fieldError": page.evaluate("() => { const e = document.getElementById('bh-lot-err'); return e ? e.textContent : null; }"),
            "ariaInvalid": page.get_attribute("#bh-lot", "aria-invalid"),
        }
    res["S4"] = typed
    res["pageErrors"] = page.errors

print(json.dumps(res, indent=1))
(out / "services.json").write_text(json.dumps(res, indent=1))
