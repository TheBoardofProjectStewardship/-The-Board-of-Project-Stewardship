#!/usr/bin/env python3
"""Build the WordPress plugin's single script from the Build Here source files.

    python3 wordpress/build.py            writes wordpress/ppg-build-here/assets/js/ppg-build-here.js
    python3 wordpress/build.py --zip DIR  also writes DIR/ppg-build-here-<version>.zip

The plugin has no copy of the tool's logic of its own. The script it ships is made here from
assets/js/build-here*.js, assets/css/build-here.css, and three small files in wordpress/src/
(the markup, the embed-only styles, and the loader). Fix a bug in the source, run this, ship the zip.

What the build changes, and why:

  window.BuildHere* / root.BuildHere*  ->  NS.BuildHere*
      The modules talk to each other through properties on window. In the bundle they talk through a
      private object, so the page gets one global (window.PPGBuildHere) and nothing else.

  1.5rem  ->  calc(var(--ppgbh-rem) * 1.5)
      rem is the root font size, which belongs to the theme. Some themes set it to 10px. The loader
      sets --ppgbh-rem to 1rem when the root size is ordinary and to 16px when it is not.

  @media (max-width: 760px)  ->  @container ppgbh (max-width: 760px)
      The tool can sit in a narrow column on a wide screen. Its layout follows its own width.

  70vw  ->  70cqw        the same, for the two viewport-width lengths in the stylesheet
  #bh-home rules         dropped (they style the homepage include on the source site)
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PLUGIN = HERE / "ppg-build-here"
OUT = PLUGIN / "assets" / "js" / "ppg-build-here.js"
MODULES = ["build-here-rules.js", "build-here-landscape.js", "build-here-measures.js", "build-here-stage.js", "build-here-export.js", "build-here.js"]


def plugin_version() -> str:
    m = re.search(r"^\s*\*\s*Version:\s*([0-9][0-9A-Za-z.\-]*)\s*$", (PLUGIN / "ppg-build-here.php").read_text(encoding="utf-8"), re.M)
    if not m:
        raise SystemExit("No Version header in ppg-build-here.php")
    return m.group(1)


def module_js(name: str) -> str:
    text = (ROOT / "assets" / "js" / name).read_text(encoding="utf-8")
    text, n = re.subn(r"\b(?:window|root)\.BuildHere", "NS.BuildHere", text)
    if not n:
        raise SystemExit(name + ": no BuildHere global found; has the module pattern changed?")
    # A stray CommonJS shim on the page must not receive the module.
    text = re.sub(r"\n[ \t]*if \(typeof module !== \"undefined\" && module\.exports\) module\.exports = api;", "", text)
    return "/* ---- " + name + " ---- */\n" + text.rstrip() + "\n"


def blocks(css: str):
    """Top-level pieces of a stylesheet: ("rule", text) or ("at", prelude, body)."""
    i, n = 0, len(css)
    while i < n:
        j = css.find("{", i)
        if j < 0:
            break
        depth, k = 1, j + 1
        while k < n and depth:
            depth += {"{": 1, "}": -1}.get(css[k], 0)
            k += 1
        prelude = css[i:j].strip()
        if prelude.startswith("@"):
            yield ("at", prelude, css[j + 1:k - 1])
        else:
            yield ("rule", css[i:k].strip())
        i = k


WIDTH = re.compile(r"^\((max|min)-width:\s*(\d+)px\)$")


def embed_css(css: str) -> str:
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out = []
    for b in blocks(css):
        if b[0] == "rule":
            if b[1].startswith("#bh-home"):
                continue
            out.append(b[1])
            continue
        prelude, body = b[1], b[2].strip()
        if prelude.startswith("@media"):
            cond = prelude[len("@media"):].strip()
            if "#bh-home" in body and body.lstrip().startswith("#bh-home") and body.count("#bh-home") >= body.count("{"):
                continue  # the homepage include's phone layout
            body = body.replace(",#bh-home *", "")
            screen = cond.startswith("screen and ")
            m = WIDTH.match(cond[len("screen and "):] if screen else cond)
            if m:
                inner = "@container ppgbh (%s-width:%spx){%s}" % (m.group(1), m.group(2), body)
                out.append("@media screen{%s}" % inner if screen else inner)
                continue
        out.append("%s{%s}" % (prelude, body))
    css = "\n".join(out)
    css = re.sub(r"(?<![\w.-])(\d*\.?\d+)rem\b", r"calc(var(--ppgbh-rem) * \1)", css)
    css = re.sub(r"(?<![\w.-])(\d*\.?\d+)vw\b", r"\1cqw", css)
    return css


def render() -> str:
    """The plugin script as text. build() writes it; the tests compare it with the file that is shipped."""
    version = plugin_version()
    widget = (HERE / "src" / "widget.css").read_text(encoding="utf-8")
    if widget.count("/*@CHROME*/") != 1:
        raise SystemExit("widget.css needs exactly one /*@CHROME*/ marker")
    base, chrome = widget.split("/*@CHROME*/")
    css = "\n".join([embed_css(base), embed_css((ROOT / "assets" / "css" / "build-here.css").read_text(encoding="utf-8")), embed_css(chrome)])
    if "#bh-home" in css:
        raise SystemExit("homepage rules were not removed")
    if re.search(r"(?<![\w.(-])\d*\.?\d+rem\b", css):
        raise SystemExit("a rem length was not rewritten")
    template = re.sub(r">\s+<", "><", (HERE / "src" / "widget.html").read_text(encoding="utf-8")).strip()
    modules = "\n".join(module_js(m) for m in MODULES)
    for leak in ("window.BuildHere", "root.BuildHere"):
        if leak in modules:
            raise SystemExit("a module still writes " + leak)
    loader = (HERE / "src" / "loader.js").read_text(encoding="utf-8")
    for marker in ('"@CSS"', '"@TEMPLATE"', "/*@MODULES*/"):
        if loader.count(marker) != 1:
            raise SystemExit("loader.js needs exactly one " + marker)
    js = loader.replace("@VERSION", version)
    js = js.replace('"@CSS"', json.dumps(css, ensure_ascii=True)).replace('"@TEMPLATE"', json.dumps(template, ensure_ascii=True))
    return js.replace("/*@MODULES*/", modules)


def build() -> Path:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(render(), encoding="utf-8")
    subprocess.run(["node", "--check", str(OUT)], check=True)
    print("built %s (%d KB, version %s)" % (OUT.relative_to(ROOT), OUT.stat().st_size // 1024, plugin_version()))
    return OUT


def make_zip(folder: Path) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / ("ppg-build-here-%s.zip" % plugin_version())
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(PLUGIN.rglob("*")):
            if p.is_file() and "__pycache__" not in p.parts and not p.name.startswith("."):
                zf.write(p, Path("ppg-build-here") / p.relative_to(PLUGIN))
    print("wrote", target)
    return target


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description="Build the PPG Build Here plugin script.")
    ap.add_argument("--zip", type=Path, default=None, help="also write the plugin zip into this folder")
    args = ap.parse_args(argv)
    build()
    if args.zip:
        make_zip(args.zip)


if __name__ == "__main__":
    sys.exit(main())
