#!/usr/bin/env python3
"""Does the page honor window.BuildHereConfig?  Usage: scn_config.py REPO [PORT]"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mocklib as m
repo = Path(sys.argv[1]).resolve()
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8779
LON, LAT = -122.350, 47.694
lot = m.feature(m.rect(LON, LAT, -25, 5, 25, 105), PIN="4444444444", ADDR_FULL="100 FIRST ST", CTYNAME="SEATTLE", LOTSQFT=5000, KCA_ZONING="NR3", PREUSE_DESC="Single Family")
shard_hosts = []

def handler(host, path, p, body, url):
    if host == "geocoding.geo.census.gov":
        return m.census("100 FIRST ST, SEATTLE, WA, 98103", LON, LAT, "King County", "WA", "Washington", "Seattle city")
    if host == "gismaps.kingcounty.gov" and "KingCo_PropertyInfo" in path:
        return {"features": [lot]}
    if host == "services.arcgis.com" and "Current_Land_Use_Zoning_Detail" in path:
        return {"features": [{"attributes": {"ZONING": "NR3", "ZONELUT": "NR3"}}]}
    if host == "services.arcgis.com" and "Building_Outlines_2023" in path:
        return {"features": [m.feature(m.rect(LON, LAT, -15, 30, 15, 80))]}
    if "kc-resbldg" in path:
        shard_hosts.append(host)
        return {"src": "mock", "asOf": "2026-10-01", "b": {"4444444444": [2700, 2008, 2, 900, 400]}}
    if host == "elevation.nationalmap.gov":
        return m.dem_samples(body, LON, LAT)
    return None

CONFIG = """window.BuildHereConfig = { dataBase: "https://data.example.com/build-here/", massingUrl: "", siteBase: "https://pacificprogroup.com/",
  brand: "Pacific Pro Group", links: { permits: "", bids: "", additions: "", customHomes: "", howWeRank: "" }, showRankingsCta: false, parcelDiscovery: false };"""
with m.served(repo, port), m.browser_page() as page:
    page.add_init_script(CONFIG)
    page.route("**/*", m.Mock(handler, port).route)
    m.run_lookup(page, port, "100 First St, Seattle, WA 98103")
    with page.expect_download() as dl:
        page.click("#bh-download")
    text = Path(dl.value.path()).read_text(encoding="utf-8")
    print(json.dumps({
        "shardFetchedFrom": shard_hosts,
        "livingAreaRow": page.evaluate(m.ROW_JS, "Existing finished area"),
        "footerBrand": page.evaluate("() => [...new Set([...document.querySelectorAll('#bh-report .bh-brand')].map(e => e.textContent))]"),
        "rankingsCta": page.evaluate("() => !!document.querySelector('#bh-report .bh-cta')"),
        "massingLink": page.evaluate("() => !!document.querySelector('#bh-report a[href*=\"3d\"]')"),
        "siteLinksInStudy": page.evaluate("() => [...document.querySelectorAll('#bh-report a[href^=\"./\"]')].map(a => a.getAttribute('href'))"),
        "downloadName": dl.value.suggested_filename,
        "downloadBase": text.split('<base href="')[1].split('"')[0],
        "downloadHeader": text.split("<header><p>")[1].split("</p>")[0],
        "errors": page.errors}, indent=1))
