#!/usr/bin/env python3
"""Print behaviour.

P1  A host page that merely loads build-here.css (the homepage does, and a
    WordPress page with the widget would) and has not run a lookup: what does
    Ctrl+P print?
P2  The tool page after a lookup: page count and what is visible in print.

Usage: python3 scn_print.py REPO_DIR OUT_DIR [PORT]
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mocklib as m  # noqa: E402

repo = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
port = int(sys.argv[3]) if len(sys.argv) > 3 else 8773
out.mkdir(parents=True, exist_ok=True)

HOST = """<!doctype html><html><head><meta charset="utf-8"><title>Host page</title>
<link rel="stylesheet" href="/assets/css/build-here.css"></head><body>
<h1 id="h">Pacific Pro Group: additions and custom homes</h1>
<p id="p">Ordinary page copy that a visitor might want to print.</p>
<table><tr><td id="td" data-label="Phone">425 555 0100</td></tr></table>
<button id="btn" type="button">Request a bid</button>
<section id="bh-report-wrap" hidden><div id="bh-report" class="bh-report"></div></section>
</body></html>"""
host_file = repo / "_host_print_probe.html"
host_file.write_text(HOST, encoding="utf-8")

VIS = """() => { const v = (id) => { const e = document.getElementById(id), c = getComputedStyle(e); return c.display === 'none' ? 'display:none' : c.visibility; };
  return { heading: v('h'), paragraph: v('p'), button: v('btn'), tdPrefix: getComputedStyle(document.getElementById('td'), '::before').content, bodyBackground: getComputedStyle(document.body).backgroundColor }; }"""


def pages(pdf):
    raw = pdf.read_bytes()
    return raw.count(b"/Type /Page") - raw.count(b"/Type /Pages")


res = {}
try:
    with m.served(repo, port), m.browser_page() as page:
        page.route("**/*", m.Mock(lambda *a: None, port).route)
        page.goto("http://127.0.0.1:%d/_host_print_probe.html" % port)
        res["hostScreen"] = page.evaluate(VIS)
        page.emulate_media(media="print")
        res["hostPrint"] = page.evaluate(VIS)
        page.pdf(path=str(out / "host_print.pdf"), format="Letter")
        page.screenshot(path=str(out / "host_print.png"))
        res["hostPrintPages"] = pages(out / "host_print.pdf")
        page.emulate_media(media="screen")
        # P2: the tool page with the built-in sample study.
        page.goto("http://127.0.0.1:%d/build-here.html?sample=1" % port)
        page.wait_for_selector(".bh-scenario")
        page.evaluate("() => { window.__bp = 0; window.addEventListener('beforeprint', () => window.__bp++); }")
        page.emulate_media(media="print")
        page.pdf(path=str(out / "tool_print_menu.pdf"), format="Letter")
        res["beforeprintFiredByPdf"] = page.evaluate("() => window.__bp")
        res["toolPrintPagesViaBrowserCommand"] = pages(out / "tool_print_menu.pdf")
        # The Print button path: build the copy the way the button does, then capture.
        page.evaluate("() => { window.print = () => {}; document.getElementById('bh-print').click(); }")
        res["printHost"] = page.evaluate("() => { const h = document.getElementById('bh-print-host'); return h ? { display: getComputedStyle(h).display, pages: h.querySelectorAll('.bh-page').length, hasEditForm: !!h.querySelector('form'), duplicateIds: h.querySelectorAll('[id]').length, siteHeader: getComputedStyle(document.querySelector('header.site-header')).display } : null; }")
        page.pdf(path=str(out / "tool_print.pdf"), format="Letter")
        res["toolPrintPages"] = pages(out / "tool_print.pdf")
        res["toolPrint"] = page.evaluate("""() => ({ reportPosition: getComputedStyle(document.getElementById('bh-report')).position,
          siteHeaderVisibility: getComputedStyle(document.querySelector('header.site-header')).visibility,
          bodyClass: document.body.className.includes('bh-printing'),
          docHeightPx: document.documentElement.scrollHeight, reportHeightPx: Math.round(document.getElementById('bh-report').getBoundingClientRect().height) })""")
        # The feasibility study is a separate page from the interactive tool. It prints six landscape sheets.
        page.emulate_media(media="screen")
        page.goto("http://127.0.0.1:%d/feasibility-study.html?sample=2" % port)
        page.wait_for_selector("#bh-report .bh-cover")
        page.wait_for_function("""() => {
          const imgs = [...document.querySelectorAll('#bh-report img')];
          return imgs.length >= 2 && imgs.every(img => img.complete && img.naturalWidth > 0);
        }""")
        res["study"] = page.evaluate("""() => {
          const root = document.getElementById('bh-report');
          const pages = [...root.querySelectorAll('.bh-page')];
          const label = (el) => { const m = el.textContent.match(/Page \\d+ of \\d+/); return m ? m[0] : ''; };
          const text = root.textContent;
          const logos = [...root.querySelectorAll('img.bh-foot-logo, img.bh-cover-logo')];
          return {
            pages: pages.length,
            labels: pages.map(label),
            dataPages: pages.map(p => p.getAttribute('data-page') + ' of ' + p.getAttribute('data-total')),
            sheets: root.querySelectorAll('.bh-sheet').length,
            httpLinks: root.querySelectorAll('a[href^="http"]').length,
            anchors: root.querySelectorAll('a[href]').length,
            iframes: root.querySelectorAll('iframe').length,
            ppg: /\\bPPG\\b/.test(text),
            turf: /turf|lawn/i.test(text),
            permit: /Permit history and plan sets/.test(text),
            listingOff: /no listing data service connected/.test(text),
            cover: !!(pages[0] && pages[0].classList.contains('bh-cover') && /Feasibility Study/.test(pages[0].textContent)),
            logoCount: logos.length,
            logoOk: logos.length > 0 && logos.every(img => img.naturalWidth > 0),
            massing: !!document.querySelector('#bh-3d canvas'),
            shot: !!((document.getElementById('bh-3d-shot') || {}).src || '').startsWith('data:image'),
            controls: !!document.getElementById('bh-3d-roof'),
            interior: /CONCEPTUAL — VERIFY ON SITE/.test((document.getElementById('bh-report') || {}).textContent || ''),
            googleKeyed: /Google 3D Maps|Solar/.test((document.getElementById('bh-3d-legend') || {}).textContent || '')
          };
        }""")
        res["studyErrors"] = list(page.errors)
        page.emulate_media(media="print")
        page.pdf(path=str(out / "study_print.pdf"), format="Letter", landscape=True, print_background=True, prefer_css_page_size=True)
        res["studyPrintPages"] = pages(out / "study_print.pdf")
finally:
    host_file.unlink()

print(json.dumps(res, indent=1))
(out / "print.json").write_text(json.dumps(res, indent=1))
