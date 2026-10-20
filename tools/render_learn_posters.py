#!/usr/bin/env python3
"""Render /learn/ posters from the in-repo house model.

Uses the same presets as the lesson pages (LearnHouse.presets in
assets/js/learn-house.js) and headless Chrome. No external image service.
Writes assets/images/learn/learn-<slug>-poster.webp and a 640-wide sibling.
"""
from __future__ import annotations

import io
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import build_learn  # noqa: E402

OUT_DIR = ROOT / "assets" / "images" / "learn"
STAGE = ROOT / "tools" / "_learn_poster_stage.html"
WIDTH = build_learn.POSTER_W
HEIGHT = build_learn.POSTER_H
SMALL_W = build_learn.POSTER_SMALL_W
MAX_BYTES = 150 * 1024

STAGE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Learn poster stage</title>
<style>
  html, body { margin: 0; background: #f7f6f2; }
  canvas { width: 1200px; height: 675px; display: block; }
</style>
<script>
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    get: function () { return 2; }
  });
</script>
</head>
<body>
<canvas id="stage" width="1200" height="675"></canvas>
<script src="/assets/js/scroll-house.js"></script>
<script src="/assets/js/learn-house.js"></script>
<script>
  var params = new URLSearchParams(location.search);
  var name = params.get("preset") || "grade";
  var canvas = document.getElementById("stage");
  try {
    var spec = window.LearnHouse && window.LearnHouse.presets && window.LearnHouse.presets[name];
    if (!spec) throw new Error("missing preset " + name);
    var engine = window.BoardHouse.openViewer(canvas);
    var drawn = engine.draw({
      progress: spec.progress,
      focus: spec.focus,
      groups: spec.groups,
      orbit: {
        lockAngle: spec.orbit.lockAngle,
        lockHeading: spec.orbit.lockHeading,
        yaw: 0,
        pitch: 0,
        zoom: 1
      },
      width: 1200,
      height: 675
    });
    if (!drawn) throw new Error("draw failed");
    canvas.setAttribute("data-ready", "1");
  } catch (error) {
    canvas.setAttribute("data-error", String(error && error.message || error));
  }
</script>
</body>
</html>
"""


def save_webp(image: Image.Image, path: Path) -> int:
    for quality in (78, 70, 62, 54, 46, 38):
        buf = io.BytesIO()
        image.save(buf, format="WEBP", quality=quality, method=6)
        if buf.tell() <= MAX_BYTES:
            path.write_bytes(buf.getvalue())
            return buf.tell()
    raise SystemExit(f"{path.name} stays above {MAX_BYTES} bytes")


def assert_drawn(image: Image.Image, preset: str) -> None:
    sample = image.convert("L").resize((80, 45))
    pixels = list(sample.get_flattened_data() if hasattr(sample, "get_flattened_data") else sample.getdata())
    if max(pixels) - min(pixels) < 18:
        raise SystemExit(f"preset {preset} rendered nearly blank")


def render_preset(page, preset: str) -> Image.Image:
    page.goto(f"http://127.0.0.1:{PORT}/tools/_learn_poster_stage.html?preset={preset}", wait_until="load")
    page.wait_for_function(
        """() => {
          const canvas = document.querySelector('#stage');
          return canvas && (canvas.getAttribute('data-ready') === '1' || canvas.getAttribute('data-error'));
        }""",
        timeout=30000,
    )
    error = page.evaluate("() => document.querySelector('#stage').getAttribute('data-error')")
    if error:
        raise SystemExit(f"preset {preset}: {error}")
    data_url = page.evaluate("() => document.querySelector('#stage').toDataURL('image/png')")
    if not data_url.startswith("data:image/png;base64,"):
        raise SystemExit(f"preset {preset}: canvas export failed")
    raw = __import__("base64").b64decode(data_url.split(",", 1)[1])
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    assert_drawn(image, preset)
    return image.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


PORT = 8765


def main() -> None:
    from playwright.sync_api import sync_playwright

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    STAGE.write_text(STAGE_HTML, encoding="utf-8")
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    by_preset: dict[str, list[str]] = {}
    for slug, (preset, _alt, _caption) in build_learn.POSTER_META.items():
        by_preset.setdefault(preset, []).append(slug)
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path="/usr/bin/google-chrome",
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--use-angle=swiftshader",
                    "--enable-webgl",
                    "--ignore-gpu-blocklist",
                ],
            )
            page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
            page.set_default_timeout(30000)
            for preset, slugs in sorted(by_preset.items()):
                image = render_preset(page, preset)
                small = image.resize((SMALL_W, round(HEIGHT * SMALL_W / WIDTH)), Image.Resampling.LANCZOS)
                for slug in sorted(slugs):
                    full_path = OUT_DIR / f"learn-{slug}-poster.webp"
                    small_path = OUT_DIR / f"learn-{slug}-poster-640.webp"
                    full_bytes = save_webp(image, full_path)
                    small_bytes = save_webp(small, small_path)
                    print(f"{slug:22} {preset:14} {full_bytes:6}  {small_bytes:6}")
            browser.close()
    finally:
        server.shutdown()
        STAGE.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
