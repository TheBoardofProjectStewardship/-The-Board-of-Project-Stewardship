#!/usr/bin/env python3
"""Browser checks. These run against a local static server and headless Chrome.

They do not skip when port 8765 is down: this file starts the server.
A missing Chrome binary fails the test instead of recording a skip.
"""
import json
import shutil
import subprocess
import sys
import time
import unittest
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHROME = (
    shutil.which("google-chrome")
    or shutil.which("google-chrome-stable")
    or shutil.which("chromium")
    or shutil.which("chromium-browser")
)


def _port_open(port):
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{port}/build-here.html", timeout=1)
        return True
    except Exception:
        return False


class InteractTest(unittest.TestCase):
    server = None
    own_server = False
    port = 8765

    @classmethod
    def setUpClass(cls):
        if not CHROME:
            return
        if _port_open(cls.port):
            return
        cls.server = subprocess.Popen(
            [sys.executable, "-m", "http.server", str(cls.port), "--bind", "127.0.0.1"],
            cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cls.own_server = True
        for _ in range(50):
            if _port_open(cls.port):
                return
            time.sleep(0.1)
        raise RuntimeError("local static server did not answer on port %s" % cls.port)

    @classmethod
    def tearDownClass(cls):
        if cls.own_server and cls.server:
            cls.server.kill()
            cls.server.wait(timeout=5)

    def test_edit_form_survives_rerender_and_address_is_visible(self):
        if not CHROME:
            self.fail("chrome is not installed; the interaction test did not run")
        got = chrome_session(self.port)
        self.assertIsInstance(got, dict, got)
        self.assertGreaterEqual(got["cards"], 5)
        self.assertFalse(got["fadeInMap"])
        self.assertTrue(got["addressVisible"], got)
        self.assertTrue(got["addressHasSample"])
        self.assertTrue(got["dateShown"])
        self.assertTrue(got["placeShown"])
        self.assertTrue(got["afterEdit"])
        self.assertTrue(got["afterManual"])
        self.assertTrue(got["afterSecondRender"])
        self.assertEqual(got["livingConfidence"], "Medium")
        self.assertNotEqual(got["livingConfidence"], "High")
        self.assertTrue(got["userEntered"])
        self.assertEqual(got["footprintYourEntry"], 1, got.get("footprintText"))
        self.assertIn("surveyed footprint", got.get("footprintText") or "")
        self.assertNotIn("your entry) (your entry", got.get("footprintText") or "")
        self.assertTrue(got["fillFormFieldsSurvive"])
        self.assertTrue(got["lotShownAfterFill"])
        self.assertFalse(got["exportHasConfirm"])
        self.assertFalse(got["exportDoublePeriod"])
        self.assertTrue(got["exportKeepsPermitSentence"])
        for key in ("kicker", "place", "date"):
            self.assertEqual(got["printColor"][key], "rgb(16, 42, 28)", got["printColor"])
        self.assertGreaterEqual(got["printContrast"], 4.5, got["printColor"])


def chrome_session(port):
    profile = Path("/tmp/bh-interact-profile")
    if profile.exists():
        shutil.rmtree(profile)
    proc = subprocess.Popen(
        [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
         f"--user-data-dir={profile}", "--remote-debugging-port=9341",
         "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ver = None
        for _ in range(40):
            try:
                ver = json.load(urllib.request.urlopen("http://127.0.0.1:9341/json/version", timeout=1))
                break
            except Exception:
                time.sleep(0.15)
        if not ver:
            raise AssertionError("chrome did not open a debug port")
        from websocket import create_connection
        ws = create_connection(ver["webSocketDebuggerUrl"], timeout=30)
        mid = 0

        def send(method, params=None, session=None):
            nonlocal mid
            mid += 1
            payload = {"id": mid, "method": method}
            if params:
                payload["params"] = params
            if session:
                payload["sessionId"] = session
            ws.send(json.dumps(payload))
            while True:
                data = json.loads(ws.recv())
                if data.get("id") == mid:
                    if data.get("error"):
                        raise AssertionError(data["error"])
                    return data.get("result", {})

        target = send("Target.createTarget", {"url": "about:blank"})["targetId"]
        session = send("Target.attachToTarget", {"targetId": target, "flatten": True})["sessionId"]
        send("Page.enable", session=session)
        send("Runtime.enable", session=session)
        send("Page.navigate", {"url": f"http://127.0.0.1:{port}/build-here.html?sample=1"}, session=session)
        value = None
        for _ in range(40):
            value = send("Runtime.evaluate", {
                "expression": INTERACT_JS, "returnByValue": True, "awaitPromise": True
            }, session=session)
            got = (value.get("result") or {}).get("value")
            if isinstance(got, dict) and got.get("cards", 0) >= 5 and "printColor" not in got:
                break
            if isinstance(got, dict) and got.get("error"):
                break
            time.sleep(0.15)
        got = (value.get("result") or {}).get("value")
        if not isinstance(got, dict):
            detail = value.get("exceptionDetails") or value
            raise AssertionError("page script did not return a result: %s" % detail)
        send("Emulation.setEmulatedMedia", {"media": "print"}, session=session)
        painted = send("Runtime.evaluate", {
            "expression": PRINT_JS, "returnByValue": True
        }, session=session)
        colors = (painted.get("result") or {}).get("value")
        if not isinstance(colors, dict):
            raise AssertionError("print color script failed: %s" % painted)
        got["printColor"] = colors
        got["printContrast"] = min(contrast(colors[k], colors["background"]) for k in ("kicker", "place", "date"))
        ws.close()
        return got
    finally:
        proc.kill()
        proc.wait(timeout=5)


def _channel(value):
    value = value / 255
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def contrast(foreground, background):
    def lum(rgb):
        parts = [int(x) for x in rgb.replace("rgb(", "").replace(")", "").split(",")]
        r, g, b = (_channel(parts[0]), _channel(parts[1]), _channel(parts[2]))
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    lighter, darker = sorted((lum(foreground), lum(background)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


INTERACT_JS = r"""
(() => {
  const cards = document.querySelectorAll('.bh-scenario').length;
  if (cards < 5) return { cards: cards };
  const fade = document.querySelector('.bh-stage-fade');
  const map = document.querySelector('.bh-stage-map');
  const fadeBox = fade.getBoundingClientRect();
  const mapBox = map.getBoundingClientRect();
  const address = (fade.querySelector('h2') || {}).textContent || '';
  const date = (fade.querySelector('.bh-stage-date') || {}).textContent || '';
  const place = (fade.querySelector('.bh-stage-place') || {}).textContent || '';
  document.getElementById('bh-lot').value = '10000';
  document.getElementById('bh-confirm-form').requestSubmit();
  const afterEdit = !!document.getElementById('bh-confirm') && !!document.getElementById('bh-lot');
  document.getElementById('bh-man-kind').value = 'living';
  document.getElementById('bh-man-sf').value = '1800';
  document.getElementById('bh-man-source').value = 'Assessor card typed for the test';
  document.getElementById('bh-man-method').value = 'assessor';
  document.getElementById('bh-man-conf').value = 'High';
  document.getElementById('bh-manual-form').requestSubmit();
  const living = [...document.querySelectorAll('.bh-measures tr')].find(r => (r.querySelector('th') || {}).textContent === 'Finished living area');
  const livingConfidence = living ? (living.querySelector('td[data-label="Confidence"]') || {}).textContent.trim() : '';
  document.getElementById('bh-lot').value = '8000';
  document.getElementById('bh-confirm-form').requestSubmit();
  const afterSecond = !!document.getElementById('bh-confirm') && !!document.getElementById('bh-existing');
  document.getElementById('bh-footprint-kind').value = 'footprint';
  document.getElementById('bh-confirm-form').requestSubmit();
  const fp = [...document.querySelectorAll('table.bh-table tr')].find(r => (r.querySelector('th') || {}).textContent === 'Building footprint');
  const footprintText = fp ? fp.innerText : '';
  const fields = ['bh-lot', 'bh-zone', 'bh-existing', 'bh-footprint', 'bh-confirm-form', 'bh-manual-form'];
  const fieldsLive = fields.every(id => !!document.getElementById(id));
  document.getElementById('bh-lot').value = '9100';
  document.getElementById('bh-existing').value = '1500';
  document.getElementById('bh-zone').value = 'NR3';
  document.getElementById('bh-confirm-form').requestSubmit();
  const reportAfterFill = document.getElementById('bh-report').innerText;
  const exportHtml = window.BuildHereExport.buildStudyFile({
    address: 'Sample lot (not a property record)',
    date: '2026-11-09',
    bodyHtml: document.getElementById('bh-report').innerHTML,
    limitations: 'Planning estimate only.'
  });
  return {
    cards: document.querySelectorAll('.bh-scenario').length,
    fadeInMap: !!map.querySelector('.bh-stage-fade'),
    addressVisible: fadeBox.height > 20 && fadeBox.top >= mapBox.top + mapBox.height - 2,
    addressHasSample: address.indexOf('Sample lot') >= 0,
    dateShown: date.indexOf('Prepared') >= 0,
    placeShown: place.indexOf('Example County') >= 0,
    afterEdit: afterEdit,
    afterManual: !!document.getElementById('bh-confirm') && reportAfterFill.indexOf('1,800') >= 0,
    afterSecondRender: afterSecond,
    livingConfidence: livingConfidence,
    userEntered: !!(living && living.innerText.indexOf('User-entered') >= 0),
    footprintYourEntry: (footprintText.match(/your entry/g) || []).length,
    footprintText: footprintText,
    fillFormFieldsSurvive: fieldsLive && !!document.getElementById('bh-lot') && document.getElementById('bh-lot').value === '9100',
    lotShownAfterFill: reportAfterFill.indexOf('9,100') >= 0,
    exportHasConfirm: exportHtml.indexOf('#bh-confirm') >= 0,
    exportDoublePeriod: exportHtml.indexOf('permit. .') >= 0,
    exportKeepsPermitSentence: exportHtml.indexOf('Nothing here is a permit.') >= 0
  };
})()
"""

PRINT_JS = r"""
(() => {
  const pick = (sel) => getComputedStyle(document.querySelector(sel)).color;
  const fade = document.querySelector('.bh-stage-fade');
  return {
    kicker: pick('.bh-stage-fade .bh-kicker'),
    place: pick('.bh-stage-fade .bh-stage-place'),
    date: pick('.bh-stage-fade .bh-stage-date'),
    background: getComputedStyle(fade).backgroundColor
  };
})()
"""


if __name__ == "__main__":
    unittest.main()
