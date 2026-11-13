#!/usr/bin/env python3
"""The WordPress plugin's script on a page whose theme is written to break an embedded widget.

The page (wordpress/tests/theme-page.html) has a 10px root font, element rules with !important, and rules
that reuse the tool's own class names and ids. It carries the element the [ppg_build_here] shortcode prints,
twice. It is answered under https://ppg.example/ so nothing depends on the local test server's host name.

W1  Does the tool mount, and what does it add to window?
W2  Do theme styles reach into the tool? Does the tool change the theme's own elements?
W3  A lookup through the site's geocoder relay, with data from the uploads folder.
W4  Layout follows the tool's own width: a 420px column on a 1280px screen, then a 390px phone.
W5  Print and Download from inside the shadow root.
W6  The email form, the Edit the facts link, and a second shortcode on the page.
W7  The relay is closed (403): does the lookup still work?
W8  Dark cards, a pale brand color and the email form.
W9  Settings that carry markup and script links.
W10 Does the page below the tool move when the script runs? The shortcode reserves the tool's starting height.
W11 The widget sits in a layout that is only as wide as its content. Is the tool still there?

Usage: python3 scn_wp.py REPO_DIR OUT_DIR
"""
import html
import json
import re
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mocklib as m  # noqa: E402

repo = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
out.mkdir(parents=True, exist_ok=True)

ORIGIN = "https://ppg.example"
LON, LAT = -122.340, 47.690
LOT = m.feature(m.rect(LON, LAT, -25, 5, 25, 105), PIN="4444444444", ADDR_FULL="100 FIRST ST", CTYNAME="SEATTLE", LOTSQFT=5000, KCA_ZONING="NR3", PREUSE_DESC="Single Family(Res Use/Zone)")
state = {"relay": "ok", "relayBodies": [], "dataPaths": [], "data": "ok"}
DATA_FILE = {"src": "mock", "asOf": "2026-10-20", "srcDate": "2026-10-14", "b": {"4444444444": [1800, 1962, 1, 1800, 0, 1]}}
# What a WordPress site sends for a file that is not in the uploads folder: the theme's own "not found" page.
THEME_404 = "<!DOCTYPE html><html lang=\"en-US\"><head><meta charset=\"UTF-8\"><title>Page not found</title></head><body class=\"error404\"><h1>The page can&rsquo;t be found.</h1></body></html>"


def config(**over):
    cfg = {
        "brand": "Pacific Pro Group", "accent": "#0f4c81", "theme": "light", "font": "site", "maxWidth": "",
        "dataBase": ORIGIN + "/wp-content/uploads/ppg-build-here/", "siteBase": ORIGIN + "/",
        "geocodeUrl": ORIGIN + "/wp-json/ppg-build-here/v1/geocode",
        "services": {"esriGeocoder": False, "worldImagery": True, "googleMap": True, "openStreetMap": True, "msFootprints": True, "parcelDiscovery": False},
        "cta": {"heading": "Talk to Pacific Pro Group about this lot", "text": "A feasibility study is a starting point.", "buttons": [{"label": "Request a consultation", "url": ORIGIN + "/contact/"}]},
        "contactLine": "Pacific Pro Group, ppg.example", "leadEmail": "", "leadSource": "ppg.example", "permitsUrl": "", "bidsUrl": "", "customCss": "",
    }
    cfg.update(over)
    return cfg


# The inline styles of the frame and the host come from the PHP that prints them, so this page is the shortcode's markup.
PHP = (repo / "wordpress/ppg-build-here/includes/class-ppgbh-shortcode.php").read_text(encoding="utf-8")
STYLE = {name: re.search(r"const %s\s*=\s*'([^']*)';" % name, PHP).group(1) for name in ("FRAME_STYLE", "HOST_STYLE", "HOST_STYLE_FORM")}


def site_dir(cfg, edit=None):
    root = Path(tempfile.mkdtemp(prefix="ppgbh-site-"))
    page = (repo / "wordpress/tests/theme-page.html").read_text(encoding="utf-8")
    page = page.replace("__FRAME_STYLE__", html.escape(STYLE["FRAME_STYLE"], quote=True)).replace("__HOST_STYLE__", html.escape(STYLE["HOST_STYLE_FORM" if cfg.get("leadEmail") else "HOST_STYLE"], quote=True))
    page = page.replace("__CONFIG__", html.escape(json.dumps(cfg), quote=True))
    if edit:
        page = edit(page)
    (root / "index.html").write_text(page, encoding="utf-8")
    shutil.copytree(repo / "wordpress/ppg-build-here", root / "wp-content/plugins/ppg-build-here")
    return root


def handler(host, path, p, body, url):
    if host == "local":
        if path.startswith("/wp-json/"):
            state["relayBodies"].append(body)
            if state["relay"] != "ok":
                return (int(state["relay"]), "{}")
            return m.census("100 FIRST ST, SEATTLE, WA, 98103", LON, LAT, "King County", "WA", "Washington", "Seattle city")
        state["dataPaths"].append(path)
        if state["data"] == "not uploaded":
            return (404, "text/html; charset=UTF-8", THEME_404)
        if state["data"] == "web page":  # a host, or a security plugin, that answers with a page and status 200
            return (200, "text/html; charset=UTF-8", THEME_404)
        return DATA_FILE
    if host == "files.example":
        # The Data address setting points at another host, and the request to it fails in the browser. A host that
        # was not set up to be read from this site looks the same to the page; scn_king.py B8 shows that with a
        # real second server.
        state["dataPaths"].append(host + path)
        return m.ABORT
    if host == "geocoding.geo.census.gov":
        return m.census("100 FIRST ST, SEATTLE, WA, 98103", LON, LAT, "King County", "WA", "Washington", "Seattle city")
    if host == "gismaps.kingcounty.gov":
        if "KingCo_PropertyInfo" in path:
            if "PIN=" in p.get("where", ""):
                return {"features": [{"attributes": {"MAJOR": "444444", "MINOR": "4444", "PLAT_NAME": "EXAMPLE ADD"}}]}
            return {"features": [LOT]}
        if "KingCo_Aerial" in path:
            return ("image/svg+xml", m.aerial_svg([float(x) for x in p["bbox"].split(",")], LOT["geometry"]["rings"]))
        return None
    if host == "services.arcgis.com":
        if "Current_Land_Use_Zoning_Detail" in path:
            return {"features": [{"attributes": {"ZONING": "NR3", "ZONELUT": "NR3"}}]}
        if "Building_Outlines_2023" in path:
            return {"features": [m.feature(m.rect(LON, LAT, -15, 30, 15, 80))]}
        return None
    if "overpass" in host:
        return {"elements": []}
    if host == "elevation.nationalmap.gov":
        return m.dem_samples(body, LON, LAT, 0.01, 0.01)
    return None


SH = "document.querySelector('.ppgbh-host').shadowRoot"
CS = """(sel) => { const e = %s.querySelector(sel); if (!e) return null; const c = getComputedStyle(e);
  return { display: c.display, color: c.color, background: c.backgroundColor, border: c.borderTopWidth + ' ' + c.borderTopColor, fontSize: c.fontSize, fontFamily: c.fontFamily.slice(0, 40),
    letterSpacing: c.letterSpacing, textTransform: c.textTransform, textAlign: c.textAlign, width: Math.round(e.getBoundingClientRect().width), height: Math.round(e.getBoundingClientRect().height), boxSizing: c.boxSizing, textDecoration: c.textDecorationLine }; }""" % SH
THEME = """() => Object.fromEntries(['t-h1', 't-p', 't-btn', 't-after'].map(id => { const c = getComputedStyle(document.getElementById(id)); return [id, [c.fontSize, c.color, c.backgroundColor, c.textTransform, c.display].join(' | ')]; }))"""


def lookup(page, address="100 First St, Seattle, WA 98103"):
    page.evaluate("(a) => { const r = %s; r.getElementById('bh-address').value = a; r.getElementById('bh-go').click(); }" % SH, address)
    page.wait_for_function("() => !%s.getElementById('bh-go').disabled" % SH, timeout=20000)
    page.wait_for_timeout(200)
    return page.evaluate("() => %s.getElementById('bh-status').textContent" % SH)


res = {}
root = site_dir(config())
with m.browser_page({"width": 1280, "height": 900}) as page:
    mock = m.Mock(handler, 0, sites={"ppg.example": root})
    page.route("**/*", mock.route)
    page.add_init_script("window.__before = new Set(Object.getOwnPropertyNames(window));")
    themeBefore = None
    page.goto(ORIGIN + "/")
    page.wait_for_selector(".ppgbh-host[data-ppgbh-ready='1']", state="attached", timeout=8000)
    # W1
    res["W1"] = {
        "addedToWindow": page.evaluate("() => Object.getOwnPropertyNames(window).filter(k => !window.__before.has(k) && k !== '__before')"),
        "toolGlobals": page.evaluate("() => ['BuildHere', 'BuildHereRules', 'BuildHereLandscape', 'BuildHereMeasures', 'BuildHereStage', 'BuildHereExport', 'BuildHereConfig'].filter(k => k in window)"),
        "version": page.evaluate("() => window.PPGBuildHere.version"),
        "idsInPageDocument": page.evaluate("() => document.querySelectorAll('[id^=bh-]').length"),
        "idsInShadow": page.evaluate("() => %s.querySelectorAll('[id^=bh-]').length" % SH),
        "fallbackVisible": page.evaluate("() => { const p = document.querySelector('.ppgbh-host .ppgbh-fallback'); return !!p && p.getBoundingClientRect().height > 0; }"),
    }
    # W2
    res["W2"] = {
        "wrapper": page.evaluate(CS, ".ppgbh"),
        "card": page.evaluate(CS, ".bh-card"),
        "cardHeading": page.evaluate(CS, ".bh-card h2"),
        "input": page.evaluate(CS, "#bh-address"),
        "button": page.evaluate(CS, "#bh-go"),
        "help": page.evaluate(CS, "#bh-address-help"),
        "hiddenSection": page.evaluate(CS, "#bh-report-wrap"),
        "theme": page.evaluate(THEME),
        "privacy": page.evaluate("() => %s.getElementById('bh-privacy-text').textContent" % SH),
        "leadCard": page.evaluate("() => !!%s.getElementById('bh-lead-card')" % SH),
    }
    page.locator(".ppgbh-host").first.screenshot(path=str(out / "w2_start_1280.png"))
    # W3
    status = lookup(page)
    cards = page.evaluate("() => [...%s.querySelectorAll('.bh-scenario')].map(c => c.getAttribute('data-state') + ': ' + c.querySelector('.bh-scenario-kicker').textContent + ' / ' + c.querySelector('.bh-scenario-metric').textContent)" % SH)
    res["W3"] = {
        "status": status, "cards": cards, "relayBody": state["relayBodies"][-1] if state["relayBodies"] else None, "dataPaths": state["dataPaths"][:2],
        "censusCalledFromBrowser": "geocoding.geo.census.gov" in mock.hosts,
        "hosts": sorted(h for h in mock.hosts if h != "ppg.example"),
        "footBrand": page.evaluate("() => %s.querySelector('.bh-brand').textContent" % SH),
        "cta": page.evaluate("() => { const c = %s.querySelector('.bh-cta'); return c ? [c.querySelector('h3').textContent, [...c.querySelectorAll('a')].map(a => a.textContent + ' -> ' + a.getAttribute('href'))] : null; }" % SH),
        "existing": page.evaluate("() => { const r = [...%s.querySelectorAll('table.bh-table tr')].find(r => (r.querySelector('th') || {}).textContent === 'Existing finished area'); return r ? r.querySelector('td').innerText : null; }" % SH),
        "pageButton": page.evaluate(CS, ".bh-page .bh-btn"),
        "overflowX": page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth"),
        "themeAfter": page.evaluate(THEME),
    }
    res["W3"]["themeUnchanged"] = res["W3"]["themeAfter"] == res["W2"]["theme"]
    page.locator(".ppgbh-host").first.screenshot(path=str(out / "w3_study_1280.png"))
    LAYOUT = """() => { const r = %s; const cols = r.querySelector('.bh-cols'), td = r.querySelector('.bh-page .bh-table td'), grid = r.querySelector('.bh-scenario-grid'), w = r.querySelector('.ppgbh');
      return { toolWidth: Math.round(w.getBoundingClientRect().width), colsTemplate: getComputedStyle(cols).gridTemplateColumns.split(' ').length, tdDisplay: getComputedStyle(td).display,
        cardColumns: getComputedStyle(grid).gridTemplateColumns.split(' ').length, widest: Math.round(Math.max(...[...r.querySelectorAll('.bh-page *')].map(e => e.getBoundingClientRect().right)) - w.getBoundingClientRect().right) }; }""" % SH
    res["W4"] = {"wide": page.evaluate(LAYOUT)}
    page.evaluate("() => { document.querySelector('.ppgbh-host').closest('.elementor-widget-container').style.width = '420px'; }")
    page.wait_for_timeout(150)
    res["W4"]["column420onDesktop"] = page.evaluate(LAYOUT)
    page.locator(".ppgbh-host").first.screenshot(path=str(out / "w4_column_420.png"))
    page.evaluate("() => { document.querySelector('.ppgbh-host').closest('.elementor-widget-container').style.width = ''; }")
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(150)
    res["W4"]["phone390"] = page.evaluate(LAYOUT)
    # The hostile theme's own 40px letter-spaced heading is wider than a phone. What matters is that nothing of the tool is.
    res["W4"]["phoneOverflowX"] = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    res["W4"]["phoneWidestElement"] = page.evaluate("() => { let best = null, r = 0; document.querySelectorAll('body *').forEach(e => { const x = e.getBoundingClientRect().right; if (x > r) { r = x; best = e; } }); return [best.tagName, best.id || best.className, Math.round(r)]; }")
    res["W4"]["phoneToolRightEdge"] = page.evaluate("() => Math.round(document.querySelector('.ppgbh-host').getBoundingClientRect().right)")
    page.screenshot(path=str(out / "w4_phone_390.png"), full_page=False)
    page.evaluate("() => %s.querySelector('.bh-stage-page').scrollIntoView()" % SH)
    page.screenshot(path=str(out / "w4_phone_390_stage.png"), full_page=False)
    page.set_viewport_size({"width": 1280, "height": 900})
    # W6 edit link, inside the shadow root
    page.evaluate("() => %s.querySelector('a[href=\"#bh-confirm\"]').click()" % SH)
    page.wait_for_timeout(150)
    res["W6"] = {"editLink": page.evaluate("() => { const r = %s; return { focus: r.activeElement ? r.activeElement.id : null, top: Math.round(r.getElementById('bh-confirm').getBoundingClientRect().top), urlHash: location.hash }; }" % SH)}
    res["W6"]["secondShortcode"] = page.evaluate("() => { const e = document.getElementById('second'); return { ready: e.getAttribute('data-ppgbh-ready'), text: e.textContent, shadow: !!e.shadowRoot, height: Math.round(e.getBoundingClientRect().height) }; }")
    # W5 download
    with page.expect_download(timeout=5000) as dl:
        page.evaluate("() => %s.getElementById('bh-download').click()" % SH)
    saved = out / "w5_download.html"
    dl.value.save_as(str(saved))
    text = saved.read_text(encoding="utf-8")
    res["W5"] = {"file": dl.value.suggested_filename, "status": page.evaluate("() => %s.getElementById('bh-export-status').textContent" % SH),
                 "brandHeader": "<header><p>Pacific Pro Group</p>" in text, "base": text[text.index("<base href="):text.index("<base href=") + 40], "contactLine": "Pacific Pro Group, ppg.example" in text,
                 "boardNameInFile": "Board of Project Stewardship" in text, "boardDomainInFile": "boardofprojectstewardship.com" in text}
    # W5 print
    page.evaluate("() => { window.print = () => {}; %s.getElementById('bh-print').click(); }" % SH)
    page.emulate_media(media="print")
    res["W5"]["print"] = page.evaluate("""() => { const h = document.getElementById('bh-print-host'); if (!h) return null; const r = h.shadowRoot, card = r && r.querySelector('.bh-scenario'), pg = r && r.querySelector('.bh-page');
      return { hasShadow: !!r, hostDisplay: getComputedStyle(h).display, themeHeadingDisplay: getComputedStyle(document.getElementById('t-h1').closest('.site')).display, pages: r ? r.querySelectorAll('.bh-page').length : 0,
        cardOpacity: card ? getComputedStyle(card).opacity : null, pageShadow: pg ? getComputedStyle(pg).boxShadow : null, bodyFont: pg ? getComputedStyle(pg.querySelector('p')).fontSize : null, buttons: r ? r.querySelectorAll('button').length : -1,
        ctaPrintLine: r && r.querySelector('.bh-cta .bh-print-only') ? [getComputedStyle(r.querySelector('.bh-cta .bh-print-only')).display, r.querySelector('.bh-cta .bh-print-only').textContent] : null }; }""")
    page.pdf(path=str(out / "w5_print.pdf"), format="Letter")
    raw = (out / "w5_print.pdf").read_bytes()
    res["W5"]["printPages"] = raw.count(b"/Type /Page") - raw.count(b"/Type /Pages")
    page.emulate_media(media="screen")
    page.evaluate("() => window.dispatchEvent(new Event('afterprint'))")
    res["W5"]["printHostRemoved"] = page.evaluate("() => !document.getElementById('bh-print-host') && !document.body.classList.contains('bh-printing')")
    # W7 relay closed
    state["relay"] = "403"
    res["W7"] = {"status": lookup(page), "cards": page.evaluate("() => %s.querySelectorAll('.bh-scenario').length" % SH), "censusCalledFromBrowser": "geocoding.geo.census.gov" in mock.hosts}
    state["relay"] = "429"
    res["W7"]["tooMany"] = lookup(page)
    state["relay"] = "ok"
    res["pageErrors"] = page.errors[:]
shutil.rmtree(root, ignore_errors=True)

# Dark cards, a pale brand color, an email form, and a normal 16px theme.
root = site_dir(config(theme="dark", accent="#ffe066", leadEmail="office@ppg.example", font="system"))
with m.browser_page({"width": 1100, "height": 900}) as page:
    page.route("**/*", m.Mock(handler, 0, sites={"ppg.example": root}).route)
    page.goto(ORIGIN + "/")
    page.wait_for_selector(".ppgbh-host[data-ppgbh-ready='1']", state="attached", timeout=8000)
    page.add_style_tag(content="html{font-size:100%!important}")
    res["W8"] = {"button": page.evaluate(CS, "#bh-go"), "card": page.evaluate(CS, ".bh-card"), "lead": page.evaluate("() => { const r = %s; const c = r.getElementById('bh-lead-card'); return c ? [c.hidden, r.getElementById('bh-lead-h').textContent, r.getElementById('bh-lead-intro').textContent] : null; }" % SH),
                 "vars": page.evaluate("() => { const h = document.querySelector('.ppgbh-host'); return ['--ppgbh-accent', '--ppgbh-accent-ink', '--ppgbh-accent-text', '--ppgbh-rem', '--ppgbh-font'].map(k => k + '=' + h.style.getPropertyValue(k)); }")}
    lookup(page)
    page.locator(".ppgbh-host").first.screenshot(path=str(out / "w8_dark.png"))
    res["pageErrors"] += page.errors
shutil.rmtree(root, ignore_errors=True)

# W9: settings that carry markup and script links, as if something had written them straight into the database.
EVIL = '"><img src=x onerror="window.__xss=1"></p><script>window.__xss=2</script>'
root = site_dir(config(brand=EVIL, contactLine=EVIL, customCss="</style><img src=x onerror=\"window.__xss=3\">", leadEmail="office@ppg.example",
                       cta={"heading": EVIL, "text": EVIL, "buttons": [{"label": EVIL, "url": "javascript:window.__xss=4"}, {"label": "Fine", "url": ORIGIN + "/contact/"}]},
                       permitsUrl="javascript:window.__xss=5", bidsUrl="data:text/html,<script>window.__xss=6</script>"))
with m.browser_page({"width": 1100, "height": 900}) as page:
    page.route("**/*", m.Mock(handler, 0, sites={"ppg.example": root}).route)
    page.goto(ORIGIN + "/")
    page.wait_for_selector(".ppgbh-host[data-ppgbh-ready='1']", state="attached", timeout=8000)
    lookup(page)
    with page.expect_download(timeout=5000) as dl:
        page.evaluate("() => %s.getElementById('bh-download').click()" % SH)
    evil_file = out / "w9_download.html"
    dl.value.save_as(str(evil_file))
    saved_text = evil_file.read_text(encoding="utf-8")
    page.wait_for_timeout(400)
    res["W9"] = {
        "scriptRan": page.evaluate("() => window.__xss || null"),
        "imagesFromSettings": page.evaluate("() => %s.querySelectorAll('img[src=x]').length + document.querySelectorAll('img[src=x]').length" % SH),
        "brandShownAsText": page.evaluate("() => %s.querySelector('.bh-brand').textContent" % SH) == EVIL,
        "ctaLinks": page.evaluate("() => [...%s.querySelectorAll('.bh-cta a')].map(a => a.getAttribute('href'))" % SH),
        "scriptSchemeLinks": page.evaluate("() => [...%s.querySelectorAll('a[href]')].filter(a => /^(javascript|data):/i.test(a.getAttribute('href').trim())).length" % SH),
        "savedFileHasLiveMarkup": "<img src=x" in saved_text or "<script>window.__xss" in saved_text,
        "pageErrors": page.errors[:],
    }
shutil.rmtree(root, ignore_errors=True)

# W10: the page below the tool, before the script runs and after. "Before" is the same page with JavaScript off.
NEXT = "() => Math.round(document.getElementById('second').closest('.elementor-widget-container').getBoundingClientRect().top + window.scrollY)"
HOST_H = "() => Math.round(document.querySelector('.ppgbh-host').getBoundingClientRect().height)"
res["W10"] = {}
for label, cfg, vw, vh, column in (("phone 320", config(), 320, 700, ""), ("phone 390", config(), 390, 844, ""), ("tablet 800", config(), 800, 1000, ""), ("desktop 1280", config(), 1280, 900, ""),
                                   ("420px column on desktop", config(), 1280, 900, "420px"), ("desktop 1280 with the email form", config(leadEmail="office@ppg.example"), 1280, 900, "")):
    narrow = (lambda page_html, c=column: page_html.replace('<div class="site">', '<div class="site" style="max-width:%s">' % c)) if column else None
    root = site_dir(cfg, narrow)
    row = {}
    for js in (False, True):
        with m.browser_page({"width": vw, "height": vh}, java_script_enabled=js) as page:
            page.route("**/*", m.Mock(handler, 0, sites={"ppg.example": root}).route)
            page.goto(ORIGIN + "/")
            if js:
                page.wait_for_selector(".ppgbh-host[data-ppgbh-ready='1']", state="attached", timeout=8000)
                page.wait_for_timeout(200)
                row["toolHeight"] = page.evaluate("() => Math.round(%s.querySelector('.ppgbh').getBoundingClientRect().height)" % SH)
            row["nextTopWithScript" if js else "nextTopReserved"] = page.evaluate(NEXT)
            row["hostHeightWithScript" if js else "hostHeightReserved"] = page.evaluate(HOST_H)
    row["moved"] = row["nextTopWithScript"] - row["nextTopReserved"]
    row["spare"] = row["hostHeightReserved"] - row["toolHeight"]
    res["W10"][label] = row
    shutil.rmtree(root, ignore_errors=True)

# W11: the widget is an item of a row layout, or of a centered column, and is only as wide as its content.
res["W11"] = {}
for label, wrap in (("row of a flex layout", ('<div style="display:flex;flex-direction:row;gap:20px">', '<div>Another widget</div></div>')),
                    ("centered column of a flex layout", ('<div style="display:flex;flex-direction:column;align-items:center">', '</div>')),
                    ("inline-block", ('<div style="display:inline-block">', '</div>'))):
    def content_sized(page_html, w=wrap):
        first = page_html.index('<div class="elementor-widget-container">')
        end = page_html.index('<div class="elementor-widget-container">', first + 10)
        return page_html[:first] + w[0] + page_html[first:end] + w[1] + page_html[end:]
    root = site_dir(config(), content_sized)
    with m.browser_page({"width": 1280, "height": 900}) as page:
        page.route("**/*", m.Mock(handler, 0, sites={"ppg.example": root}).route)
        page.goto(ORIGIN + "/")
        page.wait_for_selector(".ppgbh-host[data-ppgbh-ready='1']", state="attached", timeout=8000)
        page.wait_for_timeout(200)
        res["W11"][label] = page.evaluate("() => { const r = %s.querySelector('.ppgbh').getBoundingClientRect(); const b = %s.getElementById('bh-go').getBoundingClientRect(); return { toolWidth: Math.round(r.width), toolHeight: Math.round(r.height), buttonWidth: Math.round(b.width) }; }" % (SH, SH))
        res["pageErrors"] += page.errors
    shutil.rmtree(root, ignore_errors=True)

# W12: the data files are not there. A new install before the folder is uploaded, a host that answers the missing file
# with a web page, and a Data address on another host whose request fails.
STUDY = """() => { const r = %s; const row = [...r.querySelectorAll('table.bh-table tr')].find(x => (x.querySelector('th') || {}).textContent === 'Existing finished area');
  return { cards: r.querySelectorAll('.bh-scenario').length, pages: r.querySelectorAll('.bh-page').length, existing: row ? row.querySelector('td').innerText : null,
    hint: r.getElementById('bh-existing-src').textContent,
    tried: [...r.querySelectorAll('.bh-page li')].map(li => li.textContent).filter(t => /King County Assessor residential building extract|King County living area/.test(t)),
    raw: r.getElementById('bh-report').textContent.match(/Unexpected token|SyntaxError|TypeError|Failed to fetch|is not valid JSON|HTTP 404|undefined|<!doctype/gi) || [] }; }""" % SH
res["W12"] = {}
for label, mode, cfg in (("the folder was never uploaded", "not uploaded", config()), ("a web page sent with status 200", "web page", config()),
                         ("a data address on a host that cannot be read", "ok", config(dataBase="https://files.example/ppg/"))):
    state["data"], state["dataPaths"] = mode, []
    root = site_dir(cfg)
    with m.browser_page({"width": 1100, "height": 900}) as page:
        page.route("**/*", m.Mock(handler, 0, sites={"ppg.example": root}).route)
        page.goto(ORIGIN + "/")
        page.wait_for_selector(".ppgbh-host[data-ppgbh-ready='1']", state="attached", timeout=8000)
        row = {"status": lookup(page)}
        row.update(page.evaluate(STUDY))
        row["dataRequests"] = state["dataPaths"][:]
        row["pageErrors"] = page.errors[:]
        res["W12"][label] = row
    shutil.rmtree(root, ignore_errors=True)
state["data"] = "ok"

print(json.dumps(res, indent=1))
(out / "wp.json").write_text(json.dumps(res, indent=1))
