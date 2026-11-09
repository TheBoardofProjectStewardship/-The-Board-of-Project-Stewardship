#!/usr/bin/env python3
"""Browser checks: the edit form survives a second render, and the address bar is visible."""
import json
import shutil
import subprocess
import time
import unittest
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHROME = shutil.which("google-chrome") or shutil.which("google-chrome-stable")


def chrome_eval(expression):
    if not CHROME:
        raise unittest.SkipTest("chrome is not installed")
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
            raise unittest.SkipTest("chrome did not open a debug port")
        from websocket import create_connection
        ws = create_connection(ver["webSocketDebuggerUrl"], timeout=20)
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
                    return data.get("result", {})

        target = send("Target.createTarget", {"url": "about:blank"})["targetId"]
        session = send("Target.attachToTarget", {"targetId": target, "flatten": True})["sessionId"]
        send("Page.enable", session=session)
        send("Runtime.enable", session=session)
        send("Page.navigate", {"url": "http://127.0.0.1:8765/build-here.html?sample=1"}, session=session)
        value = None
        for _ in range(40):
            value = send("Runtime.evaluate", {"expression": expression, "returnByValue": True}, session=session)
            got = (value.get("result") or {}).get("value")
            if isinstance(got, dict) and got.get("cards", 0) >= 5:
                break
            time.sleep(0.15)
        ws.close()
        return (value.get("result") or {}).get("value")
    finally:
        proc.kill()
        proc.wait(timeout=5)


class InteractTest(unittest.TestCase):
    def test_edit_form_survives_rerender_and_address_is_visible(self):
        expr = r"""
        (() => {
          const cards = document.querySelectorAll('.bh-scenario').length;
          if (cards < 5) return { cards: cards };
          const fade = document.querySelector('.bh-stage-fade');
          const map = document.querySelector('.bh-stage-map');
          const fadeInMap = !!map.querySelector('.bh-stage-fade');
          const fadeBox = fade.getBoundingClientRect();
          const mapBox = map.getBoundingClientRect();
          const address = (fade.querySelector('h2') || {}).textContent || '';
          const date = (fade.querySelector('.bh-stage-date') || {}).textContent || '';
          document.getElementById('bh-lot').value = '10000';
          document.getElementById('bh-confirm-form').requestSubmit();
          const afterEdit = !!document.getElementById('bh-confirm') && !!document.getElementById('bh-lot');
          document.getElementById('bh-man-kind').value = 'living';
          document.getElementById('bh-man-sf').value = '1800';
          document.getElementById('bh-man-source').value = 'Assessor card typed for the test';
          document.getElementById('bh-man-method').value = 'assessor';
          document.getElementById('bh-man-conf').value = 'High';
          document.getElementById('bh-manual-form').requestSubmit();
          const report = document.getElementById('bh-report').innerText;
          document.getElementById('bh-lot').value = '8000';
          document.getElementById('bh-confirm-form').requestSubmit();
          return {
            cards: document.querySelectorAll('.bh-scenario').length,
            fadeInMap: fadeInMap,
            addressVisible: fadeBox.height > 20 && fadeBox.top >= mapBox.top + mapBox.height - 2,
            addressHasSample: address.indexOf('Sample lot') >= 0,
            dateShown: date.indexOf('Prepared') >= 0,
            afterEdit: afterEdit,
            afterManual: !!document.getElementById('bh-confirm') && report.indexOf('1,800') >= 0,
            afterSecondRender: !!document.getElementById('bh-confirm') && !!document.getElementById('bh-existing'),
            highCapped: document.getElementById('bh-report').innerText.indexOf('User-entered') >= 0
          };
        })()
        """
        try:
            urllib.request.urlopen("http://127.0.0.1:8765/build-here.html", timeout=2)
        except Exception:
            self.skipTest("local site is not being served on port 8765")
        got = chrome_eval(expr)
        self.assertIsInstance(got, dict)
        self.assertGreaterEqual(got["cards"], 5)
        self.assertFalse(got["fadeInMap"])
        self.assertTrue(got["addressVisible"])
        self.assertTrue(got["addressHasSample"])
        self.assertTrue(got["dateShown"])
        self.assertTrue(got["afterEdit"])
        self.assertTrue(got["afterManual"])
        self.assertTrue(got["afterSecondRender"])
        self.assertTrue(got["highCapped"])


if __name__ == "__main__":
    unittest.main()
