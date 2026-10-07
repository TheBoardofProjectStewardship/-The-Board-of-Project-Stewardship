#!/usr/bin/env python3
"""Build performance assets: Latin Inter, Font Awesome subset, image variants, 720p videos.

Original media files are left in place. Derived files get new names and unique checksums.
"""
from __future__ import annotations

import hashlib
import re
import subprocess
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PYFT = Path.home() / ".local" / "bin" / "pyftsubset"
WIDTHS = (480, 800, 1200)
HERO_WIDTHS = (640, 1280)
HERO_BUDGET = 150 * 1024
SKIP_PARTS = {"node_modules", "intake", "tests", ".git", "vendor"}


def md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def existing_md5s() -> set[str]:
    found: set[str] = set()
    for path in ROOT.joinpath("assets").rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif"}:
            continue
        found.add(md5(path.read_bytes()))
    return found


def save_unique(im: Image.Image, dest: Path, *, quality: int, seen: set[str]) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    work = im.convert("RGB")
    q = quality
    blob = b""
    for _ in range(8):
        buf = BytesIO()
        work.save(buf, format="WEBP", quality=q, method=6)
        blob = buf.getvalue()
        digest = md5(blob)
        if digest not in seen:
            break
        # Nudge one corner pixel so a derived file is never a byte copy.
        px = work.getpixel((0, 0))
        work.putpixel((0, 0), ((px[0] + 1) % 256, px[1], px[2]))
        q = max(40, q - 1)
    dest.write_bytes(blob)
    seen.add(md5(blob))


def to_width(im: Image.Image, width: int) -> Image.Image | None:
    if im.width <= width:
        return None
    height = max(1, round(im.height * (width / im.width)))
    return im.convert("RGB").resize((width, height), Image.Resampling.LANCZOS)


def variant_name(path: Path, width: int) -> Path:
    return path.with_name(f"{path.stem}-{width}.webp")


def is_variant(path: Path) -> bool:
    return bool(re.search(r"-(480|640|800|1200|1280)$", path.stem))


def build_images(seen: set[str]) -> None:
    roots = [ROOT / "assets" / "images", ROOT / "assets" / "hero"]
    count = 0
    for base in roots:
        if not base.exists():
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in {".webp", ".jpg", ".jpeg", ".png"}:
                continue
            if is_variant(path):
                continue
            try:
                im = Image.open(path)
                im.load()
            except Exception as exc:
                print(f"  skip unreadable {path}: {exc}")
                continue
            hero = path.parent == ROOT / "assets" / "hero" and path.suffix.lower() in {".jpg", ".jpeg"}
            widths = HERO_WIDTHS if hero else WIDTHS
            for width in widths:
                dest = variant_name(path, width)
                if dest.exists() and dest.stat().st_size > 0:
                    seen.add(md5(dest.read_bytes()))
                    continue
                resized = to_width(im, width)
                if resized is None and not hero:
                    continue
                if resized is None:
                    resized = im.convert("RGB")
                quality = 68
                if hero:
                    # Stay at or under 150 KB for the hero layers.
                    for quality in (70, 60, 52, 46, 40, 34):
                        buf = BytesIO()
                        resized.save(buf, format="WEBP", quality=quality, method=6)
                        if buf.tell() <= HERO_BUDGET:
                            break
                save_unique(resized, dest, quality=quality, seen=seen)
                count += 1
                print(f"  image {dest.relative_to(ROOT)} {dest.stat().st_size // 1024} KB")
            if path.name == "energy-credits-hero.png":
                dest = path.with_suffix(".webp")
                if not dest.exists():
                    full = im.convert("RGB")
                    if full.width > 1600:
                        full = to_width(full, 1600) or full
                    save_unique(full, dest, quality=68, seen=seen)
                    print(f"  image {dest.relative_to(ROOT)} {dest.stat().st_size // 1024} KB")
                    count += 1
    print(f"image variants written this run: {count}")


def build_font() -> None:
    src = ROOT / "assets" / "fonts" / "InterVariable.woff2"
    dest = ROOT / "assets" / "fonts" / "InterLatin.woff2"
    if not src.is_file():
        raise SystemExit(f"missing {src}")
    unicodes = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
    subprocess.check_call(
        [
            str(PYFT),
            str(src),
            f"--output-file={dest}",
            "--flavor=woff2",
            f"--unicodes={unicodes}",
            "--layout-features=kern,liga,calt",
            "--desubroutinize",
        ]
    )
    print(f"inter latin {dest.stat().st_size // 1024} KB")


def icon_names() -> set[str]:
    names: set[str] = set()
    for path in list(ROOT.rglob("*.py")) + list(ROOT.rglob("*.html")):
        if any(part in SKIP_PARTS for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        names.update(re.findall(r"\bfa-([a-z0-9-]+)\b", text))
    names.discard("solid")
    names.discard("regular")
    names.discard("brands")
    return names


def build_icons() -> None:
    css = Path("/tmp/perf-src/all.min.css").read_text(encoding="utf-8", errors="ignore")
    shims = Path("/tmp/perf-src/v4-shims.min.css").read_text(encoding="utf-8", errors="ignore")
    mapping: dict[str, str] = {}
    for blob in (css, shims):
        for selectors, code in re.findall(r"([^{]+)\{content:\"\\([0-9a-fA-F]+)\"\}", blob):
            for name in re.findall(r"\.fa-([a-z0-9-]+):before", selectors):
                mapping.setdefault(name, code.lower())
    wanted = sorted(icon_names())
    missing = [name for name in wanted if name not in mapping]
    if missing:
        print("icons without a FA glyph:", ", ".join(missing))
    used = [(name, mapping[name]) for name in wanted if name in mapping]
    codes = sorted({code for _, code in used})
    unicodes = ",".join(f"U+{code.upper()}" for code in codes)
    src = Path("/tmp/perf-src/fa-solid-900.woff2")
    dest = ROOT / "assets" / "fonts" / "fa-solid-subset.woff2"
    subprocess.check_call(
        [str(PYFT), str(src), f"--output-file={dest}", "--flavor=woff2", f"--unicodes={unicodes}"]
    )
    rules = "\n".join(f".fa-{name}:before{{content:\"\\{code}\"}}" for name, code in used)
    face = """@font-face{font-family:"Font Awesome 6 Free";font-style:normal;font-weight:900;font-display:swap;src:url("/assets/fonts/fa-solid-subset.woff2") format("woff2")}
.fa,.fas,.fa-solid{font-family:"Font Awesome 6 Free";font-weight:900;display:inline-block;font-style:normal;font-variant:normal;line-height:1;text-rendering:auto;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
"""
    (ROOT / "assets" / "css" / "fa-subset.css").write_text(face + rules + "\n", encoding="utf-8")
    print(f"fa subset {dest.stat().st_size // 1024} KB, {len(used)} icons, missing {len(missing)}")


def published_videos() -> list[Path]:
    found = []
    for path in (ROOT / "assets").rglob("*.mp4"):
        if any(part in SKIP_PARTS for part in path.parts):
            continue
        if path.stem.endswith("-720"):
            continue
        found.append(path)
    return sorted(found)


def encode_one(src: Path) -> None:
    dest = src.with_name(src.stem + "-720.mp4")
    poster = src.with_name(src.stem + "-poster.webp")
    if not dest.exists() or dest.stat().st_size == 0:
        probe = subprocess.run(
            [
                "ffprobe", "-v", "error", "-select_streams", "v:0",
                "-show_entries", "stream=height", "-of", "csv=p=0", str(src),
            ],
            capture_output=True, text=True,
        )
        try:
            height = int((probe.stdout or "0").strip().split(",")[0] or "0")
        except ValueError:
            height = 0
        vf = ["-vf", "scale=-2:720"] if height > 720 else []
        cmd = [
            "ffmpeg", "-y", "-i", str(src), *vf,
            "-c:v", "libx264", "-crf", "28", "-preset", "veryfast",
            "-c:a", "aac", "-b:a", "96k",
            "-movflags", "+faststart",
            "-metadata", f"comment=board-720-{src.name}",
            str(dest),
        ]
        proc = subprocess.run(cmd, capture_output=True)
        if proc.returncode != 0:
            cmd = [
                "ffmpeg", "-y", "-i", str(src), *vf,
                "-c:v", "libx264", "-crf", "28", "-preset", "veryfast",
                "-an", "-movflags", "+faststart",
                "-metadata", f"comment=board-720-{src.name}",
                str(dest),
            ]
            proc = subprocess.run(cmd, capture_output=True)
            if proc.returncode != 0:
                err = proc.stderr.decode("utf-8", "replace")[-500:]
                raise SystemExit(f"ffmpeg failed for {src}:\n{err}")
        print(f"  video {dest.relative_to(ROOT)} {dest.stat().st_size / 1e6:.2f} MB (from {src.stat().st_size / 1e6:.2f})")
    else:
        print(f"  video exists {dest.relative_to(ROOT)}")
    if poster.exists() and poster.stat().st_size > 0:
        return
    png = subprocess.run(
        ["ffmpeg", "-y", "-ss", "0.4", "-i", str(src), "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1"],
        capture_output=True,
    )
    if png.returncode != 0 or not png.stdout:
        print(f"  poster skipped {src.name}")
        return
    im = Image.open(BytesIO(png.stdout))
    resized = to_width(im, 1280) or im.convert("RGB")
    seen = existing_md5s()
    save_unique(resized, poster, quality=62, seen=seen)
    print(f"  poster {poster.relative_to(ROOT)} {poster.stat().st_size // 1024} KB")


def build_videos() -> None:
    videos = published_videos()
    print(f"encoding {len(videos)} videos")
    # Sequential keeps memory predictable on the VM. veryfast is enough.
    for src in videos:
        encode_one(src)


def main() -> None:
    seen = existing_md5s()
    print("font")
    build_font()
    print("icons")
    build_icons()
    print("images")
    build_images(seen)
    print("videos")
    build_videos()
    print("done")


if __name__ == "__main__":
    main()
