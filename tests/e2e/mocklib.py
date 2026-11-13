"""Offline end-to-end harness for the Build Here page.

Every third-party request the page makes (Census geocoder JSONP, county and
city ArcGIS layers, Overpass, USGS 3DEP, aerial exports) is answered from
canned data by a Playwright route handler, so the real page code runs its real
lookup pipeline with no network. The mocks are inputs chosen by this review;
they are not recordings of the live services.
"""
import json
from pathlib import Path
import math
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from contextlib import contextmanager

from playwright.sync_api import sync_playwright

# System Chrome when there is one; otherwise the browser Playwright installed (executable_path=None).
CHROME = shutil.which("google-chrome") or shutil.which("google-chrome-stable") or shutil.which("chromium") or shutil.which("chromium-browser")
K = math.pi / 180
RF = 20925646.0  # earth radius in feet, same constant the page uses
RM = 6378137.0


def ll(lon0, lat0, x_ft, y_ft):
    """Lon/lat of a point x_ft east and y_ft north of (lon0, lat0)."""
    return [lon0 + x_ft / (K * RF * math.cos(lat0 * K)), lat0 + y_ft / (K * RF)]


def rect(lon0, lat0, x0, y0, x1, y1):
    """Closed ring for an axis-aligned rectangle given in feet offsets."""
    pts = [(x0, y0), (x0, y1), (x1, y1), (x1, y0), (x0, y0)]
    return [ll(lon0, lat0, x, y) for x, y in pts]


def merc(lon, lat):
    return [RM * lon * K, RM * math.log(math.tan(math.pi / 4 + lat * K / 2))]


def feature(ring, **attrs):
    return {"attributes": attrs, "geometry": {"rings": [ring]}}


def census(matched, lon, lat, county, state_abbr, state_name, place):
    geos = {"States": [{"STUSAB": state_abbr, "NAME": state_name}], "Counties": [{"NAME": county}]}
    if place:
        geos["Incorporated Places"] = [{"NAME": place}]
    return {"result": {"addressMatches": [{"matchedAddress": matched, "coordinates": {"x": lon, "y": lat}, "geographies": geos}]}}


def aerial_svg(bbox, rings):
    """An 800x600 stand-in aerial with the true parcel outline baked in (magenta)."""
    x0, y0, x1, y1 = bbox
    paths = []
    for ring in rings:
        pts = []
        for lon, lat in ring:
            mx, my = merc(lon, lat)
            pts.append("%.1f,%.1f" % ((mx - x0) / (x1 - x0) * 800, (y1 - my) / (y1 - y0) * 600))
        paths.append('<polygon points="%s" fill="none" stroke="#ff00ff" stroke-width="6"/>' % " ".join(pts))
    grid = "".join('<line x1="%d" y1="0" x2="%d" y2="600" stroke="#5d6f4e" stroke-width="1"/>' % (x, x) for x in range(0, 801, 100))
    grid += "".join('<line x1="0" y1="%d" x2="800" y2="%d" stroke="#5d6f4e" stroke-width="1"/>' % (y, y) for y in range(0, 601, 100))
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">'
            '<rect width="800" height="600" fill="#6b7f5a"/>' + grid + "".join(paths) + "</svg>")


def dem_samples(body, lon0, lat0, grade_x=0.03, grade_y=0.01):
    q = urllib.parse.parse_qs(body or "")
    geom = json.loads(q.get("geometry", ["{}"])[0])
    out = []
    for i, (lon, lat) in enumerate(geom.get("points", [])):
        x = (lon - lon0) * K * RF * math.cos(lat0 * K)
        y = (lat - lat0) * K * RF
        feet = 300 + grade_x * x + grade_y * y
        out.append({"locationId": i, "value": str(feet / 3.28084), "resolution": 1})
    return {"samples": out}


ABORT = object()  # a handler returns this to drop the connection: the request fails in the browser


class Mock:
    """Routes page requests. `handler(host, path, params, body, url)` returns a
    dict (JSON), a (content_type, text) tuple, or None for the default answer."""

    def __init__(self, handler, port, sites=None, passthrough=()):
        self.handler = handler
        self.port = port
        # Ports on 127.0.0.1 that a real local server answers. Requests to them are left to the browser, so
        # what the browser allows or refuses there is the browser's own doing. An answer written by this class
        # cannot show that: Playwright adds the cross-origin header to every answer a route fulfills.
        self.passthrough = set(passthrough)
        self.hosts = {}
        self.calls = []
        # {hostname: directory}: a static tree answered under another host name, so a page can be
        # tested on an origin that is not the local test server (no DNS is involved).
        self.sites = {k: Path(v) for k, v in (sites or {}).items()}

    @staticmethod
    def answer_local(route, local):
        """A scenario's answer for a data file or a relay on the page's own site. (status, body) is a failure
        typed as JSON. (status, content_type, body) sets the type too, for a host that answers a missing file
        with a web page. ABORT drops the connection. Anything else is sent as JSON with status 200."""
        if local is ABORT:
            route.abort("connectionfailed")
        elif isinstance(local, tuple) and isinstance(local[0], int):
            ctype, body = ("application/json", local[1]) if len(local) == 2 else (local[1], local[2])
            route.fulfill(status=local[0], content_type=ctype, body=body)
        else:
            route.fulfill(status=200, content_type="application/json", body=json.dumps(local))

    def route(self, route, request):
        url = request.url
        u = urllib.parse.urlsplit(url)
        if u.hostname == "127.0.0.1" and u.port in self.passthrough:
            route.continue_()
            return
        if u.hostname == "127.0.0.1" and u.port == self.port:
            # Shard files and a same-origin geocoder relay are answered by the scenario; everything else is the static tree.
            local = self.handler("local", u.path, {}, request.post_data or "", url) if (u.path.startswith("/assets/data/") or u.path.startswith("/relay-")) else None
            if local is None:
                route.continue_()
            else:
                self.answer_local(route, local)
            return
        if u.scheme in ("file", "data", "blob", "about"):
            route.continue_()
            return
        if u.hostname in self.sites:
            rel = urllib.parse.unquote(u.path).lstrip("/") or "index.html"
            f = (self.sites[u.hostname] / rel).resolve()
            if u.path.startswith("/relay-") or u.path.startswith("/wp-json/") or "/kc-resbldg/" in u.path:
                self.answer_local(route, self.handler("local", u.path, {}, request.post_data or "", url))
                return
            if not str(f).startswith(str(self.sites[u.hostname].resolve())) or not f.is_file():
                route.fulfill(status=404, content_type="text/plain", body="not found")
                return
            ctype = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png"}.get(f.suffix, "application/octet-stream")
            route.fulfill(status=200, content_type=ctype, body=f.read_bytes())
            return
        params = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        body = request.post_data or ""
        if body and "geometry=" in body or "where=" in body or "data=" in body:
            for k, v in urllib.parse.parse_qs(body).items():
                params.setdefault(k, v[0])
        self.hosts[u.hostname] = self.hosts.get(u.hostname, 0) + 1
        self.calls.append((request.method, u.hostname, u.path, params))
        res = self.handler(u.hostname, u.path, params, body, url)
        if res is ABORT:
            route.abort("connectionfailed")
            return
        headers = {"Access-Control-Allow-Origin": "*"}
        if res is None:
            if "googletagmanager" in u.hostname or "google.com" in u.hostname or "jsdelivr" in u.hostname:
                route.fulfill(status=204, headers=headers, body="")
                return
            res = {"count": 0} if params.get("returnCountOnly") == "true" else {"features": []}
        if isinstance(res, tuple) and isinstance(res[0], int):
            route.fulfill(status=res[0], headers=headers, content_type="application/json", body=res[1])  # (status, body): a failing service
        elif isinstance(res, tuple):
            route.fulfill(status=200, headers=headers, content_type=res[0], body=res[1])
        elif "callback" in params:
            route.fulfill(status=200, headers=headers, content_type="application/javascript", body=params["callback"] + "(" + json.dumps(res) + ");")
        else:
            route.fulfill(status=200, headers=headers, content_type="application/json", body=json.dumps(res))


@contextmanager
def served(repo, port):
    server = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
                              cwd=repo, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            try:
                urllib.request.urlopen("http://127.0.0.1:%d/build-here.html" % port, timeout=1)
                break
            except Exception:
                time.sleep(0.1)
        yield
    finally:
        server.kill()
        server.wait(timeout=5)


@contextmanager
def browser_page(viewport=None, **context_options):
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True,
                                    args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
                                          "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"])
        ctx = browser.new_context(viewport=viewport or {"width": 1280, "height": 900}, **context_options)
        page = ctx.new_page()
        page.errors = []
        page.on("pageerror", lambda e: page.errors.append(str(e)))
        try:
            yield page
        finally:
            browser.close()


def run_lookup(page, port, address, path="/build-here.html", wait_ms=20000):
    if not page.url.startswith("http://127.0.0.1:%d%s" % (port, path)):
        page.goto("http://127.0.0.1:%d%s" % (port, path))
    page.fill("#bh-address", address)
    page.click("#bh-go")
    page.wait_for_function("() => !document.getElementById('bh-go').disabled", timeout=wait_ms)
    page.wait_for_timeout(150)
    return page.inner_text("#bh-status")


CARDS_JS = """() => [...document.querySelectorAll('.bh-scenario')].map(c => ({
  title: c.querySelector('.bh-scenario-kicker').textContent,
  state: c.getAttribute('data-state'),
  metric: c.querySelector('.bh-scenario-metric').textContent,
  line: c.querySelector('.bh-scenario-copy p:nth-of-type(3)').textContent
}))"""

ROW_JS = """(label) => { const r = [...document.querySelectorAll('#bh-report table.bh-table tr')].find(r => (r.querySelector('th') || {}).textContent === label); return r ? r.querySelector('td').innerText : null; }"""
