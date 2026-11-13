#!/usr/bin/env python3
"""Snohomish County: the county layer has no record for "123 SUNSET BLVD", but it has
"123 MAIN BLVD" in the same ZIP, 900 ft away. The lot at the geocoded point is recorded
as "121 SUNSET BLVD". Which lot does the study use?   Usage: scn_sno_street.py REPO [PORT]"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mocklib as m
repo = Path(sys.argv[1]).resolve()
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8780
LON, LAT = -122.33, 47.82
here = m.feature(m.rect(LON, LAT, -40, -10, 40, 115), PARCEL_ID="HERE-121-SUNSET", Site_House_Number="121", Site_Address="121 SUNSET BLVD", Site_City="EDMONDS", Acres_Gross=0.23, Property_Account_Summary="https://www.snoco.org/proptax/here")
far = m.feature(m.rect(LON, LAT, 860, -10, 940, 115), PARCEL_ID="FAR-123-MAIN", Site_House_Number="123", Site_Address="123 MAIN BLVD", Site_City="EDMONDS", Acres_Gross=0.23, Property_Account_Summary="https://www.snoco.org/proptax/far")

def handler(host, path, p, body, url):
    if host == "geocoding.geo.census.gov":
        return m.census("123 SUNSET BLVD, EDMONDS, WA, 98020", LON, LAT, "Snohomish County", "WA", "Washington", "Edmonds city")
    if host == "gis.snoco.org":
        if "SAS_Parcels" in path:
            if "Site_House_Number='123'" in p.get("where", ""):
                return {"features": [far]}
            if p.get("geometryType") == "esriGeometryPoint":
                return {"features": [here]}
            return {"features": [far, here] if float(p["geometry"].split(",")[2]) - float(p["geometry"].split(",")[0]) > 0.002 else [here]}
        if "SAS_Cities" in path:
            return {"features": [{"attributes": {"NAME": "EDMONDS"}}]}
    if host == "maps.edmondswa.gov":
        return {"features": [{"attributes": {"ZONING": "LDR-M"}}]}
    if "overpass" in host or host == "maps.mail.ru":
        return {"elements": []}
    if host == "elevation.nationalmap.gov":
        return m.dem_samples(body, LON, LAT)
    return None

with m.served(repo, port), m.browser_page() as page:
    page.route("**/*", m.Mock(handler, port).route)
    status = m.run_lookup(page, port, "123 Sunset Blvd, Edmonds, WA 98020")
    print(json.dumps({"parcelUsed": page.evaluate(m.ROW_JS, "Parcel number"), "warningOnFirstScreen": page.evaluate("() => [...document.querySelectorAll('#bh-report .bh-stage [role=alert]')].map(e => e.textContent)"), "status": status}, indent=1))
