#!/usr/bin/env python3
"""Original editorial illustrations for the visualizer demo.

Drawn in code, then scaled down. They are not photographs, not customer
houses, and not Pacific Pro Group projects. Each picture is labeled
"Sample — illustrative".
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "images" / "visualizer"
W, H = 2400, 1600
FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 42)


def _vgrad(img: Image.Image, y0: int, y1: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(img)
    span = max(1, y1 - y0)
    for y in range(y0, y1):
        t = (y - y0) / span
        color = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        draw.line([(0, y), (W, y)], fill=color)


def _window(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], frame: tuple[int, int, int], glass: tuple[int, int, int]) -> None:
    x0, y0, x1, y1 = box
    draw.rectangle(box, fill=frame)
    inset = 14
    draw.rectangle([x0 + inset, y0 + inset, x1 - inset, y1 - inset], fill=glass)
    mid_x = (x0 + x1) // 2
    mid_y = (y0 + y1) // 2
    draw.rectangle([mid_x - 4, y0 + inset, mid_x + 4, y1 - inset], fill=frame)
    draw.rectangle([x0 + inset, mid_y - 4, x1 - inset, mid_y + 4], fill=frame)
    draw.polygon([(x0 + inset + 8, y0 + inset + 8), (x0 + 70, y0 + inset + 8), (x0 + inset + 8, y0 + 90)], fill=(255, 255, 255))


def _siding(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], color: tuple[int, int, int], line: tuple[int, int, int]) -> None:
    draw.rectangle(box, fill=color)
    x0, y0, x1, y1 = box
    for y in range(y0 + 18, y1, 22):
        draw.line([(x0, y), (x1, y)], fill=line)


def _label(img: Image.Image) -> None:
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([36, 36, 560, 112], radius=16, fill=(255, 252, 247))
    draw.text((56, 52), "Sample — illustrative", font=FONT, fill=(15, 23, 42))


def _finish(img: Image.Image) -> Image.Image:
    _label(img)
    soft = img.filter(ImageFilter.SMOOTH)
    return soft.resize((1200, 800), Image.Resampling.LANCZOS)


def exterior(second: bool, craftsman: bool = False) -> Image.Image:
    img = Image.new("RGB", (W, H), (186, 210, 224))
    _vgrad(img, 0, 1120, (168, 198, 216) if not craftsman else (186, 196, 176), (236, 226, 210))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 1120, W, H], fill=(118, 132, 96))
    draw.polygon([(0, 1120), (W, 1160), (W, H), (0, H)], fill=(132, 146, 108))
    draw.ellipse([40, 860, 520, 1280], fill=(58, 96, 64))
    draw.rectangle([230, 980, 290, 1240], fill=(92, 64, 46))
    draw.ellipse([1880, 900, 2360, 1320], fill=(46, 86, 58))
    draw.rectangle([2080, 980, 2140, 1260], fill=(86, 60, 42))
    draw.polygon([(0, 1240), (700, 1180), (1500, 1240), (2400, 1200), (2400, 1320), (0, 1320)], fill=(168, 164, 150))
    body = (214, 206, 196) if not craftsman else (176, 142, 110)
    line = (186, 176, 164) if not craftsman else (150, 118, 88)
    top = 520 if second else 760
    _siding(draw, (620, top, 1860, 1240), body, line)
    roof = (74, 78, 82) if not craftsman else (122, 64, 48)
    peak = 220 if second else 430
    draw.polygon([(540, top + 30), (1240, peak), (1940, top + 30)], fill=roof)
    draw.polygon([(560, top + 24), (1240, peak + 36), (1920, top + 24)], fill=tuple(max(0, c - 18) for c in roof))
    if second:
        for x in (760, 1040, 1360):
            _window(draw, (x, 620, x + 180, 860), (244, 240, 232), (176, 204, 214))
        if craftsman:
            draw.rectangle([860, 500, 1620, 580], fill=(92, 64, 48))
            for x in (940, 1160, 1380):
                draw.rectangle([x, 430, x + 36, 560], fill=(92, 64, 48))
    for x in (760, 1500):
        _window(draw, (x, 900, x + 200, 1120), (244, 240, 232), (168, 198, 208))
    draw.rectangle([1120, 980, 1320, 1240], fill=(62, 48, 40))
    draw.ellipse([1288, 1090, 1316, 1118], fill=(212, 176, 92))
    draw.rectangle([560, 1220, 1960, 1280], fill=(150, 142, 128))
    if craftsman and not second:
        draw.polygon([(980, 860), (1240, 700), (1500, 860)], fill=roof)
        draw.rectangle([1040, 860, 1440, 980], fill=(92, 64, 48))
    return _finish(img)


def kitchen(refreshed: bool, wood: bool = False) -> Image.Image:
    img = Image.new("RGB", (W, H), (236, 232, 224))
    draw = ImageDraw.Draw(img)
    wall = (244, 240, 232) if refreshed else (214, 196, 168)
    floor = (186, 166, 142) if refreshed else (128, 112, 96)
    cab = (236, 232, 224) if refreshed and not wood else (92, 64, 48) if wood else (150, 104, 62)
    _vgrad(img, 0, 980, wall, tuple(max(0, c - 12) for c in wall))
    draw.rectangle([0, 1240, W, H], fill=floor)
    for x in range(0, W, 80):
        shade = 8 if (x // 80) % 2 == 0 else -8
        draw.rectangle([x, 1240, x + 80, H], fill=tuple(max(0, min(255, c + shade)) for c in floor))
    draw.rectangle([0, 860, W, 980], fill=(214, 210, 202) if refreshed else (120, 108, 96))
    draw.rectangle([0, 860, W, 884], fill=(186, 182, 174))
    for x in range(80, 2200, 280):
        draw.rounded_rectangle([x, 80, x + 240, 420], radius=8, fill=cab, outline=(70, 64, 58), width=3)
        draw.rectangle([x + 28, 130, x + 212, 370], outline=(120, 112, 102), width=3)
        draw.ellipse([x + 108, 230, x + 132, 254], fill=(186, 170, 120))
    _window(draw, (860, 470, 1540, 820), (244, 240, 232), (168, 198, 210))
    for x in range(80, 2200, 280):
        draw.rounded_rectangle([x, 980, x + 240, 1280], radius=6, fill=cab, outline=(70, 64, 58), width=3)
        draw.line([(x + 120, 1020), (x + 120, 1240)], fill=(70, 64, 58), width=3)
    draw.rectangle([980, 900, 1120, 980], fill=(230, 236, 238), outline=(140, 150, 154), width=4)
    if refreshed:
        draw.rounded_rectangle([760, 1040, 1640, 1480], radius=12, fill=(214, 186, 150) if not wood else (120, 86, 58), outline=(90, 72, 52), width=6)
        draw.rectangle([800, 1080, 1600, 1160], fill=(248, 246, 242))
    return _finish(img)


def bathroom(refreshed: bool, spa: bool = False) -> Image.Image:
    img = Image.new("RGB", (W, H), (232, 236, 236))
    wall = (236, 240, 238) if refreshed else (206, 198, 186)
    tile = (186, 196, 192) if not spa else (168, 186, 180)
    _vgrad(img, 0, 1280, wall, tuple(max(0, c - 10) for c in wall))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 1280, W, H], fill=(176, 172, 164) if not refreshed else (210, 214, 212))
    if refreshed:
        draw.rectangle([80, 220, 980, 1500], fill=tile)
        for y in range(240, 1480, 80):
            draw.line([(80, y), (980, y)], fill=(150, 160, 160))
        for x in range(80, 980, 120):
            draw.line([(x, 220), (x, 1500)], fill=(150, 160, 160))
        draw.rectangle([180, 360, 860, 1320], fill=(224, 232, 230))
        draw.ellipse([430, 120, 610, 280], fill=(236, 238, 236), outline=(160, 168, 168), width=6)
        draw.rounded_rectangle([1120, 860, 2200, 1360], radius=16, fill=(248, 246, 242), outline=(160, 156, 148), width=4)
        draw.ellipse([1280, 720, 1560, 980], fill=(236, 240, 240), outline=(170, 176, 178), width=8)
        draw.ellipse([1760, 720, 2040, 980], fill=(236, 240, 240), outline=(170, 176, 178), width=8)
        draw.rectangle([1240, 420, 2080, 680], fill=(214, 222, 222), outline=(160, 168, 170), width=6)
    else:
        draw.rounded_rectangle([160, 760, 1100, 1460], radius=80, fill=(232, 224, 208), outline=(150, 140, 124), width=8)
        draw.rectangle([220, 280, 420, 620], fill=(186, 196, 198), outline=(140, 148, 150), width=4)
        draw.rectangle([1280, 900, 2140, 1460], fill=(168, 136, 104), outline=(110, 86, 60), width=4)
        draw.ellipse([1540, 760, 1840, 1040], fill=(236, 236, 232), outline=(160, 160, 156), width=8)
        draw.rectangle([1400, 360, 2020, 700], fill=(206, 210, 212), outline=(150, 150, 146), width=6)
    return _finish(img)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    pairs = {
        "exterior-before.webp": exterior(False),
        "exterior-after.webp": exterior(True, False),
        "exterior-after-b.webp": exterior(True, True),
        "kitchen-before.webp": kitchen(False),
        "kitchen-after.webp": kitchen(True, False),
        "kitchen-after-b.webp": kitchen(True, True),
        "bathroom-before.webp": bathroom(False),
        "bathroom-after.webp": bathroom(True, False),
        "bathroom-after-b.webp": bathroom(True, True),
    }
    for name, image in pairs.items():
        path = OUT / name
        image.save(path, "WEBP", quality=82, method=6)
        print(f"{path.relative_to(ROOT)} {path.stat().st_size}")


if __name__ == "__main__":
    main()
