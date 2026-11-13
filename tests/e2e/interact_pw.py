#!/usr/bin/env python3
"""Run the repo's own browser interaction script with Playwright driving system Chrome.

The repo test (tests/test_build_here_interact.py) needs the websocket-client
module, which is not installed here. This runner reuses that file's INTERACT_JS
and PRINT_JS strings and its assertions, unchanged.

Usage: python3 interact_pw.py REPO_DIR [PORT]
"""
import importlib.util
import json
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

repo = Path(sys.argv[1]).resolve()
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8765

spec = importlib.util.spec_from_file_location("interact_src", repo / "tests" / "test_build_here_interact.py")
src = importlib.util.module_from_spec(spec)
spec.loader.exec_module(src)

server = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
                          cwd=repo, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/build-here.html", timeout=1)
            break
        except Exception:
            time.sleep(0.1)
    with sync_playwright() as p:
        chrome = shutil.which("google-chrome") or shutil.which("google-chrome-stable") or shutil.which("chromium") or shutil.which("chromium-browser")
        browser = p.chromium.launch(executable_path=chrome, headless=True,
                                    args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
                                          "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"])
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"http://127.0.0.1:{port}/build-here.html?sample=1")
        page.wait_for_selector(".bh-scenario", timeout=10000)
        got = page.evaluate(src.INTERACT_JS)
        page.emulate_media(media="print")
        colors = page.evaluate(src.PRINT_JS)
        got["printColor"] = colors
        got["printContrast"] = min(src.contrast(colors[k], colors["background"]) for k in ("kicker", "place", "date"))
        browser.close()
finally:
    server.kill()
    server.wait(timeout=5)

checks = {
    "cards>=5": got["cards"] >= 5,
    "fade not inside map": not got["fadeInMap"],
    "address visible": got["addressVisible"],
    "address has sample": got["addressHasSample"],
    "date shown": got["dateShown"],
    "place shown": got["placeShown"],
    "after edit": got["afterEdit"],
    "after manual": got["afterManual"],
    "after second render": got["afterSecondRender"],
    "living confidence Medium": got["livingConfidence"] == "Medium",
    "user entered": got["userEntered"],
    "footprint 'your entry' once": got["footprintYourEntry"] == 1,
    "footprint says surveyed": "surveyed footprint" in (got.get("footprintText") or ""),
    "no doubled entry note": "your entry) (your entry" not in (got.get("footprintText") or ""),
    "form fields survive": got["fillFormFieldsSurvive"],
    "lot shown after fill": got["lotShownAfterFill"],
    "export has no #bh-confirm": not got["exportHasConfirm"],
    "export no double period": not got["exportDoublePeriod"],
    "export keeps permit sentence": got["exportKeepsPermitSentence"],
    "print colors": all(got["printColor"][k] == "rgb(16, 42, 28)" for k in ("kicker", "place", "date")),
    "print contrast>=4.5": got["printContrast"] >= 4.5,
}
bad = [k for k, v in checks.items() if not v]
print(json.dumps({"passed": len(checks) - len(bad), "failed": bad, "pageErrors": errors, "printColor": got["printColor"]}, indent=1))
sys.exit(1 if bad else 0)
