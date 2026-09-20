#!/usr/bin/env python3
"""Generate The Board of Project Stewardship multi-page static site.

Schema hygiene (fix #28): emit Organization, WebSite, ItemList, FAQPage,
Article, BreadcrumbList, and ImageObject only. Never emit
NewsMediaOrganization, LocalBusiness, parentOrganization, or a WebSite
SearchAction (no on-site search URL — skip fix #21 until search exists).

The Board is an independent publisher of standards and directories — not a GC.
Pacific Pro Group appears only as Board directory #1 outbound, never as owner.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

SITE_DIR = Path(__file__).resolve().parent
WORKSPACE = SITE_DIR.parent
SITE_ORIGIN = "https://boardofprojectstewardship.com"
BASE_URL = SITE_ORIGIN + "/"
LNI_URL = "https://secure.lni.wa.gov/verify/"
YEAR = "2026"
AUTHOR = "Board of Project Stewardship Editorial"
# Prefer a committed on-domain hero (home-*.webp is not gitignored).
OG_DEFAULT_REL = "assets/images/home-hero.webp"
OG_DEFAULT = f"{SITE_ORIGIN}/{OG_DEFAULT_REL}"
OG_IMAGE_ALT = "Board of Project Stewardship"
RSS_HREF = f"{SITE_ORIGIN}/blog/rss.xml"
GITHUB_ORG = "https://github.com/TheBoardofProjectStewardship"
GITHUB_REPO = "https://github.com/TheBoardofProjectStewardship/-The-Board-of-Project-Stewardship"
# Board Organization sameAs: real Board properties only. Never PPG.
BOARD_SAME_AS = [GITHUB_ORG, GITHUB_REPO]
EDITORIAL_EMAIL = "editorial@boardofprojectstewardship.com"
# Alex one-liner: independent publisher of standards/directories — not a newsroom, nonprofit, or GC.
BOARD_ONE_LINER = (
    "The Board of Project Stewardship publishes construction standards and contractor "
    "directories for Edmonds and King & Snohomish Counties. It is not a general contractor, newsroom, or nonprofit."
)

# Directory page -> hero image (relative to site root)
DIR_HERO_IMAGES = {
    "about": ("assets/images/home-hero.webp", "Illustrative Pacific Northwest home exterior — Board editorial for Edmonds remodel stewardship"),
    "additions": ("assets/images/dir-additions-hero.webp", "Home with a clean second-story addition in the Pacific Northwest"),
    "kitchen": ("assets/images/dir-kitchen-hero.webp", "Remodeled Pacific Northwest kitchen with island and garden window"),
    "bathrooms": ("assets/images/dir-bathrooms-hero.webp", "Walk-in shower bathroom remodel with careful waterproofing details"),
    "custom-homes": ("assets/images/dir-custom-homes-hero.webp", "Contemporary custom home exterior in a forested Pacific Northwest setting"),
    "edmonds": ("assets/images/dir-edmonds-custom-hero.webp", "Custom home on a hillside with soft Puget Sound light"),
    "blog": ("assets/images/blog-featured.webp", "Editorial workspace with blueprints suggesting project stewardship guides"),
    "story": ("assets/images/another-story-banner.webp", "Conceptual before-and-after second-story idea for Another Story SEA"),
}

# Category -> optional post hero fallback (directory heroes)
CATEGORY_HERO_FALLBACK = {
    "Bathrooms": "assets/images/dir-bathrooms-hero.webp",
    "Kitchen": "assets/images/dir-kitchen-hero.webp",
    "Additions": "assets/images/dir-additions-hero.webp",
    "Guides": "assets/images/blog-featured.webp",
    "Hiring Guides": "assets/images/blog-featured.webp",
    "Permits": "assets/images/blog-featured.webp",
}

# Optional per-post hero files under assets/images/posts/ (stem match helpers)
POST_HERO_ALIASES = {
    "bathroom-remodel-magnolia-wa": "bath-magnolia-hero.webp",
    "bathroom-remodel-edmonds-wa": "bath-edmonds-hero.webp",
}

PPG = {
    "name": "Pacific Pro Group",
    "url": "https://pacificprogroup.com/",
    "phone": "(206) 446-5656",
    "phone_tel": "+12064465656",
    "city": "Edmonds, WA",
    "license": "PACIFPG765OF",
    "rating": "4.9",
    "reviews": "190",
    "trustindex": "https://www.trustindex.io/reviews/pacificprogroup.com",
    "process_pdf": "https://pacificprogroup.com/wp-content/uploads/2025/12/Pacific-Pro-Group-Process.pdf",
    "note": "Edmonds-based firm specializing in residential home additions and remodels for the North Sound.",
}

TRADES = [
    ("plumber", "Plumber / Plumbing", "fa-faucet", "Licensed plumbers for residential service, remodels, and new work."),
    ("electrician", "Electrician / Electrical", "fa-bolt", "Panel upgrades, rewires, EV chargers, and remodel electrical."),
    ("hvac", "HVAC", "fa-temperature-half", "Heating, cooling, and heat-pump specialists for the North Sound."),
    ("framing", "Framing / Carpentry", "fa-hammer", "Structural framing and carpentry for additions and remodels."),
    ("tile", "Tile", "fa-border-all", "Tile and stone setters for kitchens, baths, and floors."),
    ("siding", "Siding", "fa-house", "Exterior siding, Hardie, and coastal-ready cladding."),
    ("roofing", "Roofing", "fa-house-chimney", "Roof replacement and repair for Edmonds and nearby."),
    ("concrete", "Concrete / Foundation", "fa-cube", "Foundations, slabs, flatwork, and structural concrete."),
    ("drywall", "Drywall", "fa-square", "Hang, tape, and Level 4–5 finish for remodel interiors."),
    ("painting", "Painting", "fa-paint-roller", "Interior and exterior painting with coastal prep know-how."),
    ("flooring", "Flooring", "fa-layer-group", "Hardwood, LVP, laminate, carpet, and refinishing."),
    ("windows", "Windows & Doors", "fa-door-open", "Replacement windows, patio doors, and entry systems."),
    ("insulation", "Insulation", "fa-snowflake", "Attic, crawlspace, spray foam, and air sealing."),
    ("excavation", "Excavation / Site Work", "fa-truck-monster", "Site prep, grading, drainage, and foundation digs."),
]

TRADE_HEADING_MAP = {
    "plumber": "1. Plumber",
    "electrician": "2. Electrician",
    "hvac": "3. HVAC",
    "framing": "4. Framing",
    "tile": "5. Tile",
    "siding": "6. Siding",
    "roofing": "7. Roofing",
    "concrete": "8. Concrete",
    "drywall": "9. Drywall",
    "painting": "10. Painting",
    "flooring": "11. Flooring",
    "windows": "12. Windows",
    "insulation": "13. Insulation",
    "excavation": "14. Excavation",
}


def esc(s: str) -> str:
    return html.escape(s or "", quote=True)


def clamp_title(title: str, limit: int = 60) -> str:
    """Keep titles roughly ≤60 characters; never cut mid-word."""
    title = re.sub(r"\s+", " ", (title or "").strip())
    if len(title) <= limit:
        return title
    cut = title[:limit].rsplit(" ", 1)[0].rstrip(" |-,;:")
    return cut if cut else title[:limit]


def clamp_description(desc: str, limit: int = 160) -> str:
    """Aim ≤160 characters; never truncate mid-word in templates."""
    desc = re.sub(r"\s+", " ", (desc or "").strip())
    if len(desc) <= limit:
        return desc
    cut = desc[:limit].rsplit(" ", 1)[0].rstrip(" .,;:")
    return cut if cut else desc[:limit]


def iso_datetime(date_s: str) -> str:
    """ISO-8601 datetime from YYYY-MM-DD (Pacific calendar date)."""
    date_s = (date_s or "").strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", date_s):
        return f"{date_s}T08:00:00-07:00"
    return date_s


def rss_pubdate(date_s: str) -> str:
    try:
        dt = datetime.strptime(date_s, "%Y-%m-%d")
        return dt.strftime("%a, %d %b %Y 08:00:00 -0700")
    except ValueError:
        return datetime.now().strftime("%a, %d %b %Y 08:00:00 -0700")


def resolve_research_file(name: str) -> Path | None:
    """Research markdown lives beside the site repo in OpenClaw; fall back locally."""
    extra = os.environ.get("BOPS_RESEARCH_DIR", "").strip()
    candidates = [
        SITE_DIR / name,
        WORKSPACE / name,
        Path("/workspace") / name,
        Path(extra) / name if extra else None,
    ]
    for p in candidates:
        if p and p.is_file():
            return p
    return None


def parse_firms_from_html(path: Path, skip_rank_1: bool = False) -> list[dict]:
    """Recover ranked firms from a previously generated directory page."""
    if not path.is_file():
        return []
    text = path.read_text(encoding="utf-8")
    firms: list[dict] = []
    edmonds_blocks = re.findall(
        r'<article class="edmonds-firm[^"]*"([^>]*)>(.*?)</article>',
        text,
        flags=re.S,
    )
    generic_blocks: list[tuple[str, str]] = []
    if edmonds_blocks:
        blocks = edmonds_blocks
    else:
        generic_blocks = re.findall(
            r'(<article class="bg-charcoal border border-white/5[^"]*card-hover">)(.*?)</article>',
            text,
            flags=re.S,
        )
        blocks = [("", body) for _, body in generic_blocks]

    for attrs, block in blocks:
        rank_m = re.search(r'data-rank="(\d+)"', attrs) or re.search(
            r'class="rank-badge[^"]*"[^>]*>(\d+)<', block
        )
        if not rank_m:
            continue
        rank = int(rank_m.group(1))
        if skip_rank_1 and rank == 1:
            continue
        name_m = re.search(
            r'<h3 class="text-lg font-bold text-white tracking-tight">([^<]+)</h3>',
            block,
        )
        if not name_m:
            continue
        name = html.unescape(name_m.group(1)).strip()
        if name == PPG["name"] and skip_rank_1:
            continue
        city = ""
        phone = ""
        specialty = ""
        loc_m = re.search(
            r'fa-map-marker-alt[^>]*>.*?</i>(.*?)</p>',
            block,
            flags=re.S,
        )
        if loc_m:
            loc = re.sub(r"<[^>]+>", "", loc_m.group(1))
            loc = html.unescape(loc).replace("\xa0", " ")
            loc = re.sub(r"\s+", " ", loc).strip()
            if " · " in loc:
                city, specialty = [p.strip() for p in loc.split(" · ", 1)]
            else:
                city = loc
        tel_m = re.search(r">(\([^<]+?\))</a>", block)
        if tel_m:
            phone = html.unescape(tel_m.group(1)).strip()
        note_m = re.search(
            r'<p class="text-sm text-slate-400 font-light leading-relaxed">([^<]*)</p>',
            block,
        )
        note = html.unescape(note_m.group(1)).strip() if note_m else ""
        web_m = re.search(r'<a href="(https?://[^"]+)"[^>]*>Website', block)
        website = web_m.group(1) if web_m else ""
        cat_m = re.search(r'data-category="([^"]+)"', attrs)
        firms.append({
            "rank": rank,
            "name": name,
            "website": website,
            "city": city,
            "phone": phone,
            "note": note,
            "specialty": specialty,
            "category": cat_m.group(1) if cat_m else "",
            "confidence": "",
        })
    firms.sort(key=lambda f: f["rank"])
    return firms


def load_rank_list(
    research_name: str,
    html_name: str,
    parser,
    skip_rank_1: bool = False,
) -> list[dict]:
    path = resolve_research_file(research_name)
    if path:
        parsed = parser(path)
        if parsed:
            return parsed
    recovered = parse_firms_from_html(SITE_DIR / html_name, skip_rank_1=skip_rank_1)
    if recovered:
        print(f"  research fallback: {html_name} ({len(recovered)} firms from existing HTML)")
    return recovered


def strip_md(s: str) -> str:
    s = s or ""
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"\*(.+?)\*", r"\1", s)
    return s


def phone_tel(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    return ""


def split_table_row(line: str) -> list[str]:
    line = line.strip()
    if not line.startswith("|"):
        return []
    parts = [p.strip() for p in line.strip("|").split("|")]
    return parts


def is_separator(cells: list[str]) -> bool:
    if not cells:
        return False
    return all(re.match(r"^:?-+:?$", c.replace(" ", "")) for c in cells if c)


def parse_md_tables(text: str) -> list[dict]:
    """Return list of {headers, rows} for each markdown table."""
    lines = text.splitlines()
    tables: list[dict] = []
    i = 0
    while i < len(lines):
        cells = split_table_row(lines[i])
        if cells and i + 1 < len(lines):
            sep = split_table_row(lines[i + 1])
            if is_separator(sep) and len(sep) == len(cells):
                headers = cells
                rows = []
                j = i + 2
                while j < len(lines):
                    r = split_table_row(lines[j])
                    if not r or len(r) != len(headers):
                        break
                    rows.append(dict(zip(headers, r)))
                    j += 1
                tables.append({"headers": headers, "rows": rows})
                i = j
                continue
        i += 1
    return tables


def section_after_heading(text: str, heading_substr: str) -> str:
    lines = text.splitlines()
    start = None
    for idx, line in enumerate(lines):
        if line.startswith("## ") and heading_substr.lower() in line.lower():
            start = idx + 1
            break
    if start is None:
        return ""
    out = []
    for line in lines[start:]:
        if line.startswith("## "):
            break
        out.append(line)
    return "\n".join(out)


def parse_rank_table(section: str) -> list[dict]:
    tables = parse_md_tables(section)
    if not tables:
        return []
    # Prefer table that has Rank + Name
    for t in tables:
        headers = [h.lower() for h in t["headers"]]
        if "rank" in headers and any("name" in h for h in headers):
            firms = []
            for row in t["rows"]:
                rank_s = row.get("Rank", "").strip()
                if not rank_s.isdigit():
                    continue
                name = row.get("Name", "").strip()
                website = row.get("Website", "").strip()
                city = row.get("City", row.get("City / area", "")).strip()
                phone = row.get("Phone", "").strip()
                note = row.get("1-line note", row.get("Short note", "")).strip()
                conf = row.get("Confidence", "").strip()
                if not name:
                    continue
                # Skip unverifiable placeholders
                if website.lower().startswith("search") or website == "—":
                    website = ""
                # Prefer first bare http(s) URL if research notes append parentheticals
                murl = re.search(r"https?://[^\s)]+", website)
                if murl:
                    website = murl.group(0).rstrip(".,;")
                if phone in ("—", "-", "(see site)", "(see site; often 360 area)"):
                    phone = ""
                if phone.lower().startswith("(see") or phone.startswith("—") or phone.startswith("-"):
                    phone = ""
                # Drop non-dialable research notes (web form / community sales via site / emails)
                digits = re.sub(r"\D", "", phone)
                if phone and len(digits) < 10:
                    phone = ""
                if phone and any(tok in phone.lower() for tok in ("web form", "via site", "via lennar", "via drhorton", "concierge@", "@")):
                    phone = ""
                firms.append({
                    "rank": int(rank_s),
                    "name": re.sub(r"\s+", " ", name),
                    "website": website,
                    "city": city,
                    "phone": phone,
                    "note": note,
                    "confidence": conf,
                })
            return firms
    return []


def parse_additions_top30(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    firms = []
    blocks = re.split(r"\n###\s+", text)
    for block in blocks[1:]:
        m = re.match(r"(\d+)\.\s+(.+?)\s+—\s+\*\*(\w+)\*\*", block)
        if not m:
            continue
        rank = int(m.group(1))
        name = m.group(2).strip()
        conf = m.group(3).strip()
        city = ""
        website = ""
        phone = ""
        note = ""
        for line in block.splitlines():
            if "**City/HQ:**" in line:
                city = line.split("**City/HQ:**", 1)[1].strip()
            elif "**Website:**" in line:
                website = line.split("**Website:**", 1)[1].strip()
            elif "**Phone:**" in line:
                phone = line.split("**Phone:**", 1)[1].strip()
                # Take first phone if multiple notes
                phone = re.split(r"\s+\(|;|—", phone)[0].strip()
                if not re.search(r"\d", phone):
                    phone = ""
            elif "**Why they belong:**" in line:
                note = line.split("**Why they belong:**", 1)[1].strip()
        firms.append({
            "rank": rank,
            "name": name,
            "website": website,
            "city": city,
            "phone": phone,
            "note": note,
            "confidence": conf,
        })
    firms.sort(key=lambda f: f["rank"])
    return firms


def parse_kitchen_bath(path: Path) -> tuple[list[dict], list[dict]]:
    text = path.read_text(encoding="utf-8")
    kitchen = parse_rank_table(section_after_heading(text, "Kitchen remodel"))
    bath = parse_rank_table(section_after_heading(text, "Bathroom remodel"))
    return kitchen, bath


def parse_custom_commercial_spec(path: Path) -> tuple[list[dict], list[dict], list[dict]]:
    """Parse custom homes (ranks 2–15), commercial (1–15), and spec homes (1–14)."""
    text = path.read_text(encoding="utf-8")
    custom = parse_rank_table(section_after_heading(text, "Custom Homes"))
    commercial = parse_rank_table(section_after_heading(text, "Commercial — ranks"))
    # Fallback if em-dash / hyphen variants differ
    if not commercial:
        commercial = parse_rank_table(section_after_heading(text, "Commercial"))
    spec = parse_rank_table(section_after_heading(text, "Spec Homes — ranks"))
    if not spec:
        spec = parse_rank_table(section_after_heading(text, "Spec Homes"))
    return custom, commercial, spec



def parse_edmonds_custom(path: Path) -> list[dict]:
    """Parse Edmonds custom homes Top 30 research (includes PPG at rank 1)."""
    text = path.read_text(encoding="utf-8")
    tables = parse_md_tables(text)
    firms: list[dict] = []
    for t in tables:
        headers = [h.lower() for h in t["headers"]]
        if "rank" not in headers or not any("name" in h for h in headers):
            continue
        for row in t["rows"]:
            rank_s = row.get("Rank", "").strip()
            if not rank_s.isdigit():
                continue
            name = row.get("Name", "").strip()
            if not name:
                continue
            website = row.get("Website", "").strip()
            if website in ("—", "-", "") or website.lower().startswith("search"):
                website = ""
            murl = re.search(r"https?://[^\s)]+", website)
            if murl:
                website = murl.group(0).rstrip(".,;")
            category = (row.get("Category", "") or "traditional").strip().lower()
            specialty = row.get("Specialty", "").strip()
            city = row.get("City", "Edmonds").strip() or "Edmonds"
            note = row.get("Notes", row.get("1-line note", "")).strip()
            firms.append({
                "rank": int(rank_s),
                "name": re.sub(r"\s+", " ", name),
                "website": website,
                "city": city if "," in city or city.endswith(" WA") else f"{city}, WA",
                "phone": "",
                "note": note or specialty,
                "category": category,
                "specialty": specialty,
            })
        if firms:
            break
    firms.sort(key=lambda f: f["rank"])
    return firms


def parse_trades(path: Path) -> dict[str, list[dict]]:
    text = path.read_text(encoding="utf-8")
    out: dict[str, list[dict]] = {}
    for slug, prefix in TRADE_HEADING_MAP.items():
        section = section_after_heading(text, prefix)
        firms = parse_rank_table(section)
        # Keep only firms with a name and (website or phone) or HIGH confidence with city
        cleaned = []
        for f in firms:
            if f["rank"] > 8 and (not f["website"] or f["confidence"].startswith("LOW")):
                # drop thin LOW fill-ins without websites for public pages
                if not f["website"]:
                    continue
            if not f["website"] and not f["phone"]:
                continue
            cleaned.append(f)
        out[slug] = cleaned
    return out


# ---------- HTML helpers ----------

def asset_exists(rel: str) -> bool:
    return (SITE_DIR / rel).is_file()


def load_cdn_map() -> dict[str, str]:
    p = SITE_DIR / "assets" / "CDN-MAP.json"
    if not p.is_file():
        return {}
    try:
        import json as _json
        data = _json.loads(p.read_text(encoding="utf-8"))
        return {str(k).lstrip("./"): str(v) for k, v in data.items() if isinstance(v, str)}
    except Exception:
        return {}


CDN_MAP = load_cdn_map()


def abs_asset_url(rel: str) -> str:
    rel = (rel or "").lstrip("./")
    if rel in CDN_MAP:
        return CDN_MAP[rel]
    return f"{SITE_ORIGIN}/{rel}"


def resolve_og_image(rel: str | None = None) -> str:
    """On-domain WebP only. Never emit CloudFront PNGs as og:image."""
    candidates = []
    if rel:
        candidates.append(rel.lstrip("./"))
    candidates.append(OG_DEFAULT_REL)
    candidates.append("assets/images/home-hero.webp")
    for cand in candidates:
        if not cand:
            continue
        if asset_exists(cand) and cand.lower().endswith((".webp", ".jpg", ".jpeg")):
            return f"{SITE_ORIGIN}/{cand}"
    return OG_DEFAULT


def prefix_asset(rel: str, prefix: str = "") -> str:
    """Prefer a committed on-domain file; CDN only when the local asset is absent."""
    rel = (rel or "").lstrip("./")
    if asset_exists(rel):
        if prefix:
            return f"{prefix}{rel}"
        return f"./{rel}"
    if rel in CDN_MAP:
        return CDN_MAP[rel]
    if prefix:
        return f"{prefix}{rel}"
    return f"./{rel}"


def resolve_post_hero(post: dict) -> str | None:
    """Optional post hero under assets/images/posts/, else category fallback, else None."""
    posts_dir = SITE_DIR / "assets" / "images" / "posts"
    slug = post.get("slug", "")
    candidates = []
    alias = POST_HERO_ALIASES.get(slug)
    if alias:
        candidates.append(alias)
    candidates.append(f"{slug}-hero.webp")
    for name in candidates:
        p = posts_dir / name
        if p.is_file():
            return f"assets/images/posts/{name}"
    cat = post.get("category", "")
    fb = CATEGORY_HERO_FALLBACK.get(cat)
    if fb and asset_exists(fb):
        return fb
    return None


def _png_rgba(width: int, height: int, pixels: bytes) -> bytes:
    """Minimal PNG writer (RGBA). pixels is width*height*4 bytes."""
    import struct
    import zlib

    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        raw.extend(pixels[y * stride : (y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


def _board_icon_pixels(size: int) -> bytes:
    """Raster of the Board compass mark (matches favicon.svg colors)."""
    out = bytearray(size * size * 4)
    cx = cy = (size - 1) / 2.0
    r_outer = size * 0.32
    r_inner = size * 0.26
    r_dot = max(1.2, size * 0.07)
    corner = size * 0.18
    for y in range(size):
        for x in range(size):
            i = (y * size + x) * 4
            # rounded-rect coverage
            dx = min(x, size - 1 - x)
            dy = min(y, size - 1 - y)
            inside = True
            if dx < corner and dy < corner:
                inside = (corner - dx) ** 2 + (corner - dy) ** 2 <= corner ** 2
            if not inside:
                out[i : i + 4] = b"\x00\x00\x00\x00"
                continue
            out[i : i + 4] = b"\x0a\x0a\x0a\xff"
            rx, ry = x - cx, y - cy
            dist = (rx * rx + ry * ry) ** 0.5
            if abs(dist - (r_outer + r_inner) / 2) <= (r_outer - r_inner) / 2 + 0.6:
                out[i : i + 4] = b"\x4a\xde\x80\xff"
            if dist <= r_dot:
                out[i : i + 4] = b"\x4a\xde\x80\xff"
    return bytes(out)


def _ico_from_png(png: bytes, size: int = 32) -> bytes:
    import struct

    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack(
        "<BBBBHHII",
        size if size < 256 else 0,
        size if size < 256 else 0,
        0,
        0,
        1,
        32,
        len(png),
        22,
    )
    return header + entry + png


def write_board_icons() -> None:
    """Write favicon.ico + apple-touch-icon.png so they deploy (not 404)."""
    icon_dir = SITE_DIR / "assets" / "icons"
    icon_dir.mkdir(parents=True, exist_ok=True)
    png32 = _png_rgba(32, 32, _board_icon_pixels(32))
    png180 = _png_rgba(180, 180, _board_icon_pixels(180))
    (icon_dir / "apple-touch-icon.png").write_bytes(png180)
    (icon_dir / "favicon.ico").write_bytes(_ico_from_png(png32, 32))


def favicon_tags(prefix: str = "") -> str:
    # Only reference icons that exist so live URLs 200. prefix unused (absolute).
    _ = prefix
    tags = []
    if asset_exists("assets/icons/favicon.svg"):
        tags.append(f'  <link rel="icon" href="{SITE_ORIGIN}/assets/icons/favicon.svg" type="image/svg+xml">')
    if asset_exists("assets/icons/favicon.ico"):
        tags.append(f'  <link rel="icon" href="{SITE_ORIGIN}/assets/icons/favicon.ico" sizes="any">')
    if asset_exists("assets/icons/apple-touch-icon.png"):
        tags.append(f'  <link rel="apple-touch-icon" href="{SITE_ORIGIN}/assets/icons/apple-touch-icon.png">')
    return "\n".join(tags)


def head_assets() -> str:
    # Font Awesome is deferred to </body> (fix #40). Tailwind CDN remains known debt.
    return """  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            obsidian: '#0a0a0a',
            charcoal: '#1a1a1a',
            'dark-gray': '#2a2a2a',
            primary: '#166534',
            secondary: '#4ade80',
          },
          boxShadow: {
            'glow-sleek': '0 0 15px -5px rgba(22, 101, 52, 0.3)',
          }
        }
      }
    }
  </script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; background-color: #0a0a0a; color: #e0e0e0; }
    .bg-grid-pattern {
      background-image:
        linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 40px 40px;
    }
    .card-hover { transition: transform 0.25s ease, border-color 0.25s ease; }
    .card-hover:hover { transform: translateY(-3px); }
    .rank-badge {
      min-width: 2.75rem; height: 2.75rem;
      display: flex; align-items: center; justify-content: center;
      border-radius: 0.5rem; font-weight: 800; font-size: 0.95rem;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8;
    }
    .prose-bops a { color: #4ade80; text-decoration: underline; }
    .prose-bops h2 { font-size: 1.5rem; font-weight: 800; color: white; margin: 1.75rem 0 0.75rem; }
    .prose-bops h3 { font-size: 1.15rem; font-weight: 700; color: white; margin: 1.25rem 0 0.5rem; }
    .prose-bops p, .prose-bops li { color: #cbd5e1; font-weight: 300; line-height: 1.7; margin-bottom: 0.85rem; }
    .prose-bops ul { list-style: disc; padding-left: 1.25rem; margin-bottom: 1rem; }
    .prose-bops ol { list-style: decimal; padding-left: 1.25rem; margin-bottom: 1rem; }
    .prose-bops strong { color: #fff; font-weight: 600; }
    .prose-bops .post-figure {
      margin: 1.5rem 0;
      border-radius: 0.75rem;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.02);
    }
    .prose-bops .post-figure img {
      display: block;
      width: 100%;
      height: auto;
      max-height: 32rem;
      object-fit: cover;
    }
    .prose-bops .post-figure figcaption {
      padding: 0.65rem 0.9rem;
      font-size: 0.85rem;
      color: #94a3b8;
      font-weight: 300;
      line-height: 1.4;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .prose-bops .video-embed {
      position: relative;
      width: 100%;
      padding-bottom: 56.25%; /* 16:9 */
      height: 0;
      margin: 1.5rem 0;
      border-radius: 0.75rem;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.08);
      background: #000;
    }
    .prose-bops .video-embed iframe {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      border: 0;
    }
    #tools input, #tools select, #tools textarea {
      color-scheme: dark;
    }
    #tools input::placeholder, #tools textarea::placeholder { color: #64748b; }
    #calc-result { letter-spacing: -0.02em; }
    .skip-link {
      position: absolute;
      left: 0.75rem;
      top: -3.25rem;
      z-index: 80;
      background: #166534;
      color: #fff;
      padding: 0.55rem 0.9rem;
      border-radius: 0.375rem;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-decoration: none;
    }
    .skip-link:focus {
      top: 0.75rem;
      outline: 2px solid #4ade80;
      outline-offset: 2px;
    }
    #more-dropdown, #mobile-nav { display: none; }
    #more-dropdown.is-open { display: block; }
    #mobile-nav.is-open { display: block; }
    @media (min-width: 768px) {
      #mobile-nav.is-open { display: none !important; }
    }
    .nav-burger {
      width: 1.35rem; height: 1.05rem;
      display: flex; flex-direction: column; justify-content: space-between;
    }
    .nav-burger span { display: block; height: 2px; background: #e2e8f0; border-radius: 1px; }
    body.nav-open { overflow: hidden; }
  </style>"""


def _nav_link(href: str, label: str, key: str, active: str, extra_cls: str = "") -> str:
    is_current = key == active
    cls = "text-secondary" if is_current else "text-slate-300 hover:text-secondary"
    current = ' aria-current="page"' if is_current else ""
    return (
        f'<a href="{href}" class="{cls} font-medium text-xs uppercase tracking-widest '
        f'transition {extra_cls}"{current}>{esc(label)}</a>'
    )


def nav_html(active: str = "", prefix: str = "") -> str:
    # Board brand only. Full set via primary + More + hamburger.
    # PPG is never chrome/brand — Board #1 outbound lives in body/feature cards.
    def href(name: str) -> str:
        if prefix:
            return f"{prefix}{name}"
        return f"./{name}"

    primary = [
        ("about", href("index.html"), "About"),
        ("additions", href("additions.html"), "Additions"),
        ("custom-homes", href("custom-homes.html"), "Custom Homes"),
        ("edmonds", href("edmonds-custom-homes.html"), "Edmonds"),
        ("kitchen", href("kitchen.html"), "Kitchen"),
        ("bathrooms", href("bathrooms.html"), "Bathrooms"),
        ("blog", href("blog.html"), "Blog"),
    ]
    more_dirs = [
        ("commercial", href("commercial.html"), "Commercial"),
        ("spec-homes", href("spec-homes.html"), "Spec"),
        ("trades", href("trades.html"), "Trades"),
    ]
    more_tools = [
        ("steward", href("good-steward.html"), "Good Steward"),
        ("site-visit", href("site-visit.html"), "Site Visit Checklist"),
        ("pm-dashboard", href("pm-dashboard.html"), "PM Dashboard"),
        ("story", href("another-story.html"), "Another Story"),
    ]
    more = more_dirs + more_tools
    more_keys = {k for k, _, _ in more}
    more_open = active in more_keys
    primary_html = "".join(_nav_link(h, label, key, active) for key, h, label in primary)

    def _more_link(key: str, h: str, label: str) -> str:
        current = key == active
        return (
            f'<a href="{h}" class="block px-4 py-2 text-xs uppercase tracking-widest '
            f'{"text-secondary" if current else "text-slate-300 hover:text-secondary hover:bg-white/5"}" '
            f'{"aria-current=\"page\"" if current else ""} role="menuitem">{esc(label)}</a>'
        )

    more_items = (
        '<p class="px-4 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Directories</p>'
        + "".join(_more_link(k, h, lab) for k, h, lab in more_dirs)
        + '<p class="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Tools</p>'
        + "".join(_more_link(k, h, lab) for k, h, lab in more_tools)
    )
    mobile_html = (
        "".join(_nav_link(h, label, key, active, extra_cls="block py-2") for key, h, label in primary)
        + '<p class="pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Directories</p>'
        + "".join(_nav_link(h, label, key, active, extra_cls="block py-2") for key, h, label in more_dirs)
        + '<p class="pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Tools</p>'
        + "".join(_nav_link(h, label, key, active, extra_cls="block py-2") for key, h, label in more_tools)
    )
    home_href = href("index.html")
    more_btn_cls = "text-secondary" if more_open else "text-slate-300 hover:text-secondary"
    return f"""  <a href="#main-content" class="skip-link">Skip to content</a>
  <header class="bg-charcoal/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16 items-center gap-3">
        <a href="{home_href}" class="flex items-center gap-2 no-underline min-w-0">
          <i class="fas fa-compass-drafting text-secondary text-xl shrink-0" aria-hidden="true"></i>
          <span class="hidden md:inline font-black text-sm lg:text-base tracking-wider text-white">Board of Project Stewardship</span>
          <span class="md:hidden font-black text-base tracking-wider text-white">Board</span>
        </a>
        <nav class="hidden md:flex items-center gap-4 lg:gap-5" aria-label="Primary">
          {primary_html}
          <div class="relative">
            <button type="button" id="more-toggle" class="{more_btn_cls} font-medium text-xs uppercase tracking-widest transition inline-flex items-center gap-1" aria-expanded="false" aria-controls="more-dropdown" aria-haspopup="true">
              More <span aria-hidden="true">▾</span>
            </button>
            <div id="more-dropdown" class="absolute right-0 mt-2 w-56 rounded-lg border border-white/10 bg-charcoal shadow-xl py-2 z-50" role="menu">
              {more_items}
            </div>
          </div>
        </nav>
        <button type="button" id="nav-toggle" class="md:hidden p-2 -mr-1 text-slate-200" aria-expanded="false" aria-controls="mobile-nav" aria-label="Open menu">
          <span class="nav-burger" aria-hidden="true"><span></span><span></span><span></span></span>
        </button>
      </div>
    </div>
    <nav id="mobile-nav" class="md:hidden border-t border-white/10 bg-charcoal/95 px-4 pb-4" aria-label="Mobile">
      {mobile_html}
    </nav>
  </header>"""


def footer_html(prefix: str = "./", active: str = "") -> str:
    explore = [
        ("about", f"{prefix}index.html", "About"),
        ("additions", f"{prefix}additions.html", "Additions Top 30"),
        ("custom-homes", f"{prefix}custom-homes.html", "Custom homes"),
        ("edmonds", f"{prefix}edmonds-custom-homes.html", "Edmonds custom homes"),
        ("kitchen", f"{prefix}kitchen.html", "Kitchen remodelers"),
        ("bathrooms", f"{prefix}bathrooms.html", "Bathroom remodelers"),
        ("commercial", f"{prefix}commercial.html", "Commercial GCs"),
        ("spec-homes", f"{prefix}spec-homes.html", "Spec homes"),
        ("trades", f"{prefix}trades.html", "Trade contractors"),
        ("blog", f"{prefix}blog.html", "Blog"),
        ("steward", f"{prefix}good-steward.html", "Good Steward"),
        ("site-visit", f"{prefix}site-visit.html", "Site Visit Checklist"),
        ("pm-dashboard", f"{prefix}pm-dashboard.html", "PM Dashboard"),
        ("story", f"{prefix}another-story.html", "Another Story"),
    ]
    items = []
    for key, href, label in explore:
        current = ' aria-current="page"' if key == active else ""
        items.append(
            f'<li><a href="{href}" class="hover:text-secondary transition"{current}>{esc(label)}</a></li>'
        )
    return f"""  <footer class="bg-obsidian py-14 text-sm border-t border-white/5">
    <div class="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-10 text-slate-400">
      <div>
        <div class="flex items-center mb-4 gap-2">
          <i class="fas fa-compass-drafting text-secondary"></i>
          <span class="font-black text-base tracking-wider text-white">Board of Project Stewardship</span>
        </div>
        <p class="font-light leading-relaxed text-sm">{esc(BOARD_ONE_LINER)} Updated {YEAR}.</p>
        <p class="mt-3 font-light leading-relaxed text-sm">Public contact: <a href="mailto:{EDITORIAL_EMAIL}" class="text-secondary hover:underline">{EDITORIAL_EMAIL}</a></p>
        <p class="mt-3 font-light leading-relaxed text-sm">Board feature: <a href="{prefix}another-story.html" class="text-secondary hover:underline">Another Story</a> — second-story concept studio.</p>
      </div>
      <div>
        <h4 class="text-white font-bold text-xs uppercase tracking-widest mb-4">Explore</h4>
        <ul class="space-y-2 font-light text-sm">
          {''.join(items)}
        </ul>
      </div>
      <div>
        <h4 class="text-white font-bold text-xs uppercase tracking-widest mb-4">Disclaimer</h4>
        <p class="mb-3 font-light leading-relaxed text-sm">Listing is not an endorsement of quality. Verify licenses, insurance, bonds, and references before hiring. Membership in trade associations does not guarantee outcomes. Re-check status at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a>.</p>
        <p class="text-xs text-slate-600">&copy; {YEAR} Board of Project Stewardship · {EDITORIAL_EMAIL}</p>
      </div>
    </div>
  </footer>"""


def tools_href(slug: str, prefix: str = "", filename: str = "") -> str:
    """Iframe/app src under ./tools/… (or ../tools/… from posts). Never mix /tools/."""
    base = prefix if prefix else "./"
    if filename:
        return f"{base}tools/{slug}/{filename}"
    return f"{base}tools/{slug}/"


def public_tool_href(slug: str, prefix: str = "") -> str:
    """Board-branded public landing. slugs: site-visit, pm-dashboard, another-story, good-steward."""
    names = {
        "site-visit": "site-visit.html",
        "pm-dashboard": "pm-dashboard.html",
        "another-story": "another-story.html",
        "good-steward": "good-steward.html",
        "story": "another-story.html",
        "steward": "good-steward.html",
    }
    name = names.get(slug, f"{slug}.html")
    return f"{prefix}{name}" if prefix else f"./{name}"


def contact_strip_html() -> str:
    return f"""  <aside id="contact" class="border-t border-white/5 bg-charcoal/50">
    <div class="max-w-6xl mx-auto px-4 py-4 text-sm text-slate-400 font-light">
      Public contact: <a href="mailto:{EDITORIAL_EMAIL}" class="text-secondary hover:underline">{EDITORIAL_EMAIL}</a>
    </div>
  </aside>
"""


def another_story_embed(prefix: str = "") -> str:
    """Full Another Story SEA tool iframe on every page."""
    banner = ""
    if asset_exists("assets/images/another-story-banner.webp"):
        banner = (
            '    <div class="mb-6 overflow-hidden rounded-xl border border-white/10">\n'
            f'      <img src="{prefix_asset("assets/images/another-story-banner.webp", prefix)}" '
            'alt="Conceptual before-and-after second-story idea for Another Story SEA" '
            'class="w-full h-48 sm:h-64 object-cover" width="1200" height="630" loading="eager">\n'
            '    </div>\n'
        )
    return (
        '  <section id="another-story-sea-embed" class="max-w-6xl mx-auto px-4 py-12 relative z-20 border-t border-white/5">\n'
        + banner
        + '    <div class="mb-5">\n'
        + '      <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">Board feature</p>\n'
        + '      <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">Another Story</h2>\n'
        + '      <p class="text-sm text-slate-400 font-light max-w-3xl leading-relaxed mb-3">'
        'Explore a second-story concept on your own photo. Upload a house picture, adjust the massing idea, and review a preview — AI-assisted design only. Not a bid, permit, structural calculation, or construction document.</p>\n'
        + '      <p class="text-sm text-slate-400 font-light max-w-3xl leading-relaxed">'
        'This is a Board feature. Open the standalone tool at '
        f'<a href="{tools_href("another-story", prefix, "index.html")}" class="text-secondary hover:underline">{SITE_ORIGIN}/tools/another-story/</a>'
        ' or <a href="https://anotherstorysea.com/" target="_blank" rel="noopener" class="text-secondary hover:underline">anotherstorysea.com</a>.</p>\n'
        + '    </div>\n'
        + '    <iframe\n'
        + '      id="another-story-sea"\n'
        + f'      src="{tools_href("another-story", prefix, "index.html")}"\n'
        + '      title="Another Story SEA — second-story design preview"\n'
        + '      loading="lazy"\n'
        + '      style="display:block;width:100%;height:1900px;border:0;border-radius:18px;background:#fff9f2;"\n'
        + '    ></iframe>\n'
        + """    <script>
    (() => {
      const frame = document.getElementById('another-story-sea');
      if (!frame) return;
      const trustedOrigin = new URL(frame.src, window.location.href).origin;
      window.addEventListener('message', (event) => {
        if (event.origin !== trustedOrigin || event.source !== frame.contentWindow) return;
        if (event.data?.type !== 'another-story:resize') return;
        const height = Number(event.data.height);
        if (Number.isFinite(height) && height >= 300 && height <= 16000) {
          frame.style.height = `${Math.ceil(height) + 2}px`;
        }
      });
    })();
    </script>
  </section>
"""
    )


def steward_cta_strip(prefix: str = "") -> str:
    """Compact Good Steward links — not the twin 1400px iframes."""
    open_steward = public_tool_href("good-steward", prefix)
    site_visit_href = public_tool_href("site-visit", prefix)
    pm_href = public_tool_href("pm-dashboard", prefix)
    return f"""  <aside id="good-steward-cta" class="max-w-6xl mx-auto px-4 py-8 relative z-20 border-t border-white/5">
    <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">Good Steward Tools</p>
    <h2 class="text-xl font-black text-white tracking-tight mb-2">Site visit and PM checklists</h2>
    <p class="text-sm text-slate-400 font-light leading-relaxed max-w-3xl mb-4">Educational Board templates for Edmonds / coastal Puget Sound. Data stays in your browser — not a bid, permit, or schedule.</p>
    <div class="flex flex-wrap gap-3">
      <a href="{open_steward}" class="bg-primary text-white px-5 py-3 rounded font-bold hover:bg-emerald-700 transition uppercase tracking-wider text-xs">Good Steward guide</a>
      <a href="{site_visit_href}" class="border border-white/20 bg-white/5 text-white px-5 py-3 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-xs">Site Visit Checklist</a>
      <a href="{pm_href}" class="border border-white/20 bg-white/5 text-white px-5 py-3 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-xs">PM Dashboard</a>
    </div>
  </aside>
"""


def another_story_cta(prefix: str = "") -> str:
    """Compact CTA card linking to another-story.html — used on all pages except the tool host."""
    href = f"{prefix}another-story.html" if prefix else "./another-story.html"
    img = ""
    if asset_exists("assets/images/another-story-banner.webp"):
        src_img = prefix_asset("assets/images/another-story-banner.webp", prefix)
        img = (
            '      <div class="md:w-2/5 shrink-0">\n'
            f'        <img src="{src_img}" alt="Conceptual before-and-after second-story idea for Another Story SEA" '
            'class="w-full h-40 md:h-full object-cover" width="640" height="360" loading="lazy">\n'
            '      </div>\n'
        )
    return f"""  <section id="another-story-cta" class="max-w-6xl mx-auto px-4 py-10 relative z-20 border-t border-white/5">
    <div class="bg-charcoal border border-secondary/25 rounded-xl overflow-hidden flex flex-col md:flex-row card-hover">
{img}      <div class="p-6 md:p-8 flex flex-col justify-center gap-3">
        <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary">Board feature</p>
        <h2 class="text-2xl font-black text-white tracking-tight">Another Story</h2>
        <p class="text-sm text-slate-400 font-light leading-relaxed max-w-xl">Same home. Another story. Open the full concept studio to explore a second-story idea on your photo — AI-assisted preview, not a bid or permit document.</p>
        <div>
          <a href="{href}" class="inline-flex items-center gap-2 bg-primary text-white px-5 py-3 rounded font-bold hover:bg-emerald-700 transition uppercase tracking-wider text-xs shadow-glow-sleek">
            Open Another Story <i class="fas fa-arrow-right text-[10px]"></i>
          </a>
        </div>
      </div>
    </div>
  </section>
"""




def steward_tools_embed(prefix: str = "") -> str:
    """Good Steward Tools — Site Visit Checklist + PM Dashboard cards and iframes."""
    open_steward = public_tool_href("good-steward", prefix)
    site_visit_href = public_tool_href("site-visit", prefix)
    pm_href = public_tool_href("pm-dashboard", prefix)
    site_visit_src = tools_href("site-visit", prefix, "index.html")
    pm_src = tools_href("pm-dashboard", prefix, "index.html")
    return (
        '  <section id="good-steward-tools-embed" class="max-w-6xl mx-auto px-4 py-12 relative z-20 border-t border-white/5">\n'
        '    <div class="mb-8">\n'
        '      <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">Good Steward Tools</p>\n'
        '      <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">Good Steward Tools</h2>\n'
        '      <p class="text-sm text-slate-400 font-light max-w-3xl leading-relaxed mb-2">'
        'Practical checklists for homeowners and builders working on additions and remodels in Edmonds and the coastal Puget Sound. '
        'Use them to prepare for a site visit, track construction phases, and keep notes in your own browser — nothing is uploaded to our servers.</p>\n'
        '      <p class="text-sm text-slate-400 font-light max-w-3xl leading-relaxed">'
        'Educational templates published by the Board. Pacific Pro Group appears in directories as '
        '<a href="https://pacificprogroup.com/" target="_blank" rel="noopener" class="text-secondary hover:underline">Pacific Pro Group</a>'
        ' (Board #1 design-build). Not bids, permits, contracts, or schedules — verify '
        f'<a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I</a> before hiring. '
        f'<a href="{open_steward}" class="text-secondary hover:underline">What a good steward does</a>.</p>\n'
        '    </div>\n'
        '    <div class="grid md:grid-cols-2 gap-4 mb-8">\n'
        f'      <a href="{site_visit_href}" class="block bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 card-hover no-underline">\n'
        '        <p class="text-[11px] font-bold uppercase tracking-widest text-secondary mb-2">Checklist</p>\n'
        '        <h3 class="text-lg font-black text-white mb-2">Site Visit &amp; Discovery</h3>\n'
        '        <p class="text-sm text-slate-400 font-light leading-relaxed">Phase-by-phase discovery notes, sketch pad, and proposal-readiness checklist. Data stays in your browser.</p>\n'
        '      </a>\n'
        f'      <a href="{pm_href}" class="block bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 card-hover no-underline">\n'
        '        <p class="text-[11px] font-bold uppercase tracking-widest text-secondary mb-2">Dashboard</p>\n'
        '        <h3 class="text-lg font-black text-white mb-2">PM Execution Dashboard</h3>\n'
        '        <p class="text-sm text-slate-400 font-light leading-relaxed">Build-phase status, punch tracking, and export helpers for steward continuity. Local-only — not a schedule commitment.</p>\n'
        '      </a>\n'
        '    </div>\n'
        '    <div class="space-y-10">\n'
        '      <div>\n'
        '        <h3 class="text-sm font-bold uppercase tracking-widest text-slate-300 mb-3">Site Visit &amp; Discovery</h3>\n'
        '        <iframe\n'
        '          id="steward-site-visit"\n'
        f'          src="{site_visit_src}"\n'
        '          title="Site Visit and Discovery Checklist — Good Steward Tools"\n'
        '          loading="lazy"\n'
        '          style="display:block;width:100%;height:1400px;border:0;border-radius:18px;background:#f8fafc;"\n'
        '        ></iframe>\n'
        '      </div>\n'
        '      <div>\n'
        '        <h3 class="text-sm font-bold uppercase tracking-widest text-slate-300 mb-3">PM Execution Dashboard</h3>\n'
        '        <iframe\n'
        '          id="steward-pm-dashboard"\n'
        f'          src="{pm_src}"\n'
        '          title="PM Execution Dashboard — Good Steward Tools"\n'
        '          loading="lazy"\n'
        '          style="display:block;width:100%;height:1400px;border:0;border-radius:18px;background:#f1f5f9;"\n'
        '        ></iframe>\n'
        '      </div>\n'
        '    </div>\n'
        '  </section>\n'
    )



def board_organization_website_ld() -> dict:
    """Board Organization + WebSite JSON-LD (Packet 03). Not LocalBusiness/GC."""
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": "https://boardofprojectstewardship.com/#organization",
                "name": "Board of Project Stewardship",
                "alternateName": "Board of Project Stewardship",
                "url": "https://boardofprojectstewardship.com/",
                "description": BOARD_ONE_LINER,
                "areaServed": [
                    {
                        "@type": "AdministrativeArea",
                        "name": "King County",
                        "containedInPlace": {"@type": "State", "name": "Washington"},
                    },
                    {
                        "@type": "AdministrativeArea",
                        "name": "Snohomish County",
                        "containedInPlace": {"@type": "State", "name": "Washington"},
                    },
                    {
                        "@type": "City",
                        "name": "Edmonds",
                        "containedInPlace": {"@type": "State", "name": "Washington"},
                    },
                ],
                "email": EDITORIAL_EMAIL,
                "sameAs": list(BOARD_SAME_AS),
                # Independent Board: never parentOrganization, isRelatedTo-as-owner, or PPG in sameAs.
            },
            {
                "@type": "WebSite",
                "@id": "https://boardofprojectstewardship.com/#website",
                "url": "https://boardofprojectstewardship.com/",
                "name": "Board of Project Stewardship",
                "publisher": {"@id": "https://boardofprojectstewardship.com/#organization"},
                "inLanguage": "en-US",
                # No potentialAction SearchAction until real on-site search exists (fix #21 omitted).
            },
        ],
    }


def ensure_indexnow_key() -> str:
    """Preserve/mint IndexNow key across generate_site regenerations."""
    well_known = SITE_DIR / ".well-known"
    well_known.mkdir(parents=True, exist_ok=True)
    key_store = well_known / "indexnow-key.txt"
    key = ""
    if key_store.exists():
        key = key_store.read_text(encoding="utf-8").strip()
    if not key or not all(c in "0123456789abcdef" for c in key.lower()) or len(key) < 32:
        import secrets
        key = secrets.token_hex(16)
        key_store.write_text(key, encoding="utf-8")
    # Remove any prior IndexNow key *.txt at site root (32 hex only) except current
    for p in SITE_DIR.glob("*.txt"):
        if p.name == "robots.txt":
            continue
        stem = p.stem
        if len(stem) >= 32 and all(c in "0123456789abcdef" for c in stem.lower()):
            if stem.lower() != key.lower():
                p.unlink()
    key_file = SITE_DIR / f"{key}.txt"
    key_file.write_text(key, encoding="utf-8")
    return key



def breadcrumb_ld(crumbs: list[tuple[str, str]], page_url: str = "") -> dict:
    """BreadcrumbList with absolute https item URLs (fix #22)."""
    elements = []
    for i, (name, url) in enumerate(crumbs, 1):
        item_url = url
        if item_url and not item_url.startswith("http"):
            item_url = SITE_ORIGIN + "/" + item_url.lstrip("./")
        entry: dict = {
            "@type": "ListItem",
            "position": i,
            "name": name,
        }
        if item_url:
            entry["item"] = item_url
        elements.append(entry)
    payload: dict = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": elements,
    }
    if page_url:
        payload["@id"] = page_url.split("#")[0] + "#breadcrumb"
    return payload


def chrome_script() -> str:
    return """  <script>
  (function () {
    var moreBtn = document.getElementById('more-toggle');
    var morePanel = document.getElementById('more-dropdown');
    var burger = document.getElementById('nav-toggle');
    var drawer = document.getElementById('mobile-nav');
    function setOpen(btn, panel, open) {
      if (!btn || !panel) return;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) panel.classList.add('is-open');
      else panel.classList.remove('is-open');
    }
    if (moreBtn && morePanel) {
      moreBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        setOpen(moreBtn, morePanel, moreBtn.getAttribute('aria-expanded') !== 'true');
      });
    }
    if (burger && drawer) {
      burger.addEventListener('click', function () {
        var open = burger.getAttribute('aria-expanded') !== 'true';
        setOpen(burger, drawer, open);
        document.body.classList.toggle('nav-open', open);
        burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        if (open) {
          var first = drawer.querySelector('a');
          if (first) first.focus();
        }
      });
      drawer.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () {
          setOpen(burger, drawer, false);
          document.body.classList.remove('nav-open');
          burger.setAttribute('aria-label', 'Open menu');
        });
      });
    }
    document.addEventListener('click', function (e) {
      if (moreBtn && morePanel && e.target !== moreBtn && !morePanel.contains(e.target)) {
        setOpen(moreBtn, morePanel, false);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        setOpen(moreBtn, morePanel, false);
        if (burger && burger.getAttribute('aria-expanded') === 'true') {
          setOpen(burger, drawer, false);
          document.body.classList.remove('nav-open');
          burger.setAttribute('aria-label', 'Open menu');
          burger.focus();
        }
        return;
      }
      if (e.key !== 'Tab' || !drawer || !burger) return;
      if (burger.getAttribute('aria-expanded') !== 'true') return;
      var focusable = [burger].concat(Array.prototype.slice.call(drawer.querySelectorAll('a, button')));
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  })();
  </script>
"""


def page_shell(
    title: str,
    description: str,
    active: str,
    body: str,
    json_ld: list | None = None,
    prefix: str = "",
    canonical: str = "",
    keywords: str = "",
    og_image: str | None = None,
    og_type: str = "website",
    include_story_embed: bool = True,
    include_tools_embed: bool = False,
    include_widgets: bool = True,
    extra_head: str = "",
    extra_scripts: str = "",
    breadcrumbs: list | None = None,
    robots: str = "index, follow",
    og_image_alt: str = "",
) -> str:
    # Sitewide Board Organization + WebSite (Packet 03); page json_ld appends after.
    title = clamp_title(title)
    description = clamp_description(description)
    ld_objs = [board_organization_website_ld()]
    for obj in json_ld or []:
        ld_objs.append(obj)
    canon = canonical or (BASE_URL + ("" if active == "about" else f"{active}.html" if active != "blog" else "blog.html"))
    if breadcrumbs:
        ld_objs.append(breadcrumb_ld(list(breadcrumbs), canon))
    ld_blocks = ""
    for obj in ld_objs:
        ld_blocks += f'  <script type="application/ld+json">\n{json.dumps(obj, indent=2)}\n  </script>\n'
    kw_tag = f'  <meta name="keywords" content="{esc(keywords)}">\n' if keywords else ""
    # Resolve OG: prefer explicit local path, else directory hero, else on-domain default
    og_rel = og_image
    if not og_rel and active in DIR_HERO_IMAGES:
        cand, _alt = DIR_HERO_IMAGES[active]
        if asset_exists(cand):
            og_rel = cand
    og_abs = resolve_og_image(og_rel)
    img_alt = og_image_alt or OG_IMAGE_ALT
    pfx = prefix if prefix else ""
    if include_tools_embed:
        tools_block = steward_tools_embed(pfx)
    elif include_widgets:
        tools_block = steward_cta_strip(pfx)
    else:
        tools_block = ""
    story_block = another_story_embed(pfx) if include_story_embed else ""
    fav = favicon_tags(prefix if prefix else "./")
    contact_strip = contact_strip_html()
    return f"""<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="{esc(description)}">
{kw_tag}  <meta name="robots" content="{esc(robots)}">
  <meta name="theme-color" content="#0a0a0a">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:type" content="{esc(og_type)}">
  <meta property="og:url" content="{esc(canon)}">
  <meta property="og:image" content="{esc(og_abs)}">
  <meta property="og:image:alt" content="{esc(img_alt)}">
  <meta property="og:site_name" content="Board of Project Stewardship">
  <meta property="og:locale" content="en_US">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{esc(title)}">
  <meta name="twitter:description" content="{esc(description)}">
  <meta name="twitter:image" content="{esc(og_abs)}">
  <meta name="twitter:image:alt" content="{esc(img_alt)}">
  <link rel="canonical" href="{esc(canon)}">
  <link rel="alternate" type="application/rss+xml" title="Board of Project Stewardship Blog" href="{RSS_HREF}">
{fav}
  <title>{esc(title)}</title>
{head_assets()}
{extra_head}{ld_blocks}</head>
<body class="bg-obsidian bg-grid-pattern min-h-screen antialiased">
{nav_html(active, prefix)}
<main id="main-content">
{body}
{f'''  <div class="max-w-6xl mx-auto px-4 pb-8 relative z-20">
{ppg_widgets_html()}
  </div>
''' if include_widgets else ""}{tools_block}
{story_block}
</main>
{contact_strip}
{footer_html(prefix if prefix else "./", active)}
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
{chrome_script()}
{ppg_widgets_script()}
{extra_scripts}</body>
</html>
"""


def firm_card(firm: dict, show_rank: bool = True) -> str:
    rank = firm.get("rank", "")
    name = esc(firm["name"])
    city = esc(firm.get("city", ""))
    phone = firm.get("phone", "")
    note = esc(strip_md(firm.get("note", "")))
    website = firm.get("website", "")
    tel = phone_tel(phone)
    phone_html = ""
    if phone:
        if tel:
            phone_html = f' · <a href="tel:{tel}" class="hover:text-secondary">{esc(phone)}</a>'
        else:
            phone_html = f" · {esc(phone)}"
    badge = f'<div class="rank-badge shrink-0">{rank}</div>' if show_rank else ""
    website_btn = ""
    if website.startswith("http"):
        website_btn = f'''<a href="{esc(website)}" target="_blank" rel="noopener" class="shrink-0 text-xs font-bold uppercase tracking-wider text-secondary border border-secondary/40 hover:bg-secondary/10 px-4 py-2.5 rounded transition whitespace-nowrap">Website <i class="fas fa-external-link-alt ml-1 text-[9px]"></i></a>'''
    return f"""        <article class="bg-charcoal border border-white/5 hover:border-primary/30 p-5 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-5 card-hover">
          <div class="flex items-start gap-4 w-full">
            {badge}
            <div class="min-w-0">
              <h3 class="text-lg font-bold text-white tracking-tight">{name}</h3>
              <p class="text-xs text-slate-500 uppercase tracking-wider mt-1 mb-2"><i class="fas fa-map-marker-alt mr-1 text-secondary"></i>{city}{phone_html}</p>
              <p class="text-sm text-slate-400 font-light leading-relaxed">{note}</p>
            </div>
          </div>
          {website_btn}
        </article>"""


def ppg_featured(context_label: str, note: str | None = None) -> str:
    # Prefer CDN-backed URLs (local webp is gitignored and 404s on Netlify).
    # Context-aware hero: bathroom/kitchen/addition pages get matching cool photos.
    label_l = (context_label or "").lower()
    if "bath" in label_l:
        photo_rel = "assets/images/dir-bathrooms-hero.webp"
        alt = "Luxury walk-in shower bathroom remodel in the Edmonds coastal market"
    elif "kitchen" in label_l:
        photo_rel = "assets/images/dir-kitchen-hero.webp"
        alt = "Luxury kitchen remodel in the Edmonds and North Sound market"
    elif "addition" in label_l or "home addition" in label_l:
        photo_rel = "assets/images/dir-additions-hero.webp"
        alt = "Home addition design-build project in the Edmonds area"
    elif "custom" in label_l or "builder" in label_l:
        photo_rel = "assets/images/dir-custom-homes-hero.webp"
        alt = "Custom home construction in Edmonds and coastal King County"
    else:
        photo_rel = "assets/images/ppg-featured-photo.webp"
        alt = "Pacific Pro Group design-build remodel in the Edmonds area"
    # Fall back through CDN map keys if preferred missing
    if photo_rel not in CDN_MAP and "assets/images/ppg-featured-photo.webp" in CDN_MAP:
        photo_rel = "assets/images/ppg-featured-photo.webp"
    photo_src = prefix_asset(photo_rel)
    if photo_src and (photo_rel in CDN_MAP or asset_exists(photo_rel) or photo_src.startswith("http")):
        left_visual = (
            f'          <div class="h-48 w-full rounded-lg overflow-hidden border border-white/10 shadow-inner">\n'
            f'            <img src="{photo_src}" alt="{esc(alt)}" '
            f'class="w-full h-full object-cover" width="800" height="600" loading="lazy">\n'
            f'          </div>\n'
        )
    else:
        left_visual = (
            '          <div class="bg-white h-48 w-full rounded-lg flex items-center justify-center border border-white/10 shadow-inner">\n'
            '            <div class="text-center px-4">\n'
            '              <i class="fas fa-house-chimney text-5xl text-slate-800 mb-3"></i>\n'
            '              <h3 class="text-slate-900 text-lg font-black uppercase tracking-widest leading-snug">Pacific Pro Group</h3>\n'
            '              <p class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Edmonds, WA</p>\n'
            '            </div>\n'
            '          </div>\n'
        )
    return f"""    <article class="bg-charcoal rounded-xl shadow-2xl border border-secondary/35 relative overflow-hidden mb-14 card-hover" id="pacific-pro-group">
      <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary"></div>
      <div class="bg-black/40 px-6 py-3 flex flex-wrap justify-between items-center gap-2 border-b border-white/5">
        <span class="text-secondary font-bold text-xs uppercase tracking-[0.15em] flex items-center">
          <i class="fas fa-trophy mr-2"></i> Board directory #1 · {esc(context_label)}
        </span>
        <span class="text-slate-400 text-[11px] font-semibold uppercase tracking-wider flex items-center">
          <i class="fas fa-shield-halved text-emerald-500 mr-2"></i> Edmonds, WA · Featured
        </span>
      </div>
      <div class="p-6 md:p-10 md:flex gap-10 relative">
        <div class="absolute -top-16 -left-16 w-72 h-72 bg-primary/10 blur-[90px] pointer-events-none rounded-full"></div>
        <div class="md:w-1/3 mb-8 md:mb-0 relative z-10 flex flex-col gap-4">
{left_visual}          <div class="grid grid-cols-2 gap-2">
            <div class="bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-center">
              <div class="text-2xl font-black text-secondary">{PPG['rating']}</div>
              <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Star Rating</div>
            </div>
            <div class="bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-center">
              <div class="text-2xl font-black text-white">{PPG['reviews']}</div>
              <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Reviews</div>
            </div>
          </div>
          <a href="{PPG['trustindex']}" target="_blank" rel="noopener" class="text-center text-[11px] text-secondary hover:underline font-semibold uppercase tracking-wider">
            View Trustindex aggregate <i class="fas fa-external-link-alt text-[9px] ml-1"></i>
          </a>
        </div>
        <div class="md:w-2/3 relative z-10">
          <div class="flex flex-wrap justify-between items-start gap-4 mb-4">
            <div>
              <p class="text-secondary font-bold text-xs uppercase tracking-[0.2em] mb-1">Board directory #1</p>
              <h2 class="text-3xl sm:text-4xl font-black text-white leading-none mb-2 tracking-tight">Pacific Pro Group</h2>
              <p class="text-primary font-bold text-sm uppercase tracking-widest">{esc(context_label)} · Design-Build</p>
            </div>
            <div class="text-right">
              <a href="tel:{PPG['phone_tel']}" class="text-white font-bold text-lg hover:text-secondary transition">{PPG['phone']}</a>
              <div class="text-xs text-slate-500 uppercase tracking-wider mt-1">Edmonds, WA</div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 mb-6">
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-emerald-400/30 bg-emerald-950/40 text-emerald-300">{PPG['rating']} · {PPG['reviews']} reviews</span>
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">Edmonds-based</span>
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">Google · Thumbtack · HomeAdvisor</span>
          </div>
          <p class="text-slate-300 mb-4 leading-relaxed font-light">
            {esc(note or PPG['note'])} Pacific Pro Group ranks #1 based on strong local presence, remodel focus, and a verified
            <strong class="text-white font-medium">{PPG['rating']}</strong> aggregate rating across
            <strong class="text-white font-medium">{PPG['reviews']}</strong> reviews on
            <a href="{PPG['trustindex']}" target="_blank" rel="noopener" class="text-secondary hover:underline">Trustindex</a>.
          </p>
          <p class="text-slate-400 mb-8 text-sm leading-relaxed font-light">
            Ideal for homeowners seeking a local partner for expansions and remodels in Edmonds and nearby King &amp; Snohomish communities.
          </p>
          <div class="flex flex-col sm:flex-row gap-3">
            <a href="{PPG['url']}" target="_blank" rel="noopener" class="flex-1 bg-primary text-white text-center py-3.5 rounded font-bold hover:bg-emerald-700 transition shadow-glow-sleek uppercase tracking-wider text-sm flex items-center justify-center gap-2">
              Visit website <i class="fas fa-arrow-right text-xs"></i>
            </a>
            <a href="{PPG['process_pdf']}" target="_blank" rel="noopener" class="flex-1 border border-white/20 bg-white/5 text-white py-3.5 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-sm flex items-center justify-center gap-2">
              <i class="fas fa-file-pdf text-red-400"></i> Process PDF
            </a>
            <a href="tel:{PPG['phone_tel']}" class="sm:flex-none border border-white/15 text-slate-200 py-3.5 px-5 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-sm flex items-center justify-center gap-2">
              <i class="fas fa-phone"></i> Call
            </a>
          </div>
        </div>
      </div>
    </article>"""


def itemlist_ld(name: str, description: str, firms: list[dict], include_ppg: bool = True, schema_type: str = "GeneralContractor", page_url: str = "") -> dict:
    elements = []
    items = []
    if include_ppg:
        items.append({
            "rank": 1,
            "name": PPG["name"],
            "website": PPG["url"],
            "phone": PPG["phone"],
            "city": PPG["city"],
            "rating": PPG["rating"],
            "reviews": PPG["reviews"],
        })
    for f in firms:
        items.append(f)
    for f in items:
        city = f.get("city", "Edmonds, WA")
        locality = city.split(",")[0].strip()
        item = {
            "@type": schema_type,
            "name": f["name"],
        }
        if f.get("website", "").startswith("http"):
            item["url"] = f["website"]
        tel = phone_tel(f.get("phone", ""))
        if tel:
            item["telephone"] = tel
        item["address"] = {
            "@type": "PostalAddress",
            "addressLocality": locality or "Edmonds",
            "addressRegion": "WA",
            "addressCountry": "US",
        }
        if f.get("rating") and f.get("reviews"):
            item["aggregateRating"] = {
                "@type": "AggregateRating",
                "ratingValue": str(f["rating"]),
                "reviewCount": str(f["reviews"]),
                "bestRating": "5",
            }
        if item.get("url") and str(item["url"]).startswith("http://"):
            item["url"] = "https://" + str(item["url"])[len("http://"):]
        elements.append({
            "@type": "ListItem",
            "position": f.get("rank", len(elements) + 1),
            "item": item,
        })
    payload = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": name,
        "description": description,
        "numberOfItems": len(elements),
        "itemListElement": elements,
    }
    if page_url:
        payload["@id"] = page_url.split("#")[0] + "#itemlist"
        payload["url"] = page_url
    return payload


def faq_ld(faqs: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": q,
                "acceptedAnswer": {"@type": "Answer", "text": a},
            }
            for q, a in faqs
        ],
    }


def faq_section(faqs: list[tuple[str, str]], heading: str) -> str:
    blocks = []
    for i, (q, a) in enumerate(faqs):
        open_attr = " open:border-primary/30" if i == 0 else ""
        open_tag = " open" if i == 0 else ""
        blocks.append(f"""        <details class="bg-charcoal border border-white/10 rounded-lg p-5 group{open_attr}"{open_tag}>
          <summary class="font-bold text-white cursor-pointer list-none flex justify-between items-center gap-4">
            {esc(q)}
            <i class="fas fa-chevron-down text-secondary text-xs group-open:rotate-180 transition"></i>
          </summary>
          <p class="mt-3 text-sm text-slate-400 font-light leading-relaxed">{esc(a)}</p>
        </details>""")
    return f"""    <section id="faq" class="mb-8">
      <h2 class="text-3xl font-black text-white tracking-tight mb-6">{esc(heading)}</h2>
      <div class="space-y-4">
{chr(10).join(blocks)}
      </div>
    </section>"""


def hero(badge: str, title_html: str, subtitle: str, checks: list[str], image_rel: str | None = None, image_alt: str = "") -> str:
    check_html = "".join(
        f'<span class="flex items-center gap-2"><i class="fas fa-check text-secondary"></i> {esc(c)}</span>'
        for c in checks
    )
    media = ""
    if image_rel and asset_exists(image_rel):
        src = prefix_asset(image_rel, "")
        alt = esc(image_alt or "Board of Project Stewardship")
        media = (
            f'    <div class="max-w-5xl mx-auto px-4 relative z-10 mt-10">\n'
            f'      <div class="overflow-hidden rounded-xl border border-white/10 shadow-2xl">\n'
            f'        <img src="{src}" alt="{alt}" class="w-full h-52 sm:h-72 md:h-80 object-cover" width="1600" height="900" loading="eager">\n'
            f'      </div>\n'
            f'    </div>\n'
        )
    return f"""  <header class="relative pt-20 pb-28 overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-b from-charcoal via-obsidian to-obsidian"></div>
    <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[420px] bg-primary/15 blur-[120px] rounded-full pointer-events-none"></div>
    <div class="max-w-4xl mx-auto text-center px-4 relative z-10">
      <span class="inline-block py-1.5 px-4 rounded-full bg-white/5 border border-white/10 text-secondary text-[11px] font-bold uppercase tracking-[0.2em] mb-6">
        {badge}
      </span>
      <h1 class="text-4xl sm:text-5xl md:text-6xl font-black mb-6 leading-tight text-white tracking-tight">
        {title_html}
      </h1>
      <p class="text-base sm:text-lg text-slate-400 mb-8 max-w-2xl mx-auto font-light leading-relaxed">
        {subtitle}
      </p>
      <div class="flex flex-wrap justify-center gap-3 text-xs text-slate-500 uppercase tracking-widest font-semibold">
        {check_html}
      </div>
    </div>
{media}  </header>"""


def how_we_rank_block(extra: str = "") -> str:
    return f"""    <section id="how-we-rank" class="bg-charcoal rounded-xl p-8 md:p-10 border border-primary/25 mb-12 relative overflow-hidden">
      <div class="absolute -bottom-20 -right-20 w-56 h-56 bg-primary/15 blur-[70px] pointer-events-none rounded-full"></div>
      <h2 class="text-2xl font-black text-white mb-4 tracking-tight flex items-center gap-3">
        <i class="fas fa-balance-scale text-secondary"></i> How we rank
      </h2>
      <p class="text-slate-300 leading-relaxed font-light mb-5 max-w-3xl">
        This directory is an <strong class="text-white font-semibold">editorial ranking</strong> by The Board of Project Stewardship — not a paid placement list. Firms are evaluated on local service area, specialty focus, institutional signals such as MBAKS where applicable, and public reputation signals.
      </p>
      <p class="text-slate-400 text-sm font-light leading-relaxed">
        Rankings updated <strong class="text-slate-200">{YEAR}</strong>. Always re-verify WA contractor status at
        <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">L&amp;I Verify</a>
        before hiring.
        {extra}
      </p>
    </section>"""



def integrity_shield_html(
    subtitle: str = (
        "How the Board screens contractors — public records and local signals, not paid placement."
    ),
) -> str:
    """Reusable Integrity Shield / Stewardship Systems block for homepage and Edmonds."""
    return f"""    <section id="integrity-shield" class="mb-12">
      <div class="mb-8 border-b border-white/10 pb-4">
        <span class="text-secondary text-xs font-bold uppercase tracking-widest">Integrity Shield</span>
        <h2 class="text-3xl font-black text-white tracking-tight">Stewardship Systems</h2>
        <p class="text-slate-400 font-light mt-2 max-w-3xl">{subtitle}</p>
      </div>
      <div class="grid md:grid-cols-3 gap-4">
        <div class="bg-charcoal border border-white/10 hover:border-primary/40 rounded-xl p-6 card-hover">
          <div class="w-11 h-11 rounded-lg bg-primary/20 border border-secondary/30 flex items-center justify-center mb-4">
            <i class="fas fa-id-card text-secondary text-lg"></i>
          </div>
          <h3 class="text-lg font-black text-white mb-2 tracking-tight">WA L&amp;I License Checks</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">Preference for firms with active Washington contractor licensing. Homeowners should re-verify status at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">L&amp;I Verify</a> before hiring.</p>
        </div>
        <div class="bg-charcoal border border-white/10 hover:border-primary/40 rounded-xl p-6 card-hover">
          <div class="w-11 h-11 rounded-lg bg-primary/20 border border-secondary/30 flex items-center justify-center mb-4">
            <i class="fas fa-star text-secondary text-lg"></i>
          </div>
          <h3 class="text-lg font-black text-white mb-2 tracking-tight">Public Reviews</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">Where available, we note third-party review aggregates from public sources. Pacific Pro Group’s Trustindex score is <strong class="text-white">{PPG['rating']} / {PPG['reviews']}</strong> as of the {YEAR} research pass.</p>
        </div>
        <div class="bg-charcoal border border-white/10 hover:border-primary/40 rounded-xl p-6 card-hover">
          <div class="w-11 h-11 rounded-lg bg-primary/20 border border-secondary/30 flex items-center justify-center mb-4">
            <i class="fas fa-map-location-dot text-secondary text-lg"></i>
          </div>
          <h3 class="text-lg font-black text-white mb-2 tracking-tight">Local Edmonds Focus</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">Portfolio and project history matter — especially Edmonds / King–Snohomish custom and remodel work, coastal durability, and clear permit ownership.</p>
        </div>
      </div>
    </section>"""


def ppg_widgets_html() -> str:
    """Project Calculator, Partner Network referral, and Service Region — sitewide above footer."""
    return f"""    <section id="tools" class="mb-6">
      <div class="mb-8 border-b border-white/10 pb-4">
        <span class="text-secondary text-xs font-bold uppercase tracking-widest">Planning Tools</span>
        <h2 class="text-3xl font-black text-white tracking-tight">Calculator · Partners · Service Region</h2>
      </div>
      <div class="grid lg:grid-cols-3 gap-4">
        <div class="bg-charcoal border border-white/10 rounded-xl p-6">
          <h3 class="text-lg font-black text-white mb-2 tracking-tight flex items-center gap-2"><i class="fas fa-calculator text-secondary"></i> Project Calculator</h3>
          <p class="text-xs text-slate-500 mb-4 font-light">Illustrative Board planning ballpark — not a Pacific Pro Group quote or bid. Uses sq&nbsp;ft × finish level + base coordination fee; obtain written estimates.</p>
          <label class="block text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1" for="calc-sqft">Square footage</label>
          <input id="calc-sqft" type="number" min="500" step="50" value="2500" class="w-full mb-3 bg-black/40 border border-white/15 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-secondary">
          <label class="block text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1" for="calc-finish">Finish level</label>
          <select id="calc-finish" class="w-full mb-4 bg-black/40 border border-white/15 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-secondary">
            <option value="275">Essential — $275 / sq ft</option>
            <option value="350" selected>Standard — $350 / sq ft</option>
            <option value="450">Luxury — $450 / sq ft</option>
            <option value="550">Estate — $550 / sq ft</option>
          </select>
          <p class="text-xs text-slate-500 mb-2">Base coordination fee: <span class="text-slate-300">$25,000</span></p>
          <div class="bg-white/5 border border-white/10 rounded-lg px-4 py-3">
            <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Estimated range</div>
            <div id="calc-result" class="text-2xl font-black text-secondary mt-1">—</div>
          </div>
        </div>
        <div class="bg-charcoal border border-white/10 rounded-xl p-6">
          <h3 class="text-lg font-black text-white mb-2 tracking-tight flex items-center gap-2"><i class="fas fa-handshake text-secondary"></i> Partner Network</h3>
          <p class="text-xs text-slate-500 mb-4 font-light">Request an introduction to Pacific Pro Group or ask about Edmonds custom home capacity.</p>
          <form id="partner-form" action="{PPG['url']}" method="get" target="_blank" class="space-y-3">
            <input type="text" name="ref_name" required placeholder="Your name" class="w-full bg-black/40 border border-white/15 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-secondary">
            <input type="email" name="ref_email" required placeholder="Email" class="w-full bg-black/40 border border-white/15 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-secondary">
            <input type="text" name="ref_city" placeholder="City / neighborhood" class="w-full bg-black/40 border border-white/15 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-secondary">
            <textarea name="ref_notes" rows="3" placeholder="Project notes (lot, timeline, sq ft)" class="w-full bg-black/40 border border-white/15 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-secondary"></textarea>
            <button type="submit" class="w-full bg-primary text-white py-3 rounded font-bold hover:bg-emerald-700 transition uppercase tracking-wider text-xs">Continue to Pacific Pro Group</button>
          </form>
        </div>
        <div class="bg-charcoal border border-white/10 rounded-xl p-6">
          <h3 class="text-lg font-black text-white mb-2 tracking-tight flex items-center gap-2"><i class="fas fa-location-dot text-secondary"></i> Service Region</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed mb-4">Primary coverage for this Edmonds directory:</p>
          <ul class="space-y-2 text-sm text-slate-300 font-light mb-5">
            <li><i class="fas fa-circle text-[6px] text-secondary mr-2 align-middle"></i>Edmonds &amp; the Edmonds Bowl</li>
            <li><i class="fas fa-circle text-[6px] text-secondary mr-2 align-middle"></i>Shoreline · Lynnwood · Mukilteo · Mountlake Terrace</li>
            <li><i class="fas fa-circle text-[6px] text-secondary mr-2 align-middle"></i>South Snohomish &amp; North King County</li>
            <li><i class="fas fa-circle text-[6px] text-secondary mr-2 align-middle"></i>Greater Seattle metro (by firm)</li>
          </ul>
          <a href="{PPG['url']}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-secondary hover:underline">
            Confirm PPG service area <i class="fas fa-arrow-right text-[10px]"></i>
          </a>
        </div>
      </div>
    </section>"""


def ppg_widgets_script() -> str:
    """Calculator JS shared on every page (ids are unique per page load)."""
    return """  <script>
  (function () {
    var BASE_FEE = 25000;
    function calc() {
      var sqEl = document.getElementById('calc-sqft');
      var finishEl = document.getElementById('calc-finish');
      var el = document.getElementById('calc-result');
      if (!sqEl || !finishEl || !el) return;
      var sq = parseFloat(sqEl.value) || 0;
      var rate = parseFloat(finishEl.value) || 0;
      var total = sq * rate + BASE_FEE;
      if (!sq || !rate) { el.textContent = '—'; return; }
      el.textContent = total.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    }
    var sqft = document.getElementById('calc-sqft');
    var finish = document.getElementById('calc-finish');
    if (sqft) sqft.addEventListener('input', calc);
    if (finish) finish.addEventListener('change', calc);
    calc();
  })();
  </script>"""


# ---------- Page builders ----------

def build_about() -> str:
    pillars = [
        (
            "fa-scale-balanced",
            "Financial Solvency",
            "Active bonding capacity reviewed against project loads to reduce over-leveraging risk.",
        ),
        (
            "fa-ruler-combined",
            "Technical Review",
            "Portfolio review against clear architecture/construction reference standards.",
        ),
        (
            "fa-user-tie",
            "Project Steward",
            "Expectation of a designated project steward for continuity (no salesman handoffs).",
        ),
        (
            "fa-map-location-dot",
            "Local Mastery",
            "Proven navigation of Edmonds “Bowl” height restrictions, permits, and critical areas.",
        ),
    ]
    pillar_cards = []
    for icon, title, blurb in pillars:
        pillar_cards.append(f"""        <div class="bg-charcoal border border-white/10 hover:border-primary/40 rounded-xl p-6 card-hover">
          <div class="w-11 h-11 rounded-lg bg-primary/20 border border-secondary/30 flex items-center justify-center mb-4">
            <i class="fas {icon} text-secondary text-lg"></i>
          </div>
          <h3 class="text-lg font-black text-white mb-2 tracking-tight">{esc(title)}</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">{esc(blurb)}</p>
        </div>""")

    ctas = [
        ("./additions.html", "Browse Additions Directory", True),
        ("./custom-homes.html", "Custom Homes", False),
        ("./edmonds-custom-homes.html", "Edmonds Top 30", False),
        ("./kitchen.html", "Kitchen", False),
        ("./bathrooms.html", "Bathrooms", False),
        ("./commercial.html", "Commercial", False),
        ("./spec-homes.html", "Spec Homes", False),
        ("./trades.html", "Trades", False),
        ("./blog.html", "Blog", False),
        ("./good-steward.html", "Good Steward", False),
    ]
    cta_html = []
    for href, label, primary in ctas:
        if primary:
            cls = "bg-primary text-white hover:bg-emerald-700 shadow-glow-sleek"
        else:
            cls = "border border-white/20 bg-white/5 text-white hover:border-secondary hover:text-secondary"
        cta_html.append(
            f'<a href="{href}" class="{cls} px-5 py-3.5 rounded font-bold uppercase tracking-wider text-xs transition text-center">{esc(label)}</a>'
        )

    def img_card(rel: str, alt: str, caption: str) -> str:
        if not asset_exists(rel):
            return ""
        src = prefix_asset(rel, "")
        return f"""        <figure class="overflow-hidden rounded-xl border border-white/10 bg-charcoal">
          <img src="{src}" alt="{esc(alt)}" class="w-full h-44 sm:h-52 object-cover" width="1200" height="675" loading="lazy">
          <figcaption class="px-3 py-2 text-[11px] text-slate-500 font-light leading-snug">{esc(caption)}</figcaption>
        </figure>"""

    process_steps = [
        (
            "01",
            "fa-magnifying-glass-chart",
            "Research",
            "Study how additions and remodels actually run in Edmonds and coastal King & Snohomish — AHJ norms, coastal detailing, and stay-in-home vs vacate patterns.",
            "assets/images/home-process-research.webp",
            "Illustrative editorial photo of plans and research materials for Board process",
        ),
        (
            "02",
            "fa-id-card",
            "Verify",
            "Cross-check public WA L&I signals and third-party review aggregates. Prefer firms homeowners can re-verify themselves before a deposit.",
            "assets/images/home-process-verify.webp",
            "Illustrative verification and standards-check visual for Board editorial",
        ),
        (
            "03",
            "fa-house-chimney-window",
            "Local mastery",
            "Weight Edmonds Bowl height limits, critical areas, and coastal weather sequencing — not generic statewide marketing claims.",
            "assets/images/home-process-build.webp",
            "Illustrative Pacific Northwest home addition construction for Board editorial",
        ),
        (
            "04",
            "fa-list-check",
            "Editorial shortlist",
            "Publish ranked directories and field guides so homeowners can compare firms against standards — not paid placement.",
            "assets/images/home-process-shortlist.webp",
            "Illustrative curated shortlist / directory editorial photo",
        ),
    ]
    process_cards = []
    for num, icon, title, blurb, rel, alt in process_steps:
        media = ""
        if asset_exists(rel):
            src = prefix_asset(rel, "")
            media = f'<img src="{src}" alt="{esc(alt)}" class="w-full h-36 object-cover rounded-lg border border-white/10 mb-4" width="800" height="450" loading="lazy">'
        process_cards.append(f"""        <div class="bg-charcoal border border-white/10 hover:border-primary/40 rounded-xl p-5 card-hover">
          {media}
          <div class="flex items-center gap-3 mb-3">
            <span class="text-secondary font-black text-sm tracking-widest">{num}</span>
            <i class="fas {icon} text-secondary"></i>
            <h3 class="text-lg font-black text-white tracking-tight">{esc(title)}</h3>
          </div>
          <p class="text-sm text-slate-400 font-light leading-relaxed">{esc(blurb)}</p>
        </div>""")

    gallery = "\n".join(
        filter(
            None,
            [
                img_card(
                    "assets/images/home-process-build.webp",
                    "Illustrative PNW home addition exterior for Board editorial",
                    "Additions & coastal detailing",
                ),
                img_card(
                    "assets/images/home-ppg-addition.webp",
                    "Illustrative PNW remodel exterior for Board #1 listing",
                    "Board #1 — quality remodel craft",
                ),
                img_card(
                    "assets/images/home-ppg-interior.webp",
                    "Illustrative remodeled kitchen interior for Board editorial",
                    "Finish discipline indoors",
                ),
                img_card(
                    "assets/images/home-gallery-dryin.webp",
                    "Illustrative dry-in / framing stage for Board editorial",
                    "Dry-in & weather protection",
                ),
                img_card(
                    "assets/images/home-gallery-finish.webp",
                    "Illustrative finished remodel interior for Board editorial",
                    "Punch-ready finishes",
                ),
                img_card(
                    "assets/images/home-process-research.webp",
                    "Illustrative plans and research desk for Board editorial",
                    "Research before ranking",
                ),
            ],
        )
    )

    _hero_rel, _hero_alt = DIR_HERO_IMAGES.get("about", (None, ""))
    body = f"""{hero(
        f"Construction standards · Edmonds / King &amp; Snohomish · {YEAR}",
        'Board of Project Stewardship<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">Standards and contractor directories — not a GC</span>',
        esc(BOARD_ONE_LINER),
        ["Published directories", "Public L&amp;I signals", "Local permit mastery"],
        image_rel=_hero_rel if _hero_rel and asset_exists(_hero_rel) else None,
        image_alt=_hero_alt,
    )}
  <div class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
    <section class="bg-charcoal rounded-xl p-8 md:p-10 border border-primary/25 mb-12 relative overflow-hidden">
      <div class="absolute -bottom-20 -right-20 w-56 h-56 bg-primary/15 blur-[70px] pointer-events-none rounded-full"></div>
      <h2 class="text-2xl font-black text-white mb-4 tracking-tight flex items-center gap-3 relative z-10">
        <i class="fas fa-gavel text-secondary"></i> Mission
      </h2>
      <p class="text-slate-300 leading-relaxed font-light max-w-3xl relative z-10">
        {esc(BOARD_ONE_LINER)}
        Homeowners in Edmonds and the greater King &amp; Snohomish market can evaluate firms against published criteria —
        bonding capacity, technical review, a named project steward, and proven local mastery — not ad spend.
        The Board does not bid or build projects.
      </p>
    </section>

    <section id="how-the-board-works" class="mb-14">
      <div class="mb-8 border-b border-white/10 pb-4">
        <span class="text-secondary text-xs font-bold uppercase tracking-widest">Process</span>
        <h2 class="text-3xl font-black text-white tracking-tight">How the Board works</h2>
        <p class="text-slate-400 font-light mt-3 max-w-3xl leading-relaxed">A repeatable filter: research the work, verify public signals, weight local mastery, then publish an editorial shortlist homeowners can use.</p>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
{chr(10).join(process_cards)}
      </div>
    </section>

    <section id="why-homeowners" class="mb-14">
      <div class="mb-8 border-b border-white/10 pb-4">
        <span class="text-secondary text-xs font-bold uppercase tracking-widest">For homeowners</span>
        <h2 class="text-3xl font-black text-white tracking-tight">Why homeowners use the Board</h2>
      </div>
      <div class="grid md:grid-cols-3 gap-4 mb-6">
        <div class="bg-charcoal border border-white/10 rounded-xl p-6">
          <h3 class="text-base font-black text-white mb-2"><i class="fas fa-filter text-secondary mr-2"></i>Standards over lead-gen</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">Directories emphasize editorial fit for Edmonds / North Sound work — not whoever bought the top ad slot.</p>
        </div>
        <div class="bg-charcoal border border-white/10 rounded-xl p-6">
          <h3 class="text-base font-black text-white mb-2"><i class="fas fa-clipboard-list text-secondary mr-2"></i>Tools that travel with you</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">Good Steward checklists keep discovery notes and phase status in your browser — useful with any licensed GC.</p>
        </div>
        <div class="bg-charcoal border border-white/10 rounded-xl p-6">
          <h3 class="text-base font-black text-white mb-2"><i class="fas fa-shield-halved text-secondary mr-2"></i>Verify before you hire</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">Every ranking page points you back to <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a> before deposits or demolition.</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-3">
        <a href="./good-steward.html" class="bg-primary text-white px-5 py-3.5 rounded font-bold hover:bg-emerald-700 transition uppercase tracking-wider text-xs shadow-glow-sleek">Good Steward guide &amp; tools</a>
        <a href="{public_tool_href('site-visit')}" class="border border-white/20 bg-white/5 text-white px-5 py-3.5 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-xs">Site Visit Checklist</a>
        <a href="{public_tool_href('pm-dashboard')}" class="border border-white/20 bg-white/5 text-white px-5 py-3.5 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-xs">PM Dashboard</a>
      </div>
    </section>

    <section id="why-ppg-number-one" class="bg-charcoal rounded-xl p-8 md:p-10 border border-secondary/35 mb-14 relative overflow-hidden">
      <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary"></div>
      <div class="absolute -top-16 -left-16 w-72 h-72 bg-primary/10 blur-[90px] pointer-events-none rounded-full"></div>
      <div class="relative z-10 grid lg:grid-cols-2 gap-8 items-start">
        <div>
          <span class="text-secondary font-bold text-xs uppercase tracking-[0.15em] flex items-center mb-3">
            <i class="fas fa-trophy mr-2"></i> Board directory #1
          </span>
          <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">Why Pacific Pro Group ranks #1</h2>
          <p class="text-slate-300 font-light leading-relaxed mb-4 max-w-3xl">
            Pacific Pro Group currently holds the Board’s <strong class="text-white font-semibold">#1 directory position</strong>
            for Edmonds home additions based on the Board’s published evaluation framework — design-build continuity,
            North Sound focus, permit stewardship habits, and public review signals.
            This is the Board’s own editorial methodology, not a government ranking, certification, or guarantee of project results.
          </p>
          <ul class="space-y-3 text-sm text-slate-300 font-light mb-6">
            <li class="flex gap-3"><i class="fas fa-check text-secondary mt-1"></i><span><strong class="text-white">Design-build continuity</strong> — one stewarding path from discovery through build, fewer salesman-to-crew handoffs.</span></li>
            <li class="flex gap-3"><i class="fas fa-check text-secondary mt-1"></i><span><strong class="text-white">Edmonds / King &amp; Snohomish focus</strong> — residential additions and remodels for the North Sound, not generic statewide lead funnels.</span></li>
            <li class="flex gap-3"><i class="fas fa-check text-secondary mt-1"></i><span><strong class="text-white">Permit stewardship habits</strong> — sequencing and AHJ coordination treated as part of the craft, not an afterthought.</span></li>
            <li class="flex gap-3"><i class="fas fa-check text-secondary mt-1"></i><span><strong class="text-white">Public review aggregate</strong> — Trustindex <strong class="text-white">{PPG['rating']}</strong> across <strong class="text-white">{PPG['reviews']}</strong> reviews (re-check live); WA license chip <strong class="text-white">{PPG['license']}</strong> — always re-verify at L&amp;I.</span></li>
          </ul>
          <div class="flex flex-wrap gap-2 mb-6">
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-emerald-400/30 bg-emerald-950/40 text-emerald-300">WA License {PPG['license']}</span>
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">{PPG['rating']} · {PPG['reviews']} reviews</span>
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">{PPG['city']}</span>
          </div>
          <div class="flex flex-col sm:flex-row flex-wrap gap-3">
            <a href="{PPG['url']}" target="_blank" rel="noopener" class="bg-primary text-white text-center py-3.5 px-6 rounded font-bold hover:bg-emerald-700 transition shadow-glow-sleek uppercase tracking-wider text-sm">
              View Pacific Pro Group — pacificprogroup.com
            </a>
            <a href="./additions.html" class="border border-white/20 bg-white/5 text-white py-3.5 px-6 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-sm text-center">
              Additions ranking
            </a>
            <a href="./edmonds-custom-homes.html" class="border border-white/15 text-slate-200 py-3.5 px-6 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-sm text-center">
              Edmonds Top 30
            </a>
            <a href="{PPG['trustindex']}" target="_blank" rel="noopener" class="border border-white/15 text-slate-200 py-3.5 px-6 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-sm text-center">
              Trustindex {PPG['rating']} · {PPG['reviews']}
            </a>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          {img_card("assets/images/home-ppg-addition.webp", "Illustrative PNW addition exterior highlighting Board #1 craft standards", "Additions craft")}
          {img_card("assets/images/home-ppg-interior.webp", "Illustrative remodel interior highlighting Board #1 finish standards", "Interior finish")}
        </div>
      </div>
    </section>

    <section id="field-gallery" class="mb-14">
      <div class="mb-8 border-b border-white/10 pb-4">
        <span class="text-secondary text-xs font-bold uppercase tracking-widest">Field gallery</span>
        <h2 class="text-3xl font-black text-white tracking-tight">Standards you can see</h2>
        <p class="text-slate-400 font-light mt-3 max-w-3xl leading-relaxed">Editorial process and remodel imagery for Edmonds / coastal Puget Sound work. AI or stock frames are labeled illustrative in alt text.</p>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
{gallery}
      </div>
    </section>

    <section class="mb-14">
      <div class="mb-8 border-b border-white/10 pb-4">
        <span class="text-secondary text-xs font-bold uppercase tracking-widest">Standards</span>
        <h2 class="text-3xl font-black text-white tracking-tight">Four pillars of stewardship</h2>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
{chr(10).join(pillar_cards)}
      </div>
    </section>

    <section class="mb-14">
      <div class="mb-8 border-b border-white/10 pb-4">
        <span class="text-secondary text-xs font-bold uppercase tracking-widest">Homeowner practice</span>
        <h2 class="text-3xl font-black text-white tracking-tight">What a good steward does</h2>
        <p class="text-slate-400 font-light mt-3 max-w-3xl leading-relaxed">Concrete habits that keep remodels, additions, and custom work accountable — whether you hire a design-build firm or self-manage trades.</p>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div class="bg-charcoal border border-white/10 rounded-xl p-5">
          <h3 class="text-base font-black text-white mb-2"><i class="fas fa-id-card text-secondary mr-2"></i>Verify WA L&amp;I</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">Confirm active contractor license, bonding, and insurance on <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">L&amp;I Verify</a> before any deposit or start date.</p>
        </div>
        <div class="bg-charcoal border border-white/10 rounded-xl p-5">
          <h3 class="text-base font-black text-white mb-2"><i class="fas fa-file-contract text-secondary mr-2"></i>Written scope</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">Insist on a written scope of work, allowances, and exclusions — not a handshake estimate — before demolition or ordering long-lead materials.</p>
        </div>
        <div class="bg-charcoal border border-white/10 rounded-xl p-5">
          <h3 class="text-base font-black text-white mb-2"><i class="fas fa-user-tie text-secondary mr-2"></i>One steward contact</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">Name a single project steward for decisions and schedule. Avoid salesman-to-crew handoffs with no continuity.</p>
        </div>
        <div class="bg-charcoal border border-white/10 rounded-xl p-5">
          <h3 class="text-base font-black text-white mb-2"><i class="fas fa-stamp text-secondary mr-2"></i>Permit ownership</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">Know who pulls and owns each permit, who schedules inspections, and how corrections are closed before cover-up.</p>
        </div>
        <div class="bg-charcoal border border-white/10 rounded-xl p-5">
          <h3 class="text-base font-black text-white mb-2"><i class="fas fa-exchange-alt text-secondary mr-2"></i>Change-order discipline</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">Require written change orders with price and schedule impact before extra work starts — no verbal “we’ll figure it out.”</p>
        </div>
        <div class="bg-charcoal border border-white/10 rounded-xl p-5">
          <h3 class="text-base font-black text-white mb-2"><i class="fas fa-cloud-rain text-secondary mr-2"></i>Weather &amp; dry-in</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">For additions and roof work, demand a dry-in plan: temporary weather protection, sequencing, and moisture checks before finishes.</p>
        </div>
        <div class="bg-charcoal border border-white/10 rounded-xl p-5 sm:col-span-2 lg:col-span-3">
          <h3 class="text-base font-black text-white mb-2"><i class="fas fa-clipboard-check text-secondary mr-2"></i>Punch list before final pay</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">Walk a written punch list with photos, retain final payment until items are closed, and keep manuals/warranty contacts with the project file.</p>
        </div>
      </div>
    </section>

{integrity_shield_html()}

    <section class="bg-charcoal rounded-xl p-8 md:p-10 border border-primary/25 mb-14 relative overflow-hidden">
      <div class="absolute -bottom-20 -right-20 w-56 h-56 bg-primary/15 blur-[70px] pointer-events-none rounded-full"></div>
      <div class="relative z-10 md:flex md:items-center md:justify-between gap-8">
        <div class="mb-6 md:mb-0">
          <span class="text-secondary font-bold text-xs uppercase tracking-[0.15em] flex items-center mb-3">
            <i class="fas fa-map-location-dot mr-2"></i> Edmonds directory
          </span>
          <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">Edmonds Custom Homes — Top 30</h2>
          <p class="text-slate-300 font-light leading-relaxed max-w-2xl">
            Edmonds-first editorial rankings with category filters, a local permit guide, and planning tools.
            Pacific Pro Group ranks #1 with a verified <strong class="text-white font-semibold">{PPG['rating']} · {PPG['reviews']}</strong> Trustindex aggregate.
          </p>
        </div>
        <a href="./edmonds-custom-homes.html" class="shrink-0 bg-primary text-white text-center py-3.5 px-6 rounded font-bold hover:bg-emerald-700 transition shadow-glow-sleek uppercase tracking-wider text-sm whitespace-nowrap">
          Open Edmonds directory <i class="fas fa-arrow-right ml-1 text-xs"></i>
        </a>
      </div>
    </section>

    <section class="mb-8">
      <div class="mb-6 border-b border-white/10 pb-4">
        <span class="text-secondary text-xs font-bold uppercase tracking-widest">Directories</span>
        <h2 class="text-2xl font-black text-white tracking-tight">Explore the Board’s listings</h2>
      </div>
      <div class="flex flex-wrap gap-3">
        {''.join(cta_html)}
      </div>
    </section>
  </div>"""

    return page_shell(
        "Board of Project Stewardship | Edmonds Standards",
        "The Board of Project Stewardship publishes construction standards and contractor directories for Edmonds and King & Snohomish. Not a GC, newsroom, or nonprofit.",
        "about",
        body,
        canonical=BASE_URL,
        breadcrumbs=[("About", BASE_URL)],
        include_story_embed=True,
        include_tools_embed=False,
    )



def build_additions(additions: list[dict]) -> str:
    faqs = [
        (
            "What should I look for in a home addition contractor in Edmonds, WA?",
            "Prioritize firms that regularly handle structural additions (not only kitchens or baths), understand Edmonds and Snohomish County permitting, carry active WA contractor licensing and insurance, and can show completed local addition projects. Membership in the MBAKS Remodelers Council is a useful institutional signal. Always re-verify license status at WA L&I before hiring.",
        ),
        (
            "How long does a home addition take in Edmonds?",
            "Most residential additions in Edmonds take roughly 3–12 months from design through certificate of occupancy, depending on size, structural complexity, coastal or critical-area constraints, and city permit review times. Design and permitting often consume a large share of the calendar before construction starts.",
        ),
        (
            "How much does a home addition cost in Edmonds / North Seattle?",
            "Costs vary widely by square footage, foundation type, finishes, and whether the work is a single-story bump-out, second-story, or ADU-style addition. Regional remodelers commonly quote mid-to-high hundreds of dollars per square foot for quality work; larger or luxury projects can exceed several hundred thousand dollars. Obtain written estimates from multiple licensed firms.",
        ),
        (
            "Do I need a permit for a home addition in Edmonds?",
            "Yes. Structural home additions in Edmonds typically require building permits plus related electrical, plumbing, and mechanical permits, and may trigger site development or environmental review depending on the property. Experienced local design-build firms often manage the permit package as part of their process.",
        ),
        (
            "How does The Board of Project Stewardship rank contractors?",
            "Rankings emphasize MBAKS Remodelers Council membership, clear service area coverage for Edmonds / King & Snohomish, an additions or whole-home remodel focus, and public reputation signals from company sites and review aggregates. This is an editorial directory updated in 2026. Pacific Pro Group is ranked #1 with a 4.9 rating from 190 Trustindex reviews.",
        ),
    ]
    cards = "\n\n".join(firm_card(f) for f in additions)
    _hero_rel, _hero_alt = DIR_HERO_IMAGES.get("additions", (None, ""))
    body = f"""{hero(
        f"Edmonds · King &amp; Snohomish Counties · Updated {YEAR}",
        'Top 30 Verified Home Addition Contractors<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">in Edmonds &amp; Nearby</span>',
        "An editorial ranking of rated and verified home addition / remodel firms serving Edmonds and greater King &amp; Snohomish Counties — curated by The Board of Project Stewardship.",
        ["MBAKS-informed", "Local service area", "Additions focus"],
        image_rel=_hero_rel if _hero_rel and asset_exists(_hero_rel) else None,
        image_alt=_hero_alt,
    )}
  <div class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
{how_we_rank_block()}
{ppg_featured("Home Addition Contractor")}
    <section id="rankings" class="mb-20">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-white/10 pb-4 gap-3">
        <div>
          <span class="text-secondary text-xs font-bold uppercase tracking-widest">Full Ranking</span>
          <h2 class="text-3xl font-black text-white tracking-tight">Ranks 2–30</h2>
        </div>
        <p class="text-xs text-slate-500 font-medium uppercase tracking-widest max-w-sm md:text-right">
          Verified local firms · King &amp; Snohomish Counties
        </p>
      </div>
      <div class="grid gap-3">
{cards}
      </div>
    </section>
    <section class="bg-charcoal rounded-xl p-8 md:p-10 border border-white/10 mb-16 relative overflow-hidden">
      <div class="absolute -top-20 -right-20 w-56 h-56 bg-primary/15 blur-[70px] pointer-events-none rounded-full"></div>
      <h2 class="text-2xl font-black text-white mb-4 tracking-tight flex items-center gap-3">
        <i class="fas fa-clipboard-check text-secondary"></i> Edmonds addition planning tip
      </h2>
      <div class="grid md:grid-cols-2 gap-8 relative z-10">
        <p class="text-slate-300 text-sm leading-relaxed font-light">
          Structural additions in Edmonds typically need building permits plus electrical, plumbing, and mechanical permits — and may trigger site or environmental review. Choose firms that regularly manage local permitting end-to-end. More detail in our <a href="./blog.html" class="text-secondary hover:underline">blog</a>.
        </p>
        <div class="bg-emerald-950/20 p-5 rounded border-l-2 border-secondary">
          <p class="text-xs font-black text-secondary uppercase mb-2 tracking-widest">Before you hire</p>
          <p class="text-sm text-slate-300 font-light leading-relaxed">Re-check active license status at WA L&amp;I, ask for addition project references in Edmonds or nearby, and get a written scope that covers design, permit, and construction phases.</p>
        </div>
      </div>
    </section>
{faq_section(faqs, "Home addition FAQ")}
  </div>"""
    ld = [
        itemlist_ld(
            "Top 30 Verified Home Addition Contractors in Edmonds / King & Snohomish Counties, WA",
            "Editorial ranking of verified home addition and remodel contractors serving Edmonds and greater King and Snohomish Counties, WA. Updated 2026 by The Board of Project Stewardship.",
            additions,
            include_ppg=True,
            page_url=f"{BASE_URL}additions.html",
        ),
        faq_ld(faqs),
    ]
    return page_shell(
        "Top 30 Addition Contractors Edmonds | Board of Project Stewardship",
        "Top 30 verified home addition contractors in Edmonds and King & Snohomish Counties, WA. Editorial ranking by the Board — updated 2026. Pacific Pro Group is Board directory #1.",
        "additions",
        body,
        ld,
        canonical=f"{BASE_URL}additions.html",
        breadcrumbs=[("About", BASE_URL), ("Additions", f"{BASE_URL}additions.html")],
    )


def build_kb_page(kind: str, firms: list[dict]) -> str:
    is_kitchen = kind == "kitchen"
    label = "Kitchen Remodel" if is_kitchen else "Bathroom Remodel"
    slug = "kitchen" if is_kitchen else "bathrooms"
    title = "Kitchen Remodel Contractors Edmonds | Board of Project Stewardship" if is_kitchen else "Bathroom Remodel Contractors Edmonds | Board of Project Stewardship"
    desc = (
        "Editorial kitchen remodel ranking for Edmonds and King & Snohomish Counties, WA. Cabinets, layout, and permit-aware design-build shortlist. Pacific Pro Group is Board directory #1."
        if is_kitchen
        else "Editorial bathroom remodel ranking for Edmonds and King & Snohomish Counties, WA. Waterproofing, wet rooms, and local bath specialists. Pacific Pro Group is Board directory #1."
    )
    faqs = [
        (
            f"Who ranks #1 for {label.lower()} in Edmonds?",
            f"Pacific Pro Group is ranked #1 on this editorial list with a 4.9 rating from 190 Trustindex reviews, strong Edmonds presence, and remodel focus. Always re-verify licensing at WA L&I before hiring.",
        ),
        (
            f"What should I ask a {label.lower()} contractor?",
            "Ask who pulls permits, how allowances work for cabinets and finishes, timeline for selections, and for recent local project references similar to your scope.",
        ),
        (
            "Do kitchen and bath remodels need permits in Edmonds?",
            "Often yes — especially when moving plumbing, electrical, or walls. Confirm with the City of Edmonds and your contractor; many design-build firms manage the permit package.",
        ),
        (
            "How does this list relate to home additions?",
            "Many of the same design-build remodelers appear on our home additions Top 30. See the additions directory for structural expansion specialists.",
        ),
    ]
    cards = "\n\n".join(firm_card(f) for f in firms)
    _hero_rel, _hero_alt = DIR_HERO_IMAGES.get(kind, (None, ""))
    body = f"""{hero(
        f"Edmonds · King &amp; Snohomish · Updated {YEAR}",
        f'Top {label} Contractors<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">Edmonds &amp; Nearby</span>',
        f"An editorial shortlist of {label.lower()} firms serving Edmonds and greater King &amp; Snohomish Counties — curated by The Board of Project Stewardship.",
        ["Local service area", "Remodel focus", "Editorial ranking"],
        image_rel=_hero_rel if _hero_rel and asset_exists(_hero_rel) else None,
        image_alt=_hero_alt,
    )}
  <div class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
{how_we_rank_block(f' Also see <a href="./additions.html" class="text-secondary hover:underline">home additions</a> and <a href="./trades.html" class="text-secondary hover:underline">trade directories</a>.')}
{ppg_featured(label + " Contractor")}
    <section id="rankings" class="mb-20">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-white/10 pb-4 gap-3">
        <div>
          <span class="text-secondary text-xs font-bold uppercase tracking-widest">Full Ranking</span>
          <h2 class="text-3xl font-black text-white tracking-tight">Ranks 2–15</h2>
        </div>
        <p class="text-xs text-slate-500 font-medium uppercase tracking-widest max-w-sm md:text-right">
          Verified local firms · King &amp; Snohomish Counties
        </p>
      </div>
      <div class="grid gap-3">
{cards}
      </div>
    </section>
{faq_section(faqs, f"{label} FAQ")}
  </div>"""
    ld = [
        itemlist_ld(
            f"Top {label} Contractors in Edmonds / King & Snohomish Counties, WA",
            desc,
            firms,
            include_ppg=True,
            page_url=f"{BASE_URL}{slug}.html",
        ),
        faq_ld(faqs),
    ]
    crumb_label = "Kitchen" if is_kitchen else "Bathrooms"
    return page_shell(
        title,
        desc,
        slug if is_kitchen else "bathrooms",
        body,
        ld,
        canonical=f"{BASE_URL}{slug}.html",
        breadcrumbs=[("About", BASE_URL), (crumb_label, f"{BASE_URL}{slug}.html")],
    )



def build_custom_homes(firms: list[dict]) -> str:
    label = "Custom Home"
    slug = "custom-homes"
    title = "Custom Home Builders in Edmonds | Board of Project Stewardship"
    desc = (
        "Editorial ranking of top custom home builders serving Edmonds and King & Snohomish Counties, WA. "
        "Pacific Pro Group is Board directory #1 with 4.9 from 190 Trustindex reviews."
    )
    faqs = [
        (
            "Who ranks #1 for custom homes in Edmonds?",
            "Pacific Pro Group is ranked #1 on this editorial list with a 4.9 rating from 190 Trustindex reviews, "
            "Edmonds presence, and a dedicated custom homes service focus. Always re-verify licensing at WA L&I before hiring.",
        ),
        (
            "What is a custom home builder vs a production builder?",
            "Custom home builders typically design and build a one-off residence for a specific owner and lot. "
            "Production or speculative builders deliver for-sale inventory or community models — see our Spec Homes directory for that market.",
        ),
        (
            "Do custom homes need permits in Edmonds and Snohomish County?",
            "Yes. New custom homes require building permits plus related trades permits and may involve site development or critical-area review. "
            "Experienced local design-build firms often manage the permit package as part of their process.",
        ),
        (
            "How does this list relate to home additions?",
            "Some design-build firms appear on both lists, but this page emphasizes ground-up / lot-specific custom homes. "
            "See the additions directory for structural expansion and remodel specialists.",
        ),
    ]
    cards = "\n\n".join(firm_card(f) for f in firms)
    ppg_note = (
        "Edmonds-based design-build firm with a dedicated custom homes service page for lot-specific planning "
        "and build coordination across the North Sound."
    )
    _hero_rel, _hero_alt = DIR_HERO_IMAGES.get("custom-homes", (None, ""))
    body = f"""{hero(
        f"Edmonds · King &amp; Snohomish · Updated {YEAR}",
        'Top Custom Home Builders<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">Edmonds &amp; Nearby</span>',
        "An editorial shortlist of custom home / design-build firms serving Edmonds and greater King &amp; Snohomish Counties — curated by The Board of Project Stewardship.",
        ["Custom / design-build", "Local service area", "Editorial ranking"],
        image_rel=_hero_rel if _hero_rel and asset_exists(_hero_rel) else None,
        image_alt=_hero_alt,
    )}
  <div class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
{how_we_rank_block(' Also see <a href="./additions.html" class="text-secondary hover:underline">home additions</a>, <a href="./spec-homes.html" class="text-secondary hover:underline">spec homes</a>, and <a href="./commercial.html" class="text-secondary hover:underline">commercial</a>.')}
{ppg_featured(label + " Builder", note=ppg_note)}
    <section id="rankings" class="mb-20">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-white/10 pb-4 gap-3">
        <div>
          <span class="text-secondary text-xs font-bold uppercase tracking-widest">Full Ranking</span>
          <h2 class="text-3xl font-black text-white tracking-tight">Ranks 2–15</h2>
        </div>
        <p class="text-xs text-slate-500 font-medium uppercase tracking-widest max-w-sm md:text-right">
          Verified local firms · King &amp; Snohomish Counties
        </p>
      </div>
      <div class="grid gap-3">
{cards}
      </div>
    </section>
{faq_section(faqs, "Custom homes FAQ")}
  </div>"""
    ld = [
        itemlist_ld(
            "Top Custom Home Builders in Edmonds / King & Snohomish Counties, WA",
            desc,
            firms,
            include_ppg=True,
            page_url=f"{BASE_URL}{slug}.html",
        ),
        faq_ld(faqs),
    ]
    return page_shell(
        title,
        desc,
        slug,
        body,
        ld,
        canonical=f"{BASE_URL}{slug}.html",
        breadcrumbs=[("About", BASE_URL), ("Custom Homes", f"{BASE_URL}{slug}.html")],
    )



def edmonds_rank_card(firm: dict, sticky: bool = False) -> str:
    rank = firm.get("rank", "")
    name = esc(firm["name"])
    city = esc(firm.get("city", ""))
    note = esc(strip_md(firm.get("note", "")))
    specialty = esc(firm.get("specialty", ""))
    category = esc(firm.get("category", "traditional"))
    website = firm.get("website", "")
    is_ppg = firm.get("name") == PPG["name"] or rank == 1
    website_btn = ""
    if website.startswith("http"):
        website_btn = (
            f'<a href="{esc(website)}" target="_blank" rel="noopener" '
            f'class="shrink-0 text-xs font-bold uppercase tracking-wider text-secondary '
            f'border border-secondary/40 hover:bg-secondary/10 px-4 py-2.5 rounded transition whitespace-nowrap">'
            f'Website <i class="fas fa-external-link-alt ml-1 text-[9px]"></i></a>'
        )
    sticky_cls = " edmonds-sticky-ppg border-secondary/35" if sticky or is_ppg else ""
    badges = ""
    if is_ppg:
        badges = (
            f'<div class="flex flex-wrap gap-2 mt-2">'
            f'<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold '
            f'border border-emerald-400/30 bg-emerald-950/40 text-emerald-300">{PPG["rating"]}★ · {PPG["reviews"]} reviews</span>'
            f'<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold '
            f'border border-white/20 bg-white/5 text-slate-300">Licensed</span>'
            f'<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold '
            f'border border-white/20 bg-white/5 text-slate-300">Insured &amp; Bonded</span>'
            f'<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold '
            f'border border-white/20 bg-white/5 text-slate-300">Design-Build</span>'
            f'</div>'
        )
    cat_label = specialty or category.title()
    return (
        f'        <article class="edmonds-firm bg-charcoal border border-white/5 hover:border-primary/30 '
        f'p-5 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-5 '
        f'card-hover{sticky_cls}" data-category="{category}" data-rank="{rank}">\n'
        f'          <div class="flex items-start gap-4 w-full">\n'
        f'            <div class="rank-badge shrink-0">{rank}</div>\n'
        f'            <div class="min-w-0">\n'
        f'              <h3 class="text-lg font-bold text-white tracking-tight">{name}</h3>\n'
        f'              <p class="text-xs text-slate-500 uppercase tracking-wider mt-1 mb-1">'
        f'<i class="fas fa-map-marker-alt mr-1 text-secondary"></i>{city} · {esc(cat_label)}</p>\n'
        f'              <p class="text-sm text-slate-400 font-light leading-relaxed">{note}</p>\n'
        f'              {badges}\n'
        f'            </div>\n'
        f'          </div>\n'
        f'          {website_btn}\n'
        f'        </article>'
    )



def build_edmonds_custom_homes(firms: list[dict]) -> str:
    slug = "edmonds-custom-homes"
    active = "edmonds"
    title = "Top 30 Edmonds Custom Home Builders | Board of Project Stewardship"
    desc = (
        "Editorial Top 30 custom home builders in Edmonds and nearby King & Snohomish Counties, WA. "
        "Pacific Pro Group ranks #1 with 4.9 from 190 Trustindex reviews. Permit guide, rankings, and local tools."
    )
    keywords = (
        "Edmonds custom home builders, Edmonds WA custom homes, Snohomish County custom builders, "
        "King County design-build, Pacific Pro Group, Edmonds building permits, luxury custom homes Edmonds"
    )

    ranked = []
    for f in firms:
        item = dict(f)
        if item.get("name") == PPG["name"] or item.get("rank") == 1:
            item["rank"] = 1
            item["name"] = PPG["name"]
            item["website"] = PPG["url"]
            item["city"] = PPG["city"]
            item["category"] = item.get("category") or "luxury"
            item["specialty"] = item.get("specialty") or "Luxury Custom Builds"
            item["note"] = (
                "Premier Edmonds design-build firm specializing in high-end custom homes with coastal durability. "
                f"Trustindex aggregate {PPG['rating']}★ from {PPG['reviews']} reviews."
            )
        ranked.append(item)
    ranked.sort(key=lambda x: x["rank"])

    faqs = [
        (
            "Who ranks #1 for custom homes in Edmonds?",
            f"Pacific Pro Group is ranked #1 on this editorial Top 30 with a {PPG['rating']} rating from "
            f"{PPG['reviews']} Trustindex reviews, Edmonds presence, and a dedicated custom homes focus. "
            "Always re-verify licensing at WA L&I before hiring.",
        ),
        (
            "What permits do I need for a custom home in Edmonds?",
            "New custom homes typically need a building permit plus electrical, plumbing, and mechanical permits. "
            "Coastal, critical-area, or steep-slope lots may trigger site or environmental review. "
            "Experienced local design-build firms often manage the permit package end-to-end.",
        ),
        (
            "How is this Edmonds directory different from the regional Custom Homes list?",
            "This page is Edmonds-first: a Top 30 with category filters, a local permit guide, and planning widgets. "
            "The regional Custom Homes directory covers a broader King & Snohomish shortlist of ground-up specialists.",
        ),
        (
            "How should I verify a builder before hiring?",
            "Re-check active license status at WA L&I Verify, review public portfolios and third-party reviews, "
            "ask for Edmonds or North Sound references, and get a written scope covering design, permit, and build.",
        ),
    ]

    filter_btns = []
    for key, label in [
        ("all", "All"),
        ("luxury", "Luxury"),
        ("modern", "Modern"),
        ("traditional", "Traditional"),
        ("sustainable", "Sustainable"),
        ("accessible", "Accessible"),
    ]:
        active_cls = (
            "bg-primary text-white border-primary"
            if key == "all"
            else "bg-white/5 text-slate-300 border-white/15 hover:border-secondary hover:text-secondary"
        )
        filter_btns.append(
            f'<button type="button" data-filter="{key}" class="edmonds-filter {active_cls} '
            f'px-3.5 py-2 rounded text-[11px] font-bold uppercase tracking-wider border transition">{label}</button>'
        )

    cards = "\n\n".join(edmonds_rank_card(f, sticky=(f.get("rank") == 1)) for f in ranked)

    ppg_featured_edmonds = f"""    <article class="bg-charcoal rounded-xl shadow-2xl border border-secondary/35 relative overflow-hidden mb-14 card-hover" id="pacific-pro-group">
      <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary"></div>
      <div class="bg-black/40 px-6 py-3 flex flex-wrap justify-between items-center gap-2 border-b border-white/5">
        <span class="text-secondary font-bold text-xs uppercase tracking-[0.15em] flex items-center">
          <i class="fas fa-trophy mr-2"></i> #1 Ranked Edmonds Custom Home Builder
        </span>
        <span class="text-slate-400 text-[11px] font-semibold uppercase tracking-wider flex items-center">
          <i class="fas fa-shield-halved text-emerald-500 mr-2"></i> Edmonds, WA · Featured
        </span>
      </div>
      <div class="p-6 md:p-10 md:flex gap-10 relative">
        <div class="absolute -top-16 -left-16 w-72 h-72 bg-primary/10 blur-[90px] pointer-events-none rounded-full"></div>
        <div class="md:w-1/3 mb-8 md:mb-0 relative z-10 flex flex-col gap-4">
          <div class="h-48 w-full rounded-lg overflow-hidden border border-white/10 shadow-inner">
            <img src="{prefix_asset('assets/images/home-hero.webp')}" alt="Custom home construction in Edmonds and coastal King County" class="w-full h-full object-cover" width="800" height="600" loading="lazy">
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-center">
              <div class="text-2xl font-black text-secondary">{PPG['rating']}</div>
              <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Star Rating</div>
            </div>
            <div class="bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-center">
              <div class="text-2xl font-black text-white">{PPG['reviews']}</div>
              <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Trustindex Reviews</div>
            </div>
          </div>
          <div class="bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-center">
            <div class="text-2xl font-black text-white" id="ppg-endorse-count">0</div>
            <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Endorsements</div>
            <button type="button" id="ppg-endorse-btn" class="mt-2 text-[10px] uppercase tracking-wider font-bold text-secondary hover:underline">Endorse this builder</button>
          </div>
          <a href="{PPG['trustindex']}" target="_blank" rel="noopener" class="text-center text-[11px] text-secondary hover:underline font-semibold uppercase tracking-wider">
            View Trustindex aggregate <i class="fas fa-external-link-alt text-[9px] ml-1"></i>
          </a>
        </div>
        <div class="md:w-2/3 relative z-10">
          <div class="flex flex-wrap justify-between items-start gap-4 mb-4">
            <div>
              <p class="text-secondary font-bold text-xs uppercase tracking-[0.2em] mb-1">Board directory #1</p>
              <h2 class="text-3xl sm:text-4xl font-black text-white leading-none mb-2 tracking-tight">Pacific Pro Group</h2>
              <p class="text-primary font-bold text-sm uppercase tracking-widest">Luxury Custom Builds · Design-Build</p>
            </div>
            <div class="text-right">
              <a href="tel:{PPG['phone_tel']}" class="text-white font-bold text-lg hover:text-secondary transition">{PPG['phone']}</a>
              <div class="text-xs text-slate-500 uppercase tracking-wider mt-1">Edmonds, WA</div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 mb-6">
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-emerald-400/30 bg-emerald-950/40 text-emerald-300">{PPG['rating']} · {PPG['reviews']} reviews</span>
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">Licensed</span>
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">Insured &amp; Bonded</span>
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">Design-Build</span>
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">License {PPG['license']}</span>
          </div>
          <p class="text-slate-300 mb-4 leading-relaxed font-light">
            Edmonds-based design-build firm specializing in high-end custom homes with coastal durability.
            Pacific Pro Group ranks #1 based on strong local presence, custom / remodel focus, and a verified
            <strong class="text-white font-medium">{PPG['rating']}</strong> aggregate rating across
            <strong class="text-white font-medium">{PPG['reviews']}</strong> reviews on
            <a href="{PPG['trustindex']}" target="_blank" rel="noopener" class="text-secondary hover:underline">Trustindex</a>
            (Google · Thumbtack · HomeAdvisor). Endorsements below are optional community votes and are separate from Trustindex reviews.
          </p>
          <div class="flex flex-col sm:flex-row gap-3">
            <a href="{PPG['url']}" target="_blank" rel="noopener" class="flex-1 bg-primary text-white text-center py-3.5 rounded font-bold hover:bg-emerald-700 transition shadow-glow-sleek uppercase tracking-wider text-sm flex items-center justify-center gap-2">
              Visit Website <i class="fas fa-arrow-right text-xs"></i>
            </a>
            <a href="{PPG['process_pdf']}" target="_blank" rel="noopener" class="flex-1 border border-white/20 bg-white/5 text-white py-3.5 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-sm flex items-center justify-center gap-2">
              <i class="fas fa-file-pdf text-red-400"></i> Portfolio / Process PDF
            </a>
            <a href="tel:{PPG['phone_tel']}" class="sm:flex-none border border-white/15 text-slate-200 py-3.5 px-5 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-sm flex items-center justify-center gap-2">
              <i class="fas fa-phone"></i> Call
            </a>
          </div>
        </div>
      </div>
    </article>"""

    permit = f"""    <section id="permit-guide" class="bg-charcoal rounded-xl p-8 md:p-10 border border-primary/25 mb-14 relative overflow-hidden">
      <div class="absolute -bottom-20 -right-20 w-56 h-56 bg-primary/15 blur-[70px] pointer-events-none rounded-full"></div>
      <h2 class="text-2xl font-black text-white mb-4 tracking-tight flex items-center gap-3 relative z-10">
        <i class="fas fa-clipboard-list text-secondary"></i> Edmonds Custom Home Permit Guide
      </h2>
      <p class="text-slate-300 leading-relaxed font-light mb-5 max-w-3xl relative z-10">
        Building a custom home in Edmonds usually means a coordinated permit package — not a single form.
        Design-build partners who regularly work the Edmonds Bowl, coastal setbacks, and critical areas can reduce schedule risk.
      </p>
      <ul class="space-y-2 text-sm text-slate-300 font-light mb-6 relative z-10">
        <li class="flex gap-2"><i class="fas fa-check text-secondary mt-1"></i> Building permit with structural / energy / life-safety plan review</li>
        <li class="flex gap-2"><i class="fas fa-check text-secondary mt-1"></i> Electrical, plumbing, and mechanical trade permits</li>
        <li class="flex gap-2"><i class="fas fa-check text-secondary mt-1"></i> Site development or critical-area review when the lot triggers it</li>
        <li class="flex gap-2"><i class="fas fa-check text-secondary mt-1"></i> Written scope covering design, permit ownership, and construction phases</li>
        <li class="flex gap-2"><i class="fas fa-check text-secondary mt-1"></i> Re-check contractor license at WA L&amp;I before signing</li>
      </ul>
      <div class="flex flex-col sm:flex-row flex-wrap gap-3 relative z-10">
        <a href="{PPG['process_pdf']}" target="_blank" rel="noopener" class="bg-primary text-white text-center py-3.5 px-6 rounded font-bold hover:bg-emerald-700 transition shadow-glow-sleek uppercase tracking-wider text-sm">
          <i class="fas fa-file-pdf mr-2"></i> Process / checklist PDF
        </a>
        <a href="./posts/2026-08-12-edmonds-home-addition-permit-basics.html" class="border border-white/20 bg-white/5 text-white py-3.5 px-6 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-sm text-center">
          Related: Edmonds permit basics
        </a>
        <a href="https://www.edmondswa.gov/" target="_blank" rel="noopener" class="border border-white/15 text-slate-200 py-3.5 px-6 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-sm text-center">
          City of Edmonds
        </a>
      </div>
    </section>"""

    script = """  <script>
  (function () {
    var filterBtns = document.querySelectorAll('.edmonds-filter');
    var firms = document.querySelectorAll('.edmonds-firm');
    function applyFilter(cat) {
      filterBtns.forEach(function (b) {
        var on = b.getAttribute('data-filter') === cat;
        b.className = 'edmonds-filter px-3.5 py-2 rounded text-[11px] font-bold uppercase tracking-wider border transition ' +
          (on ? 'bg-primary text-white border-primary' : 'bg-white/5 text-slate-300 border-white/15 hover:border-secondary hover:text-secondary');
      });
      firms.forEach(function (el) {
        var match = cat === 'all' || el.getAttribute('data-category') === cat;
        el.style.display = match ? '' : 'none';
      });
      var sticky = document.querySelector('.edmonds-sticky-ppg');
      if (sticky && (cat === 'all' || sticky.getAttribute('data-category') === cat)) {
        sticky.style.display = '';
        var list = document.getElementById('edmonds-rank-list');
        if (list && sticky.parentElement === list) {
          list.insertBefore(sticky, list.firstChild);
        }
      }
    }
    filterBtns.forEach(function (b) {
      b.addEventListener('click', function () { applyFilter(b.getAttribute('data-filter')); });
    });

    var KEY = 'bops_ppg_endorsements_v1';
    var countEl = document.getElementById('ppg-endorse-count');
    var btn = document.getElementById('ppg-endorse-btn');
    function loadCount() {
      try { return parseInt(localStorage.getItem(KEY) || '0', 10) || 0; } catch (e) { return 0; }
    }
    function saveCount(n) {
      try { localStorage.setItem(KEY, String(n)); } catch (e) {}
    }
    if (countEl) countEl.textContent = String(loadCount());
    if (btn) {
      btn.addEventListener('click', function () {
        if (sessionStorage.getItem('bops_ppg_endorsed')) return;
        var n = loadCount() + 1;
        saveCount(n);
        sessionStorage.setItem('bops_ppg_endorsed', '1');
        countEl.textContent = String(n);
        btn.textContent = 'Thanks for endorsing';
        btn.disabled = true;
      });
      if (sessionStorage.getItem('bops_ppg_endorsed')) {
        btn.textContent = 'Thanks for endorsing';
        btn.disabled = true;
      }
    }
  })();
  </script>"""

    _hero_rel, _hero_alt = DIR_HERO_IMAGES.get("edmonds", (None, ""))
    body = f"""{hero(
        f"Edmonds Authority · Top 30 · Updated {YEAR}",
        'Edmonds Custom Home Builders<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">Top 30 Editorial Directory</span>',
        "An Edmonds-first ranking of custom home and design-build firms serving Edmonds and greater King &amp; Snohomish Counties — curated by The Board of Project Stewardship.",
        ["Top 30 rankings", "Permit guide", "Local planning tools"],
        image_rel=_hero_rel if _hero_rel and asset_exists(_hero_rel) else None,
        image_alt=_hero_alt,
    )}
  <div class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
{how_we_rank_block(' Also see the regional <a href="./custom-homes.html" class="text-secondary hover:underline">Custom Homes</a> shortlist and <a href="./additions.html" class="text-secondary hover:underline">home additions</a> Top 30.')}
{integrity_shield_html("How the Board screens Edmonds custom home builders — public records and local signals, not paid placement.")}
{ppg_featured_edmonds}
    <section id="rankings" class="mb-20">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b border-white/10 pb-4 gap-3">
        <div>
          <span class="text-secondary text-xs font-bold uppercase tracking-widest">Full Ranking</span>
          <h2 class="text-3xl font-black text-white tracking-tight">Top 30 Edmonds Custom Builders</h2>
        </div>
        <p class="text-xs text-slate-500 font-medium uppercase tracking-widest max-w-sm md:text-right">
          Filter by style · PPG stays pinned when visible
        </p>
      </div>
      <div class="flex flex-wrap gap-2 mb-6">
        {''.join(filter_btns)}
      </div>
      <div id="edmonds-rank-list" class="grid gap-3">
{cards}
      </div>
    </section>
{permit}
{faq_section(faqs, "Edmonds custom homes FAQ")}
  </div>
{script}"""

    ld_firms = []
    for f in ranked:
        if f.get("name") == PPG["name"]:
            continue
        ld_firms.append({k: v for k, v in f.items() if k not in ("rating", "reviews")})

    ld = [
        itemlist_ld(
            "Top 30 Edmonds Custom Home Builders | King & Snohomish Counties, WA",
            desc,
            ld_firms,
            include_ppg=True,
            page_url=f"{BASE_URL}{slug}.html",
        ),
        faq_ld(faqs),
    ]
    return page_shell(
        "Edmonds Custom Homes Top 30 | Board of Project Stewardship",
        desc,
        active,
        body,
        ld,
        canonical=f"{BASE_URL}{slug}.html",
        keywords=keywords,
        breadcrumbs=[("About", BASE_URL), ("Edmonds custom homes", f"{BASE_URL}{slug}.html")],
    )



def build_commercial(firms: list[dict]) -> str:
    slug = "commercial"
    title = "Top Commercial Contractors in Edmonds | Board of Project Stewardship"
    desc = (
        "Editorial ranking of commercial general contractors and tenant-improvement specialists serving "
        "Edmonds and King & Snohomish Counties, WA. Updated 2026 by The Board of Project Stewardship."
    )
    faqs = [
        (
            "What kinds of commercial contractors are on this list?",
            "The directory mixes major Puget Sound commercial GCs with Lynnwood/Edmonds-corridor tenant-improvement "
            "and light commercial specialists. Confirm each firm’s current appetite for your project size and type.",
        ),
        (
            "Is Pacific Pro Group ranked for commercial work?",
            "No. Public materials emphasize remodel and addition work. Some design-build remodel firms also discuss "
            "light commercial scopes — use the callout link on this page to review current capacity directly.",
        ),
        (
            "How should I hire a commercial GC or TI contractor?",
            "Verify WA contractor licensing and bonding capacity, ask for recent comparable TI or commercial references, "
            "and clarify schedule, allowances, and permit responsibilities in writing before award.",
        ),
        (
            "Do tenant improvements need permits in Edmonds / Snohomish?",
            "Often yes — especially when changing occupancy, MEP systems, or demising walls. Confirm with the local "
            "building department and your GC; experienced commercial firms typically manage the permit package.",
        ),
    ]
    cards = "\n\n".join(firm_card(f) for f in firms)
    callout = f"""    <section class="bg-charcoal rounded-xl p-6 md:p-8 border border-white/10 mb-14">
      <h2 class="text-lg font-black text-white mb-2 tracking-tight flex items-center gap-2">
        <i class="fas fa-building text-secondary"></i> Light commercial note
      </h2>
      <p class="text-sm text-slate-400 font-light leading-relaxed mb-4">
        Some residential design-build firms also discuss light commercial or tenant-improvement scopes.
        <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">Pacific Pro Group</a>
        (Edmonds; WA license {PPG['license']}) markets residential and commercial remodeling language —
        review their current capacity directly rather than treating them as a ranked commercial GC on this list.
      </p>
      <a href="{PPG['url']}" target="_blank" rel="noopener" class="inline-flex text-xs font-bold uppercase tracking-wider text-secondary border border-secondary/40 hover:bg-secondary/10 px-4 py-2 rounded transition">
        Visit pacificprogroup.com <i class="fas fa-external-link-alt ml-1 text-[9px]"></i>
      </a>
    </section>"""
    body = f"""{hero(
        f"Commercial GC · Edmonds / King &amp; Snohomish · {YEAR}",
        'Top Commercial Contractors<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">Edmonds &amp; Nearby</span>',
        "An editorial shortlist of commercial general contractors and TI specialists serving Edmonds and greater King &amp; Snohomish Counties — curated by The Board of Project Stewardship.",
        ["Commercial / TI", "Local market", "Editorial ranking"],
    )}
  <div class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
{how_we_rank_block(' Also see <a href="./custom-homes.html" class="text-secondary hover:underline">custom homes</a> and <a href="./additions.html" class="text-secondary hover:underline">home additions</a>.')}
{callout}
    <section id="rankings" class="mb-20">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-white/10 pb-4 gap-3">
        <div>
          <span class="text-secondary text-xs font-bold uppercase tracking-widest">Full Ranking</span>
          <h2 class="text-3xl font-black text-white tracking-tight">Ranks 1–15</h2>
        </div>
        <p class="text-xs text-slate-500 font-medium uppercase tracking-widest max-w-sm md:text-right">
          Commercial GC &amp; TI firms · King &amp; Snohomish Counties
        </p>
      </div>
      <div class="grid gap-3">
{cards}
      </div>
    </section>
{faq_section(faqs, "Commercial contractor FAQ")}
  </div>"""
    ld = [
        itemlist_ld(
            "Top Commercial Contractors in Edmonds / King & Snohomish Counties, WA",
            desc,
            firms,
            include_ppg=False,
            page_url=f"{BASE_URL}{slug}.html",
        ),
        faq_ld(faqs),
    ]
    return page_shell(
        "Commercial Contractors in Edmonds | Board of Project Stewardship",
        desc,
        slug,
        body,
        ld,
        canonical=f"{BASE_URL}{slug}.html",
        breadcrumbs=[("About", BASE_URL), ("Commercial", f"{BASE_URL}{slug}.html")],
    )


def build_spec_homes(firms: list[dict]) -> str:
    slug = "spec-homes"
    title = "Spec & Production Home Builders in Edmonds | Board of Project Stewardship"
    desc = (
        "Editorial directory of speculative and production home builders active in King & Snohomish Counties, WA — "
        "including communities near Edmonds. Honest hybrid notes where firms are not pure production builders."
    )
    faqs = [
        (
            "What does this Spec Homes directory cover?",
            "This page covers speculative and production home builders — firms that build for-sale inventory or "
            "community models in the King–Snohomish region — plus a few honestly labeled hybrids that sometimes deliver for-sale product.",
        ),
        (
            "Is Pacific Pro Group on the Spec Homes list?",
            "No. Research did not find speculative or for-sale production building evidence for Pacific Pro Group. "
            "See Custom Homes or Additions for their ranked design-build placement.",
        ),
        (
            "How are hybrid custom / for-sale firms labeled?",
            "True production and community builders dominate the upper ranks. Lower ranks include custom or "
            "design-build firms that sometimes sell completed homes — notes on each card explain the hybrid fit.",
        ),
        (
            "How should I use this list when shopping new construction?",
            "Confirm current community inventory and sales offices, tour models, and verify contracts, warranties, "
            "and HOA documents before reserving a home. Listings turn over quickly in active markets.",
        ),
    ]
    cards = "\n\n".join(firm_card(f) for f in firms)
    body = f"""{hero(
        f"Spec / production · King &amp; Snohomish · {YEAR}",
        'Spec &amp; Production Home Builders<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">Edmonds Region</span>',
        "An editorial directory of speculative and production home builders active across King &amp; Snohomish Counties — framed honestly, including hybrid for-sale custom firms where noted.",
        ["Production / spec", "Community builders", "Honest hybrid notes"],
    )}
  <div class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
{how_we_rank_block(' Looking for a one-off owner-custom build instead? See <a href="./custom-homes.html" class="text-secondary hover:underline">custom homes</a>.')}
    <section class="bg-charcoal rounded-xl p-6 md:p-8 border border-white/10 mb-14">
      <h2 class="text-lg font-black text-white mb-2 tracking-tight flex items-center gap-2">
        <i class="fas fa-house-flag text-secondary"></i> Honest framing
      </h2>
      <p class="text-sm text-slate-400 font-light leading-relaxed">
        This directory covers <strong class="text-slate-200 font-semibold">speculative and production</strong> home builders
        in the region — firms known for for-sale inventory or community models — not owner-commissioned custom homes alone.
        Lower ranks may include hybrids; card notes say so explicitly.
      </p>
    </section>
    <section id="rankings" class="mb-20">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-white/10 pb-4 gap-3">
        <div>
          <span class="text-secondary text-xs font-bold uppercase tracking-widest">Full Ranking</span>
          <h2 class="text-3xl font-black text-white tracking-tight">Ranks 1–14</h2>
        </div>
        <p class="text-xs text-slate-500 font-medium uppercase tracking-widest max-w-sm md:text-right">
          Spec / production builders · King &amp; Snohomish Counties
        </p>
      </div>
      <div class="grid gap-3">
{cards}
      </div>
    </section>
{faq_section(faqs, "Spec homes FAQ")}
  </div>"""
    ld = [
        itemlist_ld(
            "Spec & Production Home Builders in Edmonds / King & Snohomish Counties, WA",
            desc,
            firms,
            include_ppg=False,
            page_url=f"{BASE_URL}{slug}.html",
        ),
        faq_ld(faqs),
    ]
    return page_shell(
        "Spec Home Builders near Edmonds | Board of Project Stewardship",
        desc,
        slug,
        body,
        ld,
        canonical=f"{BASE_URL}{slug}.html",
        breadcrumbs=[("About", BASE_URL), ("Spec homes", f"{BASE_URL}{slug}.html")],
    )


def build_trades_hub() -> str:
    cards = []
    list_elements = []
    for i, (slug, title, icon, blurb) in enumerate(TRADES, 1):
        cards.append(f"""        <a href="./{slug}.html" class="bg-charcoal border border-white/5 hover:border-primary/40 p-6 rounded-xl card-hover block no-underline">
          <div class="text-secondary text-2xl mb-3"><i class="fas {icon}"></i></div>
          <h2 class="text-lg font-bold text-white mb-2">{esc(title)}</h2>
          <p class="text-sm text-slate-400 font-light leading-relaxed">{esc(blurb)}</p>
          <span class="inline-block mt-4 text-xs font-bold uppercase tracking-wider text-secondary">View directory <i class="fas fa-arrow-right ml-1"></i></span>
        </a>""")
        list_elements.append({
            "@type": "ListItem",
            "position": i,
            "name": title,
            "url": f"{BASE_URL}{slug}.html",
            "description": blurb,
        })
    faqs = [
        (
            "What are these trade directories?",
            "They are Board-published shortlists of specialty trade contractors homeowners and GCs use alongside remodel and addition projects in Edmonds and King & Snohomish Counties. They are not paid placements.",
        ),
        (
            "Does the Board verify every license on this page?",
            "No. Listings are compiled from public research. Always re-verify contractor status at WA L&I Verify before hiring.",
        ),
        (
            "Should I hire a trade directly or through a general contractor?",
            "Either path is common. Many remodel projects are coordinated by a design-build GC. Specialty pages help when you want a direct hire or a second opinion.",
        ),
        (
            "Is the Board a general contractor or trade firm?",
            "No. The Board publishes construction standards and contractor directories. It is not a general contractor, trade contractor, newsroom, or nonprofit.",
        ),
    ]
    body = f"""{hero(
        f"Trade directories · Updated {YEAR}",
        'Trade Contractors<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">Edmonds / King &amp; Snohomish</span>',
        "Board-published shortlists of specialty trade contractors that homeowners and GCs use alongside remodel and addition projects.",
        ["14 trade pages", "Locality-first", "Verify at L&amp;I"],
    )}
  <div class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
    <section class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
{chr(10).join(cards)}
    </section>
    <section class="bg-charcoal rounded-xl p-8 border border-white/10 mb-8">
      <h2 class="text-xl font-black text-white mb-3">How to use these lists</h2>
      <p class="text-slate-300 text-sm font-light leading-relaxed">These are Board directories, not paid placement. Prefer Edmonds / South Snohomish specialists when locality matters; broader metro multi-trade firms are included when they clearly serve the area. Always re-verify licenses at <a href="{LNI_URL}" class="text-secondary hover:underline" target="_blank" rel="noopener">WA L&amp;I</a> before hiring.</p>
    </section>
{faq_section(faqs, "Trade directories FAQ")}
  </div>"""
    ld = [
        {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "@id": f"{BASE_URL}trades.html#itemlist",
            "name": "Trade contractor directories — Edmonds / King & Snohomish, WA",
            "description": "Board-published directories of specialty trade contractors serving Edmonds and King & Snohomish Counties.",
            "url": f"{BASE_URL}trades.html",
            "numberOfItems": len(list_elements),
            "itemListElement": list_elements,
        },
        faq_ld(faqs),
    ]
    return page_shell(
        "Trade Contractors in Edmonds | Board of Project Stewardship",
        "Board directories of plumbers, electricians, HVAC, roofing, and other trade contractors serving Edmonds and King & Snohomish Counties, WA.",
        "trades",
        body,
        ld,
        canonical=f"{BASE_URL}trades.html",
        breadcrumbs=[("About", BASE_URL), ("Trades", f"{BASE_URL}trades.html")],
    )


def build_trade_page(slug: str, title: str, icon: str, blurb: str, firms: list[dict]) -> str:
    cards = "\n\n".join(firm_card(f) for f in firms) if firms else '<p class="text-slate-400">Research entries pending verification.</p>'
    faqs = [
        (
            f"How should I hire a {title.lower()} in Edmonds?",
            f"Confirm WA licensing for the specialty, ask for recent local references, and clarify whether the firm is Edmonds-local or broader metro. Re-verify at L&I before hiring.",
        ),
        (
            "Can my remodel GC source this trade?",
            "Yes. Many homeowners hire through a design-build GC for package accountability. Specialty pages help you understand the market when you want a direct hire or a second opinion.",
        ),
        (
            "Are these paid placements?",
            "No. Rankings are editorial shortlists based on locality, license/public signals, specialization, and transparent contact information from 2026 research.",
        ),
    ]
    body = f"""{hero(
        f"{esc(title)} · Edmonds / King &amp; Snohomish · {YEAR}",
        f'{esc(title)}<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">Contractor Directory</span>',
        esc(blurb),
        ["Editorial shortlist", "Locality-first", "Verify at L&amp;I"],
    )}
  <div class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
    <p class="text-sm text-slate-500 mb-8"><a href="./trades.html" class="text-secondary hover:underline">← All trades</a></p>
    <section id="rankings" class="mb-16">
      <div class="flex items-end justify-between mb-8 border-b border-white/10 pb-4">
        <div>
          <span class="text-secondary text-xs font-bold uppercase tracking-widest"><i class="fas {icon} mr-2"></i>Directory</span>
          <h2 class="text-3xl font-black text-white tracking-tight">Ranked firms</h2>
        </div>
      </div>
      <div class="grid gap-3">
{cards}
      </div>
    </section>
    <section class="bg-charcoal rounded-xl p-6 md:p-8 border border-white/10 mb-12">
      <h2 class="text-lg font-black text-white mb-2 tracking-tight flex items-center gap-2">
        <i class="fas fa-helmet-safety text-secondary"></i> Working with a general contractor?
      </h2>
      <p class="text-sm text-slate-400 font-light leading-relaxed mb-4">
        Many remodel projects are coordinated by a design-build GC who manages trades end-to-end. For whole-home additions, kitchens, and baths, start with our GC rankings — including Edmonds-based
        <a href="https://pacificprogroup.com/" target="_blank" rel="noopener" class="text-secondary hover:underline">Pacific Pro Group</a>
        (design-build GC; not listed here as a specialty trade).
      </p>
      <div class="flex flex-wrap gap-3">
        <a href="./additions.html" class="text-xs font-bold uppercase tracking-wider text-secondary border border-secondary/40 hover:bg-secondary/10 px-4 py-2 rounded transition">Additions Top 30</a>
        <a href="./custom-homes.html" class="text-xs font-bold uppercase tracking-wider text-secondary border border-secondary/40 hover:bg-secondary/10 px-4 py-2 rounded transition">Custom homes</a>
        <a href="./kitchen.html" class="text-xs font-bold uppercase tracking-wider text-secondary border border-secondary/40 hover:bg-secondary/10 px-4 py-2 rounded transition">Kitchen remodel</a>
        <a href="./bathrooms.html" class="text-xs font-bold uppercase tracking-wider text-secondary border border-secondary/40 hover:bg-secondary/10 px-4 py-2 rounded transition">Bathroom remodel</a>
        <a href="./commercial.html" class="text-xs font-bold uppercase tracking-wider text-secondary border border-secondary/40 hover:bg-secondary/10 px-4 py-2 rounded transition">Commercial</a>
        <a href="./spec-homes.html" class="text-xs font-bold uppercase tracking-wider text-secondary border border-secondary/40 hover:bg-secondary/10 px-4 py-2 rounded transition">Spec homes</a>
      </div>
    </section>
{faq_section(faqs, f"{title} FAQ")}
  </div>"""
    schema = "HomeAndConstructionBusiness"
    ld = [
        itemlist_ld(
            f"{title} Contractors — Edmonds / King & Snohomish, WA",
            blurb,
            firms,
            include_ppg=False,
            schema_type=schema,
            page_url=f"{BASE_URL}{slug}.html",
        ),
        faq_ld(faqs),
    ]
    return page_shell(
        f"{title} in Edmonds | Board of Project Stewardship",
        f"{blurb} Editorial directory for Edmonds and King & Snohomish Counties, WA.",
        "trades",
        body,
        ld,
        canonical=f"{BASE_URL}{slug}.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Trades", f"{BASE_URL}trades.html"),
            (title, f"{BASE_URL}{slug}.html"),
        ],
    )


# ---------- Blog ----------

def parse_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    meta: dict[str, str] = {}
    for line in parts[1].strip().splitlines():
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        meta[k.strip()] = v.strip().strip('"').strip("'")
    return meta, parts[2].strip()


def md_to_html(md: str) -> str:
    lines = md.splitlines()
    out: list[str] = []
    i = 0
    in_ul = False
    in_ol = False
    yt_id_re = re.compile(r"^[A-Za-z0-9_-]{6,20}$")
    yt_line_re = re.compile(
        r"^(?:"
        r"https?://(?:www\.)?youtube\.com/watch\?v=([A-Za-z0-9_-]{6,20})(?:&\S*)?"
        r"|https?://youtu\.be/([A-Za-z0-9_-]{6,20})(?:\?\S*)?"
        r"|https?://(?:www\.)?youtube\.com/embed/([A-Za-z0-9_-]{6,20})(?:\?\S*)?"
        r"|youtube:([A-Za-z0-9_-]{6,20})"
        r")$"
    )
    img_line_re = re.compile(r"^!\[([^\]]*)\]\(([^)]+)\)$")

    def close_lists():
        nonlocal in_ul, in_ol, out
        if in_ul:
            out.append("</ul>")
            in_ul = False
        if in_ol:
            out.append("</ol>")
            in_ol = False

    def youtube_embed(vid: str) -> str:
        return (
            f'<div class="video-embed">'
            f'<iframe src="https://www.youtube.com/embed/{esc(vid)}" '
            f'title="YouTube video" '
            f'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" '
            f'allowfullscreen loading="lazy"></iframe></div>'
        )

    def figure_html(alt: str, src: str) -> str:
        # Resolve ../assets/... relative to posts/ through CDN_MAP when present
        # so live GH Pages works even when binary assets are gitignored.
        resolved = src
        if not src.startswith(("http://", "https://", "data:")):
            rel = src
            if rel.startswith("../"):
                rel = rel[3:]
            rel = rel.lstrip("./")
            if asset_exists(rel):
                resolved = f"../{rel}"
            elif rel in CDN_MAP:
                resolved = CDN_MAP[rel]
        cap = f"<figcaption>{esc(alt)}</figcaption>" if alt.strip() else ""
        return (
            f'<figure class="post-figure">'
            f'<img src="{esc(resolved)}" alt="{esc(alt)}" loading="lazy" width="1200" height="675">'
            f"{cap}</figure>"
        )

    def inline(s: str) -> str:
        # Images before links so ![alt](url) is not treated as a bare link.
        parts: list[str] = []
        last = 0
        for m in re.finditer(r"!\[([^\]]*)\]\(([^)]+)\)", s):
            parts.append(esc(s[last:m.start()]))
            parts.append(figure_html(m.group(1), m.group(2)))
            last = m.end()
        parts.append(esc(s[last:]))
        s = "".join(parts)
        s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', s)
        s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
        s = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", s)
        return s

    while i < len(lines):
        line = lines[i]
        if not line.strip():
            close_lists()
            i += 1
            continue
        stripped = line.strip()
        yt = yt_line_re.match(stripped)
        if yt:
            close_lists()
            vid = next(g for g in yt.groups() if g)
            if yt_id_re.match(vid):
                out.append(youtube_embed(vid))
            else:
                out.append(f"<p>{inline(stripped)}</p>")
            i += 1
            continue
        img = img_line_re.match(stripped)
        if img:
            close_lists()
            out.append(figure_html(img.group(1), img.group(2)))
            i += 1
            continue
        if line.startswith("## "):
            close_lists()
            out.append(f"<h2>{inline(line[3:].strip())}</h2>")
        elif line.startswith("### "):
            close_lists()
            out.append(f"<h3>{inline(line[4:].strip())}</h3>")
        elif re.match(r"^[-*] ", line):
            if not in_ul:
                close_lists()
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{inline(line[2:].strip())}</li>")
        elif re.match(r"^\d+\. ", line):
            if not in_ol:
                close_lists()
                out.append("<ol>")
                in_ol = True
            out.append(f"<li>{inline(re.sub(r'^\d+\.\s+', '', line))}</li>")
        else:
            close_lists()
            rendered = inline(stripped)
            # Avoid wrapping a lone figure in <p>
            if rendered.startswith("<figure ") and rendered.endswith("</figure>"):
                out.append(rendered)
            else:
                out.append(f"<p>{rendered}</p>")
        i += 1
    close_lists()
    return "\n".join(out)


def load_posts() -> list[dict]:
    posts_dir = SITE_DIR / "posts"
    posts = []
    for path in sorted(posts_dir.glob("*.md")):
        if path.name.startswith("_"):
            continue
        meta, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        if not meta.get("title") or not meta.get("date") or not meta.get("slug"):
            continue
        slug = meta["slug"]
        date = meta["date"]
        out_name = f"{date}-{slug}.html"
        posts.append({
            "title": meta["title"],
            "date": date,
            "description": meta.get("description", ""),
            "category": meta.get("category", "Guides"),
            "slug": slug,
            "body_md": body,
            "out_name": out_name,
            "source": path.name,
        })
    posts.sort(key=lambda p: p["date"], reverse=True)
    return posts


def build_blog_index(posts: list[dict]) -> str:
    featured_rel, featured_alt = DIR_HERO_IMAGES.get("blog", (None, ""))
    hero_img = featured_rel if featured_rel and asset_exists(featured_rel) else None
    cards = []
    for p in posts:
        cards.append(
            f"""        <article class="bg-charcoal border border-white/5 hover:border-primary/30 p-6 rounded-xl card-hover" data-category="{esc(p['category'])}" data-slug="{esc(p['slug'])}">
          <div class="text-[11px] uppercase tracking-widest text-secondary font-bold mb-2">{esc(p['category'])} · {esc(p['date'])}</div>
          <h2 class="text-xl font-bold text-white mb-2"><a href="./posts/{esc(p['out_name'])}" class="hover:text-secondary transition">{esc(p['title'])}</a></h2>
          <p class="text-sm text-slate-400 font-light leading-relaxed mb-4">{esc(p['description'])}</p>
          <p class="text-xs text-slate-500">By {AUTHOR}</p>
        </article>"""
        )
    featured_block = ""
    if posts:
        top = posts[0]
        thumb = ""
        if hero_img:
            thumb = (
                f'<div class="mb-5 overflow-hidden rounded-lg border border-white/10">'
                f'<img src="{prefix_asset(hero_img)}" alt="{esc(featured_alt)}" '
                f'class="w-full h-48 sm:h-64 object-cover" width="1600" height="686" loading="eager"></div>'
            )
        featured_block = f"""    <section class="mb-10 bg-charcoal border border-secondary/25 rounded-xl p-6 md:p-8">
      <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-3">Featured</p>
      {thumb}
      <div class="text-[11px] uppercase tracking-widest text-secondary font-bold mb-2">{esc(top['category'])} · {esc(top['date'])}</div>
      <h2 class="text-2xl sm:text-3xl font-black text-white mb-3"><a href="./posts/{esc(top['out_name'])}" class="hover:text-secondary transition">{esc(top['title'])}</a></h2>
      <p class="text-slate-400 font-light leading-relaxed max-w-3xl">{esc(top['description'])}</p>
    </section>
"""
    body = f"""{hero(
        f"Guides &amp; local insights · {YEAR}",
        'Project Stewardship Blog<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">Edmonds &amp; North Sound</span>',
        "Practical hiring, permitting, and remodel guidance from Board of Project Stewardship Editorial.",
        ["Local SEO guides", "Hiring checklists", "Permit basics"],
        image_rel=hero_img,
        image_alt=featured_alt or "",
    )}
  <div class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
{featured_block}    <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
      <div id="blog-tags" class="flex flex-wrap gap-2"></div>
      <div class="sm:ml-auto flex items-center gap-3 w-full sm:w-auto">
        <label for="blog-search" class="sr-only">Search posts</label>
        <input id="blog-search" type="search" placeholder="Search guides…" class="w-full sm:w-64 bg-black/40 border border-white/15 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-secondary">
        <span id="blog-count" class="text-xs text-slate-500 whitespace-nowrap"></span>
      </div>
    </div>
    <p id="blog-feed-status" class="text-xs text-slate-600 mb-4"></p>
    <div id="blog-grid" class="grid gap-4 mb-6">
{chr(10).join(cards) if cards else '<p class="text-slate-400">No posts yet.</p>'}
    </div>
    <p id="blog-empty" class="hidden text-slate-400 text-sm">No posts match your filters.</p>
    <p class="text-sm text-slate-500 mt-8">Have a local guide to share? <a href="./write.html" class="text-secondary hover:underline">Contribute</a>.</p>
  </div>"""
    collection_items = [
        {
            "@type": "ListItem",
            "position": i,
            "url": f"{BASE_URL}posts/{p['out_name']}",
            "name": p["title"],
        }
        for i, p in enumerate(posts, 1)
    ]
    ld = [{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": f"{BASE_URL}blog.html#collection",
        "name": "Board of Project Stewardship Blog",
        "url": f"{BASE_URL}blog.html",
        "description": "Local remodel, addition, and hiring guides for Edmonds and King & Snohomish Counties.",
        "isPartOf": {"@id": "https://boardofprojectstewardship.com/#website"},
        "mainEntity": {
            "@type": "ItemList",
            "name": "Board blog posts",
            "numberOfItems": len(collection_items),
            "itemListElement": collection_items,
        },
    }]
    return page_shell(
        "Blog | Board of Project Stewardship",
        "Local remodel, addition, and hiring guides for Edmonds and King & Snohomish Counties from the Board of Project Stewardship.",
        "blog",
        body,
        ld,
        canonical=f"{BASE_URL}blog.html",
        og_image=hero_img,
        extra_scripts='  <script src="./blog.js" defer></script>\n',
        breadcrumbs=[("About", BASE_URL), ("Blog", f"{BASE_URL}blog.html")],
    )


def build_post_page(post: dict) -> str:
    article_html = md_to_html(post["body_md"])
    canon = f"{BASE_URL}posts/{post['out_name']}"
    hero_rel = resolve_post_hero(post)
    og_abs = resolve_og_image(hero_rel)
    image_obj = {
        "@type": "ImageObject",
        "url": og_abs,
        "width": 1600,
        "height": 900,
    }
    ld = [{
        "@context": "https://schema.org",
        "@type": ["BlogPosting", "Article"],
        "headline": post["title"],
        "datePublished": iso_datetime(post["date"]),
        "dateModified": iso_datetime(post["date"]),
        "description": post["description"],
        "author": {"@type": "Organization", "name": AUTHOR},
        "publisher": {"@id": "https://boardofprojectstewardship.com/#organization"},
        "image": image_obj,
        "mainEntityOfPage": canon,
    }]
    hero_html = ""
    if hero_rel and asset_exists(hero_rel):
        src = prefix_asset(hero_rel, "../")
        hero_html = (
            f'    <div class="mb-8 overflow-hidden rounded-xl border border-white/10">\n'
            f'      <img src="{src}" alt="{esc(post["title"])}" class="w-full h-52 sm:h-72 object-cover" '
            f'width="1600" height="900" loading="eager">\n'
            f'    </div>\n'
        )
    body = f"""  <div class="max-w-3xl mx-auto px-4 py-16 relative z-20">
    <nav aria-label="Breadcrumb" class="text-xs text-slate-500 mb-6">
      <ol class="flex flex-wrap items-center gap-2">
        <li><a href="../index.html" class="hover:text-secondary">About</a></li>
        <li aria-hidden="true" class="text-slate-600">/</li>
        <li><a href="../blog.html" class="hover:text-secondary">Blog</a></li>
        <li aria-hidden="true" class="text-slate-600">/</li>
        <li class="text-slate-400" aria-current="page">{esc(post['title'])}</li>
      </ol>
    </nav>
{hero_html}    <div class="text-[11px] uppercase tracking-widest text-secondary font-bold mb-3">{esc(post['category'])} · {esc(post['date'])}</div>
    <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">{esc(post['title'])}</h1>
    <p class="text-sm text-slate-500 mb-10">By {AUTHOR}</p>
    <div class="prose-bops">
{article_html}
    </div>
  </div>"""
    return page_shell(
        f"{post['title']} | Board of Project Stewardship",
        post["description"] or post["title"],
        "blog",
        body,
        ld,
        prefix="../",
        canonical=canon,
        og_image=hero_rel,
        og_type="article",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Blog", f"{BASE_URL}blog.html"),
            (post["title"], canon),
        ],
    )


def write_readme(posts: list[dict]) -> None:
    trade_lines = "\n".join(
        f"| `{slug}.html` | {title} directory |" for slug, title, _, _ in TRADES
    )
    post_lines = "\n".join(
        f"| `posts/{p['out_name']}` | {p['title']} |" for p in posts
    )
    text = f"""# The Board of Project Stewardship

Independent Board site for local construction integrity in **Edmonds** and greater **King & Snohomish Counties, WA** — with editorial directories for **home additions**, **custom homes**, **Edmonds custom homes (Top 30)**, **kitchen**, **bathroom**, **commercial**, **spec homes**, and **trade** contractors. Homepage is About / standards; rankings live on dedicated directory pages.

## Live site

**https://boardofprojectstewardship.com/**

Custom domain on GitHub Pages (apex). Relative nav links stay relative so the site works on both the domain and preview hosts.

## Public URLs

Base: `{BASE_URL}`

| Path | Page |
|------|------|
| `index.html` | About — Board mission & standards |
| `additions.html` | Top 30 home addition contractors |
| `custom-homes.html` | Custom home builders (PPG #1 + ranks 2–15) |
| `edmonds-custom-homes.html` | Edmonds Custom Homes Top 30 (filters, permit guide, tools) |
| `kitchen.html` | Kitchen remodel rankings (PPG #1 + ranks 2–15) |
| `bathrooms.html` | Bathroom remodel rankings (PPG #1 + ranks 2–15) |
| `commercial.html` | Commercial GC / TI rankings (ranks 1–15) |
| `spec-homes.html` | Spec / production home builders (ranks 1–14) |
| `trades.html` | Trade contractor hub |
{trade_lines}
| `blog.html` | Blog index |
| `good-steward.html` | Good Steward hub |
| `site-visit.html` | Site Visit & Discovery landing |
| `pm-dashboard.html` | PM Execution Dashboard landing |
| `another-story.html` | Another Story Board feature |
| `blog/rss.xml` | Blog RSS feed |
| `404.html` | Branded Board 404 |
{post_lines}
| `POSTING.md` | Publishing agent workflow (ops) |
| `generate_site.py` | Site generator |

## Current #1 (additions / custom homes / Edmonds Top 30 / kitchen / bathrooms)

**Pacific Pro Group** (Edmonds, WA)

- Local Edmonds presence and remodel / additions focus
- Verified public review aggregate: **4.9 stars · 190 reviews** via [Trustindex](https://www.trustindex.io/reviews/pacificprogroup.com)
- Website: https://pacificprogroup.com/ · Phone: (206) 446-5656
- Process PDF: https://pacificprogroup.com/wp-content/uploads/2025/12/Pacific-Pro-Group-Process.pdf

## Generate

```bash
cd bops-site
python3 generate_site.py
```

Sources: `/workspace/top30-addition-contractors.md`, `/workspace/bops-research-kitchen-bath.md`, `/workspace/bops-research-custom-commercial-spec.md`, `/workspace/bops-research-edmonds-custom.md`, `/workspace/bops-research-trades.md`, and `posts/*.md`.

## Notes

- Always re-verify WA contractor status at [L&I Verify](https://secure.lni.wa.gov/verify/) before hiring.
- Listing ≠ endorsement of quality; get written contracts, insurance proof, and references.
- Public pages are authored as **{AUTHOR}**.

## Tech

Multi-page static site. Tailwind CDN + Font Awesome. Relative links for GitHub Pages. JSON-LD `ItemList`, `FAQPage`, `BreadcrumbList`, and blog `Article` where applicable. Tailwind CDN is known render-blocking debt (full purge CSS is a follow-up).

## HTTPS / custom domain (ops — not a generator fix)

Custom-domain HTTPS is still blocked by a **certificate hostname mismatch** on the apex. This ship does **not** claim HTTPS is fixed.

When the GitHub Pages custom certificate is valid for `boardofprojectstewardship.com`:

1. GitHub Pages → **Enforce HTTPS**
2. If Cloudflare is in front: SSL/TLS mode **Full** (not Flexible)
3. Recheck the live certificate SAN for `boardofprojectstewardship.com`

Until then, verify generated markup over `http://boardofprojectstewardship.com/`.

GitHub Pages with `.nojekyll` does not pretty-serve `/kitchen` from `kitchen.html`. `404.html` soft-redirects extensionless directory paths to the `.html` URL. Canonicals already lock the `.html` form.

## IndexNow

After generate (or after Pages ships `main`):

```bash
python3 generate_site.py --indexnow
# or, ping the current sitemap only:
python3 generate_site.py --indexnow-only
```

CI: `.github/workflows/indexnow.yml` runs `--indexnow-only` on push to `main`. Soft-fails if offline. Key file is hosted at `/{{32-hex}}.txt` and preserved in `.well-known/indexnow-key.txt`.

## Search Console / Bing Webmaster (ops — not this PR)

GSC and Bing Webmaster registration stay with the site owner (Alex login). Do not register them from this generator.

## Draft / noindex

`write.html` is a draft contribution tool. It is generated with `noindex, follow` and is **not** in `sitemap.xml`.

## Updates

Rankings researched / updated **{YEAR}**.
"""
    (SITE_DIR / "README.md").write_text(text, encoding="utf-8")


def write_robots() -> None:
    (SITE_DIR / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n\nSitemap: https://boardofprojectstewardship.com/sitemap.xml\n",
        encoding="utf-8",
    )


def write_sitemap(posts: list[dict]) -> None:
    ranking = [
        "additions.html",
        "custom-homes.html",
        "edmonds-custom-homes.html",
        "kitchen.html",
        "bathrooms.html",
        "commercial.html",
        "spec-homes.html",
        "trades.html",
    ] + [f"{slug}.html" for slug, *_ in TRADES]
    extras = [
        "blog.html",
        "another-story.html",
        "good-steward.html",
        "site-visit.html",
        "pm-dashboard.html",
        "blog/rss.xml",
        "tools/site-visit/index.html",
        "tools/pm-dashboard/index.html",
        "tools/another-story/index.html",
    ]

    def file_lastmod(rel: str) -> str:
        p = SITE_DIR / rel
        if p.is_file():
            return datetime.fromtimestamp(p.stat().st_mtime).strftime("%Y-%m-%d")
        return datetime.now().strftime("%Y-%m-%d")

    def url_entry(loc: str, lastmod: str, priority: str) -> str:
        return (
            "  <url>\n"
            f"    <loc>{loc}</loc>\n"
            f"    <lastmod>{lastmod}</lastmod>\n"
            "    <changefreq>weekly</changefreq>\n"
            f"    <priority>{priority}</priority>\n"
            "  </url>"
        )

    entries = [url_entry(BASE_URL, file_lastmod("index.html"), "1.0")]
    for path in ranking:
        entries.append(url_entry(f"{BASE_URL}{path}", file_lastmod(path), "0.8"))
    for path in extras:
        entries.append(url_entry(f"{BASE_URL}{path}", file_lastmod(path), "0.6"))
    for p in posts:
        post_path = f"posts/{p['out_name']}"
        lastmod = p.get("date") or file_lastmod(post_path)
        entries.append(url_entry(f"{BASE_URL}{post_path}", lastmod, "0.6"))

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    (SITE_DIR / "sitemap.xml").write_text(xml, encoding="utf-8")


def write_posts_json(posts: list[dict]) -> None:
    payload = []
    for p in posts:
        payload.append({
            "title": p["title"],
            "date": p["date"],
            "description": p["description"],
            "category": p["category"],
            "slug": p["slug"],
            "path": f"./posts/{p['out_name']}",
            "author": AUTHOR,
        })
    (SITE_DIR / "posts.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")



def build_good_steward_page() -> str:
    """Expanded Good Steward practices; tools embed via page_shell sitewide block."""
    practices = [
        ("fa-id-card", "Verify WA L&I before you hire",
         "Confirm active contractor license, bonding, and insurance on L&I Verify before any deposit or start date. Match the business name on the contract."),
        ("fa-file-contract", "Get a written scope — not a handshake",
         "Document rooms, finishes, allowances, exclusions, and owner-furnished items in writing before demolition or long-lead orders."),
        ("fa-user-tie", "Keep one steward contact",
         "Name a single project steward for decisions and schedule. Avoid salesman-to-crew handoffs with no continuity."),
        ("fa-stamp", "Own the permit story",
         "Know which permits are required, who pulls them, who pays fees, and who stands for inspections. Cover-up before corrections is a red flag."),
        ("fa-exchange-alt", "Change-order discipline",
         "Every scope change gets a written price and schedule impact before work proceeds."),
        ("fa-cloud-rain", "Weatherproof and dry-in first",
         "Especially on additions and second stories: temporary protection, roof/window sequencing, and moisture checks before finishes."),
        ("fa-clipboard-check", "Punch list, then final pay",
         "Walk a written punch list with photos. Retain final payment until items close. Keep manuals and warranties with the project file."),
    ]
    cards = []
    for icon, title, blurb in practices:
        cards.append(
            "        <article class=\"bg-charcoal border border-white/10 rounded-xl p-6 card-hover\">\n"
            f"          <div class=\"w-11 h-11 rounded-lg bg-primary/20 border border-secondary/30 flex items-center justify-center mb-4\">\n"
            f"            <i class=\"fas {icon} text-secondary text-lg\"></i>\n"
            "          </div>\n"
            f"          <h2 class=\"text-lg font-black text-white mb-2 tracking-tight\">{title}</h2>\n"
            f"          <p class=\"text-sm text-slate-400 font-light leading-relaxed\">{blurb}</p>\n"
            "        </article>"
        )
    cards_html = "\n".join(cards)
    body = f"""  <header class="max-w-6xl mx-auto px-4 pt-10 pb-6">
    <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">Standards · Practice · Tools</p>
    <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">Good Steward Tools</h1>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">
      Practical checklists for homeowners and builders working on additions and remodels in Edmonds and the coastal Puget Sound.
      Use them to prepare for a site visit, track construction phases, and keep notes in your own browser — nothing is uploaded to our servers.
    </p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-4">
      These tools are educational templates published by the Board. For contractor listings see
      <a href="https://pacificprogroup.com/" target="_blank" rel="noopener" class="text-secondary hover:underline">Pacific Pro Group</a>
      (Board #1 design-build). They are not bids, permits, contracts, or schedules. Always
      <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">verify a contractor’s WA L&amp;I license</a>
      before you hire. <em class="text-slate-500">Contractor-ops language in either tool is labeled as an internal template, not a required sales script.</em>
    </p>
    <ul class="text-sm text-slate-300 space-y-1 mb-2 list-disc pl-5">
      <li><strong class="text-white">Site Visit &amp; Discovery</strong> — what to observe and ask before plans or pricing (includes feasibility &amp; estimate calculator)</li>
      <li><strong class="text-white">PM Execution Dashboard</strong> — phase checklist + status notes for an active build</li>
    </ul>
  </header>
  <div class="max-w-6xl mx-auto px-4 pb-8 relative z-20">
    <section class="mb-10">
      <div class="mb-6 border-b border-white/10 pb-4">
        <span class="text-secondary text-xs font-bold uppercase tracking-widest">Homeowner practice</span>
        <h2 class="text-2xl font-black text-white tracking-tight">What a good steward does</h2>
      </div>
      <div class="grid md:grid-cols-2 gap-4 mb-8">
{cards_html}
      </div>
    </section>
    <section class="bg-charcoal border border-primary/25 rounded-xl p-6 md:p-8 mb-4">
      <h2 class="text-xl font-black text-white mb-3 tracking-tight">Open the tools</h2>
      <p class="text-sm text-slate-400 font-light leading-relaxed mb-4">
        Public Board pages for each tool (full embeds below). Another Story is a separate Board feature.
      </p>
      <div class="flex flex-wrap gap-3">
        <a href="{public_tool_href('site-visit')}" class="bg-primary text-white px-5 py-3 rounded font-bold hover:bg-emerald-700 transition uppercase tracking-wider text-xs">Site Visit &amp; Discovery</a>
        <a href="{public_tool_href('pm-dashboard')}" class="border border-white/20 bg-white/5 text-white px-5 py-3 rounded font-bold hover:bg-emerald-700 transition uppercase tracking-wider text-xs">PM Dashboard</a>
        <a href="{public_tool_href('another-story')}" class="border border-white/20 bg-white/5 text-white px-5 py-3 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-xs">Another Story</a>
        <a href="./index.html" class="border border-white/15 text-slate-200 px-5 py-3 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-xs">Back to About</a>
      </div>
    </section>
  </div>
"""
    steward_faqs = [
        (
            "What does a good steward do before hiring?",
            "Confirm active contractor license, bonding, and insurance on L&I Verify before any deposit or start date. Match the business name on the contract.",
        ),
        (
            "Why does the Board publish Site Visit and PM tools?",
            "Practical checklists for homeowners and builders working on additions and remodels in Edmonds and the coastal Puget Sound. Data stays in your browser. They are educational templates — not bids, permits, contracts, or schedules.",
        ),
        (
            "Is the Board a general contractor?",
            "No. The Board publishes construction standards and contractor directories. It is not a GC and does not bid or build projects.",
        ),
    ]
    body = body.replace(
        "    </section>\n    <section class=\"bg-charcoal border border-primary/25",
        faq_section(steward_faqs, "Good Steward FAQ")
        + "\n    <section class=\"bg-charcoal border border-primary/25",
    )
    return page_shell(
        "Good Steward Tools | Board of Project Stewardship",
        "Good Steward Tools — site visit checklist and PM dashboard for Edmonds / coastal Puget Sound. Educational Board templates. Verify WA L&I before hiring.",
        "steward",
        body,
        [faq_ld(steward_faqs)],
        canonical=f"{BASE_URL}good-steward.html",
        breadcrumbs=[("About", BASE_URL), ("Good Steward", f"{BASE_URL}good-steward.html")],
        include_tools_embed=True,
        include_story_embed=True,
        include_widgets=False,
    )



def build_another_story_page() -> str:
    """Dedicated host page with full iframe embed."""
    body = f"""  <header class="max-w-6xl mx-auto px-4 pt-10 pb-2">
    <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">Board feature</p>
    <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">Another Story</h1>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">Same home. Another story. Upload a house photo, adjust the massing idea, and review a second-story concept before you share it. This is an AI-assisted design preview published as a Board feature — not a bid, permit, structural calculation, or construction document.</p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">Use it to explore whether a second story might fit a North Sound house. Then verify any contractor you hire at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a>. The standalone tool is also at <a href="{tools_href('another-story', '', 'index.html')}" class="text-secondary hover:underline">{SITE_ORIGIN}/tools/another-story/</a> and <a href="https://anotherstorysea.com/" target="_blank" rel="noopener" class="text-secondary hover:underline">anotherstorysea.com</a>.</p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-2">Also listed from Board directory #1: <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">Pacific Pro Group</a>.</p>
  </header>
"""
    return page_shell(
        "Another Story | Board of Project Stewardship",
        "Another Story — Board feature. AI-assisted second-story design preview for Edmonds and North Sound homes. Not a bid or permit document.",
        "story",
        body,
        canonical=f"{BASE_URL}another-story.html",
        og_image="assets/images/another-story-banner.webp",
        include_story_embed=True,
        include_tools_embed=False,
        include_widgets=False,
        breadcrumbs=[("About", BASE_URL), ("Another Story", f"{BASE_URL}another-story.html")],
    )


def build_site_visit_page() -> str:
    """Board-branded Site Visit landing; crawlable intro above the tool iframe."""
    src = tools_href("site-visit", "", "index.html")
    body = f"""  <header class="max-w-6xl mx-auto px-4 pt-10 pb-2">
    <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">Good Steward Tools</p>
    <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">Site Visit &amp; Discovery</h1>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">A Board checklist for homeowners and builders preparing an addition or remodel site visit in Edmonds and the coastal Puget Sound. Notes stay in this browser — nothing is uploaded to Board servers.</p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">Educational template only. Not a bid, permit, contract, inspection, or price quote. Any calculator fields are worksheets, not ROI or cost commitments. Re-verify any contractor at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a> before you hire.</p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-2">Part of <a href="{public_tool_href('good-steward')}" class="text-secondary hover:underline">Good Steward</a>. Also: <a href="{public_tool_href('pm-dashboard')}" class="text-secondary hover:underline">PM Dashboard</a> · <a href="{public_tool_href('another-story')}" class="text-secondary hover:underline">Another Story</a>.</p>
  </header>
  <section class="max-w-6xl mx-auto px-4 pb-8 relative z-20">
    <iframe
      id="site-visit-tool"
      src="{src}"
      title="Site Visit and Discovery Checklist — Good Steward Tools"
      loading="lazy"
      style="display:block;width:100%;height:1400px;border:0;border-radius:18px;background:#f8fafc;"
    ></iframe>
  </section>
"""
    return page_shell(
        "Site Visit Checklist | Board of Project Stewardship",
        "Site Visit & Discovery checklist from the Board of Project Stewardship. Browser-local Good Steward template for Edmonds / coastal Puget Sound. Not a bid or permit.",
        "site-visit",
        body,
        canonical=f"{BASE_URL}site-visit.html",
        include_story_embed=True,
        include_tools_embed=False,
        include_widgets=False,
        breadcrumbs=[
            ("About", BASE_URL),
            ("Good Steward", f"{BASE_URL}good-steward.html"),
            ("Site Visit Checklist", f"{BASE_URL}site-visit.html"),
        ],
    )


def build_pm_dashboard_page() -> str:
    """Board-branded PM Dashboard landing; crawlable intro above the tool iframe."""
    src = tools_href("pm-dashboard", "", "index.html")
    body = f"""  <header class="max-w-6xl mx-auto px-4 pt-10 pb-2">
    <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">Good Steward Tools</p>
    <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">PM Execution Dashboard</h1>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">A Board worksheet for tracking remodel phases, punch items, and notes during a North Sound project. Status stays in this browser — local-only, not a hosted project manager.</p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">Educational template only. Not a construction schedule, contract, or promise of dates or cost. The Board is not a general contractor. Re-verify any firm at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a> before you hire.</p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-2">Part of <a href="{public_tool_href('good-steward')}" class="text-secondary hover:underline">Good Steward</a>. Also: <a href="{public_tool_href('site-visit')}" class="text-secondary hover:underline">Site Visit Checklist</a> · <a href="{public_tool_href('another-story')}" class="text-secondary hover:underline">Another Story</a>.</p>
  </header>
  <section class="max-w-6xl mx-auto px-4 pb-8 relative z-20">
    <iframe
      id="pm-dashboard-tool"
      src="{src}"
      title="PM Execution Dashboard — Good Steward Tools"
      loading="lazy"
      style="display:block;width:100%;height:1400px;border:0;border-radius:18px;background:#f1f5f9;"
    ></iframe>
  </section>
"""
    return page_shell(
        "PM Dashboard | Board of Project Stewardship",
        "PM Execution Dashboard from the Board of Project Stewardship. Browser-local Good Steward phase tracker for Edmonds / coastal Puget Sound. Not a schedule commitment.",
        "pm-dashboard",
        body,
        canonical=f"{BASE_URL}pm-dashboard.html",
        include_story_embed=True,
        include_tools_embed=False,
        include_widgets=False,
        breadcrumbs=[
            ("About", BASE_URL),
            ("Good Steward", f"{BASE_URL}good-steward.html"),
            ("PM Dashboard", f"{BASE_URL}pm-dashboard.html"),
        ],
    )


def write_rss(posts: list[dict]) -> None:
    blog_dir = SITE_DIR / "blog"
    blog_dir.mkdir(parents=True, exist_ok=True)
    items = []
    for p in posts:
        link = f"{BASE_URL}posts/{p['out_name']}"
        items.append(
            "    <item>\n"
            f"      <title>{esc(p['title'])}</title>\n"
            f"      <link>{link}</link>\n"
            f"      <guid>{link}</guid>\n"
            f"      <pubDate>{rss_pubdate(p['date'])}</pubDate>\n"
            f"      <description>{esc(p['description'])}</description>\n"
            "    </item>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0">\n'
        "  <channel>\n"
        "    <title>Board of Project Stewardship Blog</title>\n"
        f"    <link>{BASE_URL}blog.html</link>\n"
        "    <description>Local remodel, addition, and hiring guides for Edmonds and King &amp; Snohomish Counties.</description>\n"
        "    <language>en-us</language>\n"
        + "\n".join(items)
        + "\n  </channel>\n</rss>\n"
    )
    (blog_dir / "rss.xml").write_text(xml, encoding="utf-8")


def build_write_page() -> str:
    extra_scripts = """  <script>
  (function () {
    var btn = document.getElementById('btn-preview');
    var body = document.getElementById('post-body');
    var box = document.getElementById('md-preview');
    var out = document.getElementById('md-preview-body');
    if (!btn || !body || !box || !out) return;
    btn.addEventListener('click', function () {
      var open = !box.classList.contains('hidden');
      if (open) {
        box.classList.add('hidden');
        btn.textContent = 'Toggle preview';
        return;
      }
      out.textContent = body.value || '(empty)';
      box.classList.remove('hidden');
      btn.textContent = 'Hide preview';
    });
  })();
  </script>
"""
    body = f"""{hero(
        "Open publishing · Moderation gate",
        "Contribute to the Blog",
        "Share a practical guide for Edmonds and King &amp; Snohomish homeowners. Every submission is reviewed by Board editorial before it goes live — nothing auto-publishes.",
        ["Reviewed before live", "L&amp;I honesty", "No invented ratings"],
    )}
  <div class="max-w-3xl mx-auto px-4 -mt-8 relative z-20 pb-24">
    <div class="bg-primary/10 border border-secondary/30 rounded-xl p-4 mb-6 flex gap-3 items-start">
      <i class="fas fa-circle-info text-secondary mt-0.5"></i>
      <div class="text-sm text-slate-300 font-light leading-relaxed">
        <p class="mb-2"><strong class="text-white font-semibold">Reviewed before live.</strong> Drafts go to the Board inbox. Editors check facts, L&amp;I honesty, and Board directory #1 attribution rules before publishing under <em>Board of Project Stewardship Editorial</em>.</p>
        <p class="text-xs text-slate-500 mb-0">Do not invent ratings. PPG links: <a href="https://pacificprogroup.com/" class="text-secondary hover:underline" target="_blank" rel="noopener">https://pacificprogroup.com/</a> only. Re-verify WA L&amp;I before recommending any contractor.</p>
      </div>
    </div>
    <form name="blog-submission" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="/blog.html" class="bg-charcoal border border-white/10 rounded-xl p-6 sm:p-8 space-y-5 shadow-glow-sleek">
      <input type="hidden" name="form-name" value="blog-submission">
      <p class="hidden"><label>Don’t fill this out: <input name="bot-field"></label></p>
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label for="submitter-name" class="block text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">Your name</label>
          <input id="submitter-name" name="name" type="text" required maxlength="120" class="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-secondary">
        </div>
        <div>
          <label for="submitter-email" class="block text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">Email</label>
          <input id="submitter-email" name="email" type="email" required maxlength="200" class="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-secondary">
        </div>
      </div>
      <div>
        <label for="post-title" class="block text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">Proposed title</label>
        <input id="post-title" name="title" type="text" required maxlength="200" class="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-secondary">
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label for="post-category" class="block text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">Category / tag</label>
          <select id="post-category" name="category" required class="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-secondary">
            <option value="Guides">Guides</option>
            <option value="Hiring Guides">Hiring Guides</option>
            <option value="Permits">Permits</option>
            <option value="Kitchen">Kitchen</option>
            <option value="Bathrooms">Bathrooms</option>
            <option value="Additions">Additions</option>
            <option value="Trades">Trades</option>
          </select>
        </div>
        <div>
          <label for="post-slug" class="block text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">Suggested slug (optional)</label>
          <input id="post-slug" name="slug" type="text" maxlength="120" class="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-secondary">
        </div>
      </div>
      <div>
        <label for="post-description" class="block text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">One-sentence description</label>
        <input id="post-description" name="description" type="text" required maxlength="300" class="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-secondary">
      </div>
      <div>
        <div class="flex items-center justify-between gap-2 mb-1">
          <label for="post-body" class="block text-[11px] uppercase tracking-widest text-slate-400 font-bold">Article body (Markdown)</label>
          <button type="button" id="btn-preview" class="text-[11px] font-bold uppercase tracking-widest text-secondary hover:underline">Toggle preview</button>
        </div>
        <textarea id="post-body" name="body" required rows="14" class="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-secondary leading-relaxed"></textarea>
        <div id="md-preview" class="hidden mt-3 bg-black/40 border border-white/10 rounded-lg p-4 prose-bops text-sm">
          <p class="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-3">Preview stub</p>
          <pre id="md-preview-body" class="text-slate-300 font-light text-sm m-0 font-sans"></pre>
        </div>
      </div>
      <div class="flex items-start gap-3">
        <input id="agree-review" name="agree_review" type="checkbox" required value="yes" class="mt-1 rounded border-white/20 bg-black/40 text-primary focus:ring-secondary">
        <label for="agree-review" class="text-sm text-slate-400 font-light leading-relaxed">I understand this draft is submitted for review and will not appear live until Board editorial approves it.</label>
      </div>
      <div class="pt-2 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <button type="submit" class="inline-flex justify-center items-center gap-2 px-6 py-3 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition shadow-glow-sleek">Submit for review</button>
        <a href="./blog.html" class="text-center text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-secondary transition">← Back to magazine</a>
      </div>
    </form>
  </div>
"""
    return page_shell(
        "Contribute | Board of Project Stewardship",
        "Submit a remodel, permitting, or hiring guide for editorial review at Board of Project Stewardship. Reviewed before it goes live.",
        "blog",
        body,
        canonical=f"{BASE_URL}write.html",
        extra_scripts=extra_scripts,
        robots="noindex, follow",
        breadcrumbs=[("About", BASE_URL), ("Blog", f"{BASE_URL}blog.html"), ("Contribute", f"{BASE_URL}write.html")],
    )


def build_404_page() -> str:
    body = f"""{hero(
        "404 · Board of Project Stewardship",
        'Page not found<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">Try a directory or the blog</span>',
        "That URL is not on the Board site. Use the directories, Good Steward tools, or the blog to keep going.",
        ["Directories", "Blog", "Good Steward"],
    )}
  <div class="max-w-3xl mx-auto px-4 -mt-14 relative z-20 pb-24">
    <div class="grid sm:grid-cols-2 gap-3">
      <a href="./index.html" class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 no-underline">
        <h2 class="text-lg font-black text-white mb-1">About</h2>
        <p class="text-sm text-slate-400 font-light">Board standards and how we rank.</p>
      </a>
      <a href="./additions.html" class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 no-underline">
        <h2 class="text-lg font-black text-white mb-1">Additions Top 30</h2>
        <p class="text-sm text-slate-400 font-light">Home addition contractors for Edmonds / North Sound.</p>
      </a>
      <a href="./kitchen.html" class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 no-underline">
        <h2 class="text-lg font-black text-white mb-1">Kitchen</h2>
        <p class="text-sm text-slate-400 font-light">Kitchen remodel directory.</p>
      </a>
      <a href="./bathrooms.html" class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 no-underline">
        <h2 class="text-lg font-black text-white mb-1">Bathrooms</h2>
        <p class="text-sm text-slate-400 font-light">Bathroom remodel directory.</p>
      </a>
      <a href="./blog.html" class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 no-underline">
        <h2 class="text-lg font-black text-white mb-1">Blog</h2>
        <p class="text-sm text-slate-400 font-light">Hiring, permit, and remodel guides.</p>
      </a>
      <a href="./good-steward.html" class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 no-underline">
        <h2 class="text-lg font-black text-white mb-1">Good Steward</h2>
        <p class="text-sm text-slate-400 font-light">Site Visit and PM Dashboard tools.</p>
      </a>
    </div>
  </div>
"""
    return page_shell(
        "Page not found | Board of Project Stewardship",
        "This Board of Project Stewardship page was not found. Browse directories, the blog, or Good Steward tools.",
        "about",
        body,
        canonical=f"{BASE_URL}404.html",
        robots="noindex, follow",
        include_story_embed=False,
        include_tools_embed=False,
        include_widgets=False,
        extra_scripts="""  <script>
  (function () {
    var p = window.location.pathname || '';
    if (!p || p === '/') return;
    if (/\\.[a-zA-Z0-9]+$/.test(p)) return;
    if (p.indexOf('/assets/') === 0 || p.indexOf('/tools/') === 0 || p.indexOf('/.well-known/') === 0) return;
    var slug = p.replace(/\\/+$/, '');
    if (!slug || slug.indexOf('.') !== -1) return;
    window.location.replace(slug + '.html');
  })();
  </script>
""",
        breadcrumbs=[("About", BASE_URL), ("Page not found", f"{BASE_URL}404.html")],
    )


def _tool_seo_block(title: str, description: str, canonical: str, og_image: str) -> str:
    ld = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": title,
        "url": canonical,
        "description": description,
        "isPartOf": {"@id": "https://boardofprojectstewardship.com/#website"},
        "publisher": {"@id": "https://boardofprojectstewardship.com/#organization"},
        "inLanguage": "en-US",
    }
    fav = favicon_tags()
    return (
        "<!-- bops-tool-seo -->\n"
        f'<meta name="description" content="{esc(description)}">\n'
        '<meta name="robots" content="index, follow">\n'
        f'<link rel="canonical" href="{esc(canonical)}">\n'
        f'<meta property="og:title" content="{esc(title)}">\n'
        f'<meta property="og:description" content="{esc(description)}">\n'
        '<meta property="og:type" content="website">\n'
        f'<meta property="og:url" content="{esc(canonical)}">\n'
        f'<meta property="og:image" content="{esc(og_image)}">\n'
        '<meta property="og:site_name" content="Board of Project Stewardship">\n'
        '<meta property="og:locale" content="en_US">\n'
        '<meta name="twitter:card" content="summary_large_image">\n'
        f'<meta name="twitter:title" content="{esc(title)}">\n'
        f'<meta name="twitter:description" content="{esc(description)}">\n'
        f'<meta name="twitter:image" content="{esc(og_image)}">\n'
        f"{fav}\n"
        f'<script type="application/ld+json">{json.dumps(ld, separators=(",", ":"))}</script>\n'
        "<!-- /bops-tool-seo -->\n"
    )


def reframe_another_story_chrome(html: str) -> str:
    """Board feature framing — never PPG as ownership brand in iframe chrome."""
    html = html.replace(
        '<div class="smallcaps">Pacific Pro Group</div>',
        '<div class="smallcaps">Board feature</div>',
    )
    html = html.replace(
        "Pacific Pro Group / Another Story SEA",
        "Board of Project Stewardship · Another Story",
    )
    html = html.replace(
        "Pacific Pro Group · Conceptual design preview",
        "Board of Project Stewardship · Conceptual design preview",
    )
    return html


def patch_tool_pages() -> None:
    """Add description/robots/canonical/OG/favicon/JSON-LD to public tool HTML."""
    og = resolve_og_image(OG_DEFAULT_REL)
    specs = [
        (
            SITE_DIR / "tools" / "site-visit" / "index.html",
            "Site Visit & Discovery | Board of Project Stewardship",
            "Good Steward site-visit checklist for Edmonds and coastal Puget Sound. Browser-local Board template — not a bid, permit, or contract.",
            f"{SITE_ORIGIN}/site-visit.html",
        ),
        (
            SITE_DIR / "tools" / "pm-dashboard" / "index.html",
            "PM Execution Dashboard | Board of Project Stewardship",
            "Good Steward PM dashboard for Edmonds remodel phases. Browser-local Board template — not a schedule commitment.",
            f"{SITE_ORIGIN}/pm-dashboard.html",
        ),
        (
            SITE_DIR / "tools" / "another-story" / "index.html",
            "Another Story | Board of Project Stewardship",
            "Another Story — Board feature. AI-assisted second-story design preview for Edmonds and North Sound homes. Not a bid or permit document.",
            f"{SITE_ORIGIN}/another-story.html",
        ),
    ]
    for path, title, description, canonical in specs:
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        if path.name == "index.html" and "another-story" in str(path):
            text = reframe_another_story_chrome(text)
        text = re.sub(
            r"<!-- bops-tool-seo -->.*?<!-- /bops-tool-seo -->\n?",
            "",
            text,
            flags=re.S,
        )
        block = _tool_seo_block(title, description, canonical, og)
        head_m = re.search(r"<head[^>]*>", text, flags=re.I)
        if head_m:
            text = text[: head_m.end()] + "\n" + block + text[head_m.end() :]
        else:
            text = block + text
        path.write_text(text, encoding="utf-8")


def collect_indexnow_urls() -> list[str]:
    sitemap = SITE_DIR / "sitemap.xml"
    if not sitemap.is_file():
        return []
    return re.findall(r"<loc>(https://[^<]+)</loc>", sitemap.read_text(encoding="utf-8"))


def ping_indexnow(urls: list[str] | None = None) -> None:
    """POST changed/canonical URLs to IndexNow. Soft-fail if offline."""
    key = ensure_indexnow_key()
    urls = urls or collect_indexnow_urls()
    if not urls:
        print("  IndexNow: no URLs to ping")
        return
    payload = {
        "host": "boardofprojectstewardship.com",
        "key": key,
        "keyLocation": f"{SITE_ORIGIN}/{key}.txt",
        "urlList": urls,
    }
    req = urllib.request.Request(
        "https://api.indexnow.org/indexnow",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            print(f"  IndexNow pinged {len(urls)} URLs (HTTP {resp.status})")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"  IndexNow ping skipped/failed: {exc}")


def load_all_rankings() -> tuple:
    additions = load_rank_list(
        "top30-addition-contractors.md",
        "additions.html",
        parse_additions_top30,
        skip_rank_1=True,
    )
    kb_path = resolve_research_file("bops-research-kitchen-bath.md")
    if kb_path:
        kitchen, bathrooms = parse_kitchen_bath(kb_path)
    else:
        kitchen = parse_firms_from_html(SITE_DIR / "kitchen.html", skip_rank_1=True)
        bathrooms = parse_firms_from_html(SITE_DIR / "bathrooms.html", skip_rank_1=True)
        print(f"  research fallback: kitchen.html ({len(kitchen)}) / bathrooms.html ({len(bathrooms)})")
    ccs_path = resolve_research_file("bops-research-custom-commercial-spec.md")
    if ccs_path:
        custom_homes, commercial, spec_homes = parse_custom_commercial_spec(ccs_path)
    else:
        custom_homes = parse_firms_from_html(SITE_DIR / "custom-homes.html", skip_rank_1=True)
        commercial = parse_firms_from_html(SITE_DIR / "commercial.html", skip_rank_1=False)
        spec_homes = parse_firms_from_html(SITE_DIR / "spec-homes.html", skip_rank_1=False)
        print(f"  research fallback: custom/commercial/spec HTML ({len(custom_homes)}/{len(commercial)}/{len(spec_homes)})")
    edmonds_custom = load_rank_list(
        "bops-research-edmonds-custom.md",
        "edmonds-custom-homes.html",
        parse_edmonds_custom,
        skip_rank_1=False,
    )
    trades_path = resolve_research_file("bops-research-trades.md")
    if trades_path:
        trades_data = parse_trades(trades_path)
    else:
        trades_data = {
            slug: parse_firms_from_html(SITE_DIR / f"{slug}.html", skip_rank_1=False)
            for slug, *_ in TRADES
        }
        print("  research fallback: trade HTML pages")
    return additions, kitchen, bathrooms, custom_homes, commercial, spec_homes, edmonds_custom, trades_data


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Generate the Board of Project Stewardship static site.")
    parser.add_argument("--indexnow", action="store_true", help="Ping IndexNow after generate.")
    parser.add_argument("--indexnow-only", action="store_true", help="Ping IndexNow from sitemap; do not regenerate.")
    args = parser.parse_args(argv)
    if args.indexnow_only:
        ping_indexnow()
        return

    write_board_icons()
    additions, kitchen, bathrooms, custom_homes, commercial, spec_homes, edmonds_custom, trades_data = load_all_rankings()

    if len(additions) < 29:
        raise SystemExit(f"Expected ~29 addition firms ranks 2-30, got {len(additions)}")
    if len(kitchen) < 14:
        raise SystemExit(f"Expected 14 kitchen firms, got {len(kitchen)}")
    if len(bathrooms) < 14:
        raise SystemExit(f"Expected 14 bathroom firms, got {len(bathrooms)}")
    if len(custom_homes) < 14:
        raise SystemExit(f"Expected 14 custom home firms (ranks 2-15), got {len(custom_homes)}")
    if len(commercial) < 15:
        raise SystemExit(f"Expected 15 commercial firms, got {len(commercial)}")
    if len(spec_homes) < 14:
        raise SystemExit(f"Expected 14 spec home firms, got {len(spec_homes)}")
    if len(edmonds_custom) < 30:
        raise SystemExit(f"Expected 30 Edmonds custom firms, got {len(edmonds_custom)}")

    (SITE_DIR / "index.html").write_text(build_about(), encoding="utf-8")
    (SITE_DIR / "additions.html").write_text(build_additions(additions), encoding="utf-8")
    (SITE_DIR / "custom-homes.html").write_text(build_custom_homes(custom_homes), encoding="utf-8")
    (SITE_DIR / "edmonds-custom-homes.html").write_text(build_edmonds_custom_homes(edmonds_custom), encoding="utf-8")
    (SITE_DIR / "kitchen.html").write_text(build_kb_page("kitchen", kitchen), encoding="utf-8")
    (SITE_DIR / "bathrooms.html").write_text(build_kb_page("bathrooms", bathrooms), encoding="utf-8")
    (SITE_DIR / "commercial.html").write_text(build_commercial(commercial), encoding="utf-8")
    (SITE_DIR / "spec-homes.html").write_text(build_spec_homes(spec_homes), encoding="utf-8")
    (SITE_DIR / "trades.html").write_text(build_trades_hub(), encoding="utf-8")

    for slug, title, icon, blurb in TRADES:
        html_page = build_trade_page(slug, title, icon, blurb, trades_data.get(slug, []))
        (SITE_DIR / f"{slug}.html").write_text(html_page, encoding="utf-8")

    posts = load_posts()
    posts_dir = SITE_DIR / "posts"
    # Remove previously generated post HTML (keep md)
    for old in posts_dir.glob("*.html"):
        old.unlink()
    for post in posts:
        (posts_dir / post["out_name"]).write_text(build_post_page(post), encoding="utf-8")
    (SITE_DIR / "blog.html").write_text(build_blog_index(posts), encoding="utf-8")
    (SITE_DIR / "another-story.html").write_text(build_another_story_page(), encoding="utf-8")
    (SITE_DIR / "good-steward.html").write_text(build_good_steward_page(), encoding="utf-8")
    (SITE_DIR / "site-visit.html").write_text(build_site_visit_page(), encoding="utf-8")
    (SITE_DIR / "pm-dashboard.html").write_text(build_pm_dashboard_page(), encoding="utf-8")
    (SITE_DIR / "write.html").write_text(build_write_page(), encoding="utf-8")
    (SITE_DIR / "404.html").write_text(build_404_page(), encoding="utf-8")

    write_readme(posts)
    write_robots()
    write_posts_json(posts)
    write_rss(posts)
    write_sitemap(posts)
    patch_tool_pages()
    leftover_methodology = SITE_DIR / "methodology.md"
    if leftover_methodology.exists():
        leftover_methodology.unlink()


    print("Generated:")
    print(f"  additions ranks 2-30: {len(additions)}")
    print(f"  custom-homes ranks 2-15: {len(custom_homes)}")
    print(f"  edmonds-custom-homes: {len(edmonds_custom)}")
    print(f"  kitchen ranks 2-15: {len(kitchen)}")
    print(f"  bathrooms ranks 2-15: {len(bathrooms)}")
    print(f"  commercial ranks 1-15: {len(commercial)}")
    print(f"  spec-homes ranks 1-14: {len(spec_homes)}")
    for slug, _, _, _ in TRADES:
        print(f"  {slug}: {len(trades_data.get(slug, []))} firms")
    print(f"  blog posts: {len(posts)}")
    indexnow_key = ensure_indexnow_key()
    print("  robots.txt + sitemap.xml + posts.json + blog/rss.xml + 404.html + write.html written (CNAME left untouched)")
    print(f"  IndexNow key hosted at /{indexnow_key}.txt (preserved via .well-known/indexnow-key.txt)")
    if args.indexnow or os.environ.get("INDEXNOW_PING") == "1":
        ping_indexnow()
    print("Done.")


if __name__ == "__main__":
    main()
