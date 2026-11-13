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
finally:
    host_file.unlink()

print(json.dumps(res, indent=1))
(out / "print.json").write_text(json.dumps(res, indent=1))
