#!/usr/bin/env python3
"""Homepage print path: the Print button copies the study into #bh-print-host.
Does the copy carry the option cards onto paper?  Usage: scn_homeprint.py REPO OUT_DIR [PORT]"""
import subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mocklib as m
repo, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
port = int(sys.argv[3]) if len(sys.argv) > 3 else 8775
out.mkdir(parents=True, exist_ok=True)
with m.served(repo, port), m.browser_page() as page:
    page.route("**/*", m.Mock(lambda *a: None, port).route)
    page.goto("http://127.0.0.1:%d/build-here.html?sample=1" % port)
    page.wait_for_selector(".bh-scenario")
    page.wait_for_timeout(800)
    # The homepage wraps the tool in #bh-home, which is what switches the old code to the copy path.
    page.evaluate("() => { const d = document.createElement('div'); d.id = 'bh-home'; document.body.appendChild(d); window.print = () => {}; document.getElementById('bh-print').click(); }")
    info = page.evaluate("() => { const h = document.getElementById('bh-print-host'); if (!h) return null; const c = h.querySelector('.bh-scenario'); return { cardsInCopy: h.querySelectorAll('.bh-scenario').length, firstCardOpacityAtPrint: c ? getComputedStyle(c).opacity : null }; }")
    page.emulate_media(media="print")
    pdf = out / "home_path_print.pdf"
    page.pdf(path=str(pdf), format="Letter")
text = subprocess.run(["pdftotext", str(pdf), "-"], capture_output=True, text=True).stdout
print(info, "| card titles found in the PDF text:", sum(text.upper().replace(" ", "").count(t) for t in ("GARAGEORSHOP", "TEARDOWNANDNEWHOUSE")))
