#!/usr/bin/env python3
"""King County scenarios, run one after another in the same page (no reload),
the way a client or estimator would use the tool.

B1  500 Example Ave N, Seattle: the county address search finds nothing, so the
    page falls back to "parcels within 25 m of the geocoded point". The mock
    returns three: the lot across the street first (55 ft away), a side
    neighbor, then the true lot (5 ft away). Which one does the study use?
B2  700 Zone St, Seattle: assessor zoning field says "SF 5000", the City of
    Seattle zoning layer says "NR3". Which one drives the math?
B3  100 First St (assessor: 3 stories) then 200 Second St (assessor: 4 stories).
    Does the stories value carry over?
B4  900 Kent Rd, Kent: a city whose zones are not coded. What do the cards say?
B5  300 Third St, Seattle: the data file for this parcel is not there (404).
B6  400 Fourth St, Seattle: the host answers the missing file with a web page
    and status 200.
B7  600 Sixth St, Seattle: the request for the data file fails.
    In B5 to B7, is the study whole, is the house size left out, and what does
    the page say about it?
B8  100 First St again, with the data folder on another host that does not
    send the Access-Control-Allow-Origin header. A second local server stands
    in for that host, and the request is left to the browser, so the refusal
    is the browser's own.
B9  The same host once it sends the header. Is the figure read?

Usage: python3 scn_king.py REPO_DIR OUT_DIR [PORT]
"""
import http.server
import json
import sys
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mocklib as m  # noqa: E402

repo = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
port = int(sys.argv[3]) if len(sys.argv) > 3 else 8772
out.mkdir(parents=True, exist_ok=True)

BASE = {"b1": (-122.340, 47.690), "b2": (-122.345, 47.692), "b3a": (-122.350, 47.694), "b3b": (-122.355, 47.696), "b4": (-122.230, 47.380),
        "b5": (-122.360, 47.698), "b6": (-122.365, 47.700), "b7": (-122.370, 47.702)}
ADDR = {
    "500 Example Ave N, Seattle, WA 98103": ("b1", "500 EXAMPLE AVE N, SEATTLE, WA, 98103", "Seattle city"),
    "700 Zone St, Seattle, WA 98103": ("b2", "700 ZONE ST, SEATTLE, WA, 98103", "Seattle city"),
    "100 First St, Seattle, WA 98103": ("b3a", "100 FIRST ST, SEATTLE, WA, 98103", "Seattle city"),
    "200 Second St, Seattle, WA 98103": ("b3b", "200 SECOND ST, SEATTLE, WA, 98103", "Seattle city"),
    "900 Kent Rd, Kent, WA 98030": ("b4", "900 KENT RD, KENT, WA, 98030", "Kent city"),
    "300 Third St, Seattle, WA 98103": ("b5", "300 THIRD ST, SEATTLE, WA, 98103", "Seattle city"),
    "400 Fourth St, Seattle, WA 98103": ("b6", "400 FOURTH ST, SEATTLE, WA, 98103", "Seattle city"),
    "600 Sixth St, Seattle, WA 98103": ("b7", "600 SIXTH ST, SEATTLE, WA, 98103", "Seattle city"),
}
cur = {"k": None}


def lotf(key, pin, addr, city, zone, sqft, x0=-25, y0=5, x1=25, y1=105):
    lon, lat = BASE[key]
    return m.feature(m.rect(lon, lat, x0, y0, x1, y1), PIN=pin, ADDR_FULL=addr, CTYNAME=city, LOTSQFT=sqft, KCA_ZONING=zone, PREUSE_DESC="Single Family(Res Use/Zone)")


PARCELS = {
    "b1": {"true": lotf("b1", "2222222222", "500 EXAMPLE AVE NORTH", "SEATTLE", "NR3", 5000),
           "across": lotf("b1", "1111111111", "501 EXAMPLE AVE NORTH", "SEATTLE", "NR3", 3000, -25, -115, 25, -55),
           "side": lotf("b1", "1212121212", "504 EXAMPLE AVE NORTH", "SEATTLE", "NR3", 5000, 25, 5, 75, 105)},
    "b2": {"true": lotf("b2", "3333333333", "700 ZONE ST", "SEATTLE", "SF 5000", 5000)},
    "b3a": {"true": lotf("b3a", "4444444444", "100 FIRST ST", "SEATTLE", "NR3", 5000)},
    "b3b": {"true": lotf("b3b", "5555555555", "200 SECOND ST", "SEATTLE", "NR3", 5000)},
    "b4": {"true": lotf("b4", "6666666666", "900 KENT RD", "KENT", "SR-6", 7200, -30, 5, 30, 125)},
    "b5": {"true": lotf("b5", "7777777777", "300 THIRD ST", "SEATTLE", "NR3", 5000)},
    "b6": {"true": lotf("b6", "8888888888", "400 FOURTH ST", "SEATTLE", "NR3", 5000)},
    "b7": {"true": lotf("b7", "9999999999", "600 SIXTH ST", "SEATTLE", "NR3", 5000)},
}
#            living, year, stories, first floor, garage
SHARDS = {"2222222222": [1500, 1925, 1.5, 900, 240], "1111111111": [3900, 2019, 3, 1300, 0], "3333333333": [1400, 1948, 1, 1400, 0],
          "4444444444": [2700, 2008, 3, 900, 400], "5555555555": [3600, 2021, 4, 900, 400], "6666666666": [1800, 1978, 1, 1800, 0]}


def house(key):
    lon, lat = BASE[key]
    return m.feature(m.rect(lon, lat, -15, 30, 15, 80))


# Data files that are not there, by the first two digits of the parcel number: the server's own "not found" page,
# a web page sent with status 200 in place of the file, and a request that fails.
NO_FILE = {"77": (404, "text/html; charset=utf-8", "<!DOCTYPE HTML><html><head><title>Error response</title></head><body><h1>Error response</h1><p>Error code: 404</p><p>Message: File not found.</p></body></html>"),
           "88": (200, "text/html; charset=utf-8", "<!doctype html><html><head><title>Page not found</title></head><body><h1>Nothing here</h1></body></html>"),
           "99": m.ABORT}
file_requests = {}


def handler(host, path, p, body, url):
    if host == "local":
        pre = path.rsplit("/", 1)[-1][:2]
        file_requests[pre] = file_requests.get(pre, 0) + 1
        if pre in NO_FILE:
            return NO_FILE[pre]
        return {"src": "mock", "asOf": "2026-10-01", "b": {k: v for k, v in SHARDS.items() if k[:2] == pre}}
    if host == "geocoding.geo.census.gov":
        key, matched, place = ADDR[p["address"]]
        cur["k"] = key
        lon, lat = BASE[key]
        return m.census(matched, lon, lat, "King County", "WA", "Washington", place)
    k = cur["k"]
    lon, lat = BASE[k] if k else (0, 0)
    if host == "gismaps.kingcounty.gov":
        if "KingCo_PropertyInfo" in path:
            where = p.get("where", "")
            if "ADDR_FULL LIKE" in where:
                return {"features": [] if k == "b1" else [PARCELS[k]["true"]]}
            if "PIN=" in where:
                return {"features": [{"attributes": {"MAJOR": "222222", "MINOR": "2222", "PLAT_NAME": "EXAMPLE ADD"}}]}
            if p.get("geometryType") == "esriGeometryPoint":
                return {"features": [PARCELS[k]["across"], PARCELS[k]["side"], PARCELS[k]["true"]] if k == "b1" else [PARCELS[k]["true"]]}
            # Envelope queries (neighbors, and the location fallback after the patch): same unhelpful order.
            return {"features": [PARCELS[k]["across"], PARCELS[k]["side"], PARCELS[k]["true"]] if k == "b1" else list(PARCELS[k].values())}
        if "KingCo_Aerial" in path:
            rings = [PARCELS[k]["true"]["geometry"]["rings"][0]]
            return ("image/svg+xml", m.aerial_svg([float(x) for x in p["bbox"].split(",")], rings))
        return None
    if host == "services.arcgis.com":
        if "Current_Land_Use_Zoning_Detail" in path:
            return {"features": [{"attributes": {"ZONING": "NR3", "ZONELUT": "NR3"}}]}
        if "Building_Outlines_2023" in path or "MSBFP2" in path:
            return {"features": [house(k)]}
        if "ADUniverse" in path:
            return {"features": [{"attributes": {"YEAR_BUILT": 1925}}]}
        return None
    if "overpass" in host or host == "maps.mail.ru":
        return {"elements": []}
    if host == "elevation.nationalmap.gov":
        return m.dem_samples(body, lon, lat)
    return None


class OtherHost(http.server.BaseHTTPRequestHandler):
    """A data host on another site (B8, B9). It serves the one data file, and sends the header that lets another
    site read it only when `allow` is set."""

    allow = False
    answered = []

    def do_GET(self):
        found = self.path == "/files/kc-resbldg/44.json"
        body = json.dumps({"src": "mock", "asOf": "2026-10-01", "b": {"4444444444": SHARDS["4444444444"]}}).encode() if found else b"{}"
        OtherHost.answered.append([self.path, 200 if found else 404, "header sent" if OtherHost.allow else "no header"])
        self.send_response(200 if found else 404)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        if OtherHost.allow:
            self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def snap(page):
    return {
        "status": page.inner_text("#bh-status"),
        "parcel": page.evaluate(m.ROW_JS, "Parcel number"),
        "lot": page.evaluate(m.ROW_JS, "Lot area"),
        "zone": page.evaluate(m.ROW_JS, "Zone"),
        "existing": page.evaluate(m.ROW_JS, "Existing finished area"),
        "stories": page.evaluate(m.ROW_JS, "Stories (existing)"),
        "storiesSelect": page.input_value("#bh-stories"),
        "warn": page.evaluate("() => [...document.querySelectorAll('#bh-report .bh-stage [role=alert], #bh-report .bh-stage .bh-verify')].map(e => e.textContent)"),
        "records": page.evaluate("() => { const p = [...document.querySelectorAll('#bh-report .bh-page')].find(s => /House plans and permit history/.test(s.textContent)); return p ? p.querySelector('p').textContent : null; }"),
        "hazards": page.evaluate("() => { const h = [...document.querySelectorAll('#bh-report h3')].find(x => x.textContent === 'Special site features'); return h ? h.nextElementSibling.textContent : null; }"),
        "cards": page.evaluate(m.CARDS_JS),
        "pages": page.evaluate("() => document.querySelectorAll('#bh-report .bh-page').length"),
        # What the page says about the house size: under the box where it can be typed, and on the Data sources page.
        "hint": page.evaluate("() => document.getElementById('bh-existing-src').textContent"),
        "tried": page.evaluate("() => [...document.querySelectorAll('#bh-report .bh-page li')].map(li => li.textContent).filter(t => /King County Assessor residential building extract|King County living area/.test(t))"),
        "raw": page.evaluate("() => document.getElementById('bh-report').textContent.match(/Unexpected token|SyntaxError|TypeError|Failed to fetch|is not valid JSON|HTTP 404|undefined|<!doctype/gi) || []"),
    }


mock = m.Mock(handler, port)
res = {}
with m.served(repo, port), m.browser_page() as page:
    page.route("**/*", mock.route)
    for tag, address in (("B1", "500 Example Ave N, Seattle, WA 98103"), ("B2", "700 Zone St, Seattle, WA 98103"),
                         ("B3a", "100 First St, Seattle, WA 98103"), ("B3b", "200 Second St, Seattle, WA 98103"), ("B4", "900 Kent Rd, Kent, WA 98030"),
                         ("B5", "300 Third St, Seattle, WA 98103"), ("B6", "400 Fourth St, Seattle, WA 98103"), ("B7", "600 Sixth St, Seattle, WA 98103")):
        m.run_lookup(page, port, address)
        res[tag] = snap(page)
        if tag == "B1":
            page.locator(".bh-stage-page").screenshot(path=str(out / "b1_first_screen.png"))
    res["pageErrors"] = page.errors
res["fileRequests"] = dict(file_requests)

other = http.server.ThreadingHTTPServer(("127.0.0.1", port + 100), OtherHost)
threading.Thread(target=other.serve_forever, daemon=True).start()
for tag, allow in (("B8", False), ("B9", True)):
    OtherHost.allow = allow
    with m.served(repo, port), m.browser_page() as page:
        page.add_init_script('window.BuildHereConfig = { dataBase: "http://127.0.0.1:%d/files/" };' % (port + 100))
        page.route("**/*", m.Mock(handler, port, passthrough=[port + 100]).route)
        m.run_lookup(page, port, "100 First St, Seattle, WA 98103")
        res[tag] = snap(page)
        res["pageErrors"] += page.errors
other.shutdown()
other.server_close()
res["otherHost"] = OtherHost.answered
res["fileRequestsOnThisSiteInB8B9"] = {k: v - res["fileRequests"].get(k, 0) for k, v in file_requests.items() if v != res["fileRequests"].get(k, 0)}

for tag in ("B1", "B2", "B3a", "B3b", "B4", "B5", "B6", "B7", "B8", "B9"):
    r = res[tag]
    print("=== %s ===" % tag)
    for key in ("status", "parcel", "lot", "zone", "existing", "stories", "storiesSelect", "warn", "records", "hazards", "pages", "hint", "tried", "raw"):
        print("  %s: %s" % (key, r[key]))
    for c in r["cards"]:
        print("    [%s] %s :: %s" % (c["state"].upper(), c["title"], c["metric"]))
print("data file requests:", res["fileRequests"])
print("the other host answered:", res["otherHost"])
print("page errors:", res["pageErrors"])
(out / "king.json").write_text(json.dumps(res, indent=1))
