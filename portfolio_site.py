#!/usr/bin/env python3
"""Portfolio of Pacific Pro Group project models: /portfolio/ grid and one page per model.

Each project is data (data/portfolio/projects.json plus, for traced houses, a house
config JSON) rendered by the shared engine in /assets/js/house-model.js. Magnolia keeps
its hand-traced geometry in /assets/js/house-model-magnolia.js.

Run: python3 portfolio_site.py   (writes portfolio/index.html and portfolio/<slug>/index.html)
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "portfolio"
OUT = ROOT / "portfolio"
ORIGIN = "https://boardofprojectstewardship.com"
STAGE_PROGRESS = {"house": 0.04, "front": 0.22, "roof": 0.38, "upper": 0.56, "plan": 0.74, "foundation": 0.93}

esc = lambda s: html.escape(str(s), quote=True)


def load_projects() -> list[dict]:
    return json.loads((DATA / "projects.json").read_text(encoding="utf-8"))["projects"]


def load_config(entry: dict) -> dict | None:
    if entry.get("engine") != "config":
        return None
    return json.loads((DATA / entry["config"]).read_text(encoding="utf-8"))


def svg_plan(cfg: dict) -> str:
    """Static plan drawing (walls, pads, room names) from the house config, as SVG."""
    x0, z0 = cfg["planBounds"]["min"]
    x1, z1 = cfg["planBounds"]["max"]
    sc = 960 / (x1 - x0)
    h = round((z1 - z0) * sc)
    P = lambda p: f"{(p[0] - x0) * sc:.1f},{(p[1] - z0) * sc:.1f}"
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 {h}" width="960" height="{h}">',
             f'<rect width="960" height="{h}" fill="#f7f6f2"/>']
    for p in cfg.get("pads", []):
        parts.append(f'<polygon points="{" ".join(P(v) for v in p["poly"])}" fill="#e6e5df" stroke="#8a8c88" stroke-width="0.8"/>')
    for r in cfg["rooms"]:
        if r.get("poly"):
            parts.append(f'<polygon points="{" ".join(P(v) for v in r["poly"])}" fill="#fbfaf7"/>')
    for w in cfg["walls"]:
        parts.append(f'<polygon points="{" ".join(P(v) for v in w["q"])}" fill="#1f2021"/>')
    for r in cfg["rooms"]:
        if r["area"] < 60:
            continue
        x, z = r["label"]
        parts.append(f'<text x="{(x - x0) * sc:.1f}" y="{(z - z0) * sc:.1f}" font-family="system-ui, sans-serif" font-size="9" text-anchor="middle" fill="#1f2021">{esc(r["name"])}</text>')
    parts.append("</svg>")
    return "".join(parts)


def svg_data_uri(svg: str) -> str:
    from urllib.parse import quote
    return "data:image/svg+xml," + quote(svg, safe=" =:,/\"'#")


def stage_list(entry: dict, cfg: dict | None) -> list[tuple[str, str]]:
    if cfg:
        return [(s["id"], s["label"]) for s in cfg["stages"]]
    return [tuple(s) for s in entry["stages"]]


def room_lists(entry: dict, cfg: dict | None) -> dict:
    if cfg:
        big = [r["name"] for r in cfg["rooms"] if r["area"] >= 150 and r.get("poly")]
        return {"main": big, "upper": big}
    return entry["rooms"]


LEARN_CONFIG = {
    "house": ["roof", "garage"],
    "front": ["header", "garage"],
    "roof": ["roof"],
    "upper": ["partition"],
    "plan": ["partition"],
    "foundation": ["foundation"],
}
NOTES_CONFIG = {
    "roof": ("Roof", "The layout does not draw the roof or give a pitch. Assumed: a hipped roof over each wing at a 6:12 pitch, 18 inch overhangs with fascia and soffit, and standing-seam metal. The garage and shop share one roof. The living and dining roof sits higher over its 14 foot ceiling."),
    "garage": ("Garage and shop", "The garage, 2,511 SF as printed, wraps around a 406 SF shop and a small bath. Its overhead doors face the apron."),
    "header": ("Openings", "Windows, doors and the two bays are placed where the layout leaves gaps in the walls. Sill and head heights are typical values, not printed."),
    "partition": ("Room layout", "Room names, areas and ceiling heights are the ones printed on the layout. Select a room to fly in."),
    "foundation": ("Slab", "A one-story house on a slab: the floor, the covered patio, the entry porch and the apron."),
}
CALL_LABEL = {"roof": "Roof", "garage": "Garage", "header": "Openings", "partition": "Room layout", "foundation": "Slab"}


def model_section(entry: dict, cfg: dict | None, *, standalone: bool = False, still: str = "") -> str:
    """The polished model block (numbered stages, layer slider, room picker, 3D/top switch)."""
    stages = stage_list(entry, cfg)
    n = len(stages)
    lis = []
    for i, (sid, label) in enumerate(stages):
        on = ' class="ppgm-is-on"' if i == 0 else ""
        cur = ' aria-current="step"' if i == 0 else ""
        lis.append(f'          <li{on} data-ppgm-stage="{sid}"><button type="button" data-ppgm-stage="{sid}" data-ppgm-progress="{STAGE_PROGRESS[sid]}"{cur}><span class="ppgm-step-number" aria-hidden="true">{i + 1:02d}</span><span>{esc(label)}</span></button></li>')
    first_line = cfg["stages"][0]["line"] if cfg else entry["firstLine"]
    rooms = room_lists(entry, cfg)
    title = entry["title"]
    learn = ""
    if cfg:
        sets = []
        for i, (sid, _l) in enumerate(stages):
            btns = "".join(f'\n            <button type="button" class="ppgm-call" data-ppgm-callout="{c}" aria-pressed="false" aria-controls="ppgm-note-{c}">{CALL_LABEL[c]}</button>' for c in LEARN_CONFIG[sid])
            sets.append(f'          <div class="ppgm-learn-set" data-ppgm-stage="{sid}"{" hidden" if i else ""}>{btns}\n          </div>')
        notes = "".join(f'\n            <p class="ppgm-note" id="ppgm-note-{k}" data-ppgm-callout="{k}"><strong>{t}.</strong> {esc(b)}</p>' for k, (t, b) in NOTES_CONFIG.items())
        learn = f'''        <div class="ppgm-learn">
          <p class="ppgm-section-label">How the model was made</p>
{chr(10).join(sets)}
          <div class="ppgm-learn-copy" aria-live="polite">
            <p class="ppgm-learn-prompt" id="ppgm-learn-prompt">{esc(entry["sourceNote"])}</p>{notes}
          </div>
        </div>
'''
    config_tag = ""
    if cfg:
        config_tag = '\n    <script type="application/json" class="ppgm-config">' + json.dumps(cfg, separators=(",", ":")).replace("</", "<\\/") + "</script>"
    cta = ""
    if standalone:
        cta = '''        <section class="ppgm-house-cta" aria-labelledby="ppgm-build-title">
          <p class="ppgm-section-label">Build with Pacific Pro Group</p>
          <h3 id="ppgm-build-title">Expect more from your builder.</h3>
          <p class="ppgm-cta-copy">Bring your ideas to a team that sees the whole project. From the first design conversation to construction, Pacific Pro Group focuses on practical planning, careful craftsmanship and clear communication.</p>
          <ul class="ppgm-services" aria-label="Our services">
            <li>Custom homes</li><li>Home additions</li><li>Luxury remodels</li>
          </ul>
          <div class="ppgm-cta-actions">
            <a class="ppgm-cta-link" href="https://pacificprogroup.com/#contact">Start your project <span aria-hidden="true">↗</span></a>
            <a class="ppgm-cta-phone" href="tel:+12064465656">Call (206) 446-5656</a>
          </div>
          <p class="ppgm-service-area">Serving Edmonds, Seattle, and communities across King and Snohomish counties.</p>
        </section>
'''
    kicker = "Pacific Pro Group · Design + Build" if standalone else "Pacific Pro Group portfolio"
    heading = "h2" if standalone else "h1"
    still_style = f' style="--ppgm-still-image: url(&quot;{esc(still)}&quot;)"' if still else ""
    rooms_html = "".join(
        f'\n          <ul class="ppgm-rooms" data-ppgm-rooms="{k}" hidden>\n            {"".join(f"<li>{esc(x)}</li>" for x in v)}\n          </ul>' for k, v in rooms.items())
    return f'''<div class="ppgm-wrap">
  <section class="ppgm-house" id="ppgm-house" data-ppgm-embed="1" data-ppgm-project="{esc(entry["slug"])}" aria-labelledby="ppgm-house-title"{still_style}>{config_tag}
    <div class="ppgm-house-track">
      <div class="ppgm-house-sticky">
        <div class="ppgm-top">
          <p class="ppgm-kicker">{kicker}</p>
          <{heading} class="ppgm-title" id="ppgm-house-title">{esc(title)}</{heading}>
          <p class="ppgm-dek">{esc(entry["dek"])}</p>
          <p class="ppgm-project">Choose a layer, or select Explore to turn the model and go to a room.</p>
        </div>
        <ol class="ppgm-stages" aria-label="House layers">
{chr(10).join(lis)}
        </ol>
        <div class="ppgm-progress" aria-hidden="true"><span></span></div>
        <div class="ppgm-scrub-label">
          <div class="ppgm-scrub-heading">
            <label for="ppgm-scrub">Peel back the layers</label>
            <span class="ppgm-stage-readout"><span class="ppgm-stage-current">Finished house</span><span class="ppgm-stage-count" aria-hidden="true">01 / {n:02d}</span></span>
          </div>
          <input id="ppgm-scrub" class="ppgm-scrub" type="range" min="0" max="1000" step="1" value="0" aria-valuetext="House, 0 percent">
          <div class="ppgm-scrub-ends" aria-hidden="true"><span>Finished house</span><span>{esc(stages[-1][1])}</span></div>
        </div>
        <div class="ppgm-house-live">
          <p class="ppgm-hint" aria-hidden="true">Scroll <span class="ppgm-hint-chevron">↓</span></p>
          <div class="ppgm-house-sheet" role="img" aria-label="Illustrative drawing of {esc(title)}.">
            <canvas class="ppgm-house-canvas" width="960" height="540" tabindex="0" aria-describedby="ppgm-explore-help" aria-label="Interactive model: {esc(title)}"></canvas>
            <div class="ppgm-labels" aria-hidden="true"></div>
          </div>
          <div class="ppgm-explore" role="group" aria-label="Model controls" hidden>
            <button type="button" class="ppgm-explore-toggle" aria-describedby="ppgm-explore-help">Explore the house</button>
            <div class="ppgm-view-switch" role="group" aria-label="View angle">
              <button type="button" class="ppgm-view" data-ppgm-view="perspective" aria-pressed="true">3D view</button>
              <button type="button" class="ppgm-view" data-ppgm-view="plan" aria-pressed="false">Top view</button>
            </div>
            <select class="ppgm-room-select" id="ppgm-room-select" aria-label="Go to a room">
              <option value="">Go to a room</option>
            </select>
            <div class="ppgm-zoom-group" role="group" aria-label="Zoom and reset">
              <button type="button" class="ppgm-zoom" data-ppgm-zoom="out" aria-label="Zoom out" hidden>−</button>
              <button type="button" class="ppgm-zoom" data-ppgm-zoom="in" aria-label="Zoom in" hidden>+</button>
              <button type="button" class="ppgm-explore-reset" hidden>Reset view</button>
            </div>
            <p id="ppgm-explore-help" class="ppgm-explore-help">Select Explore to turn and zoom the model. Arrow keys turn. Shift with arrow keys pans. Plus and minus zoom. Zero resets. Escape ends exploring. Use Go to a room for a close view.</p>
          </div>
          <p class="ppgm-fallback-message ppgm-status" hidden>Interactive 3D is unavailable. This static drawing shows the plan.</p>
          <details class="ppgm-help">
            <summary>How to explore</summary>
            <div class="ppgm-help-content">
              <p><strong>Mouse or touch.</strong> Select Explore, then drag to turn. Use the zoom buttons, scroll or pinch to zoom. Right-drag or use two fingers to pan. Choose a room from the menu, or select a room in the drawing, to move closer. Choose Done exploring to scroll the page again.</p>
              <p><strong>Keyboard.</strong> Focus the drawing and press Enter. Arrow keys turn; Shift with arrow keys pans. Plus and minus zoom, 0 resets, and Escape ends exploring. Use the layer buttons or slider to reveal the house.</p>
              <p>Top view looks straight down at the plan. Zooming in lifts the roof and reveals room names. Reset view returns to the selected layer.</p>
            </div>
          </details>
          <noscript><p class="ppgm-status">This is a static view. Enable JavaScript to explore the layers and rooms.</p></noscript>{rooms_html}
          <p class="ppgm-house-line" id="ppgm-house-line" aria-live="polite" aria-atomic="true">{esc(first_line)}</p>
        </div>
        <figure class="ppgm-house-still">
          <div class="ppgm-still-img" role="img" aria-label="Plan drawing of {esc(title)}."></div>
          <figcaption class="ppgm-house-line">{esc(title)}, a Pacific Pro Group project.</figcaption>
        </figure>
{learn}{cta}      </div>
    </div>
  </section>
</div>'''


def _gs():
    import sys
    sys.path.insert(0, str(ROOT))
    import generate_site as gs  # noqa: E402
    return gs


def model_page(entry: dict) -> str:
    gs = _gs()
    cfg = load_config(entry)
    still = entry.get("still") or (svg_data_uri(svg_plan(cfg)) if cfg else "")
    section = model_section(entry, cfg, still=still)
    slug = entry["slug"]
    canon = f"{ORIGIN}/portfolio/{slug}/"
    links = ['<a href="/portfolio/" class="text-secondary hover:underline">All portfolio models</a>']
    if entry.get("projectPage"):
        links.append(f'<a href="{esc(entry["projectPage"])}" class="text-secondary hover:underline">See the project</a>')
    facts = "".join(f'<li style="margin-right:1.5rem">{esc(f)}</li>' for f in entry["facts"])
    body = f'''<div class="max-w-6xl mx-auto px-4 pt-6 pb-10 relative z-20 portfolio-model">
{section}
  <div class="mt-6 text-sm text-slate-300 space-y-3">
    <ul class="flex flex-wrap gap-x-6 gap-y-1 text-slate-200" aria-label="Project facts">{facts}</ul>
    <p>{esc(entry["sourceNote"])}</p>
    <p class="flex flex-wrap gap-x-6">{" ".join(links)}</p>
  </div>
</div>'''
    scripts = '  <script src="/assets/js/house-model.js" defer></script>\n'
    if entry["engine"] == "magnolia":
        scripts = '  <script src="/assets/js/house-model-magnolia.js" defer></script>\n' + scripts
    return gs.page_shell(
        title=f"{entry['title']}: 3D model",
        description=f"Interactive 3D model of a Pacific Pro Group project: {entry['card']}",
        active="portfolio",
        body=body,
        prefix="/",
        canonical=canon,
        include_widgets=False,
        extra_head='  <link rel="stylesheet" href="/assets/css/house-model.css">\n',
        extra_scripts=scripts,
        breadcrumbs=[("Home", ORIGIN + "/"), ("Portfolio", ORIGIN + "/portfolio/"), (entry["title"], canon)],
    )


def grid_page(projects: list[dict]) -> str:
    gs = _gs()
    cards = []
    for e in projects:
        facts = "".join(f'<li style="margin-right:1rem">{esc(f)}</li>' for f in e["facts"])
        cards.append(f'''    <li class="portfolio-card bg-charcoal border border-white/5 hover:border-primary/30 rounded-lg overflow-hidden card-hover">
      <a href="/portfolio/{esc(e["slug"])}/" class="block h-full">
        <img src="{esc(e["thumb"])}" alt="3D model of {esc(e["title"])}" width="1200" height="675" loading="lazy" class="w-full aspect-video object-cover bg-white">
        <div class="p-5">
          <p class="text-xs uppercase tracking-wider text-slate-400">{esc(e["kicker"])}</p>
          <h2 class="text-lg font-bold text-white tracking-tight mt-1">{esc(e["title"])}</h2>
          <p class="text-sm text-slate-300 mt-2">{esc(e["card"])}</p>
          <ul class="text-xs text-slate-400 mt-3 flex flex-wrap gap-x-4 gap-y-1">{facts}</ul>
          <p class="text-sm font-bold text-secondary mt-4">Open the 3D model <span aria-hidden="true">→</span></p>
        </div>
      </a>
    </li>''')
    body = f'''<div class="max-w-6xl mx-auto px-4 pt-8 pb-12 relative z-20">
  <header class="mb-8 max-w-3xl">
    <p class="text-xs uppercase tracking-wider text-slate-400">Pacific Pro Group</p>
    <h1 class="text-3xl md:text-4xl font-bold text-white tracking-tight mt-2">Portfolio: project models in 3D</h1>
    <p class="text-slate-300 mt-3">Interactive line-drawing models of Pacific Pro Group projects, built from each project's plans. Open a model to peel back the roof, walk the floor plan and go to any room.</p>
  </header>
  <ul class="portfolio-grid grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Project models">
{chr(10).join(cards)}
  </ul>
</div>'''
    return gs.page_shell(
        title="Portfolio: Pacific Pro Group project models in 3D",
        description="Interactive 3D models of Pacific Pro Group projects, built from each project's plans: peel back the roof, walk the floor plan and go to any room.",
        active="portfolio",
        body=body,
        prefix="../",
        canonical=f"{ORIGIN}/portfolio/",
        include_widgets=False,
        breadcrumbs=[("Home", ORIGIN + "/"), ("Portfolio", ORIGIN + "/portfolio/")],
    )


def pages() -> dict[str, str]:
    projects = load_projects()
    out = {"portfolio/index.html": grid_page(projects)}
    for e in projects:
        out[f"portfolio/{e['slug']}/index.html"] = model_page(e)
    return out


def main() -> None:
    for rel, text in pages().items():
        p = ROOT / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
        print("wrote", rel, len(text))


if __name__ == "__main__":
    main()
