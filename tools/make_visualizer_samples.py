#!/usr/bin/env python3
"""Original editorial illustrations for the visualizer demo.

These are drawn in code. They are not photographs, not customer houses,
and not Pacific Pro Group projects.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "images" / "visualizer"
W, H = 1200, 800


def _sky(draw: ImageDraw.ImageDraw, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> None:
    for y in range(H):
        t = y / (H - 1)
        color = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        draw.line([(0, y), (W, y)], fill=color)


def _ground(draw: ImageDraw.ImageDraw, y0: int, color: tuple[int, int, int]) -> None:
    draw.rectangle([0, y0, W, H], fill=color)


def _label(draw: ImageDraw.ImageDraw, text: str) -> None:
    draw.rounded_rectangle([28, 28, 430, 78], radius=8, fill=(255, 252, 247))
    draw.text((44, 42), text, fill=(15, 23, 42))


def exterior(second_story: bool) -> Image.Image:
    img = Image.new("RGB", (W, H), (186, 214, 232))
    draw = ImageDraw.Draw(img)
    _sky(draw, (186, 214, 232), (232, 224, 208))
    _ground(draw, 560, (122, 146, 96))
    draw.ellipse([80, 470, 260, 620], fill=(74, 112, 72))
    draw.rectangle([150, 400, 188, 560], fill=(92, 64, 42))
    draw.ellipse([900, 450, 1140, 640], fill=(62, 102, 68))
    draw.rectangle([990, 420, 1028, 580], fill=(86, 58, 38))
    # house body
    body_top = 300 if second_story else 390
    draw.rectangle([340, body_top, 900, 580], fill=(214, 206, 192))
    draw.rectangle([340, body_top, 900, body_top + 18], fill=(168, 154, 132))
    roof_peak_y = 150 if second_story else 250
    draw.polygon([(300, body_top + 8), (620, roof_peak_y), (940, body_top + 8)], fill=(90, 62, 52))
    # door and lower windows
    draw.rectangle([560, 470, 640, 580], fill=(62, 48, 40))
    draw.ellipse([648, 516, 662, 530], fill=(212, 176, 92))
    for x in (400, 740):
        draw.rectangle([x, 450, x + 90, 530], fill=(176, 206, 214))
        draw.rectangle([x + 42, 450, x + 48, 530], fill=(214, 206, 192))
        draw.rectangle([x, 486, x + 90, 492], fill=(214, 206, 192))
    if second_story:
        for x in (400, 560, 740):
            draw.rectangle([x, 250, x + 90, 330], fill=(186, 214, 222))
            draw.rectangle([x + 42, 250, x + 48, 330], fill=(214, 206, 192))
            draw.rectangle([x, 286, x + 90, 292], fill=(214, 206, 192))
        draw.rectangle([470, 210, 770, 236], fill=(168, 154, 132))
    draw.rectangle([300, 575, 940, 600], fill=(150, 140, 126))
    _label(draw, "Sample — illustrative")
    return img


def kitchen(refreshed: bool) -> Image.Image:
    img = Image.new("RGB", (W, H), (236, 230, 220))
    draw = ImageDraw.Draw(img)
    wall = (236, 232, 224) if refreshed else (214, 196, 168)
    cab = (248, 246, 242) if refreshed else (150, 104, 62)
    counter = (92, 96, 94) if refreshed else (120, 108, 96)
    floor = (196, 176, 150) if refreshed else (138, 122, 104)
    draw.rectangle([0, 0, W, H], fill=wall)
    draw.rectangle([0, 620, W, H], fill=floor)
    draw.rectangle([0, 430, W, 470], fill=counter)
    # upper cabinets
    for x in range(80, 1100, 180):
        draw.rectangle([x, 80, x + 160, 250], fill=cab, outline=(90, 84, 76))
        draw.rectangle([x + 16, 110, x + 144, 230], outline=(120, 112, 102))
    # lower cabinets
    for x in range(80, 1100, 180):
        draw.rectangle([x, 470, x + 160, 640], fill=cab, outline=(90, 84, 76))
        draw.line([(x + 80, 490), (x + 80, 620)], fill=(90, 84, 76))
    # window
    draw.rectangle([470, 270, 760, 410], fill=(176, 206, 214), outline=(90, 84, 76), width=6)
    draw.line([(615, 270), (615, 410)], fill=(90, 84, 76), width=4)
    if refreshed:
        # island
        draw.rectangle([430, 500, 800, 700], fill=(214, 186, 150), outline=(90, 72, 52), width=4)
        draw.rectangle([450, 520, 780, 560], fill=(248, 246, 242))
        draw.ellipse([980, 120, 1120, 260], fill=(232, 210, 150))
    else:
        draw.rectangle([980, 140, 1100, 220], fill=(232, 220, 170))
    _label(draw, "Sample — illustrative")
    return img


def bathroom(refreshed: bool) -> Image.Image:
    img = Image.new("RGB", (W, H), (228, 232, 234))
    draw = ImageDraw.Draw(img)
    wall = (236, 240, 242) if refreshed else (210, 204, 190)
    floor = (186, 190, 192) if refreshed else (150, 140, 128)
    draw.rectangle([0, 0, W, H], fill=wall)
    draw.rectangle([0, 640, W, H], fill=floor)
    if refreshed:
        # curbless shower zone
        draw.rectangle([80, 160, 520, 680], fill=(168, 186, 184), outline=(90, 104, 104), width=4)
        draw.rectangle([140, 220, 460, 620], fill=(214, 226, 224))
        draw.ellipse([250, 80, 350, 150], fill=(220, 224, 226), outline=(120, 128, 128))
        # double vanity
        draw.rectangle([600, 430, 1120, 660], fill=(248, 246, 242), outline=(120, 116, 110), width=3)
        draw.ellipse([680, 360, 800, 470], fill=(230, 236, 238), outline=(140, 150, 154), width=4)
        draw.ellipse([920, 360, 1040, 470], fill=(230, 236, 238), outline=(140, 150, 154), width=4)
        draw.rectangle([640, 250, 1080, 340], fill=(214, 222, 224), outline=(140, 150, 154))
    else:
        # tub
        draw.rounded_rectangle([120, 360, 620, 680], radius=40, fill=(232, 224, 208), outline=(140, 128, 112), width=4)
        draw.rectangle([160, 180, 240, 300], fill=(186, 196, 198))
        # single vanity
        draw.rectangle([760, 430, 1080, 680], fill=(176, 148, 116), outline=(110, 86, 60), width=3)
        draw.ellipse([860, 360, 980, 470], fill=(236, 236, 232), outline=(150, 150, 146), width=4)
        draw.rectangle([800, 200, 1040, 320], fill=(210, 214, 216), outline=(140, 140, 136))
    _label(draw, "Sample — illustrative")
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    pairs = {
        "exterior-before.webp": exterior(False),
        "exterior-after.webp": exterior(True),
        "kitchen-before.webp": kitchen(False),
        "kitchen-after.webp": kitchen(True),
        "bathroom-before.webp": bathroom(False),
        "bathroom-after.webp": bathroom(True),
    }
    for name, image in pairs.items():
        path = OUT / name
        image.save(path, "WEBP", quality=80, method=6)
        print(f"{path.relative_to(ROOT)} {path.stat().st_size}")


if __name__ == "__main__":
    main()
