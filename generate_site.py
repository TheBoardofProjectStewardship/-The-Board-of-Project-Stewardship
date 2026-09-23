#!/usr/bin/env python3
"""Generate The Board of Project Stewardship multi-page static site.

Schema hygiene (fix #28): emit Organization, WebSite, ItemList, FAQPage,
Article, BreadcrumbList, ImageObject, and HowTo (steps must match visible
on-page steps; never invent totalTime/estimatedCost/prices). Never emit
NewsMediaOrganization, LocalBusiness, parentOrganization, or a WebSite
SearchAction (no on-site search URL — skip fix #21 until search exists).

The Board is an independent publisher of construction standards and contractor directories.
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
BRAND_NAME = "Board of Project Stewardship"
TITLE_SUFFIX = f" | {BRAND_NAME}"
RSS_HREF = f"{SITE_ORIGIN}/blog/rss.xml"
GITHUB_ORG = "https://github.com/TheBoardofProjectStewardship"
GITHUB_REPO = "https://github.com/TheBoardofProjectStewardship/-The-Board-of-Project-Stewardship"
# Board Organization sameAs: real Board properties only. Never PPG.
BOARD_SAME_AS = [GITHUB_ORG, GITHUB_REPO]
EDITORIAL_EMAIL = "editorial@boardofprojectstewardship.com"
# Alex one-liner: independent publisher of standards/directories (no fake nonprofit/newsroom claims).
BOARD_ONE_LINER = (
    "The Board of Project Stewardship publishes construction standards and contractor "
    "directories for Edmonds and King & Snohomish Counties — shortlists firms homeowners can hire with confidence."
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
    "siding-replacement-edmonds-coastal-wa": "2026-09-22-edmonds-siding-1.webp",
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
    "trustindex_as_of": "2026-09",
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


def clamp_title(title: str, limit: int = 70) -> str:
    """Keep titles reasonable; never cut mid-word or chop the Board name.

    Prefer the full ``Board of Project Stewardship`` suffix. If the string is
    still long, shorten the page-specific left side — never emit
    ``Board of Project`` or ``Board of``.
    """
    title = re.sub(r"\s+", " ", (title or "").strip())
    if len(title) <= limit:
        return title
    if title.endswith(TITLE_SUFFIX):
        left = title[: -len(TITLE_SUFFIX)].rstrip()
        room = max(limit - len(TITLE_SUFFIX), 0)
        if room < 8:
            return BRAND_NAME
        if len(left) <= room:
            return f"{left}{TITLE_SUFFIX}"
        cut = left[:room].rsplit(" ", 1)[0]
        cut = re.sub(
            r"(\s+(?:in|of|for|and|the|a|an|to|vs|versus|&|—|–|-))+$",
            "",
            cut,
            flags=re.I,
        ).rstrip(" |-,;:—–")
        return f"{cut}{TITLE_SUFFIX}" if cut else BRAND_NAME
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
        loc = ""
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
                city, rest = [p.strip() for p in loc.split(" · ", 1)]
                if re.search(r"\d", rest):
                    phone = rest
                else:
                    specialty = rest
            else:
                city = loc
        tel_m = re.search(r'href="tel:[^"]+"[^>]*>([^<]+)</a>', block)
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
    """True only if the file exists on disk (will ship with GH Pages when not gitignored).
    CDN-MAP is a fallback for prefix_asset when the local file is absent — do not
    treat CDN presence as on-domain availability.
    """
    rel = (rel or "").lstrip("./")
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
        if not cand or not cand.lower().endswith((".webp", ".jpg", ".jpeg")):
            continue
        if asset_exists(cand) or cand.startswith("assets/images/"):
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
    """Optional post hero under assets/images/posts/, else first in-body still, else category fallback."""
    import re as _re

    slug = post.get("slug", "")
    date = post.get("date", "")
    candidates: list[str] = []
    alias = POST_HERO_ALIASES.get(slug)
    if alias:
        candidates.append(alias)
    candidates.append(f"{slug}-hero.webp")
    if date:
        candidates.append(f"{date}-{slug}-1.webp")
        posts_dir = SITE_DIR / "assets" / "images" / "posts"
        if posts_dir.is_dir():
            tokens = [
                tok
                for tok in slug.replace("_", "-").split("-")
                if len(tok) > 3 and tok not in {"replacement", "coastal"}
            ]
            for path in sorted(posts_dir.glob(f"{date}-*-1.webp")):
                name = path.name.lower()
                if any(tok in name for tok in tokens):
                    candidates.append(path.name)
                    break
    for name in candidates:
        rel = f"assets/images/posts/{name}"
        if asset_exists(rel):
            return rel
    body = post.get("body_md") or post.get("body") or ""
    for match in _re.finditer(
        r"\((?:\.\./)?assets/images/posts/([^)]+\.(?:webp|jpg|jpeg|png))\)",
        body,
    ):
        rel = f"assets/images/posts/{match.group(1)}"
        if asset_exists(rel):
            return rel
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
    # Font Awesome is deferred to </body> (fix #40).
    # Tailwind CDN remains known CWV debt: a full self-hosted purge build of every
    # utility class used across ~80+ pages is large and risk of visual break is high;
    # keep CDN + dns-prefetch as the practical win (SRI hashes on the live Tailwind
    # play CDN are not stable across releases — do not invent integrity attributes).
    # Inter is self-hosted (variable + key static weights) under assets/fonts/.
    return """  <link rel="preconnect" href="https://cdn.tailwindcss.com" crossorigin>
  <link rel="dns-prefetch" href="https://cdn.tailwindcss.com">
  <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com">
  <link rel="preload" href="/assets/fonts/InterVariable.woff2" as="font" type="font/woff2" crossorigin>
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
  <style>
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
      src: url('/assets/fonts/InterVariable.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url('/assets/fonts/Inter-Regular.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url('/assets/fonts/Inter-Medium.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 600;
      font-display: swap;
      src: url('/assets/fonts/Inter-SemiBold.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 700;
      font-display: swap;
      src: url('/assets/fonts/Inter-Bold.woff2') format('woff2');
    }
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
    .prose-board a { color: #4ade80; text-decoration: underline; }
    .prose-board h2 { font-size: 1.5rem; font-weight: 800; color: white; margin: 1.75rem 0 0.75rem; }
    .prose-board h3 { font-size: 1.15rem; font-weight: 700; color: white; margin: 1.25rem 0 0.5rem; }
    .prose-board p, .prose-board li { color: #cbd5e1; font-weight: 300; line-height: 1.7; margin-bottom: 0.85rem; }
    .prose-board ul { list-style: disc; padding-left: 1.25rem; margin-bottom: 1rem; }
    .prose-board ol { list-style: decimal; padding-left: 1.25rem; margin-bottom: 1rem; }
    .prose-board strong { color: #fff; font-weight: 600; }
    .prose-board .post-figure {
      margin: 1.5rem 0;
      border-radius: 0.75rem;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.02);
    }
    .prose-board .post-figure img {
      display: block;
      width: 100%;
      height: auto;
      max-height: 32rem;
      object-fit: cover;
    }
    .prose-board .post-figure figcaption {
      padding: 0.65rem 0.9rem;
      font-size: 0.85rem;
      color: #94a3b8;
      font-weight: 300;
      line-height: 1.4;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .prose-board .video-embed {
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
    .prose-board .video-embed iframe {
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
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    details.board-faq > summary:focus-visible { outline: 2px solid #4ade80; outline-offset: 2px; }
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
        ("home", href("index.html"), "Home"),
        ("about", href("about.html"), "About"),
        ("directory", href("directory.html"), "Directories"),
        ("learn", href("learn.html"), "Learn"),
        ("permits", href("permits.html"), "Permits"),
        ("verify-contractor", href("verify-contractor.html"), "Verify"),
        ("how-we-rank", href("how-we-rank.html"), "How we rank"),
        ("blog", href("blog.html"), "Blog"),
    ]
    # Cities live under Learn + Directories hubs only (mega-nav collapse).
    more_dirs = [
        ("additions", href("additions.html"), "Additions"),
        ("custom-homes", href("custom-homes.html"), "Custom Homes"),
        ("edmonds", href("edmonds-custom-homes.html"), "Edmonds Top 30"),
        ("kitchen", href("kitchen.html"), "Kitchen"),
        ("bathrooms", href("bathrooms.html"), "Bathrooms"),
        ("commercial", href("commercial.html"), "Commercial"),
        ("spec-homes", href("spec-homes.html"), "Spec"),
        ("trades", href("trades.html"), "Trades"),
    ]
    more_tools = [
        ("faq", href("faq.html"), "FAQ"),
        ("adu", href("adu.html"), "Edmonds ADU"),
        ("contact", href("contact.html"), "Contact"),
        ("steward", href("good-steward.html"), "Good Steward"),
        ("hire-questions", href("hire-questions.html"), "Hire Questions"),
        ("hiring-a-contractor", href("hiring-a-contractor.html"), "Hiring a Contractor"),
        ("kitchen-remodel-planning", href("kitchen-remodel-planning.html"), "Kitchen Remodel Planning"),
        ("bathroom-waterproofing-guide", href("bathroom-waterproofing-guide.html"), "Bathroom Waterproofing"),
        ("home-addition-planning", href("home-addition-planning.html"), "Home Addition Planning"),
        ("glossary", href("glossary.html"), "Glossary"),
        ("story", href("another-story.html"), "Another Story · Board feature"),
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
            <div id="more-dropdown" class="absolute right-0 mt-2 w-72 max-h-[70vh] overflow-y-auto rounded-lg border border-white/10 bg-charcoal shadow-xl py-2 z-50" role="menu">
              {more_items}
            </div>
          </div>
          <a href="https://pacificprogroup.com/" target="_blank" rel="noopener" class="hidden lg:inline-flex items-center gap-1 ml-1 px-2.5 py-1 rounded border border-secondary/40 text-[10px] font-bold uppercase tracking-widest text-secondary hover:bg-secondary/10 transition" title="Board directory #1 hire ranking">Board #1 · PPG<span class="sr-only"> — Pacific Pro Group (opens in new window)</span></a>
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
        ("about", f"{prefix}about.html", "About"),
        ("directory", f"{prefix}directory.html", "Directories"),
        ("learn", f"{prefix}learn.html", "Learn"),
        ("how-we-rank", f"{prefix}how-we-rank.html", "How we rank"),
        ("additions", f"{prefix}additions.html", "Additions Top 30"),
        ("custom-homes", f"{prefix}custom-homes.html", "Custom homes"),
        ("edmonds", f"{prefix}edmonds-custom-homes.html", "Edmonds custom homes"),
        ("kitchen", f"{prefix}kitchen.html", "Kitchen remodelers"),
        ("bathrooms", f"{prefix}bathrooms.html", "Bathroom remodelers"),
        ("commercial", f"{prefix}commercial.html", "Commercial GCs"),
        ("spec-homes", f"{prefix}spec-homes.html", "Spec homes"),
        ("trades", f"{prefix}trades.html", "Trade contractors"),
        ("learn", f"{prefix}learn.html", "Learn hub"),
        ("permits", f"{prefix}permits.html", "Permit hub"),
        ("adu", f"{prefix}adu.html", "Edmonds ADU"),
        ("verify-contractor", f"{prefix}verify-contractor.html", "Verify contractor"),
        ("blog", f"{prefix}blog.html", "Blog"),
        ("steward", f"{prefix}good-steward.html", "Good Steward"),
        ("build-walkthrough", f"{prefix}build-walkthrough.html", "Build Walkthrough"),
        ("site-visit", f"{prefix}site-visit.html", "Site Visit Checklist"),
        ("pm-dashboard", f"{prefix}pm-dashboard.html", "PM Dashboard"),
        ("adu-checklist", f"{prefix}adu-checklist.html", "ADU checklist"),
        ("change-orders", f"{prefix}change-orders.html", "Change orders"),
        ("coastal-waterproofing", f"{prefix}coastal-waterproofing.html", "Coastal waterproofing"),
        ("hire-questions", f"{prefix}hire-questions.html", "Hire questions"),
        ("hiring-a-contractor", f"{prefix}hiring-a-contractor.html", "Hiring a contractor"),
        ("second-story-vs-teardown", f"{prefix}second-story-vs-teardown.html", "Second story vs teardown"),
        ("kitchen-remodel-planning", f"{prefix}kitchen-remodel-planning.html", "Kitchen remodel planning"),
        ("bathroom-waterproofing-guide", f"{prefix}bathroom-waterproofing-guide.html", "Bathroom waterproofing"),
        ("home-addition-planning", f"{prefix}home-addition-planning.html", "Home addition planning"),
        ("bid-comparison", f"{prefix}bid-comparison.html", "Bid comparison"),
        ("red-flags-hiring", f"{prefix}red-flags-hiring.html", "Red flags hiring"),
        ("project-timeline", f"{prefix}project-timeline.html", "Project timeline"),
        ("final-walkthrough", f"{prefix}final-walkthrough.html", "Final walkthrough"),
        ("bonds-and-insurance", f"{prefix}bonds-and-insurance.html", "Bonds & insurance"),
        ("design-build-vs-bid", f"{prefix}design-build-vs-bid.html", "Design-build vs bid"),
        ("remodel-cost-factors", f"{prefix}remodel-cost-factors.html", "Remodel cost factors"),
        ("kitchen-cost-factors", f"{prefix}kitchen-cost-factors.html", "Kitchen cost factors"),
        ("bathroom-cost-factors", f"{prefix}bathroom-cost-factors.html", "Bathroom cost factors"),
        ("addition-cost-factors", f"{prefix}addition-cost-factors.html", "Addition cost factors"),
        ("adu-cost-factors", f"{prefix}adu-cost-factors.html", "ADU cost factors"),
        ("financing-and-draws", f"{prefix}financing-and-draws.html", "Financing & draws"),
        ("living-through-remodel", f"{prefix}living-through-remodel.html", "Living through remodel"),
        ("selecting-finishes", f"{prefix}selecting-finishes.html", "Selecting finishes"),
        ("contractor-contract-basics", f"{prefix}contractor-contract-basics.html", "Contract basics (WA)"),
        ("materials", f"{prefix}materials.html", "Materials index"),
        ("glossary", f"{prefix}glossary.html", "Glossary"),
        ("videos", f"{prefix}videos.html", "Video library"),
        ("contact", f"{prefix}contact.html", "Contact"),
        ("story", f"{prefix}another-story.html", "Another Story · Board feature"),
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
        "energy-credit": "energy-credit.html",
        "energy-credits": "energy-credit.html",
        "build-walkthrough": "build-walkthrough.html",
        "story": "another-story.html",
        "steward": "good-steward.html",
        "permits": "permits.html",
        "adu": "adu.html",
        "how-we-rank": "how-we-rank.html",
        "verify-contractor": "verify-contractor.html",
        "adu-checklist": "adu-checklist.html",
        "change-orders": "change-orders.html",
        "coastal-waterproofing": "coastal-waterproofing.html",
        "hire-questions": "hire-questions.html",
        "materials": "materials.html",
        "contact": "contact.html",
        "glossary": "glossary.html",
        "videos": "videos.html",
    }
    name = names.get(slug, f"{slug}.html")
    return f"{prefix}{name}" if prefix else f"./{name}"



def ppg_trustindex_as_of_label() -> str:
    """Human label for Trustindex editorial snapshot date."""
    raw = str(PPG.get("trustindex_as_of") or "2026-09")
    if raw.startswith("2026-09"):
        return "Sept 2026"
    return raw


def ppg_trustindex_phrase(*, short: bool = False) -> str:
    """Public Trustindex aggregate with as-of date — re-check live; not a Board-owned fact."""
    label = ppg_trustindex_as_of_label()
    if short:
        return f"{PPG['rating']} · {PPG['reviews']} reviews (as of {label}; re-check live)"
    return (
        f"Trustindex aggregate {PPG['rating']}★ · {PPG['reviews']} reviews "
        f"(as of {label}; re-check live)"
    )



# Site-root hub stems linked from posts must use ../ (or absolute), not ./ under /posts/
POST_ROOT_HUB_STEMS = frozenset({
    "remodel-cost-factors", "kitchen-cost-factors", "bathroom-cost-factors",
    "addition-cost-factors", "adu-cost-factors", "permits", "hire-questions",
    "hiring-a-contractor", "how-we-rank", "verify-contractor", "learn", "directory",
    "adu", "adu-checklist", "change-orders", "coastal-waterproofing", "materials",
    "glossary", "contact", "about", "faq", "site-visit", "pm-dashboard",
    "energy-credit", "build-walkthrough", "good-steward", "another-story",
    "kitchen", "bathrooms", "additions", "custom-homes", "edmonds-custom-homes",
    "trades", "blog", "index", "windows", "roofing", "insulation", "siding",
    "commercial", "spec-homes", "videos", "write", "bid-comparison",
    "home-addition-planning", "kitchen-remodel-planning", "bathroom-waterproofing-guide",
    "second-story-vs-teardown", "bonds-and-insurance", "contractor-contract-basics",
    "design-build-vs-bid",
})


def rewrite_post_root_hrefs(html: str, post_basenames: set[str] | None = None) -> str:
    """After markdown→HTML for a post, rewrite href="./X.html" → ../X.html when X is site-root."""
    known_posts = post_basenames or set()

    def repl(m: re.Match) -> str:
        quote = m.group(1)
        path = m.group(2)
        if path.startswith(("http://", "https://", "#", "mailto:", "/", "../")):
            return m.group(0)
        stem = path[2:] if path.startswith("./") else path
        if "/" in stem or not stem.endswith(".html"):
            return m.group(0)
        if stem in known_posts or re.match(r"^\d{4}-\d{2}-\d{2}-", stem):
            return m.group(0)
        # Non-post root pages must resolve from /posts/ via ../
        return f"href={quote}../{stem}{quote}"

    return re.sub(r'href=(["\'])([^"\']+)\1', repl, html)



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
        'Explore a second-story concept on your own photo. Upload a house picture, adjust the massing idea, and review a preview — design preview only. Not a bid, permit, structural calculation, or construction document.</p>\n'
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
    walk_href = public_tool_href("build-walkthrough", prefix)
    return f"""  <aside id="good-steward-cta" class="max-w-6xl mx-auto px-4 py-8 relative z-20 border-t border-white/5">
    <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">Good Steward Tools</p>
    <h2 class="text-xl font-black text-white tracking-tight mb-2">Site visit and PM checklists</h2>
    <p class="text-sm text-slate-400 font-light leading-relaxed max-w-3xl mb-4">Good Steward tools for Edmonds / coastal Puget Sound. Data stays in your browser on this device.</p>
    <div class="flex flex-wrap gap-3">
      <a href="{open_steward}" class="bg-primary text-white px-5 py-3 rounded font-bold hover:bg-emerald-700 transition uppercase tracking-wider text-xs">Good Steward guide</a>
      <a href="{walk_href}" class="border border-white/20 bg-white/5 text-white px-5 py-3 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-xs">Build Walkthrough</a>
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
        <p class="text-sm text-slate-400 font-light leading-relaxed max-w-xl">Same home. Another story. Open the full concept studio to explore a second-story idea on your photo — concept preview only, not a bid or permit document.</p>
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
    walk_href = public_tool_href("build-walkthrough", prefix)
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
        '    <div class="grid md:grid-cols-3 gap-4 mb-8">\n'
        f'      <a href="{walk_href}" class="block bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 card-hover no-underline">\n'
        '        <p class="text-[11px] font-bold uppercase tracking-widest text-secondary mb-2">Walkthrough</p>\n'
        '        <h3 class="text-lg font-black text-white mb-2">Build Walkthrough</h3>\n'
        '        <p class="text-sm text-slate-400 font-light leading-relaxed">Visual stages from blueprint to framing to finished home, with homeowner checklists.</p>\n'
        '      </a>\n'
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




WALKTHROUGH_STAGES = [
    ("01-sales-discovery.webp", "Sales / discovery", "Vision, budget reality, coastal site notes"),
    ("02-plans-blueprints.webp", "Plans & blueprints", "Layouts and elevations — illustrative only"),
    ("03-permits-lni.webp", "Permits & L&I", "Posted permits and license hygiene"),
    ("04-site-foundation.webp", "Site / foundation", "Excavation, rebar, pour, waterproofing"),
    ("05-framing.webp", "Framing", "Stud walls rising — featured 3D moment"),
    ("06-sheathing-dryin.webp", "Sheathing / dry-in", "OSB, WRB, roof weather-tight"),
    ("07-mep-roughin.webp", "MEP rough-in", "HVAC, plumbing, electrical in open walls"),
    ("08-insulation-wrb.webp", "Insulation / WRB", "Cavity fill and energy-path habits"),
    ("09-drywall-paint.webp", "Drywall / paint", "Hang, tape, texture, primer, paint"),
    ("10-finishes-fixtures.webp", "Finishes / fixtures", "Cabinets, counters, flooring, fixtures"),
    ("11-punch-closeout.webp", "Punch / closeout", "Walkthrough, finals, touch-ups"),
    ("12-warranty-handoff.webp", "Warranty handoff", "Finished house and steward contacts"),
]


def build_walkthrough_home_section(prefix: str = "") -> str:
    """Prominent homepage embed: Build Walkthrough iframe + plan-photos strip."""
    src = tools_href("build-walkthrough", prefix, "index.html")
    land = public_tool_href("build-walkthrough", prefix)
    thumbs = []
    for i, (fname, label, blurb) in enumerate(WALKTHROUGH_STAGES, 1):
        rel = f"assets/images/tools/build-walkthrough/{fname}"
        if not asset_exists(rel):
            continue
        img = prefix_asset(rel, prefix)
        thumbs.append(
            "        <figure class=\"shrink-0 w-36 sm:w-40 rounded-lg overflow-hidden border border-white/10 bg-charcoal relative\">\n"
            f'          <div class="aspect-[4/3] bg-obsidian relative">\n'
            f'            <img src="{img}" alt="Stage {i}: {esc(label)} — {esc(blurb)}" '
            'class="absolute inset-0 w-full h-full object-cover" width="320" height="240" loading="lazy">\n'
            f'            <span class="absolute bottom-0 inset-x-0 z-10 text-[10px] uppercase tracking-wider text-secondary font-bold px-2 py-1 bg-black/65">'
            f"{i} · {esc(label)}</span>\n"
            "          </div>\n"
            f'          <figcaption class="px-2 py-1.5 text-[10px] text-slate-500 font-light leading-snug">{esc(blurb)}</figcaption>\n'
            "        </figure>"
        )
    strip = "\n".join(thumbs)
    return f"""  <section id="build-walkthrough" class="mb-14">
    <div class="mb-6 border-b border-white/10 pb-4">
      <span class="text-secondary text-xs font-bold uppercase tracking-widest">Good Steward Tools</span>
      <h2 class="text-3xl font-black text-white tracking-tight">See how a project is built</h2>
      <p class="text-slate-400 font-light mt-3 max-w-3xl leading-relaxed">Interactive walkthrough from sales discovery to warranty handoff — blueprints, 3D framing walls rising, then a finished Pacific Northwest home. Checklist language mirrors Site Visit &amp; Discovery and the PM Dashboard. Illustrative media, not engineering docs. <a href="{land}" class="text-secondary hover:underline">Open full landing</a>.</p>
    </div>
    <iframe
      id="build-walkthrough-home"
      src="{src}"
      title="Build Walkthrough — Board of Project Stewardship"
      loading="lazy"
      style="display:block;width:100%;height:920px;border:0;border-radius:18px;background:#0a0a0a;"
    ></iframe>
    <script>
    (() => {{
      const frame = document.getElementById('build-walkthrough-home');
      if (!frame) return;
      const trustedOrigin = new URL(frame.src, window.location.href).origin;
      window.addEventListener('message', (event) => {{
        if (event.origin !== trustedOrigin || event.source !== frame.contentWindow) return;
        if (event.data?.type !== 'build-walkthrough:resize') return;
        const height = Number(event.data.height);
        if (Number.isFinite(height) && height >= 400 && height <= 16000) {{
          frame.style.height = `${{Math.min(Math.ceil(height) + 2, 1400)}}px`;
        }}
      }});
    }})();
    </script>
    <div class="mt-5">
      <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-3">Plan photo strip</p>
      <div class="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
{strip}
      </div>
      <p class="text-[11px] text-slate-600 mt-2 leading-relaxed">Illustrative stages for homeowners — not a bid, permit set, or schedule commitment.</p>
    </div>
  </section>
"""


def board_organization_website_ld() -> dict:
    """Board Organization + WebSite JSON-LD (Packet 03). Not LocalBusiness/GC."""
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": "https://boardofprojectstewardship.com/#organization",
                "name": "Board of Project Stewardship",
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
    canon = canonical or (BASE_URL + ("" if active in ("home", "about-home") else f"{active}.html" if active != "blog" else "blog.html"))
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
        # Directory heroes may be gitignored locally but still ship on Pages.
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
    contact_strip = ""
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
{ppg_widgets_html(pfx)}
  </div>
''' if include_widgets else ""}{tools_block}
{story_block}
</main>
{footer_html(prefix if prefix else "./", active)}
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"></noscript>
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
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-emerald-400/30 bg-emerald-950/40 text-emerald-300">{ppg_trustindex_phrase(short=True)}</span>
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">Edmonds-based</span>
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">Google · Thumbtack · HomeAdvisor</span>
          </div>
          <p class="text-slate-300 mb-4 leading-relaxed font-light">
            {esc(note or PPG['note'])} Pacific Pro Group ranks #1 based on strong local presence, remodel focus, and a
            <a href="{PPG['trustindex']}" target="_blank" rel="noopener" class="text-secondary hover:underline">{ppg_trustindex_phrase()}</a>.
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


def howto_ld(
    name: str,
    description: str,
    steps: list[tuple[str, str]],
    page_url: str,
) -> dict:
    """HowTo JSON-LD. steps = [(name, text), ...]. No times/prices/costs."""
    return {
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": name,
        "description": description,
        "url": page_url,
        "step": [
            {
                "@type": "HowToStep",
                "position": i,
                "name": title,
                "text": body,
            }
            for i, (title, body) in enumerate(steps, 1)
        ],
    }


def related_learning_strip(
    links: list[tuple[str, str]],
    heading: str = "Related learning",
    blurb: str = "Board educational hubs — habits and verification, not invented prices or ROI.",
) -> str:
    cards = "".join(
        f'''      <a href="{href}" class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 card-hover block no-underline">
        <h3 class="text-base font-black text-white mb-1">{esc(label)}</h3>
        <p class="text-xs text-secondary font-bold uppercase tracking-widest">Open guide -></p>
      </a>
'''
        for label, href in links
    )
    return f'''    <section class="mb-14" id="related-learning" aria-labelledby="related-learning-h">
      <div class="mb-6 border-b border-white/10 pb-4">
        <span class="text-secondary text-xs font-bold uppercase tracking-widest">Learn</span>
        <h2 id="related-learning-h" class="text-2xl font-black text-white tracking-tight">{esc(heading)}</h2>
        <p class="text-slate-400 font-light mt-2 max-w-3xl text-sm leading-relaxed">{esc(blurb)} <a href="./learn.html" class="text-secondary hover:underline">All learning hubs</a>.</p>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
{cards}      </div>
    </section>
'''


# ---------------------------------------------------------------------------
# Official outbound links + related learning packs (Steward wave 2026-09-20)
# ---------------------------------------------------------------------------

OFFICIAL_LINKS: dict[str, tuple[str, str]] = {
    "lni_verify": ("WA L&I Verify (contractor license)", LNI_URL),
    "lni_home": ("Washington State Department of Labor & Industries", "https://www.lni.wa.gov/"),
    "lni_hire_smart": (
        "L&I Hire Smart Step-by-Step",
        "https://lni.wa.gov/licensing-permits/contractors/hiring-a-contractor/hire-smart-step-by-step",
    ),
    "lni_hiring_hub": (
        "L&I Hiring a Contractor hub",
        "https://www.lni.wa.gov/licensing-permits/contractors/hiring-a-contractor/",
    ),
    "lni_hire_pdf": (
        "L&I Hire Smart worksheet (PDF)",
        "https://www.lni.wa.gov/forms-publications/F625-111-000.pdf",
    ),
    "lni_protect": (
        "L&I Protect My Home tips",
        "https://www.lni.wa.gov/licensing-permits/contractors/hiring-a-contractor/protect-my-home",
    ),
    "mybuildingpermit": ("MyBuildingPermit (regional portal)", "https://mybuildingpermit.com/"),
    "seattle_how": (
        "How to get a Seattle permit (SDCI)",
        "https://www.seattle.gov/construction-and-inspections/permits/how-do-you-get-a-permit",
    ),
    "seattle_portal": ("Seattle Services Portal", "https://cosaccela.seattle.gov/portal/"),
    "seattle_sdci": ("Seattle SDCI", "https://www.seattle.gov/sdci"),
    "edmonds": ("City of Edmonds", "https://www.edmondswa.gov/"),
    "edmonds_permits": (
        "Edmonds permit assistance",
        "https://www.edmondswa.gov/services/permit_assistance",
    ),
    "king_permits": (
        "King County permits & inspections (local services)",
        "https://kingcounty.gov/en/dept/local-services/certificates-permits-licenses/permits/permits-inspections-codes-buildings-land-use",
    ),
    "king_accela": (
        "King County permitting portal (Accela)",
        "https://aca-prod.accela.com/KINGCO/Default.aspx",
    ),
    "snohomish_pds": (
        "Snohomish County Planning & Development Services",
        "https://www.snohomishcountywa.gov/198/Planning-Development-Services",
    ),
    "shoreline_etrait": ("Shoreline eTRAKiT", "https://permits.shorelinewa.gov/eTRAKiT/"),
    "shoreline": ("City of Shoreline", "https://www.shorelinewa.gov/"),
    "lynnwood": ("City of Lynnwood", "https://www.lynnwoodwa.gov/"),
    "sbcc": ("WA State Building Code Council", "https://sbcc.wa.gov/"),
}

RELATED_LINK_PACKS: dict[str, list[tuple[str, str]]] = {
    "default": [
        ("Learn hub", "./learn.html"),
        ("Permit hub", "./permits.html"),
        ("Verify a WA contractor", "./verify-contractor.html"),
        ("How we rank", "./how-we-rank.html"),
        ("Hire interview questions", "./hire-questions.html"),
        ("Sitewide FAQ", "./faq.html"),
    ],
    "permits": [
        ("Permit hub", "./permits.html"),
        ("Edmonds ADU", "./adu.html"),
        ("ADU readiness checklist", "./adu-checklist.html"),
        ("Verify contractor", "./verify-contractor.html"),
        ("Learn hub", "./learn.html"),
        ("About the Board", "./about.html"),
    ],
    "verify": [
        ("Verify contractor walkthrough", "./verify-contractor.html"),
        ("How we rank", "./how-we-rank.html"),
        ("Hire interview questions", "./hire-questions.html"),
        ("Red flags when hiring", "./red-flags-hiring.html"),
        ("Bonds & insurance", "./bonds-and-insurance.html"),
        ("Learn hub", "./learn.html"),
    ],
    "learn": [
        ("Learn hub", "./learn.html"),
        ("Glossary", "./glossary.html"),
        ("Video library", "./videos.html"),
        ("Materials index", "./materials.html"),
        ("Good Steward", "./good-steward.html"),
        ("Sitewide FAQ", "./faq.html"),
    ],
    "directories": [
        ("Directories hub", "./directory.html"),
        ("Home additions", "./additions.html"),
        ("Kitchen remodelers", "./kitchen.html"),
        ("Bathroom remodelers", "./bathrooms.html"),
        ("Custom homes", "./custom-homes.html"),
        ("Trades hub", "./trades.html"),
        ("How we rank", "./how-we-rank.html"),
    ],
    "cost_factors": [
        ("Remodel cost factors", "./remodel-cost-factors.html"),
        ("Kitchen cost factors", "./kitchen-cost-factors.html"),
        ("Bathroom cost factors", "./bathroom-cost-factors.html"),
        ("Addition cost factors", "./addition-cost-factors.html"),
        ("ADU cost factors", "./adu-cost-factors.html"),
        ("Bid comparison checklist", "./bid-comparison.html"),
    ],
    "hire": [
        ("Hire interview questions", "./hire-questions.html"),
        ("Hiring a contractor", "./hiring-a-contractor.html"),
        ("Red flags when hiring", "./red-flags-hiring.html"),
        ("Verify contractor", "./verify-contractor.html"),
        ("Change orders & allowances", "./change-orders.html"),
        ("Bid comparison", "./bid-comparison.html"),
    ],
    "adu": [
        ("Edmonds ADU hub", "./adu.html"),
        ("ADU readiness checklist", "./adu-checklist.html"),
        ("ADU cost factors", "./adu-cost-factors.html"),
        ("Permit hub", "./permits.html"),
        ("Home additions directory", "./additions.html"),
        ("Learn hub", "./learn.html"),
    ],
    "tools": [
        ("Good Steward hub", "./good-steward.html"),
        ("Site Visit Checklist", "./site-visit.html"),
        ("Build Walkthrough", "./build-walkthrough.html"),
        ("PM Dashboard", "./pm-dashboard.html"),
        ("Energy code credits", "./energy-credit.html"),
        ("Learn hub", "./learn.html"),
    ],
}


def related_pack(*packs: str, extra: list[tuple[str, str]] | None = None, exclude: set[str] | None = None) -> list[tuple[str, str]]:
    """Merge named related-link packs; de-dupe by href; optional extras."""
    exclude = exclude or set()
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    names = packs or ("default",)
    for name in names:
        for label, href in RELATED_LINK_PACKS.get(name, []):
            if href in exclude or href in seen:
                continue
            seen.add(href)
            out.append((label, href))
    for label, href in extra or []:
        if href in exclude or href in seen:
            continue
        seen.add(href)
        out.append((label, href))
    return out[:9]


def official_links_section(
    keys: list[str] | None = None,
    extra: list[tuple[str, str]] | None = None,
    heading: str = "Official resources",
    blurb: str = (
        "Outbound links to government portals only. The Board of Project Stewardship does not issue "
        "permits or licenses. Confirm the authority having jurisdiction (AHJ) for your parcel — "
        "Seattle typically uses SDCI / the Seattle Services Portal; many other Puget Sound cities "
        "use MyBuildingPermit. Always re-verify contractors at WA L&I Verify before hiring."
    ),
) -> str:
    """Reusable official .gov (and regional permit portal) link block."""
    keys = keys or ["lni_verify", "lni_home", "mybuildingpermit", "seattle_how"]
    items: list[tuple[str, str]] = []
    seen: set[str] = set()
    for k in keys:
        if k not in OFFICIAL_LINKS:
            continue
        label, href = OFFICIAL_LINKS[k]
        if href in seen:
            continue
        seen.add(href)
        items.append((label, href))
    for label, href in extra or []:
        if href in seen:
            continue
        seen.add(href)
        items.append((label, href))
    lis = "".join(
        (
            f'<li><a href="{href}" target="_blank" rel="noopener" '
            f'class="text-secondary hover:underline">{esc(label)}</a></li>'
        )
        for label, href in items
    )
    return (
        '    <section class="mb-14" id="official-resources" aria-labelledby="official-resources-h">\n'
        '      <div class="mb-6 border-b border-white/10 pb-4">\n'
        '        <span class="text-secondary text-xs font-bold uppercase tracking-widest">Official</span>\n'
        f'        <h2 id="official-resources-h" class="text-2xl font-black text-white tracking-tight">{esc(heading)}</h2>\n'
        f'        <p class="text-slate-400 font-light mt-2 max-w-3xl text-sm leading-relaxed">{esc(blurb)}</p>\n'
        "      </div>\n"
        '      <ul class="space-y-2 text-sm text-slate-300 font-light list-disc pl-5">\n'
        f"{lis}\n"
        "      </ul>\n"
        "    </section>\n"
    )


def education_closing(
    *packs: str,
    official_keys: list[str] | None = None,
    official_extra: list[tuple[str, str]] | None = None,
    related_extra: list[tuple[str, str]] | None = None,
    exclude_href: set[str] | None = None,
) -> str:
    """Standard closing: official .gov links + related_learning_strip inside max-width wrapper."""
    links = related_pack(*(packs or ("default",)), extra=related_extra, exclude=exclude_href)
    return (
        '  <div class="max-w-6xl mx-auto px-4">\n'
        f"{official_links_section(official_keys, extra=official_extra)}"
        f"{related_learning_strip(links)}"
        "  </div>\n"
    )


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



# Settled Project Stewardship layers (Alex 2026-09-20) — shared by Integrity Shield + homepage.
STEWARDSHIP_LAYERS = [
    (
        "fa-scale-balanced",
        "Financial Solvency",
        "Active bonding capacity reviewed against project loads to reduce over-leveraging risk.",
    ),
    (
        "fa-ruler-combined",
        "Technical Review (McMorrough Protocol)",
        "Portfolio review against architecture and construction reference standards using the McMorrough Protocol — an editorial lens for drawings, detailing, and completed work. Not a professional license or certification.",
    ),
    (
        "fa-user-tie",
        "Project Steward",
        "Expectation of a designated project steward for continuity (no salesman handoffs).",
    ),
    (
        "fa-map-location-dot",
        "Local Mastery",
        "Proven navigation of Edmonds Bowl height restrictions, permits, and critical areas across King and Snohomish jurisdictions.",
    ),
    (
        "fa-id-card",
        "WA L&I License",
        "Preference for firms with active Washington contractor registration. Homeowners should re-verify status at L&I Verify before hiring.",
    ),
    (
        "fa-stamp",
        "Permit ownership",
        "Clear answers on who pulls and owns each permit, who schedules inspections, and who closes corrections before cover-up. The Board does not issue permits.",
    ),
]



# City / neighborhood hubs — linked from Learn + Directories only (not primary mega-nav).
CITY_HUB_LINKS: list[tuple[str, str]] = [
    ("Seattle hub", "./seattle.html"),
    ("King County hub", "./king-county.html"),
    ("Snohomish County hub", "./snohomish-county.html"),
    ("Edmonds project hub", "./edmonds.html"),
    ("Edmonds custom homes", "./edmonds-custom-homes.html"),
    ("Shoreline", "./shoreline.html"),
    ("Lynnwood", "./lynnwood.html"),
    ("Ballard", "./ballard.html"),
    ("Magnolia", "./magnolia.html"),
    ("Mukilteo", "./mukilteo.html"),
    ("Kirkland", "./kirkland.html"),
    ("Bothell", "./bothell.html"),
    ("Queen Anne", "./queen-anne.html"),
    ("Phinney Ridge", "./phinney-ridge.html"),
    ("Greenwood", "./greenwood.html"),
    ("Lake Forest Park", "./lake-forest-park.html"),
    ("Mountlake Terrace", "./mountlake-terrace.html"),
    ("Mill Creek", "./mill-creek.html"),
]


def city_hubs_section(
    heading: str = "City & neighborhood hubs",
    blurb: str = "Local Board hubs for Edmonds / King & Snohomish — permitting orientation and shortlist links. Not a complete contractor roster.",
) -> str:
    links = _link_ul(CITY_HUB_LINKS)
    return _hub_section(heading, f"""      <p class="text-sm text-slate-400 font-light leading-relaxed mb-3">{esc(blurb)}</p>
{links}""")


def learn_directory_bridge_html(
    *,
    topic: str,
    directory_href: str,
    directory_label: str,
    learn_href: str,
    learn_label: str,
    extra_links: list[tuple[str, str]] | None = None,
) -> str:
    """Bidirectional body module: directory ↔ matching planning guide."""
    extras = "".join(
        f'<li><a href="{href}" class="text-secondary hover:underline">{esc(label)}</a></li>'
        for label, href in (extra_links or [])
    )
    return f"""    <section id="learn-directory-bridge" class="mb-12 bg-charcoal border border-secondary/30 rounded-xl p-6 md:p-8" aria-labelledby="learn-dir-bridge-h">
      <span class="text-secondary text-xs font-bold uppercase tracking-widest">Learn ↔ Directory</span>
      <h2 id="learn-dir-bridge-h" class="text-2xl font-black text-white tracking-tight mt-1 mb-3">{esc(topic)}</h2>
      <p class="text-sm text-slate-300 font-light leading-relaxed mb-4">Use the planning guide for questions and sequencing, then shortlist from the matching Board directory. Re-verify every legal name at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a> before any deposit. Rankings are editorial — not invented prices or ROI.</p>
      <div class="grid sm:grid-cols-2 gap-3 mb-3">
        <a href="{learn_href}" class="bg-obsidian border border-white/10 hover:border-secondary/40 rounded-lg p-4 no-underline block">
          <div class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Planning</div>
          <div class="text-base font-black text-white">{esc(learn_label)}</div>
        </a>
        <a href="{directory_href}" class="bg-obsidian border border-white/10 hover:border-secondary/40 rounded-lg p-4 no-underline block">
          <div class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Directory</div>
          <div class="text-base font-black text-white">{esc(directory_label)}</div>
        </a>
      </div>
      <ul class="text-sm text-slate-400 font-light space-y-1 list-disc pl-5">
        <li><a href="./how-we-rank.html" class="text-secondary hover:underline">How we rank</a></li>
        <li><a href="./verify-contractor.html" class="text-secondary hover:underline">Verify a WA contractor</a></li>
        <li><a href="./learn.html" class="text-secondary hover:underline">Learn hub</a> · <a href="./directory.html" class="text-secondary hover:underline">Directories hub</a></li>
        {extras}
      </ul>
    </section>
"""


def resolve_post_parent_directory(post: dict) -> tuple[str, str]:
    """Map post category/slug → parent directory (href, label) for post outro."""
    cat = (post.get("category") or "").strip().lower()
    slug = (post.get("slug") or post.get("out_name") or "").lower()
    title = (post.get("title") or "").lower()
    blob = f"{cat} {slug} {title}"
    if any(k in blob for k in ("kitchen",)):
        return ("./kitchen.html", "Kitchen remodelers directory")
    if any(k in blob for k in ("bath", "shower", "waterproof")):
        return ("./bathrooms.html", "Bathroom remodelers directory")
    if any(k in blob for k in ("addition", "second-story", "second story", "adu")):
        return ("./additions.html", "Home additions directory")
    if any(k in blob for k in ("custom home", "custom-home")):
        return ("./custom-homes.html", "Custom homes directory")
    if any(k in blob for k in ("hire", "hiring", "red flag", "contract", "verify")):
        return ("./hiring-a-contractor.html", "Hiring a contractor hub")
    if any(k in blob for k in ("permit",)):
        return ("./permits.html", "Permit jurisdiction hub")
    return ("./directory.html", "Contractor directories hub")


def post_outro_html(post: dict, *, prefix: str = "../") -> str:
    """Generator-level blog/post outro: parent directory + How we rank + L&I Verify."""
    dir_href, dir_label = resolve_post_parent_directory(post)
    # Posts live under posts/; adjust relative links
    def adj(href: str) -> str:
        if href.startswith("./"):
            return prefix + href[2:]
        if href.startswith("http"):
            return href
        return prefix + href.lstrip("/")

    return f"""    <section id="post-outro" class="mt-12 mb-4 bg-charcoal border border-white/10 rounded-xl p-6 md:p-8" aria-labelledby="post-outro-h">
      <span class="text-secondary text-xs font-bold uppercase tracking-widest">Next steps</span>
      <h2 id="post-outro-h" class="text-xl font-black text-white tracking-tight mt-1 mb-3">Directory · ranking method · L&amp;I Verify</h2>
      <p class="text-sm text-slate-300 font-light leading-relaxed mb-4">This article is educational Board of Project Stewardship guidance — not a bid, schedule guarantee, or price list. Shortlist from a matching directory, read how rankings work, then re-verify every contract legal name on the official WA L&amp;I tool before deposits.</p>
      <ul class="space-y-2 text-sm text-slate-300 font-light">
        <li><a href="{adj(dir_href)}" class="text-secondary hover:underline font-semibold">{esc(dir_label)}</a></li>
        <li><a href="{adj('./how-we-rank.html')}" class="text-secondary hover:underline">How we rank</a> — published editorial method, not paid placement.</li>
        <li><a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a> — official contractor license lookup.</li>
        <li><a href="{adj('./verify-contractor.html')}" class="text-secondary hover:underline">Board verify walkthrough</a> · <a href="{adj('./learn.html')}" class="text-secondary hover:underline">Learn hub</a> · <a href="{adj('./blog.html')}" class="text-secondary hover:underline">Blog</a></li>
      </ul>
    </section>
"""


def integrity_shield_html(
    subtitle: str = (
        "Six layers the Board uses when screening contractors — public records, local mastery, and clear permit ownership. Not paid placement and not a certification product."
    ),
) -> str:
    """Reusable Integrity Shield block: six Project Stewardship layers in a 2×3 / 3×2 grid."""
    cards = []
    for icon, title, blurb in STEWARDSHIP_LAYERS:
        if title == "WA L&I License":
            body = (
                f'Preference for firms with active Washington contractor registration. '
                f'Homeowners should re-verify status at '
                f'<a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">L&amp;I Verify</a> '
                f'before hiring.'
            )
        else:
            body = esc(blurb)
        cards.append(f"""        <div class="bg-charcoal border border-white/10 hover:border-primary/40 rounded-xl p-6 card-hover">
          <div class="w-11 h-11 rounded-lg bg-primary/20 border border-secondary/30 flex items-center justify-center mb-4">
            <i class="fas {icon} text-secondary text-lg" aria-hidden="true"></i>
          </div>
          <h3 class="text-lg font-black text-white mb-2 tracking-tight">{esc(title)}</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">{body}</p>
        </div>""")
    cards_html = "\n".join(cards)
    return f"""    <section id="integrity-shield" class="mb-14">
      <div class="mb-8 border-b border-white/10 pb-4">
        <span class="text-secondary text-xs font-bold uppercase tracking-widest">Integrity Shield</span>
        <h2 class="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <i class="fas fa-shield-halved text-secondary" aria-hidden="true"></i>
          <span>Six layers of project stewardship</span>
        </h2>
        <p class="text-slate-400 font-light mt-2 max-w-3xl">{subtitle}</p>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
{cards_html}
      </div>
    </section>"""


def ppg_widgets_html(prefix: str = "") -> str:
    """Project Factor Guide, Directory #1 outbound, and Service Region — sitewide above footer."""
    pfx = prefix if prefix else "./"
    how = f"{pfx}how-we-rank.html"
    additions = f"{pfx}additions.html"
    directory = f"{pfx}directory.html"
    verify = f"{pfx}verify-contractor.html"
    cost = f"{pfx}remodel-cost-factors.html"
    permits = f"{pfx}permits.html"
    hire = f"{pfx}hire-questions.html"
    return f"""    <section id="tools" class="mb-6">
      <div class="mb-8 border-b border-white/10 pb-4">
        <span class="text-secondary text-xs font-bold uppercase tracking-widest">Planning Tools</span>
        <h2 class="text-3xl font-black text-white tracking-tight">Planning tools · Directory #1 · Service region</h2>
      </div>
      <div class="grid lg:grid-cols-3 gap-4">
        <div class="bg-charcoal border border-white/10 rounded-xl p-6">
          <h3 class="text-lg font-black text-white mb-2 tracking-tight flex items-center gap-2"><i class="fas fa-clipboard-list text-secondary"></i> Project Factor Guide</h3>
          <p class="text-xs text-slate-500 mb-4 font-light">Educational planning checklist — <strong class="text-slate-300 font-semibold">not a bid</strong>, not market pricing, and <strong class="text-slate-300 font-semibold">not Pacific Pro Group pricing</strong>. Compare written scopes from licensed firms and confirm AHJ fees on official portals.</p>
          <label class="block text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1" for="calc-scope">Project scope</label>
          <select id="calc-scope" class="w-full mb-3 bg-black/40 border border-white/15 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-secondary">
            <option value="kitchen">Kitchen remodel</option>
            <option value="bath">Bathroom remodel</option>
            <option value="addition" selected>Home addition</option>
            <option value="adu">ADU / DADU</option>
            <option value="custom">Custom / whole-home</option>
          </select>
          <label class="block text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1" for="calc-drivers">Complexity drivers to discuss with bidders</label>
          <select id="calc-drivers" class="w-full mb-4 bg-black/40 border border-white/15 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-secondary">
            <option value="site">Site access, drainage, coastal exposure</option>
            <option value="structure" selected>Structure, openings, second-story loads</option>
            <option value="finish">Finish level and fixture lead times</option>
            <option value="ahj">Permit path / AHJ review intensity</option>
          </select>
          <div class="bg-white/5 border border-white/10 rounded-lg px-4 py-3">
            <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Board guidance</div>
            <div id="calc-result" class="text-sm font-light text-slate-300 mt-1 leading-relaxed">Pick a scope and driver to see what to ask in bids — dollar totals belong on contractor proposals, not this page.</div>
          </div>
          <p class="text-[11px] text-slate-500 mt-3 font-light"><a href="{cost}" class="text-secondary hover:underline">Cost-factor guides</a> · <a href="{permits}" class="text-secondary hover:underline">Permit hub</a> · <a href="{hire}" class="text-secondary hover:underline">Hire questions</a></p>
        </div>
        <div class="bg-charcoal border border-white/10 rounded-xl p-6">
          <h3 class="text-lg font-black text-white mb-2 tracking-tight flex items-center gap-2"><i class="fas fa-trophy text-secondary"></i> Directory #1</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed mb-4">The Board ranks <strong class="text-white font-semibold">Pacific Pro Group</strong> #1 for Edmonds / King &amp; Snohomish remodel and additions focus. Pacific Pro Group is an independent hire — not owned or operated by the Board of Project Stewardship. Outbound only; re-verify at WA L&amp;I before any deposit.</p>
          <a href="{PPG['url']}" target="_blank" rel="noopener" class="inline-flex w-full items-center justify-center gap-2 bg-primary text-white py-3 rounded font-bold hover:bg-emerald-700 transition uppercase tracking-wider text-xs mb-4">
            View Pacific Pro Group (directory #1) <i class="fas fa-arrow-up-right-from-square text-[10px]"></i>
          </a>
          <p class="text-[11px] text-slate-500 font-light leading-relaxed">
            <a href="{how}" class="text-secondary hover:underline">How we rank</a>
            · <a href="{additions}" class="text-secondary hover:underline">Additions Top 30</a>
            · <a href="{directory}" class="text-secondary hover:underline">Directories hub</a>
            · <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">L&amp;I Verify</a>
            · <a href="{verify}" class="text-secondary hover:underline">Board verify walkthrough</a>
          </p>
        </div>
        <div class="bg-charcoal border border-white/10 rounded-xl p-6">
          <h3 class="text-lg font-black text-white mb-2 tracking-tight flex items-center gap-2"><i class="fas fa-location-dot text-secondary"></i> Service Region</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed mb-4">Primary coverage emphasized in this Edmonds / North Sound directory:</p>
          <ul class="space-y-2 text-sm text-slate-300 font-light mb-5">
            <li><i class="fas fa-circle text-[6px] text-secondary mr-2 align-middle"></i>Edmonds &amp; the Edmonds Bowl</li>
            <li><i class="fas fa-circle text-[6px] text-secondary mr-2 align-middle"></i>Shoreline · Lynnwood · Mukilteo · Mountlake Terrace</li>
            <li><i class="fas fa-circle text-[6px] text-secondary mr-2 align-middle"></i>South Snohomish &amp; North King County</li>
            <li><i class="fas fa-circle text-[6px] text-secondary mr-2 align-middle"></i>Greater Seattle metro (by firm)</li>
          </ul>
          <a href="{PPG['url']}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-secondary hover:underline">
            Pacific Pro Group site (directory #1) <i class="fas fa-arrow-up-right-from-square text-[10px]"></i>
          </a>
        </div>
      </div>
    </section>"""



def ppg_widgets_script() -> str:
    """Factor-guide JS shared on every page (no invented dollar totals)."""
    return """  <script>
  (function () {
    var tips = {
      kitchen: {
        site: 'Ask how demo dust, temporary kitchen plans, and cabinet lead times are handled in the written schedule.',
        structure: 'Confirm whether walls are load-bearing, if an engineer is needed, and who owns framing inspections.',
        finish: 'Separate allowances from fixed packages; get brand/model lists and lead-time assumptions in writing.',
        ahj: 'Verify whether the kitchen triggers a building permit only, or also electrical/plumbing/mechanical permits in your AHJ.'
      },
      bath: {
        site: 'In coastal King/Snohomish homes, press on waterproofing stacks, fan ducting to exterior, and moisture detailing.',
        structure: 'Ask how pan, curb, and blocking are detailed before tile; get the waterproofing product stack in the scope.',
        finish: 'Tile layout, niches, and glass lead times drive duration — require a finish schedule before deposit.',
        ahj: 'Confirm bathroom fan, GFCI, and waterproofing inspection holds with your city or county AHJ.'
      },
      addition: {
        site: 'Discuss setbacks, drainage, tree protection, and construction access before design is locked.',
        structure: 'Second-story and opening enlargements need clear engineering ownership and dry-in milestones.',
        finish: 'Exterior cladding and window packages often gate dry-in — get lead times on the critical path.',
        ahj: 'Use the Board permit hub, then your AHJ portal for fees/timelines — Board pages do not invent calendars.'
      },
      adu: {
        site: 'Confirm lot coverage, parking, and utility taps early; Edmonds and Seattle rules are not interchangeable.',
        structure: 'Detached vs attached ADUs change foundation and fire-separation details — put the typology in the contract.',
        finish: 'Kitchenette and bath packages inside an ADU still need allowance rules and inspection sequencing.',
        ahj: 'Read the Board Edmonds ADU hub for orientation, then finish on the official portal for that parcel\'s AHJ.'
      },
      custom: {
        site: 'Custom homes hinge on site surveys, soils, and coastal exposure — ask who owns each diligence item.',
        structure: 'Demand a single steward for drawings, engineering, and field changes so RFIs do not orphan the schedule.',
        finish: 'Finish boards and long-lead items should be frozen before framing when possible; document exceptions.',
        ahj: 'Large permits move through multiple reviews — ask for a responsibility matrix, not a promised month count.'
      }
    };
    function update() {
      var scope = document.getElementById('calc-scope');
      var drivers = document.getElementById('calc-drivers');
      var el = document.getElementById('calc-result');
      if (!scope || !drivers || !el) return;
      var s = scope.value, d = drivers.value;
      el.textContent = (tips[s] && tips[s][d]) ? tips[s][d] : 'Compare written scopes; verify every firm at WA L&I before deposits.';
    }
    var scope = document.getElementById('calc-scope');
    var drivers = document.getElementById('calc-drivers');
    if (scope) scope.addEventListener('change', update);
    if (drivers) drivers.addEventListener('change', update);
    update();
  })();
  </script>"""


# ---------- Page builders ----------

def build_about() -> str:
    # Six stewardship layers live in STEWARDSHIP_LAYERS / integrity_shield_html().
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
        'Board of Project Stewardship<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">Standards and contractor directories for Edmonds / King &amp; Snohomish</span>',
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

{build_walkthrough_home_section()}

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
        <a href="{public_tool_href('build-walkthrough')}" class="border border-white/20 bg-white/5 text-white px-5 py-3.5 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-xs">Build Walkthrough</a>
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
            <li class="flex gap-3"><i class="fas fa-check text-secondary mt-1"></i><span><strong class="text-white">Public review aggregate</strong> — {ppg_trustindex_phrase()}; WA license chip <strong class="text-white">{PPG['license']}</strong> — always re-verify at L&amp;I.</span></li>
          </ul>
          <div class="flex flex-wrap gap-2 mb-6">
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-emerald-400/30 bg-emerald-950/40 text-emerald-300">WA License {PPG['license']}</span>
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">{ppg_trustindex_phrase(short=True)}</span>
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
              {ppg_trustindex_phrase(short=True)}
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
        <p class="text-slate-400 font-light mt-3 max-w-3xl leading-relaxed">Editorial process and remodel imagery for Edmonds / coastal Puget Sound work. Editorial and stock frames are labeled illustrative in alt text.</p>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
{gallery}
      </div>
    </section>

{integrity_shield_html()}

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

    <section class="mb-14" id="cornerstone-reading">
      <div class="mb-8 border-b border-white/10 pb-4">
        <span class="text-secondary text-xs font-bold uppercase tracking-widest">From the Board journal</span>
        <h2 class="text-3xl font-black text-white tracking-tight">Cornerstone reading</h2>
        <p class="text-slate-400 font-light mt-3 max-w-3xl leading-relaxed">Six editorial posts that pair with Board directories and Good Steward tools — permits, hiring, waterproofing, and addition path decisions. Educational only; no invented prices or timelines.</p>
      </div>
      <ul class="grid sm:grid-cols-2 gap-3 text-sm text-slate-300 font-light">
        <li class="bg-charcoal border border-white/10 rounded-xl p-4"><a href="./posts/2026-08-12-edmonds-home-addition-permit-basics.html" class="text-secondary hover:underline font-semibold">Edmonds home addition permit basics</a> — AHJ start-here habits before design freeze.</li>
        <li class="bg-charcoal border border-white/10 rounded-xl p-4"><a href="./posts/2026-08-11-hire-design-build-edmonds.html" class="text-secondary hover:underline font-semibold">Hire design-build in Edmonds</a> — when one steward beats a trade-only chase.</li>
        <li class="bg-charcoal border border-white/10 rounded-xl p-4"><a href="./posts/2026-08-18-pnw-bathroom-waterproofing-essentials.html" class="text-secondary hover:underline font-semibold">PNW bathroom waterproofing essentials</a> — wet-area discipline for coastal baths.</li>
        <li class="bg-charcoal border border-white/10 rounded-xl p-4"><a href="./posts/2026-08-09-second-story-vs-teardown-edmonds.html" class="text-secondary hover:underline font-semibold">Second story vs teardown (Edmonds)</a> — compare paths without invented cost claims.</li>
        <li class="bg-charcoal border border-white/10 rounded-xl p-4"><a href="./posts/2026-08-12-hire-kitchen-remodeler-king-snohomish.html" class="text-secondary hover:underline font-semibold">Hire a kitchen remodeler (King &amp; Snohomish)</a> — shortlist habits before cabinet day.</li>
        <li class="bg-charcoal border border-white/10 rounded-xl p-4"><a href="./posts/2026-09-07-adu-planning-edmonds-wa.html" class="text-secondary hover:underline font-semibold">ADU planning Edmonds WA</a> — parcel and portal honesty before stock plans.</li>
      </ul>
      <p class="text-sm text-slate-500 font-light mt-4"><a href="./blog.html" class="text-secondary hover:underline">Browse the full blog</a> · <a href="./learn.html" class="text-secondary hover:underline">Learn hub</a> · <a href="./how-we-rank.html" class="text-secondary hover:underline">How we rank</a></p>
    </section>

    <section class="mb-14" id="learn">
      <div class="mb-8 border-b border-white/10 pb-4">
        <span class="text-secondary text-xs font-bold uppercase tracking-widest">Learn before you hire</span>
        <h2 class="text-3xl font-black text-white tracking-tight">Planning hubs &amp; client tools</h2>
        <p class="text-slate-400 font-light mt-3 max-w-3xl leading-relaxed">Educational Board guides for remodels and additions — paired with verification tools. No invented prices, licenses, or awards.</p>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <a href="./hiring-a-contractor.html" class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 card-hover block">
          <h3 class="text-base font-black text-white mb-2">Hiring a contractor</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">L&amp;I verify path, interview habits, and how Board rankings work.</p>
        </a>
        <a href="./kitchen-remodel-planning.html" class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 card-hover block">
          <h3 class="text-base font-black text-white mb-2">Kitchen remodel planning</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">Layout, allowances, and permit ownership before cabinet day.</p>
        </a>
        <a href="./bathroom-waterproofing-guide.html" class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 card-hover block">
          <h3 class="text-base font-black text-white mb-2">Bathroom waterproofing</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">Wet-area systems and coastal moisture habits for Puget Sound baths.</p>
        </a>
        <a href="./home-addition-planning.html" class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 card-hover block">
          <h3 class="text-base font-black text-white mb-2">Home addition planning</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">Jurisdiction, dry-in sequencing, and addition shortlist links.</p>
        </a>
        <a href="./second-story-vs-teardown.html" class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 card-hover block">
          <h3 class="text-base font-black text-white mb-2">Second story vs teardown</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">Compare paths without invented cost guarantees.</p>
        </a>
        <div class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 card-hover">
          <h3 class="text-base font-black text-white mb-2">Bid comparison &amp; red flags</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed"><a href="./bid-comparison.html" class="text-secondary hover:underline">Bid checklist</a> · <a href="./red-flags-hiring.html" class="text-secondary hover:underline">red flags</a> · <a href="./project-timeline.html" class="text-secondary hover:underline">timeline phases</a>.</p>
        </div>
      </div>
      <p class="text-sm text-slate-400 font-light mb-3"><a href="./learn.html" class="text-secondary hover:underline font-semibold">Browse the full Learn hub</a> — permits, ADU, verify, checklists, stewardship layers, glossary, videos, and Good Steward tools.</p>
      <p class="text-sm text-slate-500 font-light">City hubs: <a href="./edmonds.html" class="text-secondary hover:underline">Edmonds</a> · <a href="./greenwood.html" class="text-secondary hover:underline">Greenwood</a> · <a href="./lake-forest-park.html" class="text-secondary hover:underline">Lake Forest Park</a> · <a href="./mountlake-terrace.html" class="text-secondary hover:underline">Mountlake Terrace</a> · <a href="./mill-creek.html" class="text-secondary hover:underline">Mill Creek</a> · <a href="./mukilteo.html" class="text-secondary hover:underline">Mukilteo</a> · <a href="./kirkland.html" class="text-secondary hover:underline">Kirkland</a> · <a href="./bothell.html" class="text-secondary hover:underline">Bothell</a> · <a href="./queen-anne.html" class="text-secondary hover:underline">Queen Anne</a> · <a href="./phinney-ridge.html" class="text-secondary hover:underline">Phinney Ridge</a> · <a href="./shoreline.html" class="text-secondary hover:underline">Shoreline</a> · <a href="./lynnwood.html" class="text-secondary hover:underline">Lynnwood</a> · <a href="./ballard.html" class="text-secondary hover:underline">Ballard</a> · <a href="./magnolia.html" class="text-secondary hover:underline">Magnolia</a></p>
    </section>

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
            Pacific Pro Group ranks #1 with a verified <strong class="text-white font-semibold">{ppg_trustindex_phrase(short=True)}</strong>.
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
        "The Board of Project Stewardship publishes construction standards and contractor directories for Edmonds and King & Snohomish — hire from the Board shortlist.",
        "home",
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
            "Timelines vary widely by size, structural complexity, coastal or critical-area constraints, design readiness, and city permit review workload. Design and permitting often consume a large share of the calendar before construction starts. Ask your GC and the Edmonds / MyBuildingPermit path for expectations on your parcel — the Board does not promise month ranges.",
        ),
        (
            "How much does a home addition cost in Edmonds / North Seattle?",
            "Costs vary widely by square footage, foundation type, finishes, and whether the work is a single-story bump-out, second-story, or ADU-style addition. The Board does not publish invented prices or ROI. Compare written scopes from multiple licensed firms and read the Board addition cost-factor guide for qualitative drivers only.",
        ),
        (
            "Do I need a permit for a home addition in Edmonds?",
            "Yes. Structural home additions in Edmonds typically require building permits plus related electrical, plumbing, and mechanical permits, and may trigger site development or environmental review depending on the property. Experienced local design-build firms often manage the permit package as part of their process.",
        ),
        (
            "How does The Board of Project Stewardship rank contractors?",
            "Rankings emphasize MBAKS Remodelers Council membership, clear service area coverage for Edmonds / King & Snohomish, an additions or whole-home remodel focus, and public reputation signals from company sites and review aggregates. This is an editorial directory updated in 2026. Pacific Pro Group is ranked #1 — " + ppg_trustindex_phrase() + ".",
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
{how_we_rank_block(' Also see <a href="./home-addition-planning.html" class="text-secondary hover:underline">addition planning</a>, <a href="./second-story-vs-teardown.html" class="text-secondary hover:underline">second story vs teardown</a>, and <a href="./hiring-a-contractor.html" class="text-secondary hover:underline">hiring a contractor</a>.')}
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
{learn_directory_bridge_html(
            topic="Additions: plan first, then shortlist",
            directory_href="./additions.html",
            directory_label="Home additions directory",
            learn_href="./home-addition-planning.html",
            learn_label="Home addition planning guide",
            extra_links=[
                ("Addition cost factors", "./addition-cost-factors.html"),
                ("Second story vs teardown", "./second-story-vs-teardown.html"),
            ],
        )}
{related_learning_strip([
            ("Home addition planning", "./home-addition-planning.html"),
            ("Addition cost factors", "./addition-cost-factors.html"),
            ("Second story vs teardown", "./second-story-vs-teardown.html"),
            ("Hiring a contractor", "./hiring-a-contractor.html"),
            ("Permit hub", "./permits.html"),
            ("Project timeline", "./project-timeline.html"),
            ("Learn hub", "./learn.html"),
        ], heading="Related learning for additions")}
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
            f"Pacific Pro Group is ranked #1 on this editorial list with {ppg_trustindex_phrase()}, strong Edmonds presence, and remodel focus. Always re-verify licensing at WA L&I before hiring.",
        ),
        (
            f"What should I ask a {label.lower()} contractor?",
            "Ask who pulls permits, how allowances work for cabinets and finishes, timeline for selections, and for recent local project references similar to your scope.",
        ),
        (
            "Do kitchen and bath remodels need permits in Edmonds?",
            "Often yes — especially when moving plumbing, electrical, or walls. Confirm with the City of Edmonds / MyBuildingPermit and your contractor; many design-build firms manage the permit package. See our permit jurisdiction hub for official portals.",
        ),
        (
            "How does this list relate to home additions?",
            "Many of the same design-build remodelers appear on our home additions Top 30. See the additions directory for structural expansion specialists.",
        ),
        (
            "How should I verify a firm before depositing?",
            "Match the legal business name on the contract to WA L&I Verify, confirm active license, bond, and insurance, then ask for recent local references with similar scope.",
        ),
        (
            "Is The Board of Project Stewardship a general contractor?",
            "No. The Board publishes editorial directories and standards. Pacific Pro Group appears as Board directory #1 for hire — not as an owner of the Board.",
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
{how_we_rank_block(f' Also see <a href="./additions.html" class="text-secondary hover:underline">home additions</a>, <a href="./trades.html" class="text-secondary hover:underline">trade directories</a>, <a href="./kitchen-remodel-planning.html" class="text-secondary hover:underline">kitchen planning</a>, <a href="./bathroom-waterproofing-guide.html" class="text-secondary hover:underline">bath waterproofing</a>, and <a href="./hiring-a-contractor.html" class="text-secondary hover:underline">hiring a contractor</a>.')}
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
{learn_directory_bridge_html(
            topic=("Kitchen remodel: plan ↔ directory" if is_kitchen else "Bathroom remodel: plan ↔ directory"),
            directory_href=("./kitchen.html" if is_kitchen else "./bathrooms.html"),
            directory_label=("Kitchen remodelers directory" if is_kitchen else "Bathroom remodelers directory"),
            learn_href=("./kitchen-remodel-planning.html" if is_kitchen else "./bathroom-waterproofing-guide.html"),
            learn_label=("Kitchen remodel planning" if is_kitchen else "Bathroom waterproofing guide"),
            extra_links=(
                [("Kitchen cost factors", "./kitchen-cost-factors.html"), ("Hire questions", "./hire-questions.html")]
                if is_kitchen
                else [("Bathroom cost factors", "./bathroom-cost-factors.html"), ("Coastal waterproofing", "./coastal-waterproofing.html")]
            ),
        )}
{related_learning_strip(
            [
                ("Kitchen remodel planning", "./kitchen-remodel-planning.html"),
                ("Kitchen cost factors", "./kitchen-cost-factors.html"),
                ("Hiring a contractor", "./hiring-a-contractor.html"),
                ("Bid comparison", "./bid-comparison.html"),
                ("Permit hub", "./permits.html"),
                ("Materials index", "./materials.html"),
                ("Learn hub", "./learn.html"),
            ]
            if is_kitchen
            else [
                ("Bathroom waterproofing guide", "./bathroom-waterproofing-guide.html"),
                ("Bathroom cost factors", "./bathroom-cost-factors.html"),
                ("Coastal waterproofing checklist", "./coastal-waterproofing.html"),
                ("Hiring a contractor", "./hiring-a-contractor.html"),
                ("Permit hub", "./permits.html"),
                ("Materials index", "./materials.html"),
                ("Learn hub", "./learn.html"),
            ],
            heading=f"Related learning for {label.lower()}s",
        )}
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
        + "Pacific Pro Group is Board directory #1 — "
        + ppg_trustindex_phrase()
        + "."
    )
    faqs = [
        (
            "Who ranks #1 for custom homes in Edmonds?",
            f"Pacific Pro Group is ranked #1 on this editorial list with {ppg_trustindex_phrase()}, "
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
        (
            "Where should I learn addition vs custom-home planning?",
            "Read Home addition planning and Second story vs teardown for expansion literacy, then Hiring a contractor before deposits. Custom-home shortlists stay on this page and Edmonds custom homes.",
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
{how_we_rank_block(' Also see <a href="./additions.html" class="text-secondary hover:underline">home additions</a>, <a href="./home-addition-planning.html" class="text-secondary hover:underline">addition planning</a>, <a href="./hiring-a-contractor.html" class="text-secondary hover:underline">hiring a contractor</a>, <a href="./spec-homes.html" class="text-secondary hover:underline">spec homes</a>, and <a href="./commercial.html" class="text-secondary hover:underline">commercial</a>.')}
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
    body = body + education_closing("directories", "default", official_keys=["lni_verify", "lni_home", "mybuildingpermit"])
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
            f'border border-emerald-400/30 bg-emerald-950/40 text-emerald-300">{ppg_trustindex_phrase(short=True)}</span>'
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
        + "Pacific Pro Group ranks #1 — "
        + ppg_trustindex_phrase()
        + ". Permit guide, rankings, and local tools."
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
                + ppg_trustindex_phrase()
                + "."
            )
        ranked.append(item)
    ranked.sort(key=lambda x: x["rank"])

    faqs = [
        (
            "Who ranks #1 for custom homes in Edmonds?",
            f"Pacific Pro Group is ranked #1 on this editorial Top 30 with {ppg_trustindex_phrase()}, Edmonds presence, and a dedicated custom homes focus. "
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
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-emerald-400/30 bg-emerald-950/40 text-emerald-300">{ppg_trustindex_phrase(short=True)}</span>
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">Licensed</span>
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">Insured &amp; Bonded</span>
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">Design-Build</span>
            <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">License {PPG['license']}</span>
          </div>
          <p class="text-slate-300 mb-4 leading-relaxed font-light">
            Edmonds-based design-build firm specializing in high-end custom homes with coastal durability.
            Pacific Pro Group ranks #1 based on strong local presence, custom / remodel focus, and a
            <a href="{PPG['trustindex']}" target="_blank" rel="noopener" class="text-secondary hover:underline">{ppg_trustindex_phrase()}</a>
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

    var KEY = 'board_ppg_endorsements_v1';
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
        if (sessionStorage.getItem('board_ppg_endorsed')) return;
        var n = loadCount() + 1;
        saveCount(n);
        sessionStorage.setItem('board_ppg_endorsed', '1');
        countEl.textContent = String(n);
        btn.textContent = 'Thanks for endorsing';
        btn.disabled = true;
      });
      if (sessionStorage.getItem('board_ppg_endorsed')) {
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
    body = body + education_closing(
        "directories",
        "learn",
        "permits",
        official_keys=["lni_verify", "lni_home", "edmonds", "edmonds_permits", "mybuildingpermit"],
        related_extra=[
            ("Learn hub", "./learn.html"),
            ("Home addition planning", "./home-addition-planning.html"),
            ("Custom homes (regional)", "./custom-homes.html"),
            ("Hiring a contractor", "./hiring-a-contractor.html"),
        ],
    )

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
    <section class="bg-charcoal rounded-xl p-6 md:p-8 border border-primary/20 mb-10" id="editorial-criteria">
      <h2 class="text-lg font-black text-white mb-3 tracking-tight">Editorial criteria (commercial / TI)</h2>
      <p class="text-sm text-slate-400 font-light leading-relaxed mb-3">
        This Board shortlist favors firms with a clear King &amp; Snohomish commercial or tenant-improvement footprint,
        public WA contractor registration signals, and transparent contact paths. It is an editorial preview ranking —
        not a paid placement list, bond guarantee, or capacity calendar.
      </p>
      <ul class="space-y-2 text-sm text-slate-300 font-light list-disc pl-5 mb-3">
        <li>Local service area for Edmonds / Lynnwood corridor and greater King &amp; Snohomish commercial work.</li>
        <li>Specialty fit: ground-up commercial GC vs TI / light commercial remodel appetite stated in public materials.</li>
        <li>Institutional or public reputation signals where available — never invented awards or review scores.</li>
        <li>Homeowners and owners must still re-verify every legal name at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a> and confirm bonding capacity for the job size.</li>
      </ul>
      <p class="text-sm text-slate-500 font-light leading-relaxed">Full methodology: <a href="./how-we-rank.html" class="text-secondary hover:underline">How we rank</a>. Residential remodel packages belong on <a href="./kitchen.html" class="text-secondary hover:underline">Kitchen</a> / <a href="./additions.html" class="text-secondary hover:underline">Additions</a>, not this list.</p>
    </section>
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
    body = body + education_closing("directories", "verify", "default", official_keys=["lni_verify", "lni_home", "lni_hire_smart", "mybuildingpermit", "seattle_sdci"])
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
    <section class="bg-charcoal rounded-xl p-6 md:p-8 border border-primary/20 mb-14" id="editorial-criteria">
      <h2 class="text-lg font-black text-white mb-2 tracking-tight flex items-center gap-2">
        <i class="fas fa-house-flag text-secondary"></i> Editorial criteria · honest framing
      </h2>
      <p class="text-sm text-slate-400 font-light leading-relaxed mb-3">
        This directory covers <strong class="text-slate-200 font-semibold">speculative and production</strong> home builders
        in the region — firms known for for-sale inventory or community models — not owner-commissioned custom homes alone.
        Lower ranks may include hybrids; card notes say so explicitly. Editorial shortlist only — not paid placement.
      </p>
      <ul class="space-y-2 text-sm text-slate-300 font-light list-disc pl-5 mb-3">
        <li>Evidence of for-sale / community product in King or Snohomish Counties (or honest hybrid labeling when custom firms occasionally sell completed homes).</li>
        <li>Public WA contractor registration signals buyers can re-check at L&amp;I before reservation deposits.</li>
        <li>Transparent sales or company contact paths — no invented community inventories or price bands on Board pages.</li>
        <li>Owner-custom one-off builds belong on <a href="./custom-homes.html" class="text-secondary hover:underline">Custom homes</a>; remodel packages on <a href="./additions.html" class="text-secondary hover:underline">Additions</a>.</li>
      </ul>
      <p class="text-sm text-slate-500 font-light leading-relaxed">Methodology: <a href="./how-we-rank.html" class="text-secondary hover:underline">How we rank</a>. Re-verify: <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a>.</p>
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
    body = body + education_closing("directories", "verify", "default", official_keys=["lni_verify", "lni_home", "lni_hire_smart", "mybuildingpermit"])
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
            "Either path is common. Use a specialty hire for single-craft scopes; use a design-build GC when kitchen, bath, or addition work needs one steward for permits and sequencing. Specialty pages help for direct hire or a second opinion — then re-verify at WA L&I.",
        ),
        (
            "Is the Board a general contractor or trade firm?",
            "The Board publishes construction standards and contractor directories so homeowners can shortlist and hire with clearer criteria. Rankings highlight Board #1 and other verified firms — start there when you are ready to hire.",
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
      <h2 class="text-xl font-black text-white mb-3">Specialty trade vs general contractor</h2>
      <p class="text-slate-300 text-sm font-light leading-relaxed mb-3">Hire a <strong class="text-white font-semibold">specialty trade</strong> when the scope is mostly one craft — a service panel, furnace swap, re-roof, or drain repair — and you (or your designer) will coordinate the rest. Hire a <strong class="text-white font-semibold">general contractor / design-build GC</strong> when several trades must sequence together (kitchen, bath, addition) and you want one written steward for permits, schedule, and punch list.</p>
      <p class="text-slate-300 text-sm font-light leading-relaxed mb-3">These Board directories are editorial shortlists — not paid placement. Prefer Edmonds / South Snohomish specialists when locality matters; broader metro firms appear when they clearly serve the corridor. Re-verify every legal name at <a href="{LNI_URL}" class="text-secondary hover:underline" target="_blank" rel="noopener">WA L&amp;I Verify</a> before any deposit.</p>
      <p class="text-slate-400 text-sm font-light leading-relaxed mb-2">GC directories for multi-trade packages: <a href="./kitchen.html" class="text-secondary hover:underline">Kitchen</a> · <a href="./bathrooms.html" class="text-secondary hover:underline">Bathrooms</a> · <a href="./additions.html" class="text-secondary hover:underline">Additions</a> · <a href="./how-we-rank.html" class="text-secondary hover:underline">How we rank</a>.</p>
      <p class="text-slate-400 text-sm font-light leading-relaxed">Common specialty starts: <a href="./plumber.html" class="text-secondary hover:underline">Plumber</a> · <a href="./electrician.html" class="text-secondary hover:underline">Electrician</a> · <a href="./hvac.html" class="text-secondary hover:underline">HVAC</a> · <a href="./roofing.html" class="text-secondary hover:underline">Roofing</a> · <a href="./verify-contractor.html" class="text-secondary hover:underline">Verify walkthrough</a>.</p>
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
    body = body + education_closing("directories", "verify", "default", official_keys=["lni_verify", "lni_home"])
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
    <p class="text-sm text-slate-500 mb-4"><a href="./trades.html" class="text-secondary hover:underline">← All trades</a></p>
    <section class="bg-charcoal rounded-xl p-5 md:p-6 border border-primary/20 mb-10">
      <h2 class="text-base font-black text-white mb-2 tracking-tight">Specialty vs GC · license check</h2>
      <p class="text-sm text-slate-400 font-light leading-relaxed mb-2">
        Use this specialty shortlist for craft-focused scopes. For multi-trade kitchen, bath, or addition packages, start with a
        <a href="./kitchen.html" class="text-secondary hover:underline">kitchen</a>,
        <a href="./bathrooms.html" class="text-secondary hover:underline">bathroom</a>, or
        <a href="./additions.html" class="text-secondary hover:underline">additions</a> GC directory instead — then bring trades under that steward.
      </p>
      <p class="text-sm text-slate-400 font-light leading-relaxed">
        Before any deposit, re-verify the legal business name at
        <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a>
        (Board walkthrough: <a href="./verify-contractor.html" class="text-secondary hover:underline">verify contractor</a>).
      </p>
    </section>
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
    body = body + education_closing(
        "directories",
        "verify",
        "hire",
        official_keys=["lni_verify", "lni_home", "lni_hire_smart"],
        related_extra=[
            ("Trades hub", "./trades.html"),
            ("Kitchen remodelers", "./kitchen.html"),
            ("Bathroom remodelers", "./bathrooms.html"),
            ("Plumber directory", "./plumber.html"),
            ("Electrician directory", "./electrician.html"),
            ("HVAC directory", "./hvac.html"),
        ],
    )
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

    def local_video_embed(src: str) -> str:
        resolved = src
        if not src.startswith(("http://", "https://", "data:")):
            rel = src[3:] if src.startswith("../") else src.lstrip("./")
            if asset_exists(rel):
                resolved = f"../{rel}"
            elif rel in CDN_MAP:
                resolved = CDN_MAP[rel]
        return (
            f'<div class="video-embed">'
            f'<video controls playsinline preload="metadata" '
            f'style="width:100%;border-radius:12px;background:#000">'
            f'<source src="{esc(resolved)}" type="video/mp4">'
            f'</video></div>'
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
        if stripped in ("tool:energy-credits", "tool:energy-credit", "tool:wa-energy-credit"):
            close_lists()
            src = tools_href("energy-credits", "../", "index.html")
            land = public_tool_href("energy-credits", "../")
            out.append(
                '<div class="tool-embed my-8 border border-white/10 rounded-2xl p-4 sm:p-5 bg-white/[0.03]">'
                '<p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">Good Steward Tools</p>'
                '<h2 class="text-xl font-black text-white tracking-tight mb-2">WSEC-R prescriptive credits</h2>'
                '<p class="text-slate-400 text-sm font-light mb-4">WSEC-R 2021 single-family / townhouse prescriptive energy credit worksheet. '
                f'<a class="text-secondary hover:underline" href="{land}">Open full Board landing</a>.</p>'
                f'<iframe src="{src}" title="WSEC-R prescriptive credits" loading="lazy" '
                'style="display:block;width:100%;height:1180px;border:0;border-radius:18px;background:#f8fafc;"></iframe>'
                '</div>'
            )
            i += 1
            continue
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
        if stripped.endswith(".mp4") or stripped.startswith("video:"):
            close_lists()
            src = stripped[6:].strip() if stripped.startswith("video:") else stripped
            out.append(local_video_embed(src))
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
    featured_slug = posts[0]["slug"] if posts else ""
    cards = []
    for p in posts:
        # Skip featured post in the grid so it is not listed twice
        if featured_slug and p["slug"] == featured_slug:
            continue
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
        # Featured card must not reuse the blog chrome hero (same viewport).
        card_img = resolve_post_hero(top)
        if card_img and hero_img and card_img == hero_img:
            for alt_name in (
                f"assets/images/posts/{top.get('date','')}-edmonds-siding-2.webp",
                f"assets/images/posts/{top.get('date','')}-edmonds-siding-3.webp",
                "assets/images/hubs/hub-edmonds-1.webp",
                "assets/images/home-hero.webp",
            ):
                if asset_exists(alt_name) and alt_name != hero_img:
                    card_img = alt_name
                    break
        card_alt = (
            f"Illustrative cover for {top['title']} — not a real Board of Project Stewardship job photo"
            if card_img
            else ""
        )
        thumb = ""
        if card_img:
            thumb = (
                f'<div class="mb-5 overflow-hidden rounded-lg border border-white/10">'
                f'<img src="{prefix_asset(card_img)}" alt="{esc(card_alt)}" '
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
    <div id="blog-grid" class="grid gap-4 mb-6" data-exclude-slug="{esc(featured_slug)}">
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
    article_html = rewrite_post_root_hrefs(md_to_html(post["body_md"]))
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
    <div class="prose-board">
{article_html}
    </div>
{post_outro_html(post, prefix="../")}
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


# Hand-polished post HTML may include this marker. Regenerating from markdown
# that still points at CloudFront would replace repo assets/ paths in the live page.
POLISHED_POST_MARKER = "<!-- board-post-polished -->"


def post_html_should_be_preserved(existing: str, regenerated: str) -> bool:
    """True when writing regenerated HTML would drop polished markup or repo assets."""
    if existing == regenerated:
        return False
    if POLISHED_POST_MARKER in existing:
        return True
    regenerated_cdn = "cloudfront.net" in regenerated.lower()
    existing_cdn = "cloudfront.net" in existing.lower()
    existing_repo_asset = "../assets/" in existing or "./assets/" in existing
    if regenerated_cdn and not existing_cdn and existing_repo_asset:
        return True
    return False


def refresh_post_html(posts: list[dict]) -> None:
    """Rewrite post HTML from markdown, keeping polished pages and local asset HTML.

    Markdown media must use repo ``assets/...`` paths. A CloudFront URL in
    markdown makes ``build_post_page`` emit that URL and would overwrite a
    polished page that already references ``../assets/...``.
    """
    posts_dir = SITE_DIR / "posts"
    expected = {p["out_name"] for p in posts}
    for old in sorted(posts_dir.glob("*.html")):
        if old.name in expected:
            continue
        text = old.read_text(encoding="utf-8")
        if POLISHED_POST_MARKER in text:
            print(f"  keep polished post HTML outside current markdown set: {old.name}")
            continue
        old.unlink()
    for post in posts:
        dest = posts_dir / post["out_name"]
        regenerated = build_post_page(post)
        if dest.is_file():
            existing = dest.read_text(encoding="utf-8")
            if post_html_should_be_preserved(existing, regenerated):
                print(
                    f"  keep post HTML {dest.name}: regenerate would replace "
                    "repo asset paths or polished markup"
                )
                continue
        dest.write_text(regenerated, encoding="utf-8")


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
| `build-walkthrough.html` | Build Walkthrough landing |
| `site-visit.html` | Site Visit & Discovery landing |
| `pm-dashboard.html` | PM Execution Dashboard landing |
| `energy-credit.html` | WSEC-R energy credits landing |
| `another-story.html` | Another Story Board feature |
| `blog/rss.xml` | Blog RSS feed |
| `404.html` | Branded Board 404 |
{post_lines}
| `POSTING.md` | Publishing agent workflow (ops) |
| `generate_site.py` | Site generator |
| `docs/AGENT-INTAKE.md` | Multi-agent intake contract (ops; Steward publishes) |

## Current #1 (additions / custom homes / Edmonds Top 30 / kitchen / bathrooms)

**Pacific Pro Group** (Edmonds, WA)

- Local Edmonds presence and remodel / additions focus
- Verified public review aggregate: **Trustindex aggregate 4.9★ · 190 reviews (as of Sept 2026; re-check live)** via [Trustindex](https://www.trustindex.io/reviews/pacificprogroup.com)
- Website: https://pacificprogroup.com/ · Phone: (206) 446-5656
- Process PDF: https://pacificprogroup.com/wp-content/uploads/2025/12/Pacific-Pro-Group-Process.pdf

## Generate

```bash
cd bops-site
python3 generate_site.py
```

Sources: `/workspace/top30-addition-contractors.md`, `/workspace/bops-research-kitchen-bath.md`, `/workspace/bops-research-custom-commercial-spec.md`, `/workspace/bops-research-edmonds-custom.md`, `/workspace/bops-research-trades.md`, and `posts/*.md`.

## Agent intake

Local agents drop draft packets in `intake/inbox/submission-id/`. Steward is the only publisher. Dry-run does not write posts or indexes:

```bash
python3 tools/board_intake.py validate intake/inbox/submission-id
python3 tools/board_intake.py publish intake/inbox/submission-id --dry-run
```

`publish --apply` is a deliberate Steward action. CI must not pass `--apply`. The only morning schedule is the existing 10:00 AM PT routine, which calls `python3 tools/board_intake.py morning --apply` after Steward review. This repository does not add a second cron. Contract: `docs/AGENT-INTAKE.md`.

## Notes

- Always re-verify WA contractor status at [L&I Verify](https://secure.lni.wa.gov/verify/) before hiring.
- Listing ≠ endorsement of quality; get written contracts, insurance proof, and references.
- Public pages are authored as **{AUTHOR}**.

## Tech

Multi-page static site. Tailwind CDN + Font Awesome. Relative links for GitHub Pages. JSON-LD `ItemList`, `FAQPage`, `BreadcrumbList`, and blog `Article` where applicable. Tailwind CDN is known render-blocking debt (full self-host Tailwind purge skipped this wave — too large / visual-break risk across 80+ pages; kept CDN + dns-prefetch).

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
        "User-agent: *\nAllow: /\nDisallow: /write.html\nDisallow: /intake/\n\nSitemap: https://boardofprojectstewardship.com/sitemap.xml\n",
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
        "about.html",
        "faq.html",
        "directory.html",
        "blog.html",
        "another-story.html",
        "good-steward.html",
        "build-walkthrough.html",
        "site-visit.html",
        "pm-dashboard.html",
        "energy-credit.html",
        "permits.html",
        "adu.html",
        "how-we-rank.html",
        "verify-contractor.html",
        "shoreline.html",
        "lynnwood.html",
        "ballard.html",
        "magnolia.html",
        "mukilteo.html",
        "kirkland.html",
        "bothell.html",
        "queen-anne.html",
        "phinney-ridge.html",
        "greenwood.html",
        "lake-forest-park.html",
        "mountlake-terrace.html",
        "mill-creek.html",
        "edmonds.html",
        "seattle.html",
        "king-county.html",
        "snohomish-county.html",
        "learn.html",
        "adu-checklist.html",
        "change-orders.html",
        "coastal-waterproofing.html",
        "hire-questions.html",
        "second-story-vs-teardown.html",
        "kitchen-remodel-planning.html",
        "bathroom-waterproofing-guide.html",
        "hiring-a-contractor.html",
        "home-addition-planning.html",
        "bid-comparison.html",
        "red-flags-hiring.html",
        "project-timeline.html",
        "final-walkthrough.html",
        "bonds-and-insurance.html",
        "design-build-vs-bid.html",
        "remodel-cost-factors.html",
        "kitchen-cost-factors.html",
        "bathroom-cost-factors.html",
        "addition-cost-factors.html",
        "adu-cost-factors.html",
        "financing-and-draws.html",
        "living-through-remodel.html",
        "selecting-finishes.html",
        "contractor-contract-basics.html",
        "materials.html",
        "contact.html",
        "glossary.html",
        "videos.html",
        "blog/rss.xml",
        "tools/build-walkthrough/index.html",
        "tools/site-visit/index.html",
        "tools/energy-credit/index.html",
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
      <li><strong class="text-white">Build Walkthrough</strong> — visual sales-to-build stages with homeowner checklists</li>
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
        <a href="{public_tool_href('build-walkthrough')}" class="bg-primary text-white px-5 py-3 rounded font-bold hover:bg-emerald-700 transition uppercase tracking-wider text-xs">Build Walkthrough</a>
        <a href="{public_tool_href('site-visit')}" class="border border-white/20 bg-white/5 text-white px-5 py-3 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-xs">Site Visit &amp; Discovery</a>
        <a href="{public_tool_href('pm-dashboard')}" class="border border-white/20 bg-white/5 text-white px-5 py-3 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-xs">PM Dashboard</a>
        <a href="{public_tool_href('another-story')}" class="border border-white/20 bg-white/5 text-white px-5 py-3 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-xs">Another Story</a>
        <a href="./index.html" class="border border-white/15 text-slate-200 px-5 py-3 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-xs">Back to About</a>
      </div>
    </section>
  </div>
"""
    steward_faqs = [
        (
            "What does a good steward do before hiring?",
            "Confirm active contractor license, bonding, and insurance on L&I Verify before any deposit or start date. Match the business name on the contract. See Hiring a contractor and Red flags when hiring.",
        ),
        (
            "Why does the Board publish Site Visit and PM tools?",
            "Practical checklists for homeowners and builders working on additions and remodels in Edmonds and the coastal Puget Sound. Data stays in your browser. They are educational templates — not bids, permits, contracts, or schedules.",
        ),
        (
            "Is the Board a general contractor?",
            "The Board publishes standards and directories. Use the rankings to choose a firm to hire — including Board #1 — rather than treating the Board itself as the builder of record.",
        ),
        (
            "Where are the planning hubs and bid tools?",
            "Use Kitchen remodel planning, Bathroom waterproofing, Home addition planning, Second story vs teardown, Bid comparison, and Project timeline — all linked from Good Steward and the About page Learn section.",
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
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">Same home. Another story. Upload a house photo, adjust the massing idea, and review a second-story concept before you share it. This is a design preview published as a Board feature — not a bid, permit, structural calculation, or construction document.</p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">Use it to explore whether a second story might fit a North Sound house. Then verify any contractor you hire at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a>. The standalone tool is also at <a href="{tools_href('another-story', '', 'index.html')}" class="text-secondary hover:underline">{SITE_ORIGIN}/tools/another-story/</a> and <a href="https://anotherstorysea.com/" target="_blank" rel="noopener" class="text-secondary hover:underline">anotherstorysea.com</a>.</p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-2">Also listed from Board directory #1: <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">Pacific Pro Group</a>.</p>
  </header>
"""
    return page_shell(
        "Another Story | Board of Project Stewardship",
        "Another Story — Board feature. Second-story design preview for Edmonds and North Sound homes. Not a bid or permit document.",
        "story",
        body,
        canonical=f"{BASE_URL}another-story.html",
        og_image="assets/images/another-story-banner.webp",
        include_story_embed=True,
        include_tools_embed=False,
        include_widgets=False,
        breadcrumbs=[("About", BASE_URL), ("Another Story", f"{BASE_URL}another-story.html")],
    )



def build_energy_credit_page() -> str:
    """Board landing for WSEC-R prescriptive credits."""
    src = tools_href("energy-credits", "", "index.html")
    body = f"""  <header class="max-w-6xl mx-auto px-4 pt-10 pb-2">
    <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">Good Steward Tools</p>
    <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">WSEC-R prescriptive credits</h1>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">Authority links (no invented dollar amounts): <a href="https://www.energy.gov/energysaver/federal-tax-credits-energy-efficiency" target="_blank" rel="noopener" class="text-secondary hover:underline">U.S. Department of Energy — federal energy-efficiency tax credits</a> · <a href="https://www.irs.gov/credits-deductions/energy-efficient-home-improvement-credit" target="_blank" rel="noopener" class="text-secondary hover:underline">IRS — Energy Efficient Home Improvement Credit</a> · confirm WA WSEC-R with the State Building Code Council. This Board tool does not invent tax-credit dollar amounts.</p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">Upload plan PDFs to auto-suggest WSEC-R 2021 single-family / townhouse credits, then confirm dwelling size, Table R406.2 fuel normalization, and Table R406.3 options.</p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">WSEC-R 2021 single-family prescriptive path credit worksheet (fuel normalization + Table R406.3). When you hire, shortlist from Board directories — Board #1: <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">Pacific Pro Group</a>.</p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-2">Also: <a href="{public_tool_href('site-visit')}" class="text-secondary hover:underline">Site Visit Checklist</a> · <a href="./posts/2026-09-20-window-replacement-edmonds-coastal-wa.html" class="text-secondary hover:underline">Edmonds window replacement guide</a>.</p>
  </header>
  <section class="max-w-6xl mx-auto px-4 pb-8 relative z-20">
    <iframe id="energy-credit-tool" src="{src}" title="WSEC-R prescriptive credits" loading="lazy"
      style="display:block;width:100%;height:1200px;border:0;border-radius:18px;background:#f8fafc;"></iframe>
  </section>
""" + education_closing("tools", "default", official_keys=["lni_verify", "sbcc", "lni_home"])
    return page_shell(
        "WSEC-R Prescriptive Credits | Board of Project Stewardship",
        "WSEC-R 2021 single-family prescriptive energy credit worksheet for Edmonds, King, and Snohomish projects.",
        "energy-credit",
        body,
        canonical=f"{BASE_URL}energy-credit.html",
        include_story_embed=True,
        include_tools_embed=False,
        include_widgets=False,
        breadcrumbs=[
            ("About", BASE_URL),
            ("Good Steward", f"{BASE_URL}good-steward.html"),
            ("Energy code credits", f"{BASE_URL}energy-credit.html"),
        ],
    )



def build_build_walkthrough_page() -> str:
    """Board landing for interactive Build Walkthrough."""
    src = tools_href("build-walkthrough", "", "index.html")
    body = f"""  <header class="max-w-6xl mx-auto px-4 pt-10 pb-2">
    <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">Good Steward Tools</p>
    <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">Build Walkthrough</h1>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">See how a North Sound project moves from discovery to closeout — blueprint lines, 3D framing walls, then a finished home. Stage checklists reuse Board language from Site Visit &amp; Discovery and the PM Execution Dashboard.</p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">Educational Board tool. When you hire, shortlist from Board directories — Board #1: <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">Pacific Pro Group</a>. Re-verify any contractor at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a>.</p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-2">Part of <a href="{public_tool_href('good-steward')}" class="text-secondary hover:underline">Good Steward</a>. Also: <a href="{public_tool_href('site-visit')}" class="text-secondary hover:underline">Site Visit Checklist</a> · <a href="{public_tool_href('pm-dashboard')}" class="text-secondary hover:underline">PM Dashboard</a> · <a href="{public_tool_href('energy-credit')}" class="text-secondary hover:underline">Energy code credits</a>.</p>
  </header>
  <section class="max-w-6xl mx-auto px-4 pb-8 relative z-20">
    <iframe
      id="build-walkthrough-tool"
      src="{src}"
      title="Build Walkthrough — Board of Project Stewardship"
      loading="lazy"
      style="display:block;width:100%;height:900px;border:0;border-radius:18px;background:#0a0a0a;"
    ></iframe>
    <p class="text-[11px] text-slate-600 mt-3 leading-relaxed">Illustrative stages for homeowners — not a bid or schedule commitment.</p>
  </section>
""" + education_closing("tools", "hire", "default", official_keys=["lni_verify", "lni_home", "mybuildingpermit"])
    return page_shell(
        "Build Walkthrough | Board of Project Stewardship",
        "Interactive build walkthrough from the Board of Project Stewardship — discovery through finishes for Edmonds / coastal Puget Sound. Educational stages, not a bid or schedule.",
        "build-walkthrough",
        body,
        canonical=f"{BASE_URL}build-walkthrough.html",
        include_story_embed=True,
        include_tools_embed=False,
        include_widgets=False,
        breadcrumbs=[
            ("About", BASE_URL),
            ("Good Steward", f"{BASE_URL}good-steward.html"),
            ("Build Walkthrough", f"{BASE_URL}build-walkthrough.html"),
        ],
    )


def build_site_visit_page() -> str:
    """Board-branded Site Visit landing; crawlable intro above the tool iframe."""
    src = tools_href("site-visit", "", "index.html")
    body = f"""  <header class="max-w-6xl mx-auto px-4 pt-10 pb-2">
    <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">Good Steward Tools</p>
    <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">Site Visit &amp; Discovery</h1>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">A Board checklist for homeowners and builders preparing an addition or remodel site visit in Edmonds and the coastal Puget Sound. Notes stay in this browser — nothing is uploaded to Board servers.</p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">Good Steward site-visit checklist. Re-verify any contractor at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a> before you hire.</p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-2">Part of <a href="{public_tool_href('good-steward')}" class="text-secondary hover:underline">Good Steward</a>. Also: <a href="{public_tool_href('build-walkthrough')}" class="text-secondary hover:underline">Build Walkthrough</a> · <a href="{public_tool_href('pm-dashboard')}" class="text-secondary hover:underline">PM Dashboard</a> · <a href="{public_tool_href('another-story')}" class="text-secondary hover:underline">Another Story</a>.</p>
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
""" + education_closing("tools", "hire", "default", official_keys=["lni_verify", "edmonds", "mybuildingpermit"])
    return page_shell(
        "Site Visit Checklist | Board of Project Stewardship",
        "Site Visit & Discovery checklist from the Board of Project Stewardship. Browser-local Good Steward template for Edmonds / coastal Puget Sound.",
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
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-3">Educational template only. Not a construction schedule, contract, or promise of dates or cost. Re-verify any firm at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a> before you hire.</p>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed mb-2">Part of <a href="{public_tool_href('good-steward')}" class="text-secondary hover:underline">Good Steward</a>. Also: <a href="{public_tool_href('build-walkthrough')}" class="text-secondary hover:underline">Build Walkthrough</a> · <a href="{public_tool_href('site-visit')}" class="text-secondary hover:underline">Site Visit Checklist</a> · <a href="{public_tool_href('another-story')}" class="text-secondary hover:underline">Another Story</a>.</p>
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
""" + education_closing("tools", "default", official_keys=["lni_verify", "lni_home"])
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



# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Steward hubs & Good Steward companions (P0 + P1 + light P2)
# ---------------------------------------------------------------------------


def _hub_header(eyebrow: str, title: str, lead: str) -> str:
    return f"""  <header class="max-w-6xl mx-auto px-4 pt-10 pb-6">
    <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">{esc(eyebrow)}</p>
    <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">{title}</h1>
    <p class="text-slate-400 font-light max-w-3xl leading-relaxed">{lead}</p>
  </header>
"""


def _hub_section(title: str, inner: str, border: str = "border-white/10") -> str:
    return f"""  <section class="max-w-6xl mx-auto px-4 pb-8">
    <div class="bg-charcoal rounded-xl p-8 border {border}">
      <h2 class="text-2xl font-black text-white mb-4 tracking-tight">{esc(title)}</h2>
{inner}
    </div>
  </section>
"""


def _link_ul(items: list[tuple[str, str]], external: bool = False) -> str:
    lis = []
    for label, href in items:
        if external:
            lis.append(
                f'<li><a href="{href}" target="_blank" rel="noopener" class="text-secondary hover:underline">{esc(label)}</a></li>'
            )
        else:
            lis.append(f'<li><a href="{href}" class="text-secondary hover:underline">{esc(label)}</a></li>')
    return '<ul class="space-y-2 text-sm text-slate-300 font-light">\n' + "\n".join(lis) + "\n</ul>"


def _check_ul(items: list[str]) -> str:
    lis = "".join(
        f'<li class="flex gap-3"><i class="fas fa-check text-secondary mt-1 shrink-0" aria-hidden="true"></i><span>{esc(x)}</span></li>'
        for x in items
    )
    return f'<ul class="space-y-3 text-sm text-slate-300 font-light leading-relaxed">{lis}</ul>'




def _hub_photo_strip(
    items: list[tuple[str, str, str]],
    *,
    title: str = "Field context (illustrative)",
) -> str:
    """Reusable 3-up photo strip for thin learning hubs. Skips missing assets."""
    figures: list[str] = []
    for rel, alt, caption in items:
        if not asset_exists(rel):
            continue
        src = prefix_asset(rel, "")
        figures.append(
            f"""        <figure class="overflow-hidden rounded-xl border border-white/10 bg-obsidian">
          <img src="{src}" alt="{esc(alt)}" class="w-full h-40 sm:h-48 object-cover" width="800" height="450" loading="lazy">
          <figcaption class="px-3 py-2 text-[11px] text-slate-500 font-light leading-snug">{esc(caption)}</figcaption>
        </figure>"""
        )
    if not figures:
        return ""
    return f"""  <section class="max-w-6xl mx-auto px-4 pb-8" aria-label="{esc(title)}">
    <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-3">{esc(title)}</p>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
{chr(10).join(figures)}
    </div>
  </section>
"""



def build_about_org_page() -> str:
    """Dedicated About page for the Board of Project Stewardship (not the homepage)."""
    faqs = [
        (
            "Is the Board of Project Stewardship a general contractor?",
            "No. The Board of Project Stewardship is an independent publisher of construction standards and contractor directories. It does not perform construction under the Board name and does not sell contractor leads.",
        ),
        (
            "Does the Board own Pacific Pro Group?",
            f"No. {PPG['name']} appears as Board directory #1 — an editorial hire ranking that links to {PPG['url']}. Ranking is not ownership, parentage, or brand control of the Board.",
        ),
        (
            "Where should I verify a contractor?",
            f"Use the official WA L&I Verify tool at {LNI_URL}. Board directories are shortlists — L&I remains the source of truth for license, bond, and insurance status.",
        ),
        (
            "How do I contact the Board?",
            f"Email the editorial desk at {EDITORIAL_EMAIL} for directory corrections, source questions, or press notes — not for dispatching a contractor.",
        ),
    ]
    body = (
        _hub_header(
            "Independent publisher · Edmonds / King & Snohomish",
            "About the Board of Project Stewardship",
            "The Board of Project Stewardship publishes construction standards and contractor directories so homeowners can shortlist firms with clearer habits — verification, permits, and written scope — before they hire.",
        )
        + _hub_section(
            "What we are",
            f"""      <p class="text-slate-300 text-sm font-light leading-relaxed mb-3">An independent editorial publisher. We maintain ranked directories (kitchen, bath, additions, custom homes, trades, and more), Good Steward educational tools, city hubs, and planning guides for Edmonds and King &amp; Snohomish Counties.</p>
      <p class="text-slate-400 text-sm font-light leading-relaxed mb-3">Public contact: <a href="mailto:{EDITORIAL_EMAIL}" class="text-secondary hover:underline">{EDITORIAL_EMAIL}</a>. Read <a href="./how-we-rank.html" class="text-secondary hover:underline">How we rank</a> for methodology, and re-verify every bidder at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a>.</p>
      <p class="text-slate-400 text-sm font-light leading-relaxed">Board #1 hire ranking currently points homeowners to <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">{esc(PPG['name'])}</a> — contact that firm directly for project work. The Board does not take project deposits or run contractor dispatch.</p>""",
            border="border-primary/25",
        )
        + _hub_section(
            "What we are not",
            _check_ul(
                [
                    "Not a general contractor and not a substitute for your architect, engineer, or AHJ.",
                    "Not a lead-generation marketplace and not a paid placement list.",
                    "Not Pacific Pro Group customer service — PPG is ranked #1 outbound, not Board ownership.",
                    "Not a source of invented prices, ROI, licenses, years in business, or review counts.",
                    "Not a permit desk — use official city/county portals linked from our Permit hub.",
                ]
            ),
        )
        + _hub_section(
            "Start here",
            _link_ul(
                [
                    ("How we rank", "./how-we-rank.html"),
                    ("Learn hub", "./learn.html"),
                    ("Sitewide FAQ", "./faq.html"),
                    ("Verify a WA contractor", "./verify-contractor.html"),
                    ("Permit jurisdiction hub", "./permits.html"),
                    ("Editorial contact", "./contact.html"),
                    ("Home", "./index.html"),
                ]
            ),
        )
        + f'  <div class="max-w-6xl mx-auto px-4 pb-8">\n{faq_section(faqs, "About FAQ")}\n  </div>\n'
        + education_closing("default", "learn", official_keys=["lni_verify", "lni_home", "edmonds", "mybuildingpermit"])
    )
    return page_shell(
        "About | Board of Project Stewardship",
        "About the Board of Project Stewardship — independent publisher of construction standards and contractor directories for Edmonds / King & Snohomish. Not a GC and not lead-gen.",
        "about",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}about.html",
        breadcrumbs=[("Home", BASE_URL), ("About", f"{BASE_URL}about.html")],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_permits_page() -> str:
    jurisdictions = [
        (
            "Edmonds",
            "Most Edmonds residential building, plumbing, and mechanical applications go through MyBuildingPermit. Use city permit-assistance pages for tip sheets and contacts.",
            [
                ("MyBuildingPermit", "https://mybuildingpermit.com/"),
                ("City of Edmonds", "https://www.edmondswa.gov/"),
                ("Edmonds permit assistance", "https://www.edmondswa.gov/services/permit_assistance"),
            ],
        ),
        (
            "Seattle",
            "Seattle Department of Construction and Inspections (SDCI) applications typically run through the Seattle Services Portal — not MyBuildingPermit. Use official SDCI fee pages and the Fee Subtitle PDF for permit cost context; the Board does not invent Seattle project prices or fee invoices.",
            [
                ("How to get a Seattle permit (SDCI)", "https://www.seattle.gov/construction-and-inspections/permits/how-do-you-get-a-permit"),
                ("Seattle Services Portal", "https://cosaccela.seattle.gov/portal/"),
                ("SDCI home", "https://www.seattle.gov/sdci"),
                ("SDCI fees overview", "https://seattle.gov/sdci/codes/codes-we-enforce-(a-z)/fees"),
                ("How much will your permit cost?", "https://seattle.gov/sdci/permits/how-much-will-your-permit-cost"),
                ("2026 Fee Subtitle (PDF)", "https://seattle.gov/documents/Departments/SDCI/Codes/FeeSubtitleFinal.pdf"),
            ],
        ),
        (
            "King County (unincorporated)",
            "Unincorporated King County residential applications commonly start at MyBuildingPermit; the county Accela portal is also used for status and records.",
            [
                ("MyBuildingPermit", "https://mybuildingpermit.com/"),
                ("King County permitting portal", "https://aca-prod.accela.com/KINGCO/Default.aspx"),
                ("King County local services — permits", "https://kingcounty.gov/en/dept/local-services/certificates-permits-licenses/permits/permits-inspections-codes-buildings-land-use"),
            ],
        ),
        (
            "Snohomish County",
            "Snohomish County Planning and Development Services (PDS) covers county-jurisdiction work. City projects (Edmonds, Lynnwood, and others) use the city or MyBuildingPermit path instead.",
            [
                ("Snohomish County PDS", "https://www.snohomishcountywa.gov/198/Planning-Development-Services"),
                ("MyBuildingPermit", "https://mybuildingpermit.com/"),
            ],
        ),
        (
            "Shoreline",
            "The City of Shoreline uses its eTRAKiT portal for applications, status, and inspections.",
            [
                ("Shoreline eTRAKiT", "https://permits.shorelinewa.gov/eTRAKiT/"),
                ("City of Shoreline", "https://www.shorelinewa.gov/"),
            ],
        ),
        (
            "Lynnwood",
            "Lynnwood residential work is generally permitted through the City of Lynnwood (often via MyBuildingPermit for participating workflows). Confirm the live city path for your parcel; do not assume Edmonds or county rules apply.",
            [
                ("MyBuildingPermit", "https://mybuildingpermit.com/"),
                ("City of Lynnwood", "https://www.lynnwoodwa.gov/"),
                ("Lynnwood hub (Board)", "./lynnwood.html"),
            ],
        ),
        (
            "Mukilteo",
            "Mukilteo projects typically use the city permitting path and may participate in MyBuildingPermit workflows. Confirm parcel jurisdiction before design freeze.",
            [
                ("MyBuildingPermit", "https://mybuildingpermit.com/"),
                ("City of Mukilteo", "https://mukilteowa.gov/"),
                ("Mukilteo hub (Board)", "./mukilteo.html"),
            ],
        ),
    ]
    cards = []
    for name, blurb, links in jurisdictions:
        cards.append(
            f"""      <article class="bg-charcoal border border-white/10 rounded-xl p-6 mb-4">
        <h3 class="text-xl font-black text-white mb-2 tracking-tight">{esc(name)}</h3>
        <p class="text-sm text-slate-400 font-light leading-relaxed mb-3">{esc(blurb)}</p>
        {_link_ul(links, external=True)}
      </article>"""
        )
    faqs = [
        (
            "Does every remodel need a building permit?",
            "Not always — but moving walls, plumbing, electrical, or changing structure usually does. Confirm with the jurisdiction for your parcel (city vs county).",
        ),
        (
            "What is MyBuildingPermit?",
            "MyBuildingPermit.com is a shared online portal used by many Puget Sound cities and counties (including Edmonds) for residential permit applications and tip sheets.",
        ),
        (
            "Who pulls the permit — homeowner or contractor?",
            "Either can, depending on jurisdiction and license rules. Get the permit number in writing and confirm the named contractor matches WA L&I Verify.",
        ),
        (
            "Where do I verify a Washington contractor?",
            "Use the official WA L&I Verify tool. The Board publishes a walkthrough companion; L&I remains the source of truth.",
        ),
        (
            "How does this hub relate to Board directories?",
            "This page links official portals only. Shortlist firms on Board directories, then re-verify at L&I before hiring.",
        ),
        (
            "Where are Seattle permit fees published?",
            "On official SDCI fee pages and the Fee Subtitle PDF linked in the Seattle section above — not as invented Board prices. Pair with remodel cost-factor guides for qualitative drivers only.",
        ),
        (
            "Is there a separate Seattle permits page?",
            "No. Seattle orientation lives on this permit hub (plus the Seattle city hub) to avoid duplicate thin pages.",
        ),
        (
            "Should work be covered before inspections?",
            "No. Keep work open until the AHJ completes required inspections. Covering work early can force costly uncovering. Confirm the inspection sequence with your permit owner and GC in writing.",
        ),
    ]
    body = (
        _hub_header(
            f"Official portals · Updated {YEAR}",
            "Permit jurisdiction hub",
            "Editorial how-to with outbound links to official permit portals only. The Board of Project Stewardship does not issue permits and does not invent review timelines.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/posts/2026-08-12-edmonds-addition-permit-4.webp",
                    "Illustrative Edmonds-area addition permit planning context",
                    "Addition permit context",
                ),
                (
                    "assets/images/posts/2026-08-12-edmonds-addition-permit-5.webp",
                    "Illustrative residential permit document and plan review materials",
                    "Plan review readiness",
                ),
                (
                    "assets/images/posts/2026-09-06-seattle-bath-permits-1.webp",
                    "Illustrative Seattle bathroom remodel permit orientation",
                    "City vs county AHJ",
                ),
            ],
            title="Permit work in pictures (illustrative)",
        )
        + _hub_section(
            "How to use this hub",
            f"""      <p class="text-slate-300 text-sm font-light leading-relaxed mb-3">Identify which city or county has permitting authority for your parcel, open that jurisdiction’s official portal, and keep permit numbers with your project file. Ask bidders who owns the submittal and who stands for inspections.</p>
      <p class="text-slate-400 text-sm font-light leading-relaxed">Always re-verify any contractor at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a>. Companion walkthrough: <a href="./verify-contractor.html" class="text-secondary hover:underline">How to verify a WA contractor</a>.</p>""",
            border="border-primary/25",
        )
        + "  <div class=\"max-w-6xl mx-auto px-4 pb-4\">\n"
        + "\n".join(cards)
        + "\n  </div>\n"
        + _hub_section(
            "Related Board reading",
            _link_ul(
                [
                    ("Edmonds home addition permit basics", "./posts/2026-08-12-edmonds-home-addition-permit-basics.html"),
                    ("Seattle bathroom remodel permits", "./posts/2026-09-06-seattle-bathroom-remodel-permits.html"),
                    ("Edmonds ADU planning hub", "./adu.html"),
                    ("Home additions directory", "./additions.html"),
                    ("Kitchen remodelers", "./kitchen.html"),
                    ("Bathroom remodelers", "./bathrooms.html"),
                    ("Site Visit Checklist", "./site-visit.html"),
                    ("Good Steward", "./good-steward.html"),
                    ("Remodel cost factors", "./remodel-cost-factors.html"),
                    ("Seattle hub", "./seattle.html"),
                ]
            ),
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Permit hub FAQ')}\n  </div>\n"
        + education_closing("permits", "adu", "default", official_keys=["lni_verify", "mybuildingpermit", "seattle_how", "edmonds"])
    )
    return page_shell(
        "Permit Jurisdiction Hub | Board of Project Stewardship",
        "Official permit portals for Edmonds, Seattle, King County, Snohomish County, and Shoreline — Board editorial hub with L&I Verify links. No invented timelines.",
        "permits",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}permits.html",
        breadcrumbs=[("About", BASE_URL), ("Permit hub", f"{BASE_URL}permits.html")],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_adu_page() -> str:
    faqs = [
        (
            "Where are Edmonds ADU standards published?",
            "Site development standards for accessory dwelling units are in Edmonds Community Development Code (ECDC) 16.20.050. Confirm the live code text before you freeze design.",
        ),
        (
            "Do Edmonds ADUs require a building permit?",
            "Yes. City handouts state a residential building permit is required for ADUs, and additional permits may apply (plumbing, utilities, critical areas, right-of-way, and similar).",
        ),
        (
            "Where do I apply?",
            "Apply through MyBuildingPermit.com and select the Edmonds ADU path that matches your project (detached, attached/remodel, new residence with ADU, or manufactured-home ADU).",
        ),
        (
            "Detached vs garage conversion — which is simpler?",
            "Neither is automatically simple. Garage conversions can hide insulation, ceiling-height, and fire-separation issues; detached units add foundation and utility runs.",
        ),
        (
            "How does the Board rank ADU builders?",
            "The Board does not publish a separate ADU-only ranking yet. Use Edmonds custom homes and additions directories as a starting shortlist, then verify every firm at WA L&I.",
        ),
    ]
    body = (
        _hub_header(
            f"Edmonds-first · Updated {YEAR}",
            "Edmonds ADU planning hub",
            "A Board of Project Stewardship hub that points homeowners to official Edmonds ADU standards and portals. Not a fee table, bid, or guarantee of approval.",
        )
        + _hub_section(
            "Start with official sources",
            f"""      <p class="text-slate-300 text-sm font-light leading-relaxed mb-4">Accessory dwelling units in Edmonds are full dwellings with utility, egress, and permit obligations — not shed upgrades. Read the live code and city handouts before schematic attachment.</p>
      {_link_ul([
          ("ECDC 16.20.050 — ADU site development standards", "https://edmonds.municipal.codes/ECDC/16.20.050"),
          ("City of Edmonds ADU informational handout (PDF)", "https://cdnsm5-hosted.civiclive.com/UserFiles/Servers/Server_16494932/File/Services/Permits%20Development/General%20Permit%20Assistance/Informational%20Handouts/B2-Accessory_Dwelling_Unit.pdf"),
          ("Pre-approved DADU program handout (PDF)", "https://cdnsm5-hosted.civiclive.com/UserFiles/Servers/Server_16494932/File/Services/Permits%20Development/General%20Permit%20Assistance/Informational%20Handouts/B2b-Pre-Approved_DADU_Program.pdf"),
          ("MyBuildingPermit", "https://mybuildingpermit.com/"),
          ("City of Edmonds", "https://www.edmondswa.gov/"),
      ], external=True)}
      <p class="text-slate-500 text-xs font-light mt-4">Handout URLs are city-hosted PDFs; if a link moves, use Edmonds permit-assistance pages and search for current ADU handouts.</p>""",
            border="border-primary/25",
        )
        + _hub_section(
            "Simple planning checklist",
            _check_ul(
                [
                    "Confirm parcel zoning and whether attached, detached, or conversion paths fit the lot.",
                    "Read ECDC 16.20.050 for unit count, setbacks, and dwelling standards that apply to your configuration.",
                    "Check utility capacity early (water meter / fixture units, sewer or septic, electrical service).",
                    "Flag critical areas, slopes, trees, and parking before you buy plans.",
                    "Apply in MyBuildingPermit under the Edmonds ADU application type that matches the work.",
                    "Hire only after WA L&I Verify matches the contract legal name; keep permit numbers in the owner file.",
                ]
            )
            + """
      <p class="text-sm text-slate-400 font-light mt-4">Printable companion: <a href="./adu-checklist.html" class="text-secondary hover:underline">ADU readiness checklist</a>. Deeper editorial: <a href="./posts/2026-09-07-adu-planning-edmonds-wa.html" class="text-secondary hover:underline">ADU planning Edmonds WA (2026-09-07)</a>.</p>""",
        )
        + _hub_section(
            "Board shortlists & tools",
            f"""      <p class="text-sm text-slate-400 font-light leading-relaxed mb-3">{esc(PPG['name'])} is Board directory #1 for kitchen, bath, and additions hire rankings — <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">{esc(PPG['url'].rstrip('/').split('//')[-1])}</a> — not Board ownership. Re-verify at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">L&amp;I Verify</a>.</p>
      {_link_ul([
          ("Edmonds custom homes directory", "./edmonds-custom-homes.html"),
          ("Home additions directory", "./additions.html"),
          ("ADU cost factors", "./adu-cost-factors.html"),
          ("Permit jurisdiction hub", "./permits.html"),
          ("Another Story — Board feature for second-story concepts", "./another-story.html"),
      ])}""",
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Edmonds ADU FAQ')}\n  </div>\n"
        + education_closing("adu", "permits", "directories", official_keys=["lni_verify", "edmonds", "edmonds_permits", "mybuildingpermit"])
    )
    return page_shell(
        "Edmonds ADU Planning Hub | Board of Project Stewardship",
        "Edmonds ADU planning hub: ECDC 16.20.050, city handouts, MyBuildingPermit paths, and Board shortlists. Official links only — no invented fees.",
        "adu",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}adu.html",
        breadcrumbs=[("About", BASE_URL), ("Edmonds ADU", f"{BASE_URL}adu.html")],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_how_we_rank_page() -> str:
    faqs = [
        (
            "Is the Board of Project Stewardship a general contractor?",
            "No. The Board is an independent publisher of construction standards and contractor directories. It does not perform construction under the Board name.",
        ),
        (
            "What does Board #1 mean?",
            f"Board #1 is an editorial hire ranking on Board directories (for example kitchen, bath, and additions). {PPG['name']} currently holds that #1 hire ranking and links to {PPG['url']}. Ranking is not ownership of the Board.",
        ),
        (
            "Are listings paid placements?",
            "No. Directories are editorial. Listing is not an endorsement of quality or a guarantee of outcomes.",
        ),
        (
            "Should I still use L&I Verify?",
            "Yes. Treat licensing as a living status. Re-check every bidder at WA L&I Verify even if they appear on a Board directory or were referred by a friend.",
        ),
        (
            "How often are rankings updated?",
            f"Directories carry a {YEAR} research pass date in page copy. Criteria emphasize local service area, specialty focus, institutional signals such as MBAKS where applicable, and public reputation signals — not invented awards.",
        ),
    ]
    body = (
        _hub_header(
            f"Editorial standards · {YEAR}",
            "How we rank",
            "How the Board of Project Stewardship builds contractor directories, what Board #1 means, and why L&I re-verification stays non-negotiable.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/hubs/hub-rank-1.webp",
                    "Illustrative contractor ranking scorecard staging — free generative image, not a real Board job photo",
                    "Editorial scorecard habit",
                ),
                (
                    "assets/images/hubs/hub-rank-2.webp",
                    "Illustrative sealed-bid comparison staging — free generative image, not a real Board job photo",
                    "Compare written proposals",
                ),
                (
                    "assets/images/hubs/hub-rank-3.webp",
                    "Illustrative framed-house walk-through notebook staging — free generative image, not a real Board job photo",
                    "Site walk notes",
                ),
            ],
            title="Ranking habits in pictures (illustrative)",
        )
        + _hub_section(
            "Entity clarity",
            f"""      <p class="text-slate-300 text-sm font-light leading-relaxed mb-3">The Board of Project Stewardship publishes standards and directories for Edmonds and King &amp; Snohomish Counties. <strong class="text-white">{esc(PPG['name'])}</strong> appears as <strong class="text-white">Board directory #1</strong> — a hire ranking homeowners can follow to <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">{esc(PPG['url'])}</a> — not as owner, parent, or brand of the Board.</p>
      <p class="text-slate-400 text-sm font-light leading-relaxed">Another Story is labeled a <strong class="text-white">Board feature</strong> (second-story concept studio), not ownership chrome for any ranked firm.</p>""",
            border="border-primary/25",
        )
        + _hub_section(
            "Ranking method",
            _check_ul(
                [
                    "Local service area coverage for Edmonds / King & Snohomish (or the page’s stated geography).",
                    "Specialty focus that matches the directory (additions vs kitchen vs bath vs custom, and so on).",
                    "Institutional signals such as MBAKS Remodelers Council membership where applicable.",
                    "Public reputation signals from company sites and review aggregates — cited when used, never invented.",
                    "Active WA contractor licensing checked during research; readers must still re-verify at hire time.",
                ]
            )
            + f"""
      <p class="text-sm text-slate-400 font-light leading-relaxed mt-4">We do not invent licenses, years in business, review counts, awards, prices, or ROI. Where {esc(PPG['name'])}’s public review aggregate appears, it is labeled as such from the research pass — not a Board-owned review wall.</p>""",
        )
        + _hub_section(
            "Good Steward verification habit",
            f"""      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">Before deposit or start date: match the contract legal name to <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a>, confirm active license / bond / insurance status, and keep a screenshot or PDF of the result in the owner file.</p>
      <p class="text-sm text-slate-400 font-light"><a href="./verify-contractor.html" class="text-secondary hover:underline">Verify contractor walkthrough</a> · <a href="./good-steward.html" class="text-secondary hover:underline">Good Steward</a> · <a href="./contact.html" class="text-secondary hover:underline">Editorial contact</a></p>""",
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Ranking FAQ')}\n  </div>\n"
        + education_closing("verify", "directories", "default", official_keys=["lni_verify", "lni_home"])
    )
    return page_shell(
        "How We Rank | Board of Project Stewardship",
        "How the Board of Project Stewardship ranks contractors: independent editorial directories, Board #1 as hire ranking not ownership, and the L&I Verify habit.",
        "how-we-rank",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}how-we-rank.html",
        breadcrumbs=[("About", BASE_URL), ("How we rank", f"{BASE_URL}how-we-rank.html")],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_verify_contractor_page() -> str:
    steps = [
        ("Collect the legal name", "Use the exact business name that will appear on the contract and permit — not only a marketing DBA on a yard sign."),
        ("Open WA L&I Verify", "Go to the official tool at secure.lni.wa.gov/verify/ — bookmark it. The Board does not operate a license database."),
        ("Match license & status", "Confirm the contractor registration is active, note the license number, and check bonding/insurance fields the portal shows."),
        ("Scan complaints & history", "Read any discipline or complaint history the portal surfaces. Ask the firm about anything you do not understand."),
        ("Cross-check references", "Call recent local references with similar scope. Board directories are a shortlist — not a substitute for your own diligence."),
        ("Save proof before deposit", "Keep a dated PDF or screenshot with the owner project file before any deposit or demolition."),
    ]
    step_html = "".join(
        f"""      <li class="bg-charcoal border border-white/10 rounded-xl p-5 flex gap-4 mb-3 list-none">
        <span class="text-secondary font-black text-xl shrink-0">{i:02d}</span>
        <div>
          <h3 class="text-white font-bold mb-1">{esc(title)}</h3>
          <p class="text-sm text-slate-400 font-light leading-relaxed">{esc(blurb)}</p>
        </div>
      </li>"""
        for i, (title, blurb) in enumerate(steps, 1)
    )
    faqs = [
        (
            "Is this page a substitute for L&I?",
            "No. It is a Good Steward walkthrough that deep-links to the official WA L&I Verify tool. L&I is the source of truth.",
        ),
        (
            "What if the marketing name and legal name differ?",
            "Search both, and require the contract to use the registered legal name that matches the active license.",
        ),
        (
            "Does Board listing mean already verified forever?",
            "No. Licensing status changes. Re-verify at hire time even for Board #1 or any ranked firm.",
        ),
        (
            "What else should I check on the L&I record?",
            "On the official portal, review bonding and insurance fields, any lawsuit history against the bond, and workers’ compensation account status when employees are involved. Ask the firm about anything you do not understand.",
        ),
        (
            "Must ads show a contractor registration number?",
            "Washington requires registered contractors to include their registration number in advertising. If a flyer or site omits it, treat that as a diligence flag and confirm the legal name on L&I Verify before any deposit.",
        ),
    ]
    body = (
        _hub_header(
            "Good Steward · WA L&I",
            "How to verify a Washington contractor",
            "A Board of Project Stewardship companion to the state license tool — educational steps only. Always finish on the official portal.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/home-process-verify.webp",
                    "Illustrative WA contractor verification workflow for homeowners",
                    "Open official L&I Verify",
                ),
                (
                    "assets/images/posts/2026-08-11-hire-design-build-5.webp",
                    "Illustrative contract legal-name match before remodel deposit",
                    "Match legal name on contract",
                ),
                (
                    "assets/images/posts/2026-08-12-hire-kitchen-1.webp",
                    "Illustrative kitchen remodel bidder diligence in King & Snohomish",
                    "Save proof before deposit",
                ),
            ],
            title="Verification in pictures (illustrative)",
        )
        + f"""  <section class="max-w-6xl mx-auto px-4 pb-8">
    <div class="bg-charcoal rounded-xl p-8 border border-primary/25 text-center">
      <p class="text-slate-300 text-sm font-light mb-4">Open the official tool in a new tab:</p>
      <a href="{LNI_URL}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 bg-secondary text-obsidian font-black uppercase tracking-widest text-sm px-6 py-3 rounded hover:opacity-90 transition">WA L&amp;I Verify <i class="fas fa-external-link-alt text-xs" aria-hidden="true"></i></a>
      <p class="text-xs text-slate-500 mt-3 break-all">{esc(LNI_URL)}</p>
    </div>
  </section>
  <section class="max-w-6xl mx-auto px-4 pb-8">
    <ol class="space-y-0">
{step_html}
    </ol>
  </section>
"""
        + _hub_section(
            "After you verify",
            f"""      <p class="text-sm text-slate-400 font-light leading-relaxed mb-3">Shortlist from Board directories, compare written scopes, and keep permit ownership clear. Board #1 hire ranking: <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">{esc(PPG['name'])}</a>.</p>
      <p class="text-sm text-slate-400 font-light"><a href="./how-we-rank.html" class="text-secondary hover:underline">How we rank</a> · <a href="./hire-questions.html" class="text-secondary hover:underline">Hire interview questions</a> · <a href="./hiring-a-contractor.html" class="text-secondary hover:underline">Hiring a contractor</a> · <a href="./learn.html" class="text-secondary hover:underline">Learn hub</a></p>""",
        )
        + education_closing(
            "verify",
            "hire",
            official_keys=["lni_verify", "lni_hire_smart", "lni_hiring_hub", "lni_hire_pdf", "lni_protect", "lni_home"],
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Verify contractor FAQ')}\n  </div>\n"
    )
    howto = howto_ld(
        "How to verify a Washington contractor",
        "Board of Project Stewardship educational steps for verifying a WA contractor at the official L&I Verify portal. L&I is the source of truth.",
        steps,
        f"{BASE_URL}verify-contractor.html",
    )
    return page_shell(
        "Verify a WA Contractor | Board of Project Stewardship",
        "Good Steward walkthrough for verifying Washington contractors at the official L&I Verify portal. Educational companion — L&I is the source of truth.",
        "verify-contractor",
        body,
        [faq_ld(faqs), howto],
        canonical=f"{BASE_URL}verify-contractor.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Good Steward", f"{BASE_URL}good-steward.html"),
            ("Verify contractor", f"{BASE_URL}verify-contractor.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_city_hub_page(
    slug: str,
    place: str,
    county_note: str,
    blurb: str,
    permit_blurb: str,
    permit_links: list[tuple[str, str]],
    related_posts: list[tuple[str, str]],
    dir_links: list[tuple[str, str]],
    nav_active: str | None = None,
    extra_faqs: list[tuple[str, str]] | None = None,
    official_keys: list[str] | None = None,
    official_extra: list[tuple[str, str]] | None = None,
    photo_strip: list[tuple[str, str, str]] | None = None,
    photo_strip_title: str = "Field context (illustrative)",
) -> str:
    faqs = [
        (
            f"Is this a complete contractor list for {place}?",
            f"No. This is a neighborhood hub that aggregates Board directories and local posts for {place}. Use directory pages for ranked shortlists, then verify at WA L&I.",
        ),
        (
            f"Who permits work in {place}?",
            permit_blurb,
        ),
        (
            "Who is Board #1?",
            f"{PPG['name']} holds the Board’s editorial #1 hire ranking for kitchen, bath, and additions directories — {PPG['url']} — not Board ownership.",
        ),
        (
            "Where should I start?",
            "Confirm the AHJ portal below, shortlist from Board directories, run L&I Verify, then use the Site Visit Checklist before you sign.",
        ),
        (
            "Does the Board invent local prices or timelines?",
            "No. Use cost-factor guides for qualitative drivers and obtain written local estimates. AHJ fee schedules are official — not Board quotes.",
        ),
    ]
    if extra_faqs:
        faqs.extend(extra_faqs)
    posts_block = _link_ul(related_posts) if related_posts else (
        '<p class="text-sm text-slate-400 font-light">Browse the '
        '<a href="./blog.html" class="text-secondary hover:underline">blog</a> and '
        '<a href="./learn.html" class="text-secondary hover:underline">Learn hub</a> '
        'for planning pillars while geo posts continue to grow.</p>'
    )
    strip = (
        _hub_photo_strip(photo_strip, title=photo_strip_title)
        if photo_strip
        else ""
    )
    body = (
        _hub_header(
            f"{place} · {county_note}",
            f"{place} project hub",
            blurb,
        )
        + strip
        + _hub_section(
            "Permitting orientation",
            f"""      <p class="text-sm text-slate-300 font-light leading-relaxed mb-4">{esc(permit_blurb)}</p>
      {_link_ul([("WA L&I Verify (contractor license)", LNI_URL)] + [p for p in permit_links if "lni.wa.gov" not in p[1]], external=True)}
      <p class="text-sm text-slate-500 font-light mt-4"><a href="./permits.html" class="text-secondary hover:underline">Full permit jurisdiction hub</a> · <a href="./verify-contractor.html" class="text-secondary hover:underline">Verify contractor</a> · <a href="./learn.html" class="text-secondary hover:underline">Learn hub</a></p>""",
            border="border-primary/25",
        )
        + _hub_section(
            "Good Steward next steps",
            _check_ul(
                [
                    "Identify the authority having jurisdiction for your parcel (city vs county).",
                    "Open the official permit portal linked above — not a Board form.",
                    "Shortlist firms from Board directories that match your project type.",
                    "Re-verify each legal name at WA L&I Verify before any deposit.",
                    "Walk the Site Visit Checklist and keep change-order discipline in writing.",
                ]
            )
            + """
      <p class="text-sm text-slate-400 font-light mt-4"><a href="./hiring-a-contractor.html" class="text-secondary hover:underline">Hiring a contractor</a> · <a href="./site-visit.html" class="text-secondary hover:underline">Site Visit Checklist</a> · <a href="./remodel-cost-factors.html" class="text-secondary hover:underline">Cost factors</a></p>""",
        )
        + _hub_section(
            "Board directories",
            f"""      {_link_ul(dir_links)}
      <p class="text-sm text-slate-400 font-light mt-4">Board #1 hire ranking: <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">{esc(PPG['name'])}<span class="sr-only"> (opens in new window)</span></a>. Re-verify at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">L&amp;I Verify<span class="sr-only"> (opens in new window)</span></a>.</p>""",
        )
        + _hub_section("Related local posts", posts_block)
        + (
            '  <div class="max-w-6xl mx-auto px-4">\n'
            + official_links_section(
                official_keys
                or ["lni_verify", "lni_home", "mybuildingpermit"],
                extra=official_extra
                or [p for p in permit_links if "lni.wa.gov" not in p[1]],
                heading=f"Official portals · {place}",
                blurb=(
                    f"Live authority-having-jurisdiction (AHJ) links for {place}. "
                    "The Board of Project Stewardship does not issue permits or licenses. "
                    "Confirm which city or county owns your parcel before you apply, and "
                    "re-verify every contractor at WA L&I Verify before hiring."
                ),
            )
            + "  </div>\n"
        )
        + related_learning_strip(
            [
                ("Learn hub", "./learn.html"),
                ("Permit hub", "./permits.html"),
                ("Verify contractor", "./verify-contractor.html"),
                ("Hiring a contractor", "./hiring-a-contractor.html"),
                ("Remodel cost factors", "./remodel-cost-factors.html"),
                ("FAQ", "./faq.html"),
            ],
            heading=f"Related learning for {place}",
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, f'{place} hub FAQ')}\n  </div>\n"
    )
    return page_shell(
        f"{place} Remodel & Addition Hub | Board of Project Stewardship",
        f"{place} hub — official permit orientation, Board directories, and local posts for {county_note}. Verify contractors at WA L&I. Educational, not a complete roster.",
        nav_active or slug,
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}{slug}.html",
        breadcrumbs=[("Home", BASE_URL), ("Learn", f"{BASE_URL}learn.html"), (place, f"{BASE_URL}{slug}.html")],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
        og_image_alt=f"Board of Project Stewardship {place} remodel and addition project hub",
    )



def build_shoreline_hub() -> str:
    return build_city_hub_page(
        "shoreline",
        "Shoreline",
        "North King County",
        "A Board of Project Stewardship neighborhood hub for Shoreline additions and remodels — linking official city permitting and Board shortlists.",
        "Shoreline building permits are handled through the City of Shoreline eTRAKiT portal. Confirm zoning and permit expectations with the city before design freeze.",
        [
            ("Shoreline eTRAKiT permitting portal", "https://permits.shorelinewa.gov/eTRAKiT/"),
            ("City of Shoreline", "https://www.shorelinewa.gov/"),
        ],
        [
            ("Home addition Shoreline WA", "./posts/2026-09-10-home-addition-shoreline-wa.html"),
            ("Bathroom remodel Shoreline WA", "./posts/2026-09-11-bathroom-remodel-shoreline-wa.html"),
            ("Kitchen remodel Shoreline WA", "./posts/2026-09-12-kitchen-remodel-shoreline-wa.html"),
            ("Second-story addition Shoreline", "./posts/2026-08-24-second-story-addition-shoreline.html"),
        ],
        [
            ("Home additions directory", "./additions.html"),
            ("Kitchen remodelers", "./kitchen.html"),
            ("Bathroom remodelers", "./bathrooms.html"),
            ("Another Story (Board feature)", "./another-story.html"),
        ],
        official_keys=["lni_verify", "lni_home", "shoreline_etrait", "shoreline"],
        photo_strip=[
            (
                "assets/images/posts/2026-09-12-shoreline-kitchen-1.webp",
                "Illustrative Shoreline kitchen remodel context — not a real Board job photo",
                "Kitchen scopes",
            ),
            (
                "assets/images/posts/2026-09-11-shoreline-bath-1.webp",
                "Illustrative Shoreline bath remodel context — not a real Board job photo",
                "Bath scopes",
            ),
            (
                "assets/images/posts/2026-09-10-shoreline-addition-1.webp",
                "Illustrative Shoreline addition context — not a real Board job photo",
                "Addition scopes",
            ),
        ],
        photo_strip_title="Shoreline work in pictures (illustrative)",
    )


def build_lynnwood_hub() -> str:
    return build_city_hub_page(
        "lynnwood",
        "Lynnwood",
        "Snohomish County",
        "Board hub for Lynnwood kitchen and bath remodels — editorial shortlists plus links toward official permitting paths.",
        "Lynnwood projects are generally permitted through the City of Lynnwood (often via MyBuildingPermit for participating workflows). Confirm the live city path for your parcel; do not assume Edmonds or county rules apply.",
        [
            ("MyBuildingPermit", "https://mybuildingpermit.com/"),
            ("City of Lynnwood", "https://www.lynnwoodwa.gov/"),
        ],
        [
            ("Bathroom remodel Lynnwood WA", "./posts/2026-09-08-bathroom-remodel-lynnwood-wa.html"),
            ("Kitchen remodel Lynnwood WA", "./posts/2026-09-09-kitchen-remodel-lynnwood-wa.html"),
        ],
        [
            ("Kitchen remodelers", "./kitchen.html"),
            ("Bathroom remodelers", "./bathrooms.html"),
            ("Home additions directory", "./additions.html"),
            ("Trades hub", "./trades.html"),
        ],
        official_keys=["lni_verify", "lni_home", "lynnwood", "mybuildingpermit"],
        photo_strip=[
            (
                "assets/images/posts/2026-09-09-lynnwood-kitchen-1.webp",
                "Illustrative Lynnwood kitchen remodel context — not a real Board job photo",
                "Kitchen scopes",
            ),
            (
                "assets/images/posts/2026-09-08-lynnwood-bath-1.webp",
                "Illustrative Lynnwood bath remodel context — not a real Board job photo",
                "Bath scopes",
            ),
            (
                "assets/images/home-process-verify.webp",
                "Illustrative contractor verification habit — not a real Board job photo",
                "L&I before hire",
            ),
        ],
        photo_strip_title="Lynnwood work in pictures (illustrative)",
    )


def build_ballard_hub() -> str:
    return build_city_hub_page(
        "ballard",
        "Ballard",
        "Seattle · King County",
        "Board hub for Ballard kitchen and bath projects inside Seattle — SDCI permitting orientation and Board directories.",
        "Ballard is within Seattle. Construction and land-use permits typically run through SDCI and the Seattle Services Portal — not MyBuildingPermit.",
        [
            ("How to get a Seattle permit (SDCI)", "https://www.seattle.gov/construction-and-inspections/permits/how-do-you-get-a-permit"),
            ("Seattle Services Portal", "https://cosaccela.seattle.gov/portal/"),
            ("SDCI", "https://www.seattle.gov/sdci"),
        ],
        [
            ("Bathroom remodel Ballard Seattle", "./posts/2026-09-03-bathroom-remodel-ballard-seattle.html"),
            ("Kitchen remodel Ballard Seattle", "./posts/2026-09-04-kitchen-remodel-ballard-seattle.html"),
            ("Seattle bathroom remodel permits", "./posts/2026-09-06-seattle-bathroom-remodel-permits.html"),
        ],
        [
            ("Kitchen remodelers", "./kitchen.html"),
            ("Bathroom remodelers", "./bathrooms.html"),
            ("Home additions directory", "./additions.html"),
            ("Permit hub", "./permits.html"),
        ],
        photo_strip=[
            (
                "assets/images/posts/2026-09-04-kitchen-ballard-1.webp",
                "Illustrative Ballard kitchen remodel context — not a real Board job photo",
                "Kitchen scopes",
            ),
            (
                "assets/images/posts/2026-09-03-ballard-bath-1.webp",
                "Illustrative Ballard bath remodel context — not a real Board job photo",
                "Bath scopes",
            ),
            (
                "assets/images/home-process-build.webp",
                "Illustrative remodel build phase — not a real Board job photo",
                "Occupied-site habits",
            ),
        ],
        photo_strip_title="Ballard work in pictures (illustrative)",
    )


def build_magnolia_hub() -> str:
    return build_city_hub_page(
        "magnolia",
        "Magnolia",
        "Seattle · King County",
        "Board hub for Magnolia remodels — coastal moisture awareness, SDCI permitting, and Board shortlists.",
        "Magnolia is within Seattle. Expect SDCI permitting via the Seattle Services Portal. Bluff, steep-slope, and moisture details often deserve early site diligence.",
        [
            ("How to get a Seattle permit (SDCI)", "https://www.seattle.gov/construction-and-inspections/permits/how-do-you-get-a-permit"),
            ("Seattle Services Portal", "https://cosaccela.seattle.gov/portal/"),
            ("SDCI", "https://www.seattle.gov/sdci"),
        ],
        [
            ("Bathroom remodel Magnolia WA", "./posts/2026-09-17-bathroom-remodel-magnolia-wa.html"),
            ("Kitchen remodel Magnolia Seattle", "./posts/2026-09-16-kitchen-remodel-magnolia-seattle.html"),
            ("Walk-in shower remodel Magnolia", "./posts/2026-08-16-walk-in-shower-remodel-magnolia.html"),
            ("Magnolia plumbing remodel considerations", "./posts/2026-08-31-magnolia-plumbing-remodel-considerations.html"),
        ],
        [
            ("Bathroom remodelers", "./bathrooms.html"),
            ("Kitchen remodelers", "./kitchen.html"),
            ("Coastal waterproofing checklist", "./coastal-waterproofing.html"),
            ("Permit hub", "./permits.html"),
        ],
        photo_strip=[
            (
                "assets/images/posts/2026-09-17-magnolia-bathroom-1.webp",
                "Illustrative Magnolia bath remodel context — not a real Board job photo",
                "Bath scopes",
            ),
            (
                "assets/images/posts/2026-09-16-magnolia-kitchen-1.webp",
                "Illustrative Magnolia kitchen remodel context — not a real Board job photo",
                "Kitchen scopes",
            ),
            (
                "assets/images/home-gallery-finish.webp",
                "Illustrative finish craft — not a real Board job photo",
                "Finish discipline",
            ),
        ],
        photo_strip_title="Magnolia work in pictures (illustrative)",
    )


def build_adu_checklist_page() -> str:
    items = [
        "Confirm city/county jurisdiction for the parcel (Edmonds city vs other).",
        "Read ECDC 16.20.050 (or the live ADU section) for your attached/detached/conversion path.",
        "Sketch setbacks, height, parking, and privacy screening against the lot.",
        "Request early utility capacity checks (water fixture units / meter, sewer or septic, electrical).",
        "Note critical areas, trees, slopes, and easements before purchasing plans.",
        "Choose MyBuildingPermit application type that matches the ADU scope.",
        "Decide occupied-site staging if the primary home stays lived-in.",
        "Shortlist firms with permitted small-dwelling or addition experience; L&I Verify each.",
        "Require written scope covering design, permit ownership, and inspections.",
        "File permits, inspection results, and as-builts for future refinance or sale.",
    ]
    body = (
        _hub_header(
            "Good Steward · ADU",
            "ADU readiness checklist",
            "A printable Board checklist for homeowners exploring an accessory dwelling unit. Educational — not a permit set, fee schedule, or bid.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/posts/2026-09-07-edmonds-adu-1.webp",
                    "Illustrative ADU / small-dwelling planning context — not a real Board job photo",
                    "Parcel & program fit",
                ),
                (
                    "assets/images/posts/2026-08-12-edmonds-addition-permit-3.webp",
                    "Illustrative permit plan set review for small dwellings — not a real Board job photo",
                    "Portal readiness",
                ),
                (
                    "assets/images/home-process-research.webp",
                    "Illustrative Board research desk for ADU standards — not a real Board job photo",
                    "Standards before stock plans",
                ),
            ],
            title="ADU planning in pictures (illustrative)",
        )
        + _hub_section(
            "How to use this checklist",
            f"""      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">Work top to bottom before you buy stock plans or pay a large design retainer. Confirm whether the parcel sits in the City of Edmonds or another AHJ — rules and portals differ. Read the live Edmonds ADU standards (ECDC paths such as 16.20.050) on the city site; do not paste Seattle ADUniverse dates onto Edmonds.</p>
      <p class="text-sm text-slate-400 font-light leading-relaxed mb-3">Utility capacity, critical areas, trees, slopes, and easements often decide feasibility earlier than finish selections. Ask who owns the MyBuildingPermit submittal and who stands for inspections. Shortlist firms with permitted small-dwelling or addition experience, then re-verify each at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a>.</p>
      <p class="text-sm text-slate-400 font-light leading-relaxed">Pair with the <a href="./adu.html" class="text-secondary hover:underline">Edmonds ADU hub</a>, <a href="./adu-cost-factors.html" class="text-secondary hover:underline">ADU cost factors</a> (qualitative only), and <a href="./permits.html" class="text-secondary hover:underline">permit hub</a>. The Board of Project Stewardship does not invent ADU fees, timelines, or ROI.</p>""",
            border="border-primary/25",
        )
        + _hub_section(
            "Checklist",
            _check_ul(items)
            + """
      <p class="text-sm text-slate-400 font-light mt-4"><a href="./adu.html" class="text-secondary hover:underline">Edmonds ADU hub</a> · <a href="./posts/2026-09-07-adu-planning-edmonds-wa.html" class="text-secondary hover:underline">ADU planning post</a> · <a href="./permits.html" class="text-secondary hover:underline">Permit hub</a></p>""",
            border="border-primary/25",
        )
        + "  <div class=\"pb-12\"></div>\n"
        + education_closing("adu", "permits", "hire", official_keys=["lni_verify", "edmonds", "edmonds_permits", "mybuildingpermit"])
    )
    return page_shell(
        "ADU Readiness Checklist | Board of Project Stewardship",
        "Edmonds-first ADU readiness checklist from the Board of Project Stewardship — planning habits without invented fees or timelines.",
        "adu-checklist",
        body,
        canonical=f"{BASE_URL}adu-checklist.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Edmonds ADU", f"{BASE_URL}adu.html"),
            ("ADU checklist", f"{BASE_URL}adu-checklist.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_change_orders_page() -> str:
    faqs = [
        (
            "What is an allowance?",
            "An allowance is a budget placeholder in the contract for selections not yet finalized (for example tile or fixtures). Overages and underages should be spelled out in writing.",
        ),
        (
            "When should a change order be signed?",
            "Before the changed work proceeds — with price and schedule impact stated. Handshake changes are how Good Steward projects go sideways.",
        ),
        (
            "Does the Board publish standard markup percentages?",
            "No. Markups and contingency percentages vary by firm and contract. Ask each bidder to explain their written policy; do not rely on invented Board averages.",
        ),
    ]
    body = (
        _hub_header(
            "Good Steward · Contracts",
            "Change orders &amp; allowances",
            "Board educational explainer for homeowners comparing remodel bids in Edmonds / King &amp; Snohomish. Not legal advice and not a price guide.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/posts/2026-08-11-hire-design-build-3.webp",
                    "Illustrative written scope and selection review — not a real Board job photo",
                    "Freeze scope before long-leads",
                ),
                (
                    "assets/images/home-process-verify.webp",
                    "Illustrative verification habit before approving extras — not a real Board job photo",
                    "Price & schedule in writing",
                ),
                (
                    "assets/images/posts/2026-08-12-hire-kitchen-2.webp",
                    "Illustrative kitchen remodel selection boards — not a real Board job photo",
                    "Allowances need rules",
                ),
            ],
            title="Change-order discipline (illustrative)",
        )
        + _hub_section(
            "Habits that protect the schedule",
            _check_ul(
                [
                    "Freeze scope rooms, openings, and wet locations before long-lead orders when possible.",
                    "List allowances with initial dollar placeholders and a rule for overage approval.",
                    "Require every scope change to state price and calendar impact before work continues.",
                    "Name who may authorize changes (one steward contact beats three overlapping yeses).",
                    "Keep a running change log with dates beside the original contract.",
                    "Do not let selection delays silently become contractor delay claims without documentation.",
                ]
            )
            + """
      <p class="text-sm text-slate-400 font-light mt-4"><a href="./hire-questions.html" class="text-secondary hover:underline">Hire interview questions</a> · <a href="./good-steward.html" class="text-secondary hover:underline">Good Steward</a> · <a href="./verify-contractor.html" class="text-secondary hover:underline">Verify contractor</a></p>""",
            border="border-primary/25",
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Change-order FAQ')}\n  </div>\n"
        + education_closing("hire", "default", official_keys=["lni_verify", "lni_home", "mybuildingpermit"])
    )
    return page_shell(
        "Change Orders & Allowances | Board of Project Stewardship",
        "Change-order and allowance explainer for North Sound remodels — Board Good Steward habits without invented markup percentages.",
        "change-orders",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}change-orders.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Good Steward", f"{BASE_URL}good-steward.html"),
            ("Change orders", f"{BASE_URL}change-orders.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_coastal_waterproofing_page() -> str:
    body = (
        _hub_header(
            "Good Steward · PNW envelope",
            "Coastal waterproofing checklist",
            "Educational checklist for baths, additions, and weatherproofing near Puget Sound. Not a product endorsement or installation manual.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/home-gallery-dryin.webp",
                    "Illustrative weather-resistive dry-in on a Pacific Northwest home — not a real Board job photo",
                    "Dry-in before finishes",
                ),
                (
                    "assets/images/posts/2026-08-08-weatherproof-first-2.webp",
                    "Illustrative coastal weatherproofing assembly — not a real Board job photo",
                    "WRB & flashing first",
                ),
                (
                    "assets/images/posts/2026-09-22-edmonds-siding-1.webp",
                    "Illustrative fiber-cement cladding context for coastal Edmonds — not a real Board job photo",
                    "Cladding after WRB",
                ),
            ],
            title="Coastal moisture context (illustrative)",
        )
        + _hub_section(
            "Moisture habits",
            _check_ul(
                [
                    "Identify wind-driven rain exposure and coastal moisture risk for the elevation before finish selections.",
                    "Require a written dry-in / temporary weather protection plan when openings are cut in roofs or walls.",
                    "Specify the waterproofing or weather-resistive approach in the contract (system + responsible trade).",
                    "Photograph membrane changes of plane, pan flashings, and wet-wall assemblies before cover.",
                    "Confirm ventilation strategy for baths (fan capacity, duct termination) in writing.",
                    "Sequence exterior cladding and window flashing so water has a drainage path, not a dead-end cavity.",
                    "Walk a moisture-related punch list before final payment; keep product cut sheets in the owner file.",
                ]
            )
            + """
      <p class="text-sm text-slate-400 font-light mt-4 mb-2">Related: <a href="./posts/2026-08-18-pnw-bathroom-waterproofing-essentials.html" class="text-secondary hover:underline">PNW bathroom waterproofing essentials</a> · <a href="./posts/2026-08-08-another-story-method-weatherproof-first.html" class="text-secondary hover:underline">Weatherproof-first method</a> · <a href="./bathrooms.html" class="text-secondary hover:underline">Bathroom directory</a></p>
      <p class="text-sm text-slate-400 font-light"><a href="./another-story.html" class="text-secondary hover:underline">Another Story</a> is a Board feature for second-story concepts — still weatherproof before finishes.</p>
      <p class="text-sm text-slate-400 font-light mt-3"><a href="./bathroom-waterproofing-guide.html" class="text-secondary hover:underline">Bathroom waterproofing guide</a> · <a href="./bathroom-cost-factors.html" class="text-secondary hover:underline">Bathroom cost factors</a> · <a href="./bathrooms.html" class="text-secondary hover:underline">Bathroom directory</a> · <a href="./materials.html" class="text-secondary hover:underline">Materials index</a></p>""",
            border="border-primary/25",
        )
        + related_learning_strip([
            ("Bathroom waterproofing guide", "./bathroom-waterproofing-guide.html"),
            ("PNW waterproofing post", "./posts/2026-08-18-pnw-bathroom-waterproofing-essentials.html"),
            ("Bathrooms directory", "./bathrooms.html"),
            ("Learn hub", "./learn.html"),
        ])
        + "  <div class=\"pb-12\"></div>\n"
        + education_closing("default", "directories", official_keys=["lni_verify", "seattle_sdci", "edmonds"])
    )
    return page_shell(
        "Coastal Waterproofing Checklist | Board of Project Stewardship",
        "Coastal waterproofing checklist for Puget Sound baths and additions — Board Good Steward moisture habits without product ROI claims.",
        "coastal-waterproofing",
        body,
        canonical=f"{BASE_URL}coastal-waterproofing.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Good Steward", f"{BASE_URL}good-steward.html"),
            ("Coastal waterproofing", f"{BASE_URL}coastal-waterproofing.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_hire_questions_page() -> str:
    groups = [
        (
            "License & entity",
            [
                "What exact legal name and WA contractor license number will appear on the contract?",
                "Will you pause while I confirm that name on WA L&I Verify today?",
            ],
        ),
        (
            "Scope & allowances",
            [
                "What is included vs excluded in the written scope?",
                "Which finishes are allowances, and how are overages approved?",
            ],
        ),
        (
            "Permits & inspections",
            [
                "Who pulls which permits, who pays fees, and who stands for inspections?",
                "What happens if a correction notice stops cover-up work?",
            ],
        ),
        (
            "Schedule & site",
            [
                "What is the weather / dry-in plan if we open a roof or exterior wall?",
                "Who is the single steward contact for decisions and schedule?",
            ],
        ),
        (
            "Money & closeout",
            [
                "What is the payment schedule tied to milestones (not vibes)?",
                "How do punch list and final payment work, and what manuals do I receive?",
            ],
        ),
        (
            "Bonds, insurance & warranty",
            [
                "What bond and liability insurance limits will be current on the start date?",
                "What warranty covers workmanship vs manufacturer products, and who stands behind callbacks?",
            ],
        ),
    ]
    blocks = []
    for title, qs in groups:
        lis = "".join(f"<li>{esc(q)}</li>" for q in qs)
        blocks.append(
            f"""      <article class="bg-charcoal border border-white/10 rounded-xl p-6 mb-4">
        <h2 class="text-lg font-black text-white mb-3">{esc(title)}</h2>
        <ul class="space-y-2 text-sm text-slate-300 font-light list-disc pl-5">{lis}</ul>
      </article>"""
        )
    body = (
        _hub_header(
            "Good Steward · Interviews",
            "Hire interview question bank",
            "A Board question bank for comparing remodel and addition bids in Edmonds / King &amp; Snohomish. Use alongside L&amp;I Verify — not instead of it.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/posts/2026-08-11-hire-design-build-4.webp",
                    "Illustrative hire interview over plans — not a real Board job photo",
                    "Same questions every firm",
                ),
                (
                    "assets/images/home-process-verify.webp",
                    "Illustrative L&I verification before deposit — not a real Board job photo",
                    "License before handshake",
                ),
                (
                    "assets/images/home-process-shortlist.webp",
                    "Illustrative shortlist comparison — not a real Board job photo",
                    "Compare written scopes",
                ),
            ],
            title="Interview habits (illustrative)",
        )
        + _hub_section(
            "How to run the interview",
            f"""      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">Ask the same questions of every bidder and write the answers down. The goal is comparable scopes — not theatrical confidence. Start with the exact legal name and WA contractor license number that will appear on the contract, then open <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a> while they are still on the call or at the table.</p>
      <p class="text-sm text-slate-400 font-light leading-relaxed mb-3">Press on permits (who pulls, who pays, who stands for inspections), allowances (what is placeholder money vs fixed), change-order rules (price and calendar impact before work continues), weather/dry-in when roofs or walls open, and how punch list / final payment works. Pair this bank with <a href="./red-flags-hiring.html" class="text-secondary hover:underline">red flags</a>, <a href="./bid-comparison.html" class="text-secondary hover:underline">bid comparison</a>, and <a href="./bonds-and-insurance.html" class="text-secondary hover:underline">bonds &amp; insurance</a>.</p>
      <p class="text-sm text-slate-400 font-light leading-relaxed">The Board of Project Stewardship does not invent typical prices, markups, or warranty lengths. If a bidder will not put answers in writing, treat that as information. Board #1 hire ranking remains an editorial outbound to <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">{esc(PPG['name'])}</a> — contact firms directly after verification.</p>""",
            border="border-primary/25",
        )
        + "  <div class=\"max-w-6xl mx-auto px-4 pb-4\">\n"
        + "\n".join(blocks)
        + """
    <p class="text-sm text-slate-400 font-light pb-16"><a href="./verify-contractor.html" class="text-secondary hover:underline">Verify contractor</a> · <a href="./change-orders.html" class="text-secondary hover:underline">Change orders</a> · <a href="./site-visit.html" class="text-secondary hover:underline">Site Visit Checklist</a> · <a href="./how-we-rank.html" class="text-secondary hover:underline">How we rank</a></p>
  </div>
"""
        + education_closing("hire", "verify", "default", official_keys=["lni_verify", "lni_home", "seattle_how", "mybuildingpermit"])
    )
    return page_shell(
        "Hire Interview Questions | Board of Project Stewardship",
        "Hire interview question bank for North Sound remodel and addition bids — Board Good Steward prompts paired with L&I Verify.",
        "hire-questions",
        body,
        canonical=f"{BASE_URL}hire-questions.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Good Steward", f"{BASE_URL}good-steward.html"),
            ("Hire questions", f"{BASE_URL}hire-questions.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )



def build_about_page() -> str:
    faqs = [
        (
            "Is the Board of Project Stewardship a general contractor?",
            "No. The Board of Project Stewardship is an independent publisher of construction standards and contractor directories. It does not perform construction under the Board name and does not sell contractor leads.",
        ),
        (
            "Does the Board own Pacific Pro Group?",
            f"No. {PPG['name']} appears as Board #1 on relevant directories because of the published ranking method — not ownership. Hire outreach goes to {PPG['url']} directly.",
        ),
        (
            "Where should homeowners start?",
            "Open the Learn hub for permits/ADU/hiring guides, shortlist from a matching directory, then re-verify every legal name at WA L&I Verify before any deposit.",
        ),
    ]
    body = (
        _hub_header(
            "Independent publisher · Edmonds / King & Snohomish",
            "About the Board of Project Stewardship",
            "We publish construction standards and contractor directories so homeowners can shortlist with confidence — not ad spend. The Board does not bid or build projects.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/home-process-research.webp",
                    "Illustrative Board research and standards desk — not a real Board job photo",
                    "Editorial research",
                ),
                (
                    "assets/images/home-process-verify.webp",
                    "Illustrative verification habit for Board directories — not a real Board job photo",
                    "Verify before hire",
                ),
                (
                    "assets/images/posts/2026-08-11-hire-design-build-5.webp",
                    "Illustrative design-build hire planning context — not a real Board job photo",
                    "Shortlist with clear scope",
                ),
            ],
            title="How the Board works (illustrative)",
        )
        + _hub_section(
            "What we are",
            f"""      <ul class="space-y-2 text-sm text-slate-300 font-light list-disc pl-5 mb-4">
        <li>An independent editorial publisher of remodel and addition standards for Edmonds and King &amp; Snohomish Counties.</li>
        <li>A curator of ranked directories and Good Steward tools that point homeowners back to official portals.</li>
        <li>Public contact: <a href="mailto:{EDITORIAL_EMAIL}" class="text-secondary hover:underline">{EDITORIAL_EMAIL}</a>.</li>
      </ul>""",
            border="border-primary/25",
        )
        + _hub_section(
            "What we are not",
            """      <ul class="space-y-2 text-sm text-slate-300 font-light list-disc pl-5 mb-4">
        <li>Not a general contractor, architect, or permit agency.</li>
        <li>Not a lead marketplace and not a paid placement list.</li>
        <li>Not the owner of ranked firms — Board #1 is an editorial hire ranking outbound only.</li>
      </ul>""",
        )
        + _hub_section(
            "How to use the Board",
            _link_ul(
                [
                    ("Learn hub", "./learn.html"),
                    ("How we rank", "./how-we-rank.html"),
                    ("Verify a WA contractor", "./verify-contractor.html"),
                    ("Permit jurisdiction hub", "./permits.html"),
                    ("Sitewide FAQ", "./faq.html"),
                    ("Contact editorial", "./contact.html"),
                    ("Home additions directory", "./additions.html"),
                ]
            ),
        )
        + integrity_shield_html(
            "Six stewardship layers the Board uses when screening contractors — public records and local mastery, not paid placement."
        )
        + education_closing("default", "directories", "learn", official_keys=["lni_verify", "lni_hire_smart", "lni_home", "mybuildingpermit", "edmonds"])
        + f'  <div class="max-w-6xl mx-auto px-4 pb-16">\n{faq_section(faqs, "About FAQ")}\n  </div>\n'
    )
    return page_shell(
        "About | Board of Project Stewardship",
        "About the Board of Project Stewardship — independent Edmonds / King & Snohomish construction directories and homeowner education. Not a GC and not owned by ranked firms.",
        "about",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}about.html",
        breadcrumbs=[("Home", BASE_URL), ("About", f"{BASE_URL}about.html")],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
        og_image_alt="About the Board of Project Stewardship — independent publisher",
    )


def build_faq_page() -> str:
    faqs = [
        (
            "Is the Board of Project Stewardship a contractor?",
            "No. The Board publishes directories and educational guides. We do not build projects, write construction contracts, or collect project deposits.",
        ),
        (
            "Does the Board own Pacific Pro Group?",
            f"No. {PPG['name']} appears as Board #1 on relevant directories because of the published ranking method — not ownership. Hire outreach goes to {PPG['url']} directly.",
        ),
        (
            "How should I verify a Washington contractor?",
            f"Match the contract legal name on WA L&I Verify ({LNI_URL}), confirm active license/bond/insurance fields, and keep a record. Use the Board verify-contractor walkthrough as a companion only.",
        ),
        (
            "Are Board rankings paid placements?",
            "No. Rankings follow published editorial pillars. See How we rank. Listings are research aids, not guarantees of price, schedule, or workmanship.",
        ),
        (
            "Where do I start for permits in Edmonds or nearby cities?",
            "Start at the Board permit hub for orientation, then use the official portal for your parcel’s authority having jurisdiction (city or county). Timelines vary by scope and AHJ workload.",
        ),
        (
            "Do you publish fixed remodel prices or ROI?",
            "No. Cost-factor pages explain drivers (scope, structure, finishes, site conditions) without invented bid amounts or return-on-investment claims.",
        ),
        (
            "What is Good Steward?",
            "A set of educational Board tools (site visit, build walkthrough, PM dashboard, and related checklists). They are planning aids — not contracts, schedules, or bids.",
        ),
        (
            "How do I ask about a directory correction?",
            f"Email {EDITORIAL_EMAIL} with the firm name, page URL, and the correction. For project hiring questions, contact the firm directly after L&I verification.",
        ),
        (
            "Is Another Story a Board-owned product?",
            "Another Story is framed as a Board feature tied to the #1 listing’s public tools — conceptual/educational, not a permit set or Board construction service.",
        ),
        (
            "How long does a typical addition or remodel take?",
            "It varies widely by scope, design readiness, inspections, material lead times, and weather. Ask your GC and AHJ for schedule ranges for your specific parcel — the Board does not promise timelines.",
        ),
        (
            "What cities does the Board cover?",
            "Editorial focus is Edmonds plus King and Snohomish County project hubs (including Seattle neighborhoods and nearby cities). Use city hubs and directories for local starting points.",
        ),
        (
            "Where is the full learning library?",
            "The Learn hub indexes permits, ADU, hiring guides, cost factors, glossary, videos, and Good Steward tools.",
        ),
    ]
    body = (
        _hub_header(
            "FAQ",
            "Homeowner questions",
            "Straight answers about the Board, rankings, verification, and permits. Educational — not legal, engineering, or bid advice.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/home-process-shortlist.webp",
                    "Illustrative homeowner shortlist review — not a real Board job photo",
                    "Start with a shortlist",
                ),
                (
                    "assets/images/home-process-verify.webp",
                    "Illustrative WA L&I verification workflow — not a real Board job photo",
                    "Re-verify at L&I",
                ),
                (
                    "assets/images/posts/2026-08-12-edmonds-addition-permit-5.webp",
                    "Illustrative permit plan-review materials — not a real Board job photo",
                    "Confirm the AHJ path",
                ),
            ],
            title="Quick visual context (illustrative)",
        )
        + faq_section(faqs, "Frequently asked questions")
        + education_closing(
            "default",
            "hire",
            "learn",
            official_keys=["lni_verify", "lni_hire_smart", "lni_hiring_hub", "lni_hire_pdf", "lni_protect", "lni_home"],
        )
        + '  <div class="pb-12"></div>\n'
    )
    return page_shell(
        "FAQ | Board of Project Stewardship",
        "FAQ for the Board of Project Stewardship — rankings, WA L&I verification, permits, and homeowner tools for Edmonds / King & Snohomish.",
        "faq",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}faq.html",
        breadcrumbs=[("Home", BASE_URL), ("FAQ", f"{BASE_URL}faq.html")],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
        og_image_alt="Board of Project Stewardship homeowner FAQ",
    )


def build_materials_index_page() -> str:
    materials = [
        ("Simpson Strong-Tie", "https://www.strongtie.com/", "Structural connectors and hold-downs commonly referenced in addition/ADU framing notes."),
        ("ZIP System (Huber)", "https://www.huberwood.com/zip-system", "Weather-resistant sheathing systems often discussed for PNW envelopes."),
        ("James Hardie", "https://www.jameshardie.com/", "Fiber-cement cladding frequently cited for coastal moisture cycles."),
        ("Boise Cascade engineered lumber", "https://www.bc.com/", "Engineered framing members referenced for efficient spans."),
        ("DuPont Tyvek (WRB)", "https://www.dupont.com/brands/tyvek.html", "Weather-resistive barrier products often discussed in PNW wall assemblies — not a Board endorsement."),
        ("Schluter Systems", "https://www.schluter.com/", "Wet-area waterproofing systems commonly referenced in bath remodel detailing notes."),
        ("Andersen Windows", "https://www.andersenwindows.com/", "Window manufacturer resources sometimes cited in replacement and flashing conversations."),
        ("Marvin", "https://www.marvin.com/", "Window and door manufacturer resources referenced in coastal moisture detailing notes."),
    ]
    cards = "".join(
        f"""      <article class="bg-charcoal border border-white/10 rounded-xl p-6 mb-3">
        <h3 class="text-lg font-black text-white mb-2"><a href="{url}" target="_blank" rel="noopener" class="text-secondary hover:underline">{esc(name)}</a></h3>
        <p class="text-sm text-slate-400 font-light leading-relaxed">{esc(blurb)}</p>
      </article>"""
        for name, url, blurb in materials
    )
    body = (
        _hub_header(
            "Editorial index · No prices",
            "Materials Worth Knowing",
            "An index of manufacturer resources the Board has pointed to in editorial posts. Not endorsements, not prices, not installation warranties from the Board.",
        )
        + f"""  <div class="max-w-6xl mx-auto px-4 pb-16">
{cards}
    <p class="text-sm text-slate-400 font-light mb-6">See Materials Worth Knowing sections inside individual <a href="./blog.html" class="text-secondary hover:underline">blog posts</a> for project context. Links are editorial references — not prices, warranties, or Board product endorsements.</p>
{related_learning_strip([
            ("Coastal waterproofing", "./coastal-waterproofing.html"),
            ("Windows & doors directory", "./windows.html"),
            ("Siding directory", "./siding.html"),
            ("Trades hub", "./trades.html"),
            ("Learn hub", "./learn.html"),
        ])}
  </div>
"""
        + education_closing("learn", "cost_factors", "default", official_keys=["lni_verify", "sbcc", "seattle_sdci"])
    )
    return page_shell(
        "Materials Worth Knowing | Board of Project Stewardship",
        "Materials Worth Knowing index — manufacturer resources referenced in Board of Project Stewardship posts. No prices or ROI claims.",
        "materials",
        body,
        canonical=f"{BASE_URL}materials.html",
        breadcrumbs=[("About", BASE_URL), ("Materials", f"{BASE_URL}materials.html")],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_contact_page() -> str:
    faqs = [
        (
            "Is this a contractor dispatch line?",
            "No. This is the Board of Project Stewardship editorial desk. For project hiring, shortlist from Board directories and contact firms directly after WA L&I Verify.",
        ),
        (
            "How fast do you reply?",
            "Editorial notes are reviewed as capacity allows. We do not promise same-day contractor matching or bid turnaround — the Board is not a brokerage.",
        ),
        (
            "Can you change a ranking if I email?",
            "Send factual corrections (legal name, dead links, jurisdiction mistakes). Rankings follow published pillars on How we rank — not paid placement requests.",
        ),
    ]
    body = (
        _hub_header(
            "Editorial desk",
            "Contact the Board of Project Stewardship",
            f"Public contact for the Board of Project Stewardship editorial desk. This is not a contractor dispatch line and not {PPG['name']} customer service.",
        )
        + _hub_section(
            "What this inbox is for",
            f"""      <div class="flex flex-wrap gap-2 mb-5">
        <span class="text-[11px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full border border-secondary/40 text-secondary">Directory correction</span>
        <span class="text-[11px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full border border-white/15 text-slate-300">Source question</span>
        <span class="text-[11px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full border border-white/15 text-slate-300">Press / editorial</span>
      </div>
      <p class="text-slate-300 text-sm font-light leading-relaxed mb-4">Email <a href="mailto:{EDITORIAL_EMAIL}" class="text-secondary hover:underline font-semibold">{EDITORIAL_EMAIL}</a> when you spot a dead firm URL, a wrong jurisdiction note, or a sourcing question about a Board directory or Learn guide. Include the page URL and the correction you want us to review.</p>
      <p class="text-slate-400 text-sm font-light leading-relaxed mb-4">Response expectations: the desk is editorial, not a call center. We review notes as capacity allows and do not promise same-day replies, contractor matching, or bid packaging. If you need a crew on site, shortlist from Board directories and call the firm after you verify the license.</p>
      <p class="text-slate-400 text-sm font-light leading-relaxed mb-4">For hiring: use <a href="./additions.html" class="text-secondary hover:underline">Additions</a>, <a href="./kitchen.html" class="text-secondary hover:underline">Kitchen</a>, <a href="./bathrooms.html" class="text-secondary hover:underline">Bathrooms</a>, or <a href="./trades.html" class="text-secondary hover:underline">Trades</a>, then verify at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a>. Board #1 hire ranking links to <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">{esc(PPG['url'])}</a> — contact that firm directly for project inquiries.</p>
      <p class="text-slate-400 text-sm font-light leading-relaxed"><a href="./about.html" class="text-secondary hover:underline">About</a> · <a href="./faq.html" class="text-secondary hover:underline">FAQ</a> · <a href="./how-we-rank.html" class="text-secondary hover:underline">How we rank</a> · <a href="./learn.html" class="text-secondary hover:underline">Learn hub</a> · <a href="./write.html" class="text-secondary hover:underline">Contribute (draft tool)</a></p>""",
            border="border-primary/25",
        )
        + f'  <div class="max-w-6xl mx-auto px-4 pb-8">\n{faq_section(faqs, "Contact FAQ")}\n  </div>\n'
        + education_closing("default", "learn", "directories", official_keys=["lni_verify", "lni_home", "edmonds", "seattle_sdci"])
    )
    return page_shell(
        "Contact | Board of Project Stewardship",
        f"Contact the Board of Project Stewardship editorial desk at {EDITORIAL_EMAIL}. Directory corrections and source questions — not a contractor dispatch line.",
        "contact",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}contact.html",
        breadcrumbs=[("Home", BASE_URL), ("Contact", f"{BASE_URL}contact.html")],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_glossary_page() -> str:
    terms = [
        ("AHJ", esc("Authority Having Jurisdiction — the city or county department that issues permits and inspections for the parcel.") + ' See the <a href="./permits.html" class="text-secondary hover:underline">permit hub</a>.'),
        ("Allowance", esc("Contract placeholder budget for a selection not yet finalized; overages need a written rule.") + ' Related: <a href="./change-orders.html" class="text-secondary hover:underline">change orders</a> · <a href="./hire-questions.html" class="text-secondary hover:underline">hire questions</a>.'),
        ("Board #1", esc(f"Editorial hire ranking on Board directories. {PPG['name']} currently holds #1 for key remodel categories — not Board ownership.") + f' <a href="{PPG["url"]}" target="_blank" rel="noopener" class="text-secondary hover:underline">Pacific Pro Group</a> · <a href="./how-we-rank.html" class="text-secondary hover:underline">How we rank</a>.'),
        ("Change order", esc("Written amendment stating price and schedule impact before changed work proceeds.") + ' Guide: <a href="./change-orders.html" class="text-secondary hover:underline">change orders &amp; allowances</a>.'),
        ("DADU", esc("Detached accessory dwelling unit — a separate small dwelling on the same lot as a primary home.") + ' See <a href="./adu.html" class="text-secondary hover:underline">Edmonds ADU hub</a> · <a href="./adu-checklist.html" class="text-secondary hover:underline">ADU checklist</a>.'),
        ("Dry-in", esc("Stage when the structure is weather-protected enough that interior work is not exposed to open rain risk.") + ' Related: <a href="./coastal-waterproofing.html" class="text-secondary hover:underline">coastal waterproofing</a> · <a href="./project-timeline.html" class="text-secondary hover:underline">project timeline</a>.'),
        ("ECDC", esc("Edmonds Community Development Code — includes ADU standards such as 16.20.050.") + ' See <a href="./adu.html" class="text-secondary hover:underline">Edmonds ADU hub</a> · <a href="./permits.html" class="text-secondary hover:underline">permit hub</a>.'),
        ("L&I Verify", esc("Washington State Department of Labor & Industries official contractor license lookup.") + f' Official tool: <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a> · Board walkthrough: <a href="./verify-contractor.html" class="text-secondary hover:underline">verify contractor</a>.'),
        ("MyBuildingPermit", esc("Shared regional portal used by many Puget Sound jurisdictions for permit applications.") + ' Orientation: <a href="./permits.html" class="text-secondary hover:underline">permit hub</a> (Seattle typically uses SDCI instead).'),
        ("Punch list", esc("Documented remaining items to complete or correct before final payment.") + ' Related: <a href="./final-walkthrough.html" class="text-secondary hover:underline">final walkthrough</a>.'),
        ("SDCI", esc("Seattle Department of Construction and Inspections.") + ' See <a href="./seattle.html" class="text-secondary hover:underline">Seattle hub</a> · <a href="./permits.html" class="text-secondary hover:underline">permit hub</a>.'),
        ("WRB", esc("Weather-resistive barrier — part of the exterior moisture-control assembly.") + ' Related: <a href="./coastal-waterproofing.html" class="text-secondary hover:underline">coastal waterproofing</a> · <a href="./materials.html" class="text-secondary hover:underline">materials index</a>.'),
        ("Bond (contractor)", esc("Surety bond associated with WA contractor registration; L&I Verify shows bond-related fields and claims history when present.") + ' Guide: <a href="./bonds-and-insurance.html" class="text-secondary hover:underline">bonds &amp; insurance</a>.'),
        ("UBI", esc("Washington Unified Business Identifier — a state business ID sometimes used alongside contractor registration searches.") + f' Pair with <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a> · <a href="./verify-contractor.html" class="text-secondary hover:underline">verify walkthrough</a>.'),
        ("Retainage", esc("Contract amount held until punch list or closeout conditions are met; terms must be written.") + ' Related: <a href="./final-walkthrough.html" class="text-secondary hover:underline">final walkthrough</a> · <a href="./change-orders.html" class="text-secondary hover:underline">change orders</a> · <a href="./financing-and-draws.html" class="text-secondary hover:underline">financing &amp; draws</a>.'),
        ("Lien", esc("A claim against property for unpaid labor or materials; ask about lien waivers at draws and final payment.") + ' Related: <a href="./bonds-and-insurance.html" class="text-secondary hover:underline">bonds &amp; insurance</a> · <a href="./contractor-contract-basics.html" class="text-secondary hover:underline">contract basics</a> · <a href="./financing-and-draws.html" class="text-secondary hover:underline">draws</a>.'),
        ("MEP", esc("Mechanical, electrical, and plumbing — rough-in and finish trades that often drive remodel sequencing.") + ' Directories: <a href="./plumber.html" class="text-secondary hover:underline">plumber</a> · <a href="./electrician.html" class="text-secondary hover:underline">electrician</a> · <a href="./hvac.html" class="text-secondary hover:underline">HVAC</a> · <a href="./trades.html" class="text-secondary hover:underline">trades hub</a>.'),
        ("Critical area", esc("Environmentally sensitive land (steep slopes, wetlands, buffers) that can add review beyond a simple building permit.") + ' Start at the <a href="./permits.html" class="text-secondary hover:underline">permit hub</a> · <a href="./home-addition-planning.html" class="text-secondary hover:underline">addition planning</a> · city hubs such as <a href="./edmonds.html" class="text-secondary hover:underline">Edmonds</a>.'),
        ("eTRAKiT", esc("Shoreline’s online permitting portal for applications, status, and inspections.") + ' See <a href="./shoreline.html" class="text-secondary hover:underline">Shoreline hub</a> · <a href="./permits.html" class="text-secondary hover:underline">permit hub</a>.'),
        ("Accela", esc("Permit/records software used by some jurisdictions (including King County portals) for status and filings.") + ' See <a href="./king-county.html" class="text-secondary hover:underline">King County hub</a> · <a href="./seattle.html" class="text-secondary hover:underline">Seattle hub</a> (Services Portal) · <a href="./permits.html" class="text-secondary hover:underline">permit hub</a>.'),
        ("Fixture unit", esc("Plumbing sizing concept used when checking water meter / supply capacity for ADUs and additions.") + ' Related: <a href="./adu-checklist.html" class="text-secondary hover:underline">ADU checklist</a> · <a href="./plumber.html" class="text-secondary hover:underline">plumber directory</a> · <a href="./adu.html" class="text-secondary hover:underline">ADU hub</a>.'),
        ("Notice to Customer", esc("Washington consumer disclosure concept referenced in L&I hiring guidance — confirm current L&I forms for your contract.") + f' Official: <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a> · <a href="./hiring-a-contractor.html" class="text-secondary hover:underline">hiring a contractor</a> · <a href="./hire-questions.html" class="text-secondary hover:underline">hire questions</a>.'),
        ("Permit", esc("Official authorization from the AHJ to perform regulated construction work; who pulls and owns each permit should be written.") + ' Hub: <a href="./permits.html" class="text-secondary hover:underline">permits</a> · city examples: <a href="./edmonds.html" class="text-secondary hover:underline">Edmonds</a> · <a href="./seattle.html" class="text-secondary hover:underline">Seattle</a>.'),
        ("Rough-in", esc("Stage when MEP lines are installed in walls/floors before insulation and finishes conceal them.") + ' Related: <a href="./project-timeline.html" class="text-secondary hover:underline">project timeline</a> · <a href="./build-walkthrough.html" class="text-secondary hover:underline">Build Walkthrough</a> · <a href="./trades.html" class="text-secondary hover:underline">trades hub</a>.'),
        ("Substantial completion", esc("Contract milestone when the work is usable for its intended purpose except punch-list items; definitions must match your written contract.") + ' Related: <a href="./final-walkthrough.html" class="text-secondary hover:underline">final walkthrough</a> · <a href="./change-orders.html" class="text-secondary hover:underline">change orders</a>.'),
        ("WSEC-R", esc("Washington State Energy Code — Residential provisions that can affect insulation, windows, and mechanical choices.") + ' Related: <a href="./energy-credit.html" class="text-secondary hover:underline">energy code credits tool</a> · <a href="./insulation.html" class="text-secondary hover:underline">insulation</a> · <a href="./windows.html" class="text-secondary hover:underline">windows</a>.'),
        ("RFI", esc("Request for Information — a written question from builder to designer (or reverse) that should be logged before work proceeds on unclear details.") + ' Related: <a href="./change-orders.html" class="text-secondary hover:underline">change orders</a> · <a href="./contractor-contract-basics.html" class="text-secondary hover:underline">contract basics</a>.'),
        ("Shop drawings", esc("Fabricator or installer detail drawings (cabinets, steel, stairs) submitted for coordination before fabrication.") + ' Related: <a href="./kitchen-remodel-planning.html" class="text-secondary hover:underline">kitchen planning</a> · <a href="./materials.html" class="text-secondary hover:underline">materials index</a>.'),
    ]
    rows = "".join(
        f"""      <div class="border-b border-white/10 py-4">
        <h3 class="text-white font-bold mb-1">{esc(term)}</h3>
        <p class="text-sm text-slate-400 font-light leading-relaxed">{defn}</p>
      </div>"""
        for term, defn in terms
    )
    body = (
        _hub_header(
            "Reference",
            "Glossary",
            "Short definitions used across Board of Project Stewardship directories and Good Steward tools.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/home-process-research.webp",
                    "Illustrative standards research desk — not a real Board job photo",
                    "Shared vocabulary",
                ),
                (
                    "assets/images/home-process-verify.webp",
                    "Illustrative verification language in practice — not a real Board job photo",
                    "Public records terms",
                ),
                (
                    "assets/images/home-gallery-dryin.webp",
                    "Illustrative building-assembly context — not a real Board job photo",
                    "Assembly terms",
                ),
            ],
            title="Standards language (illustrative)",
        )
        + _hub_section("Terms", rows)
        + "  <div class=\"pb-12\"></div>\n"
        + education_closing("learn", "default", official_keys=["lni_verify", "lni_home", "mybuildingpermit", "seattle_sdci"])
    )
    return page_shell(
        "Glossary | Board of Project Stewardship",
        "Glossary of remodel and permitting terms used by the Board of Project Stewardship.",
        "glossary",
        body,
        canonical=f"{BASE_URL}glossary.html",
        breadcrumbs=[("About", BASE_URL), ("Glossary", f"{BASE_URL}glossary.html")],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_videos_page() -> str:
    body = (
        _hub_header(
            "Editorial media",
            "Video library index",
            "Index of Board-hosted illustrative process clips referenced from posts and tools. Clips are editorial context — not footage of a guaranteed Board job schedule.",
        )
        + _hub_section(
            "Where to watch",
            """      <ul class="space-y-3 text-sm text-slate-300 font-light">
        <li><a href="./posts/2026-09-07-adu-planning-edmonds-wa.html" class="text-secondary hover:underline">ADU planning Edmonds</a> — includes illustrative framing context clip</li>
        <li><a href="./posts/2026-08-12-edmonds-home-addition-permit-basics.html" class="text-secondary hover:underline">Edmonds addition permit basics</a> — process clip reference</li>
        <li><a href="./build-walkthrough.html" class="text-secondary hover:underline">Build Walkthrough</a> — interactive stage tool</li>
        <li><a href="./another-story.html" class="text-secondary hover:underline">Another Story</a> — Board feature concept studio</li>
      </ul>
      <p class="text-xs text-slate-500 mt-4 font-light">Prefer the post page for captions and honesty labels. Illustrative clips are not project guarantees.</p>""",
        )
        + "  <div class=\"pb-12\"></div>\n"
        + education_closing("learn", "tools", "default", official_keys=["lni_verify", "lni_home"])
    )
    return page_shell(
        "Video Library | Board of Project Stewardship",
        "Video library index for Board of Project Stewardship illustrative process clips and tools.",
        "videos",
        body,
        canonical=f"{BASE_URL}videos.html",
        breadcrumbs=[("About", BASE_URL), ("Video library", f"{BASE_URL}videos.html")],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )




# ---------------------------------------------------------------------------
# SEO learning hubs + city hubs + lightweight client tools (wave after d6ca6b7)
# ---------------------------------------------------------------------------


def build_second_story_vs_teardown_page() -> str:
    faqs = [
        (
            "Is a second story always cheaper than a teardown?",
            "Not always. Structure, foundation capacity, roof complexity, temporary housing, and permit path can erase an apparent savings. Compare written scopes — not vibes.",
        ),
        (
            "Do I need engineering either way?",
            "Often yes for second-story loads and for new foundations after teardown. Your AHJ and structural engineer set the bar; the Board does not invent stamp requirements.",
        ),
        (
            "Who should I hire first?",
            "Shortlist design-build or addition specialists from Board directories, re-verify at WA L&I, then walk Site Visit Checklist questions before deposits.",
        ),
        (
            "Where does Another Story fit?",
            "Another Story is a Board feature concept studio for exploring second-story massing ideas — not a bid, permit, or structural calculation.",
        ),
    ]
    body = (
        _hub_header(
            "Learning hub · Additions",
            "Second story vs teardown",
            "An educational Board comparison for North Sound homeowners weighing a second-story addition against a full teardown-and-rebuild. Not a cost guarantee, appraisal, or structural opinion.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/posts/2026-08-09-second-story-teardown-1.webp",
                    "Illustrative second-story vs teardown comparison context — not a real Board job photo",
                    "Compare paths honestly",
                ),
                (
                    "assets/images/posts/2026-08-09-second-story-teardown-2.webp",
                    "Illustrative structural addition framing — not a real Board job photo",
                    "Structure drives path",
                ),
                (
                    "assets/images/posts/2026-08-09-second-story-teardown-3.webp",
                    "Illustrative finished vertical addition massing — not a real Board job photo",
                    "No invented cost deltas",
                ),
            ],
            title="Path comparison (illustrative)",
        )
        + _hub_section(
            "What you are really choosing",
            f"""      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">A second story keeps the existing footprint and neighborhood pattern but asks the current foundation, lateral system, and roof to carry new loads. A teardown resets systems and often zoning interpretation — and usually means longer vacancy, more demolition waste, and a full new-home permit path.</p>
      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">Neither path is automatically “better.” Good stewards compare <strong class="text-white">habitability during construction</strong>, <strong class="text-white">permit jurisdiction</strong>, <strong class="text-white">engineering scope</strong>, and <strong class="text-white">written exclusions</strong> before chasing a single headline number.</p>
      <p class="text-sm text-slate-400 font-light leading-relaxed">Official permit orientation: <a href="./permits.html" class="text-secondary hover:underline">permit hub</a>. Contractor verification: <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a>.</p>""",
            border="border-primary/25",
        )
        + _hub_section(
            "Decision checklist",
            _check_ul(
                [
                    "Confirm parcel jurisdiction (city vs county) before concept drawings freeze.",
                    "Ask whether existing foundation and lateral systems were evaluated for added story loads.",
                    "Price temporary living, storage, and weather protection as first-class line items — not afterthoughts.",
                    "For teardown: confirm demolition, haul-off, and any asbestos/lead survey expectations in writing.",
                    "For second story: demand a written dry-in / temporary roof plan before openings are cut.",
                    "Shortlist firms with permitted local addition or custom-home experience; L&I Verify each legal name.",
                ]
            ),
        )
        + _hub_section(
            "Related Board reading & tools",
            _link_ul(
                [
                    ("Second story vs teardown — Edmonds post", "./posts/2026-08-09-second-story-vs-teardown-edmonds.html"),
                    ("Stay-in-home second story Edmonds", "./posts/2026-09-14-stay-in-home-second-story-edmonds.html"),
                    ("Second-story addition Shoreline", "./posts/2026-08-24-second-story-addition-shoreline.html"),
                    ("Home addition planning hub", "./home-addition-planning.html"),
                    ("Home additions directory", "./additions.html"),
                    ("Another Story (Board feature)", "./another-story.html"),
                    ("Project timeline (typical phases)", "./project-timeline.html"),
                    ("Hiring a contractor hub", "./hiring-a-contractor.html"),
                    ("Good Steward tools", "./good-steward.html"),
                ]
            ),
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Second story vs teardown FAQ')}\n  </div>\n"
    )
    return page_shell(
        "Second Story vs Teardown | Board of Project Stewardship",
        "Educational comparison of second-story additions vs teardown-rebuild for Edmonds / King & Snohomish homeowners — Board learning hub, not a cost guarantee.",
        "second-story-vs-teardown",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}second-story-vs-teardown.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Home additions", f"{BASE_URL}additions.html"),
            ("Second story vs teardown", f"{BASE_URL}second-story-vs-teardown.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_kitchen_remodel_planning_page() -> str:
    faqs = [
        (
            "Do kitchen remodels always need permits?",
            "Moving plumbing, electrical, gas, or walls usually triggers permits. Confirm with your AHJ — see the permit hub — and get the permit number in writing.",
        ),
        (
            "What should a kitchen bid include?",
            "Written scope for demo, rough-ins, cabinets, counters, appliances (owner vs contractor furnished), allowances, exclusions, and who owns inspections.",
        ),
        (
            "Who ranks #1 for kitchen remodels on the Board?",
            f"{PPG['name']} holds the Board’s editorial #1 hire ranking for the kitchen directory — {PPG['url']} — not Board ownership. Re-verify at L&I.",
        ),
    ]
    kitchen_steps = [
        (
            "Document existing conditions",
            "Photograph existing plumbing, electrical panel capacity notes, and any prior remodel surprises.",
        ),
        (
            "Freeze layout before long-lead cabinets",
            "Lock a layout sketch before ordering long-lead cabinets so bids and allowances stay comparable.",
        ),
        (
            "Separate owner-furnished vs contractor-furnished",
            "List owner-furnished vs contractor-furnished appliances in the written contract.",
        ),
        (
            "Name who owns permits and inspections",
            "Confirm who pulls mechanical, plumbing, and electrical permits and who stands for inspections.",
        ),
        (
            "Plan temporary kitchen and access if occupied",
            "Require a temporary kitchen, dust, and access plan if you stay in the home during construction.",
        ),
        (
            "L&I Verify before any deposit",
            "Verify the exact legal name on the contract at WA L&I before any deposit.",
        ),
    ]
    body = (
        _hub_header(
            "Learning hub · Kitchen",
            "Kitchen remodel planning",
            "Board educational guide for planning a kitchen remodel in Edmonds / King &amp; Snohomish. Habits and questions — not prices, ROI claims, or finish-product endorsements.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/posts/2026-09-18-mill-creek-kitchen-1.webp",
                    "Illustrative Mill Creek kitchen remodel layout planning context",
                    "Layout before long-lead cabinets",
                ),
                (
                    "assets/images/posts/2026-09-18-mill-creek-kitchen-2.webp",
                    "Illustrative kitchen rough-in and allowance coordination",
                    "Allowances in writing",
                ),
                (
                    "assets/images/posts/2026-09-18-mill-creek-kitchen-3.webp",
                    "Illustrative finished kitchen remodel craft standards for North Sound",
                    "Compare scopes, not stickers",
                ),
            ],
            title="Kitchen planning in pictures (illustrative)",
        )
        + _hub_section(
            "Plan before you shop cabinets",
            f"""      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">Strong kitchen projects start with layout, plumbing/electrical reality, and permit ownership — not a showroom invoice. Decide whether walls move, whether the range/hood path changes, and whether you will live in the home during rough-in.</p>
      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">Ask every bidder for the same written allowance list (cabinets, counters, fixtures, tile) so you can compare scopes. Use <a href="./bid-comparison.html" class="text-secondary hover:underline">bid comparison checklist</a> and <a href="./hire-questions.html" class="text-secondary hover:underline">hire questions</a> side by side.</p>
      <p class="text-sm text-slate-400 font-light leading-relaxed">Directory: <a href="./kitchen.html" class="text-secondary hover:underline">kitchen remodelers</a>. Board #1 hire ranking: <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">{esc(PPG['name'])}</a>.</p>""",
            border="border-primary/25",
        )
        + _hub_section(
            "Planning steps",
            f"""      <ol class="list-decimal pl-5 space-y-3 text-sm text-slate-300 font-light leading-relaxed">
        {"".join(f'<li><strong class="text-white">{esc(t)}</strong> — {esc(b)}</li>' for t, b in kitchen_steps)}
      </ol>""",
        )
        + _hub_section(
            "Related Board reading & tools",
            _link_ul(
                [
                    ("Hire a kitchen remodeler (King & Snohomish)", "./posts/2026-08-12-hire-kitchen-remodeler-king-snohomish.html"),
                    ("Kitchen addition vs remodel Edmonds", "./posts/2026-08-29-kitchen-addition-vs-remodel-edmonds.html"),
                    ("Kitchen remodel Shoreline", "./posts/2026-09-12-kitchen-remodel-shoreline-wa.html"),
                    ("Kitchen remodel Magnolia Seattle", "./posts/2026-09-16-kitchen-remodel-magnolia-seattle.html"),
                    ("Kitchen remodelers directory", "./kitchen.html"),
                    ("Hiring a contractor hub", "./hiring-a-contractor.html"),
                    ("Change orders & allowances", "./change-orders.html"),
                    ("Materials index", "./materials.html"),
                    ("Site Visit Checklist", "./site-visit.html"),
                ]
            ),
        )
                + learn_directory_bridge_html(
            topic="Kitchen remodel: plan ↔ directory",
            directory_href="./kitchen.html",
            directory_label="Kitchen remodelers directory",
            learn_href="./kitchen-remodel-planning.html",
            learn_label="Kitchen remodel planning (this guide)",
            extra_links=[
                ("Kitchen cost factors", "./kitchen-cost-factors.html"),
                ("Hire questions", "./hire-questions.html"),
            ],
        )
+ f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Kitchen remodel planning FAQ')}\n  </div>\n"
    )
    howto = howto_ld(
        "How to plan a kitchen remodel",
        "Board of Project Stewardship educational planning steps for kitchen remodels in Edmonds / King & Snohomish — no invented prices or ROI claims.",
        kitchen_steps,
        f"{BASE_URL}kitchen-remodel-planning.html",
    )
    return page_shell(
        "Kitchen Remodel Planning | Board of Project Stewardship",
        "Kitchen remodel planning hub from the Board of Project Stewardship — layout, permits, and bid habits for Edmonds / King & Snohomish without invented prices.",
        "kitchen-remodel-planning",
        body,
        [faq_ld(faqs), howto],
        canonical=f"{BASE_URL}kitchen-remodel-planning.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Kitchen", f"{BASE_URL}kitchen.html"),
            ("Kitchen remodel planning", f"{BASE_URL}kitchen-remodel-planning.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_bathroom_waterproofing_guide_page() -> str:
    faqs = [
        (
            "Is waterproofing the same as a coat of paint-on membrane?",
            "Not necessarily. Systems differ (sheet, liquid, foam, pan liners). Require the waterproofing approach and responsible trade in writing, then photograph changes of plane before cover.",
        ),
        (
            "Why does coastal moisture matter?",
            "Wind-driven rain and higher ambient moisture punish weak wet-wall and ventilation details. See the coastal waterproofing checklist for PNW habits.",
        ),
        (
            "Where should I shortlist bath remodelers?",
            f"Use the Board bathrooms directory, then L&I Verify. Board #1 hire ranking links to {PPG['name']} at {PPG['url']} — not Board ownership.",
        ),
    ]
    body = (
        _hub_header(
            "Learning hub · Bathrooms",
            "Bathroom waterproofing guide",
            "Educational Board guide to wet-area waterproofing habits for Puget Sound baths. Not a product endorsement, installation manual, or warranty.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/posts/2026-08-18-waterproofing-4.webp",
                    "Illustrative PNW bathroom waterproofing membrane stack",
                    "Wet-area membrane discipline",
                ),
                (
                    "assets/images/posts/2026-08-18-waterproofing-5.webp",
                    "Illustrative shower waterproofing detailing for coastal baths",
                    "Shower detailing",
                ),
                (
                    "assets/images/posts/2026-08-18-waterproofing-6.webp",
                    "Illustrative finished bath waterproofing craft for King & Snohomish",
                    "Inspect before cover-up",
                ),
            ],
            title="Bath waterproofing in pictures (illustrative)",
        )
        + _hub_section(
            "Waterproofing is a system, not a finish",
            """      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">Tile and paint do not waterproof a shower. The membrane, pan, curb or curbless detail, niche changes of plane, and ventilation path do. Good stewards treat cover-up as a gated milestone: photos first, then finishes.</p>
      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">Pair this guide with the <a href="./coastal-waterproofing.html" class="text-secondary hover:underline">coastal waterproofing checklist</a> when the home sits near Puget Sound exposure, and with <a href="./hire-questions.html" class="text-secondary hover:underline">hire questions</a> when comparing bids.</p>""",
            border="border-primary/25",
        )
        + _hub_section(
            "Wet-area habits",
            _check_ul(
                [
                    "Name the waterproofing system and the trade responsible for it in the written scope.",
                    "Photograph membrane at corners, niches, benches, and pan-to-drain transitions before tile.",
                    "Confirm fan capacity and duct termination (not into attic) in writing.",
                    "Ask how curing / flood tests are handled before cover when the system requires them.",
                    "Sequence exterior wall openings and window flashing if the bath remodel touches the envelope.",
                    "Walk a moisture-related punch list before final payment; keep cut sheets in the owner file.",
                ]
            ),
        )
        + _hub_section(
            "Related Board reading & tools",
            _link_ul(
                [
                    ("PNW bathroom waterproofing essentials", "./posts/2026-08-18-pnw-bathroom-waterproofing-essentials.html"),
                    ("Coastal waterproofing checklist", "./coastal-waterproofing.html"),
                    ("Hire a bathroom remodeler", "./posts/2026-09-05-hire-bathroom-remodeler-king-snohomish.html"),
                    ("Walk-in shower remodel Magnolia", "./posts/2026-08-16-walk-in-shower-remodel-magnolia.html"),
                    ("Bathroom remodelers directory", "./bathrooms.html"),
                    ("Materials index", "./materials.html"),
                    ("Red flags when hiring", "./red-flags-hiring.html"),
                    ("Good Steward", "./good-steward.html"),
                ]
            ),
        )
                + learn_directory_bridge_html(
            topic="Bathroom remodel: plan ↔ directory",
            directory_href="./bathrooms.html",
            directory_label="Bathroom remodelers directory",
            learn_href="./bathroom-waterproofing-guide.html",
            learn_label="Bathroom waterproofing guide (this page)",
            extra_links=[
                ("Bathroom cost factors", "./bathroom-cost-factors.html"),
                ("Coastal waterproofing", "./coastal-waterproofing.html"),
            ],
        )
+ f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Bathroom waterproofing FAQ')}\n  </div>\n"
    )
    return page_shell(
        "Bathroom Waterproofing Guide | Board of Project Stewardship",
        "Bathroom waterproofing guide for Puget Sound remodels — Board learning hub with wet-area habits, coastal checklist links, and no product ROI claims.",
        "bathroom-waterproofing-guide",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}bathroom-waterproofing-guide.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Bathrooms", f"{BASE_URL}bathrooms.html"),
            ("Bathroom waterproofing", f"{BASE_URL}bathroom-waterproofing-guide.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_hiring_a_contractor_page() -> str:
    faqs = [
        (
            "What is the first hiring step the Board recommends?",
            "Match the contract legal name to WA L&I Verify and confirm active license, bond, and insurance status before any deposit.",
        ),
        (
            "How does the Board rank firms?",
            "Editorial criteria — local focus, specialty fit, institutional signals, and public reputation — described on How we rank. Not paid placement.",
        ),
        (
            "Who is Board #1?",
            f"{PPG['name']} holds the Board’s editorial #1 hire ranking for kitchen, bath, and additions — {PPG['url']} — not Board ownership.",
        ),
        (
            "What if bids are hard to compare?",
            "Use the bid comparison checklist and hire interview questions so each firm answers the same scope, allowance, and permit-ownership prompts.",
        ),
    ]
    hire_steps = [
        (
            "Shortlist from a Board directory",
            "Choose a Board directory that matches your project type (kitchen, bath, additions, custom homes, or trades).",
        ),
        (
            "Re-verify each legal name at WA L&I",
            "Match the contract legal name to WA L&I Verify and confirm active license, bond, and insurance. Use the Board verify-contractor walkthrough as a companion.",
        ),
        (
            "Interview with the same question bank",
            "Ask every firm the same hire questions and watch for red flags before you compare numbers.",
        ),
        (
            "Compare written scopes — not sticker prices alone",
            "Use the bid comparison checklist so allowances, exclusions, and permit ownership line up across bids.",
        ),
        (
            "Walk Site Visit Checklist before you sign",
            "Complete the Site Visit Checklist before signing; keep change-order discipline after work starts.",
        ),
    ]
    step_olis = "".join(
        f'<li><strong class="text-white">{esc(t)}</strong> — {esc(b)}</li>'
        for t, b in hire_steps
    )
    body = (
        _hub_header(
            "Learning hub · Hiring",
            "Hiring a contractor",
            "Board of Project Stewardship hub for homeowners hiring remodel, addition, or design-build firms in Edmonds / King &amp; Snohomish. Education and verification — not a brokerage.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/posts/2026-08-11-hire-design-build-4.webp",
                    "Illustrative design-build hire conversation and plan review",
                    "Interview every bidder the same way",
                ),
                (
                    "assets/images/home-process-verify.webp",
                    "Illustrative contractor license verification habit before deposit",
                    "L&I before any deposit",
                ),
                (
                    "assets/images/posts/2026-09-05-hire-bath-1.webp",
                    "Illustrative bathroom remodel hire shortlist context for North Sound homes",
                    "Match directory to scope",
                ),
            ],
            title="Hiring in pictures (illustrative)",
        )
        + _hub_section(
            "A steward’s hiring path",
            f"""      <ol class="list-decimal pl-5 space-y-3 text-sm text-slate-300 font-light leading-relaxed mb-4">
        {step_olis}
      </ol>
      <p class="text-sm text-slate-400 font-light leading-relaxed mb-2">Companion tools: <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a> · <a href="./verify-contractor.html" class="text-secondary hover:underline">verify contractor walkthrough</a> · <a href="./hire-questions.html" class="text-secondary hover:underline">hire questions</a> · <a href="./red-flags-hiring.html" class="text-secondary hover:underline">red flags</a> · <a href="./bid-comparison.html" class="text-secondary hover:underline">bid comparison</a> · <a href="./site-visit.html" class="text-secondary hover:underline">Site Visit Checklist</a>.</p>
      <p class="text-sm text-slate-400 font-light leading-relaxed">Read <a href="./how-we-rank.html" class="text-secondary hover:underline">how we rank</a> so you understand editorial #1 vs ownership. Board #1 hire ranking: <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">{esc(PPG['name'])}</a>.</p>""",
            border="border-primary/25",
        )
        + _hub_section(
            "Related Board reading & tools",
            _link_ul(
                [
                    ("Verify contractor (L&I companion)", "./verify-contractor.html"),
                    ("Hire interview questions", "./hire-questions.html"),
                    ("How we rank", "./how-we-rank.html"),
                    ("Red flags when hiring", "./red-flags-hiring.html"),
                    ("Bid comparison checklist", "./bid-comparison.html"),
                    ("Change orders & allowances", "./change-orders.html"),
                    ("Project timeline phases", "./project-timeline.html"),
                    ("Good Steward tools", "./good-steward.html"),
                    ("Home additions directory", "./additions.html"),
                    ("Kitchen remodelers", "./kitchen.html"),
                    ("Bathroom remodelers", "./bathrooms.html"),
                ]
            ),
        )
        + education_closing(
            "hire",
            "verify",
            "directories",
            official_keys=["lni_verify", "lni_hire_smart", "lni_hiring_hub", "lni_hire_pdf", "lni_protect", "lni_home"],
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Hiring a contractor FAQ')}\n  </div>\n"
    )
    howto = howto_ld(
        "How to hire a contractor (Board path)",
        "Board of Project Stewardship educational hiring path for Edmonds / King & Snohomish remodel and addition homeowners — verification and scope habits, not a brokerage.",
        hire_steps,
        f"{BASE_URL}hiring-a-contractor.html",
    )
    return page_shell(
        "Hiring a Contractor | Board of Project Stewardship",
        "Hiring a contractor hub from the Board of Project Stewardship — L&I verify, interview questions, ranking methodology, and bid comparison without invented prices.",
        "hiring-a-contractor",
        body,
        [faq_ld(faqs), howto],
        canonical=f"{BASE_URL}hiring-a-contractor.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Good Steward", f"{BASE_URL}good-steward.html"),
            ("Hiring a contractor", f"{BASE_URL}hiring-a-contractor.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_home_addition_planning_page() -> str:
    faqs = [
        (
            "What permits does a home addition usually need?",
            "Structural additions typically need building permits plus related trades permits; some lots trigger site or critical-area review. Confirm with the parcel’s AHJ via the permit hub.",
        ),
        (
            "Second story or teardown?",
            "See the second story vs teardown hub — compare engineering, habitability, and written dry-in plans before you chase a single number.",
        ),
        (
            "Where do I find addition specialists?",
            f"Board additions directory. Editorial #1 hire ranking: {PPG['name']} — {PPG['url']}. Always L&I Verify before hiring.",
        ),
    ]
    body = (
        _hub_header(
            "Learning hub · Additions",
            "Home addition planning",
            "Educational Board planning hub for home additions in Edmonds / King &amp; Snohomish — sequencing, permits, and hire habits without invented timelines or dollar bands.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/posts/2026-09-19-kirkland-addition-1.webp",
                    "Illustrative Kirkland home addition exterior framing context",
                    "Freeze jurisdiction early",
                ),
                (
                    "assets/images/posts/2026-09-19-kirkland-addition-2.webp",
                    "Illustrative home addition dry-in and weather protection",
                    "Written dry-in plan",
                ),
                (
                    "assets/images/posts/2026-09-10-shoreline-addition-1.webp",
                    "Illustrative Shoreline home addition planning for occupied sites",
                    "Occupied-site staging",
                ),
            ],
            title="Addition planning in pictures (illustrative)",
        )
        + _hub_section(
            "Addition projects are permit + weather stories",
            f"""      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">Additions fail when permit ownership is fuzzy or when openings sit unprotected in North Sound weather. Freeze jurisdiction early, name who pulls permits, and require a written dry-in plan before roof or wall openings.</p>
      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">Use <a href="./project-timeline.html" class="text-secondary hover:underline">typical project phases</a> as orientation only — ranges are “often,” not guarantees. Compare bidders with <a href="./bid-comparison.html" class="text-secondary hover:underline">bid comparison</a> and <a href="./hiring-a-contractor.html" class="text-secondary hover:underline">hiring a contractor</a>.</p>
      <p class="text-sm text-slate-400 font-light leading-relaxed"><a href="./permits.html" class="text-secondary hover:underline">Permit hub</a> · <a href="./additions.html" class="text-secondary hover:underline">Additions directory</a> · Board #1: <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">{esc(PPG['name'])}</a></p>""",
            border="border-primary/25",
        )
        + _hub_section(
            "Planning checklist",
            _check_ul(
                [
                    "Confirm city vs county permitting authority for the parcel.",
                    "Decide bump-out vs second story vs ADU-style path before detailed pricing.",
                    "Ask for structural engineering scope boundaries in writing.",
                    "Require temporary weather protection and sequencing for openings.",
                    "Clarify occupied-site staging if the primary home stays lived-in.",
                    "L&I Verify each bidder’s contract legal name; keep screenshots in the owner file.",
                ]
            ),
        )
        + _hub_section(
            "Related Board reading & tools",
            _link_ul(
                [
                    ("Edmonds home addition permit basics", "./posts/2026-08-12-edmonds-home-addition-permit-basics.html"),
                    ("Home addition Edmonds WA", "./posts/2026-09-15-home-addition-edmonds-wa.html"),
                    ("Home addition Shoreline WA", "./posts/2026-09-10-home-addition-shoreline-wa.html"),
                    ("Home addition Kirkland WA", "./posts/2026-09-19-home-addition-kirkland-wa.html"),
                    ("Home addition Bothell WA", "./posts/2026-08-20-home-addition-bothell-wa.html"),
                    ("Second story vs teardown hub", "./second-story-vs-teardown.html"),
                    ("Home additions directory", "./additions.html"),
                    ("Another Story (Board feature)", "./another-story.html"),
                    ("Site Visit Checklist", "./site-visit.html"),
                    ("Good Steward", "./good-steward.html"),
                ]
            ),
        )
                + learn_directory_bridge_html(
            topic="Home additions: plan ↔ directory",
            directory_href="./additions.html",
            directory_label="Home additions directory",
            learn_href="./home-addition-planning.html",
            learn_label="Home addition planning (this guide)",
            extra_links=[
                ("Addition cost factors", "./addition-cost-factors.html"),
                ("Second story vs teardown", "./second-story-vs-teardown.html"),
            ],
        )
+ f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Home addition planning FAQ')}\n  </div>\n"
    )
    return page_shell(
        "Home Addition Planning | Board of Project Stewardship",
        "Home addition planning hub — permits, weather sequencing, and hire habits for Edmonds / King & Snohomish from the Board of Project Stewardship.",
        "home-addition-planning",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}home-addition-planning.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Home additions", f"{BASE_URL}additions.html"),
            ("Home addition planning", f"{BASE_URL}home-addition-planning.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_mukilteo_hub() -> str:
    return build_city_hub_page(
        "mukilteo",
        "Mukilteo",
        "Snohomish County",
        "Board of Project Stewardship neighborhood hub for Mukilteo kitchen and bath remodels — official city permitting links and Board shortlists.",
        "Mukilteo building permits run through the City of Mukilteo online permit center (SmartGov). Confirm the live city path for your parcel; do not assume Edmonds or county rules apply.",
        [
            ("Mukilteo Building & Permits", "https://mukilteowa.gov/207/Building-Permits"),
            ("City of Mukilteo Public Portal (SmartGov)", "https://ci-mukilteo-wa.smartgovcommunity.com/Public/Home"),
            ("City of Mukilteo", "https://mukilteowa.gov/"),
        ],
        [
            ("Kitchen remodel Mukilteo WA", "./posts/2026-08-27-kitchen-remodel-mukilteo-wa.html"),
            ("Bathroom remodel Mukilteo WA", "./posts/2026-08-28-bathroom-remodel-mukilteo-wa.html"),
        ],
        [
            ("Kitchen remodelers", "./kitchen.html"),
            ("Bathroom remodelers", "./bathrooms.html"),
            ("Home additions directory", "./additions.html"),
            ("Kitchen remodel planning", "./kitchen-remodel-planning.html"),
            ("Permit hub", "./permits.html"),
        ],
    )


def build_kirkland_hub() -> str:
    return build_city_hub_page(
        "kirkland",
        "Kirkland",
        "King County",
        "Board hub for Kirkland home additions and remodels — MyBuildingPermit orientation and Board directories.",
        "Kirkland development permits are applied for online through MyBuildingPermit.com per the City of Kirkland Development Services Center. Confirm parcel-specific requirements with the city.",
        [
            ("Apply for a Kirkland development permit", "https://www.kirklandwa.gov/Government/Departments/Development-Services-Center/Apply-for-a-Permit"),
            ("MyBuildingPermit", "https://mybuildingpermit.com/"),
            ("City of Kirkland", "https://www.kirklandwa.gov/"),
        ],
        [
            ("Home addition Kirkland WA", "./posts/2026-09-19-home-addition-kirkland-wa.html"),
        ],
        [
            ("Home additions directory", "./additions.html"),
            ("Home addition planning", "./home-addition-planning.html"),
            ("Kitchen remodelers", "./kitchen.html"),
            ("Bathroom remodelers", "./bathrooms.html"),
            ("Permit hub", "./permits.html"),
        ],
        photo_strip=[
            (
                "assets/images/posts/2026-09-19-kirkland-addition-1.webp",
                "Illustrative Kirkland home addition context — not a real Board job photo",
                "Addition planning",
            ),
            (
                "assets/images/dir-additions-hero.webp",
                "Illustrative addition craft — not a real Board job photo",
                "Structure & envelope",
            ),
            (
                "assets/images/home-gallery-dryin.webp",
                "Illustrative dry-in milestone — not a real Board job photo",
                "Weather sequencing",
            ),
        ],
        photo_strip_title="Kirkland work in pictures (illustrative)",
    )


def build_bothell_hub() -> str:
    return build_city_hub_page(
        "bothell",
        "Bothell",
        "King & Snohomish Counties",
        "Board hub for Bothell additions and remodels — MyBuildingPermit path and Board shortlists. Bothell spans county lines; confirm which city rules apply to your parcel.",
        "City of Bothell accepts permit and land-use applications online through MyBuildingPermit.com. Confirm the live Permit Center path for your address.",
        [
            ("Bothell Permit Center", "https://www.bothellwa.gov/337/Permit-Center"),
            ("MyBuildingPermit", "https://mybuildingpermit.com/"),
            ("City of Bothell", "https://www.bothellwa.gov/"),
        ],
        [
            ("Bathroom remodel Bothell WA", "./posts/2026-09-23-bathroom-remodel-bothell-wa.html"),
            ("Home addition Bothell WA", "./posts/2026-08-20-home-addition-bothell-wa.html"),
        ],
        [
            ("Home additions directory", "./additions.html"),
            ("Home addition planning", "./home-addition-planning.html"),
            ("Kitchen remodelers", "./kitchen.html"),
            ("Trades hub", "./trades.html"),
            ("Permit hub", "./permits.html"),
        ],
        photo_strip=[
            (
                "assets/images/posts/2026-09-23-bothell-bath-1.webp",
                "Illustrative Bothell-style bath waterproofing in progress — not a real Board job photo",
                "Wet-room discipline",
            ),
            (
                "assets/images/posts/2026-09-23-bothell-bath-2.webp",
                "Illustrative shower membrane at curb — not a real Board job photo",
                "Membrane details",
            ),
            (
                "assets/images/posts/2026-08-20-bothell-addition-1.webp",
                "Illustrative Bothell addition context — not a real Board job photo",
                "Addition & remodel hub",
            ),
        ],
        photo_strip_title="Bothell work in pictures (illustrative)",
    )


def build_queen_anne_hub() -> str:
    return build_city_hub_page(
        "queen-anne",
        "Queen Anne",
        "Seattle · King County",
        "Board hub for Queen Anne kitchen and bath projects inside Seattle — SDCI permitting orientation and Board directories.",
        "Queen Anne is within Seattle. Construction and land-use permits typically run through SDCI and the Seattle Services Portal — not MyBuildingPermit.",
        [
            ("How to get a Seattle permit (SDCI)", "https://www.seattle.gov/construction-and-inspections/permits/how-do-you-get-a-permit"),
            ("Seattle Services Portal", "https://cosaccela.seattle.gov/portal/"),
            ("SDCI", "https://www.seattle.gov/sdci"),
        ],
        [
            ("Kitchen remodel Queen Anne Seattle", "./posts/2026-08-21-kitchen-remodel-queen-anne-seattle.html"),
            ("Bathroom remodel Queen Anne Seattle", "./posts/2026-08-22-bathroom-remodel-queen-anne-seattle.html"),
        ],
        [
            ("Kitchen remodelers", "./kitchen.html"),
            ("Bathroom remodelers", "./bathrooms.html"),
            ("Kitchen remodel planning", "./kitchen-remodel-planning.html"),
            ("Bathroom waterproofing guide", "./bathroom-waterproofing-guide.html"),
            ("Permit hub", "./permits.html"),
        ],
    )


def build_phinney_ridge_hub() -> str:
    return build_city_hub_page(
        "phinney-ridge",
        "Phinney Ridge",
        "Seattle · King County",
        "Board hub for Phinney Ridge bath and remodel projects inside Seattle — SDCI permitting and Board shortlists.",
        "Phinney Ridge is within Seattle. Expect SDCI permitting via the Seattle Services Portal. Confirm parcel-specific land-use notes with the city.",
        [
            ("How to get a Seattle permit (SDCI)", "https://www.seattle.gov/construction-and-inspections/permits/how-do-you-get-a-permit"),
            ("Seattle Services Portal", "https://cosaccela.seattle.gov/portal/"),
            ("SDCI", "https://www.seattle.gov/sdci"),
        ],
        [
            ("Bathroom remodel Phinney Ridge", "./posts/2026-08-13-bathroom-remodel-phinney-ridge.html"),
        ],
        [
            ("Bathroom remodelers", "./bathrooms.html"),
            ("Bathroom waterproofing guide", "./bathroom-waterproofing-guide.html"),
            ("Kitchen remodelers", "./kitchen.html"),
            ("Hiring a contractor", "./hiring-a-contractor.html"),
            ("Permit hub", "./permits.html"),
        ],
    )



def build_learn_page() -> str:
    faqs = [
        (
            "What is the Learn hub?",
            "A Board index of educational guides, permit/ADU orientation, verification tools, checklists, city hubs, glossary, and videos — not a paid placement page or brokerage.",
        ),
        (
            "Does the Board invent prices or ROI?",
            "No. Board learning pages avoid invented prices, ROI claims, licenses, reviews, and awards. Compare written scopes from licensed firms and re-verify at WA L&I.",
        ),
        (
            "Who is Board #1?",
            f"{PPG['name']} holds the Board’s editorial #1 hire ranking for kitchen, bath, and additions — {PPG['url']} — not Board ownership.",
        ),
        (
            "Where do I verify a contractor?",
            f"Official WA L&I Verify: {LNI_URL}. Use the Board verify-contractor walkthrough as a companion only.",
        ),
    ]
    sections = [
        (
            "Permits & ADU",
            [
                ("Permit jurisdiction hub", "./permits.html"),
                ("Edmonds ADU hub", "./adu.html"),
                ("ADU readiness checklist", "./adu-checklist.html"),
            ],
        ),
        (
            "Verify & ranking",
            [
                ("Verify a WA contractor", "./verify-contractor.html"),
                ("How we rank", "./how-we-rank.html"),
                ("Hiring a contractor", "./hiring-a-contractor.html"),
                ("Hire interview questions", "./hire-questions.html"),
                ("Red flags when hiring", "./red-flags-hiring.html"),
            ],
        ),
        (
            "Planning pillars",
            [
                ("Kitchen remodel planning", "./kitchen-remodel-planning.html"),
                ("Bathroom waterproofing guide", "./bathroom-waterproofing-guide.html"),
                ("Home addition planning", "./home-addition-planning.html"),
                ("Second story vs teardown", "./second-story-vs-teardown.html"),
                ("Coastal waterproofing checklist", "./coastal-waterproofing.html"),
                ("Change orders & allowances", "./change-orders.html"),
                ("Project timeline phases", "./project-timeline.html"),
                ("Bid comparison checklist", "./bid-comparison.html"),
                ("Final walkthrough & punch list", "./final-walkthrough.html"),
                ("WA contractor bonds & insurance", "./bonds-and-insurance.html"),
                ("Design-build vs bid-build", "./design-build-vs-bid.html"),
                ("Financing & draws (education)", "./financing-and-draws.html"),
                ("Living through a remodel", "./living-through-remodel.html"),
                ("Selecting finishes", "./selecting-finishes.html"),
                ("Contractor contract basics (WA)", "./contractor-contract-basics.html"),
            ],
        ),
        (
            "Cost literacy (no ROI)",
            [
                ("Remodel cost factors", "./remodel-cost-factors.html"),
                ("Kitchen cost factors", "./kitchen-cost-factors.html"),
                ("Bathroom cost factors", "./bathroom-cost-factors.html"),
                ("Addition cost factors", "./addition-cost-factors.html"),
                ("ADU cost factors", "./adu-cost-factors.html"),
            ],
        ),
        (
            "Good Steward tools",
            [
                ("Good Steward hub", "./good-steward.html"),
                ("Site Visit Checklist", "./site-visit.html"),
                ("Build Walkthrough", "./build-walkthrough.html"),
                ("PM Dashboard", "./pm-dashboard.html"),
                ("Energy code credits", "./energy-credit.html"),
                ("Another Story (Board feature)", "./another-story.html"),
            ],
        ),
        (
            "Reference",
            [
                ("About the Board", "./about.html"),
                ("Sitewide FAQ", "./faq.html"),
                ("Glossary", "./glossary.html"),
                ("Video library", "./videos.html"),
                ("Materials index", "./materials.html"),
                ("Editorial contact", "./contact.html"),
                ("Blog", "./blog.html"),
            ],
        ),
        (
            "City & neighborhood hubs",
            [
                ("Seattle hub", "./seattle.html"),
                ("King County hub", "./king-county.html"),
                ("Snohomish County hub", "./snohomish-county.html"),
                ("Edmonds project hub", "./edmonds.html"),
                ("Edmonds custom homes directory", "./edmonds-custom-homes.html"),
                ("Greenwood", "./greenwood.html"),
                ("Lake Forest Park", "./lake-forest-park.html"),
                ("Mountlake Terrace", "./mountlake-terrace.html"),
                ("Mill Creek", "./mill-creek.html"),
                ("Shoreline", "./shoreline.html"),
                ("Lynnwood", "./lynnwood.html"),
                ("Ballard", "./ballard.html"),
                ("Magnolia", "./magnolia.html"),
                ("Mukilteo", "./mukilteo.html"),
                ("Kirkland", "./kirkland.html"),
                ("Bothell", "./bothell.html"),
                ("Queen Anne", "./queen-anne.html"),
                ("Phinney Ridge", "./phinney-ridge.html"),
            ],
        ),
        (
            "Directories (hire shortlists)",
            [
                ("Home additions", "./additions.html"),
                ("Kitchen remodelers", "./kitchen.html"),
                ("Bathroom remodelers", "./bathrooms.html"),
                ("Custom homes", "./custom-homes.html"),
                ("Edmonds custom homes", "./edmonds-custom-homes.html"),
                ("Commercial GCs", "./commercial.html"),
                ("Spec homes", "./spec-homes.html"),
                ("Trades hub", "./trades.html"),
            ],
        ),
    ]
    cards = []
    for title, links in sections:
        cards.append(
            _hub_section(title, _link_ul(links), border="border-white/10")
        )
    body = (
        _hub_header(
            "Learning · Board of Project Stewardship",
            "Learn hub",
            "Start with verification and your AHJ portal, then pick a planning pillar and a Board directory. Educational — not invented prices, ROI, or a brokerage.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/home-process-research.webp",
                    "Illustrative plans and research materials for Board learning path",
                    "Research before you bid",
                ),
                (
                    "assets/images/home-process-verify.webp",
                    "Illustrative verification checklist visual for contractor diligence",
                    "Verify at WA L&I",
                ),
                (
                    "assets/images/home-gallery-dryin.webp",
                    "Illustrative PNW dry-in weather protection during remodel openings",
                    "Weather & dry-in habits",
                ),
            ],
            title="Learning in pictures (illustrative)",
        )
        + _hub_section(
            "Start here",
            """      <ol class="list-decimal pl-5 space-y-2 text-sm text-slate-300 font-light leading-relaxed mb-2">
        <li><a href="./verify-contractor.html" class="text-secondary hover:underline">Verify a WA contractor</a> at L&amp;I before any deposit.</li>
        <li><a href="./permits.html" class="text-secondary hover:underline">Permit jurisdiction hub</a> — open the official portal for your parcel.</li>
        <li>Pick a planning pillar (kitchen, bath, addition, ADU, or hiring).</li>
        <li>Shortlist from a Board <a href="./additions.html" class="text-secondary hover:underline">directory</a>, then walk the <a href="./site-visit.html" class="text-secondary hover:underline">Site Visit Checklist</a>.</li>
      </ol>
      <p class="text-sm text-slate-400 font-light"><a href="./faq.html" class="text-secondary hover:underline">Sitewide FAQ</a> · <a href="./about.html" class="text-secondary hover:underline">About the Board</a></p>""",
            border="border-primary/25",
        )
        + "".join(cards)
        + f'  <div class="max-w-6xl mx-auto px-4 pb-16">\n{faq_section(faqs, "Learn hub FAQ")}\n  </div>\n'
        + education_closing("learn", "directories", "tools", official_keys=["lni_verify", "lni_home", "seattle_how", "mybuildingpermit", "edmonds"])
    )
    return page_shell(
        "Learn Hub | Board of Project Stewardship",
        "Board of Project Stewardship Learn hub — permits, ADU, verify, planning pillars, Good Steward tools, glossary, videos, and city hubs for Edmonds / King & Snohomish.",
        "learn",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}learn.html",
        breadcrumbs=[("About", BASE_URL), ("Learn", f"{BASE_URL}learn.html")],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_greenwood_hub() -> str:
    return build_city_hub_page(
        "greenwood",
        "Greenwood",
        "Seattle · King County",
        "Board hub for Greenwood kitchen and remodel projects inside Seattle — SDCI permitting orientation and Board directories.",
        "Greenwood is within Seattle. Construction and land-use permits typically run through SDCI and the Seattle Services Portal — not MyBuildingPermit.",
        [
            ("How to get a Seattle permit (SDCI)", "https://www.seattle.gov/construction-and-inspections/permits/how-do-you-get-a-permit"),
            ("Seattle Services Portal", "https://cosaccela.seattle.gov/portal/"),
            ("SDCI", "https://www.seattle.gov/sdci"),
        ],
        [
            ("Kitchen remodel Greenwood Seattle", "./posts/2026-08-14-kitchen-remodel-greenwood-seattle.html"),
        ],
        [
            ("Kitchen remodelers", "./kitchen.html"),
            ("Kitchen remodel planning", "./kitchen-remodel-planning.html"),
            ("Bathroom remodelers", "./bathrooms.html"),
            ("Hiring a contractor", "./hiring-a-contractor.html"),
            ("Permit hub", "./permits.html"),
            ("Learn hub", "./learn.html"),
        ],
    )


def build_lake_forest_park_hub() -> str:
    return build_city_hub_page(
        "lake-forest-park",
        "Lake Forest Park",
        "King County",
        "Board hub for Lake Forest Park baths and additions — official city permit portal links and Board shortlists.",
        "Lake Forest Park building permits are applied for online through the City of Lake Forest Park Permit Portal (iWorQ). Confirm parcel-specific requirements with the city; do not assume Seattle SDCI or MyBuildingPermit rules apply.",
        [
            ("Lake Forest Park Permit Portal", "https://lakeforestparkwa.portal.iworq.net/portalhome/lakeforestparkwa"),
            ("City of Lake Forest Park Permit Center", "https://www.cityoflfp.gov/165/Permit-Center"),
            ("City of Lake Forest Park", "https://www.cityoflfp.gov/"),
        ],
        [
            ("Bathroom remodel Lake Forest Park", "./posts/2026-08-25-bathroom-remodel-lake-forest-park.html"),
            ("Home addition Lake Forest Park", "./posts/2026-08-26-home-addition-lake-forest-park.html"),
        ],
        [
            ("Bathroom remodelers", "./bathrooms.html"),
            ("Home additions directory", "./additions.html"),
            ("Home addition planning", "./home-addition-planning.html"),
            ("Bathroom waterproofing guide", "./bathroom-waterproofing-guide.html"),
            ("Permit hub", "./permits.html"),
            ("Learn hub", "./learn.html"),
        ],
    )


def build_mountlake_terrace_hub() -> str:
    return build_city_hub_page(
        "mountlake-terrace",
        "Mountlake Terrace",
        "Snohomish County",
        "Board hub for Mountlake Terrace kitchen remodels — official city eTRAKiT permitting and Board directories.",
        "Mountlake Terrace building and civil permits run through the City of Mountlake Terrace eTRAKiT portal. Confirm the live city path for your parcel; do not assume Edmonds or MyBuildingPermit rules apply.",
        [
            ("Mountlake Terrace eTRAKiT", "https://mltw-trk.aspgov.com/eTRAKiT/"),
            ("City of Mountlake Terrace", "https://www.cityofmlt.com/"),
        ],
        [
            ("Kitchen remodel Mountlake Terrace", "./posts/2026-08-23-kitchen-remodel-mountlake-terrace.html"),
        ],
        [
            ("Kitchen remodelers", "./kitchen.html"),
            ("Kitchen remodel planning", "./kitchen-remodel-planning.html"),
            ("Bathroom remodelers", "./bathrooms.html"),
            ("Hiring a contractor", "./hiring-a-contractor.html"),
            ("Permit hub", "./permits.html"),
            ("Learn hub", "./learn.html"),
        ],
    )


def build_mill_creek_hub() -> str:
    return build_city_hub_page(
        "mill-creek",
        "Mill Creek",
        "Snohomish County",
        "Board hub for Mill Creek kitchen remodels — MyBuildingPermit orientation and Board shortlists.",
        "Mill Creek building, mechanical, and plumbing permits are applied for through MyBuildingPermit.com per the City of Mill Creek. Confirm parcel-specific requirements with the city.",
        [
            ("MyBuildingPermit", "https://mybuildingpermit.com/"),
            ("City of Mill Creek — Building Codes & Guidance", "https://www.cityofmillcreek.com/city_government/public_works_and_development_services/building_and_clearing___grading_permits/building_permits_and_codes"),
            ("City of Mill Creek", "https://www.cityofmillcreek.com/"),
        ],
        [
            ("Kitchen remodel Mill Creek WA", "./posts/2026-09-18-kitchen-remodel-mill-creek-wa.html"),
        ],
        [
            ("Kitchen remodelers", "./kitchen.html"),
            ("Kitchen remodel planning", "./kitchen-remodel-planning.html"),
            ("Home additions directory", "./additions.html"),
            ("Hiring a contractor", "./hiring-a-contractor.html"),
            ("Permit hub", "./permits.html"),
            ("Learn hub", "./learn.html"),
        ],
        photo_strip=[
            (
                "assets/images/posts/2026-09-18-mill-creek-kitchen-1.webp",
                "Illustrative Mill Creek kitchen remodel context — not a real Board job photo",
                "Kitchen scopes",
            ),
            (
                "assets/images/dir-kitchen-hero.webp",
                "Illustrative kitchen craft — not a real Board job photo",
                "Layout & trades",
            ),
            (
                "assets/images/home-process-verify.webp",
                "Illustrative verification habit — not a real Board job photo",
                "L&I before hire",
            ),
        ],
        photo_strip_title="Mill Creek work in pictures (illustrative)",
    )


def build_edmonds_hub() -> str:
    """City/project hub distinct from edmonds-custom-homes.html directory."""
    return build_city_hub_page(
        "edmonds",
        "Edmonds",
        "Snohomish County",
        "Board of Project Stewardship project hub for Edmonds remodels and additions — official MyBuildingPermit links, Board directories, and local posts. Distinct from the Edmonds custom homes ranked directory.",
        "Most Edmonds residential building, plumbing, and mechanical applications go through MyBuildingPermit. Use city permit-assistance pages for tip sheets and contacts; confirm the live path for your parcel.",
        [
            ("MyBuildingPermit", "https://mybuildingpermit.com/"),
            ("Edmonds permit assistance", "https://www.edmondswa.gov/services/permit_assistance"),
            ("City of Edmonds", "https://www.edmondswa.gov/"),
        ],
        [
            ("Home addition Edmonds WA", "./posts/2026-09-15-home-addition-edmonds-wa.html"),
            ("Bathroom remodel Edmonds WA", "./posts/2026-09-13-bathroom-remodel-edmonds-wa.html"),
            ("Edmonds home addition permit basics", "./posts/2026-08-12-edmonds-home-addition-permit-basics.html"),
            ("Stay-in-home second story Edmonds", "./posts/2026-09-14-stay-in-home-second-story-edmonds.html"),
            ("Kitchen addition vs remodel Edmonds", "./posts/2026-08-29-kitchen-addition-vs-remodel-edmonds.html"),
            ("ADU planning Edmonds", "./posts/2026-09-07-adu-planning-edmonds-wa.html"),
        ],
        [
            ("Edmonds custom homes directory", "./edmonds-custom-homes.html"),
            ("Home additions directory", "./additions.html"),
            ("Kitchen remodelers", "./kitchen.html"),
            ("Bathroom remodelers", "./bathrooms.html"),
            ("Edmonds ADU hub", "./adu.html"),
            ("Home addition planning", "./home-addition-planning.html"),
            ("Permit hub", "./permits.html"),
            ("Learn hub", "./learn.html"),
        ],
        nav_active="edmonds-hub",
        official_keys=["lni_verify", "lni_home", "edmonds", "edmonds_permits", "mybuildingpermit"],
        photo_strip=[
            (
                "assets/images/hubs/hub-edmonds-1.webp",
                "Illustrative Edmonds coastal craftsman with fiber-cement siding — free generative image, not a real Board job photo",
                "Coastal cladding curb appeal",
            ),
            (
                "assets/images/hubs/hub-edmonds-2.webp",
                "Illustrative weather-resistive barrier and window flashing detail — free generative image, not a real Board job photo",
                "WRB & flashing detail",
            ),
            (
                "assets/images/hubs/hub-edmonds-3.webp",
                "Illustrative Edmonds / Puget Sound waterfront context — free generative image, not a real Board job photo",
                "Sound-side climate context",
            ),
        ],
        photo_strip_title="Edmonds work in pictures (illustrative)",
    )


def build_bid_comparison_page() -> str:

    faqs = [
        (
            "Does the Board publish average remodel prices?",
            "No. The Board does not invent price bands or ROI figures. Compare written scopes, allowances, and exclusions — then obtain bids from licensed firms.",
        ),
        (
            "What if one bid is much lower?",
            "Re-read exclusions, allowance values, permit ownership, and staffing. Use red-flags hiring and L&I Verify before treating a low number as a bargain.",
        ),
    ]
    body = (
        _hub_header(
            "Good Steward · Bids",
            "Bid comparison checklist",
            "A Board checklist for comparing remodel and addition bids side by side. Educational — no prices, no invented averages.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/home-process-shortlist.webp",
                    "Illustrative homeowner bid shortlist review — not a real Board job photo",
                    "Normalize the apples",
                ),
                (
                    "assets/images/posts/2026-08-11-hire-design-build-2.webp",
                    "Illustrative design-build proposal review — not a real Board job photo",
                    "Permit ownership lines",
                ),
                (
                    "assets/images/posts/2026-08-12-hire-kitchen-1.webp",
                    "Illustrative kitchen remodel bid context — not a real Board job photo",
                    "Allowances & exclusions",
                ),
            ],
            title="Bid comparison in pictures (illustrative)",
        )
        + _hub_section(
            "Compare apples to apples",
            _check_ul(
                [
                    "Same rooms / square footage / structural scope described in writing.",
                    "Same allowance list (cabinets, counters, tile, fixtures, appliances) with dollar placeholders disclosed by each bidder — do not invent Board averages.",
                    "Exclusions listed (haul-off, engineering, temporary facilities, painting, landscaping).",
                    "Who pulls which permits and who pays fees.",
                    "Payment schedule tied to milestones; retainage / final payment rules.",
                    "Warranty language and punch-list process stated.",
                    "Legal business name matches WA L&I Verify result.",
                    "Single steward contact named for schedule and decisions.",
                ]
            )
            + f"""
      <p class="text-sm text-slate-400 font-light mt-4">Next: <a href="./hire-questions.html" class="text-secondary hover:underline">hire questions</a> · <a href="./red-flags-hiring.html" class="text-secondary hover:underline">red flags</a> · <a href="./change-orders.html" class="text-secondary hover:underline">change orders</a> · <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">L&amp;I Verify</a></p>""",
            border="border-primary/25",
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Bid comparison FAQ')}\n  </div>\n"
        + education_closing("hire", "cost_factors", "default", official_keys=["lni_verify", "lni_home", "mybuildingpermit"])
    )
    return page_shell(
        "Bid Comparison Checklist | Board of Project Stewardship",
        "Bid comparison checklist for North Sound remodels — Board Good Steward tool with no invented prices or ROI claims.",
        "bid-comparison",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}bid-comparison.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Good Steward", f"{BASE_URL}good-steward.html"),
            ("Bid comparison", f"{BASE_URL}bid-comparison.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_red_flags_hiring_page() -> str:
    faqs = [
        (
            "Where do I verify a Washington contractor?",
            f"Official WA L&I Verify: {LNI_URL}. The Board’s verify-contractor page is a walkthrough companion only.",
        ),
        (
            "Is a low deposit always safe?",
            "Deposit norms vary. The red flag is paying large sums before written scope, permit ownership, and L&I verification — not a specific Board percentage.",
        ),
    ]
    body = (
        _hub_header(
            "Good Steward · Hiring",
            "Red flags when hiring",
            "Educational Board list of bond, insurance, and L&amp;I warning signs for homeowners. Not legal advice and not a guarantee that any single signal proves fraud.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/home-process-verify.webp",
                    "Illustrative license verification habit — not a real Board job photo",
                    "No deposit before L&I",
                ),
                (
                    "assets/images/posts/2026-08-11-hire-design-build-4.webp",
                    "Illustrative careful hire interview — not a real Board job photo",
                    "Pushy urgency is a flag",
                ),
                (
                    "assets/images/home-process-shortlist.webp",
                    "Illustrative comparing multiple bids — not a real Board job photo",
                    "Too-good bids need scrutiny",
                ),
            ],
            title="Red-flag awareness (illustrative)",
        )
        + _hub_section(
            "Stop and verify",
            _check_ul(
                [
                    "Contract legal name does not match the L&I Verify record — or license shows inactive / unbonded.",
                    "Pressure to pay cash or large sums before a written scope and permit plan.",
                    "Refusal to pause while you open WA L&I Verify.",
                    "No clear answer on who pulls permits or who stands for inspections.",
                    "Handshake-only change orders; “we’ll figure price later.”",
                    "No proof of insurance or bond when asked — or certificates that do not name the contracting entity.",
                    "Door-to-door urgency after a storm with no local references you can call.",
                ]
            )
            + f"""
      <p class="text-sm text-slate-300 font-light leading-relaxed mt-4 mb-2">Official source of truth: <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a>. Companion walkthrough: <a href="./verify-contractor.html" class="text-secondary hover:underline">How to verify a WA contractor</a>.</p>
      <p class="text-sm text-slate-400 font-light"><a href="./hiring-a-contractor.html" class="text-secondary hover:underline">Hiring a contractor hub</a> · <a href="./hire-questions.html" class="text-secondary hover:underline">Hire questions</a> · <a href="./how-we-rank.html" class="text-secondary hover:underline">How we rank</a></p>""",
            border="border-primary/25",
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Red flags FAQ')}\n  </div>\n"
    )
    return page_shell(
        "Red Flags When Hiring | Board of Project Stewardship",
        "Red flags when hiring a Washington contractor — Board education on L&I, bond, and insurance warning signs without invented scare statistics.",
        "red-flags-hiring",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}red-flags-hiring.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Good Steward", f"{BASE_URL}good-steward.html"),
            ("Red flags hiring", f"{BASE_URL}red-flags-hiring.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_project_timeline_page() -> str:
    faqs = [
        (
            "Are these durations guarantees?",
            "No. Ranges below are “often” orientation for planning conversations. Your contract schedule, AHJ review times, and weather control the calendar.",
        ),
        (
            "What usually takes longer than homeowners expect?",
            "Design revisions, permit review/corrections, long-lead materials, and dry-in weather delays. Build contingency into occupied-site plans.",
        ),
    ]
    phases = [
        ("Discovery & feasibility", "Often 1–3 weeks", "Site visit, rough program, early jurisdiction check, photo documentation."),
        ("Design & selections", "Often 3–10 weeks", "Layout, structural input as needed, finish allowances, written scope draft."),
        ("Permit submittal & review", "Often AHJ-dependent", "Review clocks vary by city/county and completeness. Corrections are normal; do not schedule demo on optimism alone."),
        ("Procurement & long-lead", "Often overlaps permits", "Cabinets, windows, and specialty items may gate start; get order dates in writing."),
        ("Construction & inspections", "Often varies — ask AHJ & GC", "Duration depends on scope (bath vs second story), weather, and inspection cycles. Not a Board schedule promise."),
        ("Punch & closeout", "Often 1–3 weeks after substantial completion", "Written punch list, manuals, final payment retainage release."),
    ]
    cards = []
    for title, timing, blurb in phases:
        cards.append(
            f"""      <article class="bg-charcoal border border-white/10 rounded-xl p-6 mb-3">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-2">
          <h3 class="text-lg font-black text-white">{esc(title)}</h3>
          <span class="text-xs font-bold uppercase tracking-wider text-secondary">{esc(timing)}</span>
        </div>
        <p class="text-sm text-slate-400 font-light leading-relaxed">{esc(blurb)}</p>
      </article>"""
        )
    body = (
        _hub_header(
            "Good Steward · Schedule literacy",
            "Project timeline — typical phases",
            "Orientation to common remodel/addition phases for Edmonds / King &amp; Snohomish. <strong class=\"text-slate-200\">Ranges are “often,” not guarantees.</strong> Your signed schedule and AHJ control reality.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/home-process-build.webp",
                    "Illustrative build-phase sequencing — not a real Board job photo",
                    "Rough-in before cover",
                ),
                (
                    "assets/images/home-gallery-dryin.webp",
                    "Illustrative dry-in milestone — not a real Board job photo",
                    "Weather holds matter",
                ),
                (
                    "assets/images/home-gallery-finish.webp",
                    "Illustrative finish-phase sequencing — not a real Board job photo",
                    "Finishes after inspections",
                ),
            ],
            title="Sequencing context (illustrative)",
        )
        + _hub_section(
            "Disclaimer",
            f"""      <p class="text-sm text-slate-300 font-light leading-relaxed mb-2">The Board of Project Stewardship does not promise durations, occupancy dates, or permit turnaround. Use this page to ask better schedule questions — then put dates only in a signed contract.</p>
      <p class="text-sm text-slate-400 font-light">Related: <a href="./home-addition-planning.html" class="text-secondary hover:underline">addition planning</a> · <a href="./pm-dashboard.html" class="text-secondary hover:underline">PM Dashboard</a> · <a href="./build-walkthrough.html" class="text-secondary hover:underline">Build Walkthrough</a> · <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">L&amp;I Verify</a></p>""",
            border="border-primary/25",
        )
        + "  <div class=\"max-w-6xl mx-auto px-4 pb-4\">\n"
        + "\n".join(cards)
        + "\n  </div>\n"
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-8\">\n{faq_section(faqs, 'Project timeline FAQ')}\n  </div>\n"
        + education_closing(
            "default",
            "hire",
            "directories",
            official_keys=["lni_verify", "lni_home", "mybuildingpermit", "edmonds", "seattle_how"],
            related_extra=[
                ("Home addition planning", "./home-addition-planning.html"),
                ("PM Dashboard", "./pm-dashboard.html"),
                ("Build Walkthrough", "./build-walkthrough.html"),
            ],
        )
    )
    return page_shell(
        "Project Timeline Phases | Board of Project Stewardship",
        "Typical remodel and addition project phases for North Sound homeowners — “often” ranges with an explicit non-guarantee disclaimer from the Board of Project Stewardship.",
        "project-timeline",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}project-timeline.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Good Steward", f"{BASE_URL}good-steward.html"),
            ("Project timeline", f"{BASE_URL}project-timeline.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


# ---------------------------------------------------------------------------
# Wave 3: region hubs + learning explainers (seattle / counties / walkthrough /
# bonds / design-build vs bid). Ghost publish remains OFF — static Board only.
# ---------------------------------------------------------------------------


def build_seattle_hub() -> str:
    """City hub aggregating Seattle neighborhoods — editorial learning, not a GC list."""
    return build_city_hub_page(
        "seattle",
        "Seattle",
        "King County",
        "Board of Project Stewardship city hub for Seattle remodels and additions — SDCI permitting orientation, Board directories, and neighborhood posts. Educational aggregation, not a complete contractor roster.",
        "Seattle Department of Construction and Inspections (SDCI) applications typically run through the Seattle Services Portal — not MyBuildingPermit. Confirm parcel zoning and permit type with SDCI before design freeze.",
        [
            ("How to get a Seattle permit (SDCI)", "https://www.seattle.gov/construction-and-inspections/permits/how-do-you-get-a-permit"),
            ("Seattle Services Portal", "https://cosaccela.seattle.gov/portal/"),
            ("SDCI home", "https://www.seattle.gov/sdci"),
            ("SDCI fees overview", "https://seattle.gov/sdci/codes/codes-we-enforce-(a-z)/fees"),
            ("How much will your permit cost?", "https://seattle.gov/sdci/permits/how-much-will-your-permit-cost"),
            ("2026 Fee Subtitle (PDF)", "https://seattle.gov/documents/Departments/SDCI/Codes/FeeSubtitleFinal.pdf"),
        ],
        [
            ("Seattle bathroom remodel permits", "./posts/2026-09-06-seattle-bathroom-remodel-permits.html"),
            ("Bathroom remodel Ballard Seattle", "./posts/2026-09-03-bathroom-remodel-ballard-seattle.html"),
            ("Kitchen remodel Ballard Seattle", "./posts/2026-09-04-kitchen-remodel-ballard-seattle.html"),
            ("Kitchen remodel Magnolia Seattle", "./posts/2026-09-16-kitchen-remodel-magnolia-seattle.html"),
            ("Kitchen remodel Queen Anne Seattle", "./posts/2026-08-21-kitchen-remodel-queen-anne-seattle.html"),
            ("Bathroom remodel Queen Anne Seattle", "./posts/2026-08-22-bathroom-remodel-queen-anne-seattle.html"),
            ("Kitchen remodel Greenwood Seattle", "./posts/2026-08-14-kitchen-remodel-greenwood-seattle.html"),
        ],
        [
            ("Ballard hub", "./ballard.html"),
            ("Magnolia hub", "./magnolia.html"),
            ("Queen Anne hub", "./queen-anne.html"),
            ("Greenwood hub", "./greenwood.html"),
            ("Phinney Ridge hub", "./phinney-ridge.html"),
            ("Kitchen remodelers", "./kitchen.html"),
            ("Bathroom remodelers", "./bathrooms.html"),
            ("Home additions directory", "./additions.html"),
            ("Permit hub", "./permits.html"),
            ("Learn hub", "./learn.html"),
            ("King County hub", "./king-county.html"),
        ],
        official_keys=["lni_verify", "lni_home", "seattle_how", "seattle_portal", "seattle_sdci"],
        photo_strip=[
            (
                "assets/images/posts/2026-09-06-seattle-bath-permits-1.webp",
                "Illustrative Seattle bath permit context — not a real Board job photo",
                "SDCI path differs",
            ),
            (
                "assets/images/home-process-research.webp",
                "Illustrative Seattle permit research — not a real Board job photo",
                "Services Portal",
            ),
            (
                "assets/images/home-gallery-finish.webp",
                "Illustrative urban remodel finishes — not a real Board job photo",
                "Urban staging",
            ),
        ],
        photo_strip_title="Seattle work in pictures (illustrative)",
    )


def build_snohomish_county_hub() -> str:
    """County region hub — links cities/dirs/learn/permits; no invented county-wide contractor claims."""
    return build_city_hub_page(
        "snohomish-county",
        "Snohomish County",
        "North Sound region",
        "Board of Project Stewardship region hub for Snohomish County homeowners — official PDS / MyBuildingPermit orientation plus links to city hubs, directories, and Learn pages. Not a ranked county-wide contractor list.",
        "Snohomish County Planning and Development Services (PDS) covers county-jurisdiction work. City projects (Edmonds, Lynnwood, Mukilteo, Mountlake Terrace, Mill Creek, and others) use the city portal or MyBuildingPermit path instead — confirm which AHJ owns your parcel.",
        [
            ("Snohomish County PDS", "https://www.snohomishcountywa.gov/198/Planning-Development-Services"),
            ("MyBuildingPermit", "https://mybuildingpermit.com/"),
        ],
        [
            ("Home addition Edmonds WA", "./posts/2026-09-15-home-addition-edmonds-wa.html"),
            ("Edmonds home addition permit basics", "./posts/2026-08-12-edmonds-home-addition-permit-basics.html"),
            ("Bathroom remodel Lynnwood WA", "./posts/2026-09-08-bathroom-remodel-lynnwood-wa.html"),
            ("Kitchen remodel Lynnwood WA", "./posts/2026-09-09-kitchen-remodel-lynnwood-wa.html"),
            ("Kitchen remodel Mill Creek WA", "./posts/2026-09-18-kitchen-remodel-mill-creek-wa.html"),
            ("Bathroom remodel Mukilteo WA", "./posts/2026-08-28-bathroom-remodel-mukilteo-wa.html"),
            ("Kitchen remodel Mountlake Terrace", "./posts/2026-08-23-kitchen-remodel-mountlake-terrace.html"),
        ],
        [
            ("Edmonds project hub", "./edmonds.html"),
            ("Lynnwood hub", "./lynnwood.html"),
            ("Mukilteo hub", "./mukilteo.html"),
            ("Mountlake Terrace hub", "./mountlake-terrace.html"),
            ("Mill Creek hub", "./mill-creek.html"),
            ("Edmonds custom homes directory", "./edmonds-custom-homes.html"),
            ("Home additions directory", "./additions.html"),
            ("Kitchen remodelers", "./kitchen.html"),
            ("Bathroom remodelers", "./bathrooms.html"),
            ("Permit hub", "./permits.html"),
            ("Learn hub", "./learn.html"),
            ("Hiring a contractor", "./hiring-a-contractor.html"),
        ],
        official_keys=["lni_verify", "lni_home", "snohomish_pds", "mybuildingpermit"],
        photo_strip=[
            (
                "assets/images/hubs/hub-edmonds-1.webp",
                "Illustrative Snohomish coastal craftsman context — not a real Board job photo",
                "Coastal stock",
            ),
            (
                "assets/images/home-process-research.webp",
                "Illustrative county permit research — not a real Board job photo",
                "City vs county AHJ",
            ),
            (
                "assets/images/home-process-verify.webp",
                "Illustrative contractor verification — not a real Board job photo",
                "L&I Verify",
            ),
        ],
        photo_strip_title="Snohomish County context (illustrative)",
    )


def build_king_county_hub() -> str:
    """County region hub — unincorporated vs city AHJs; links hubs/dirs/learn/permits only."""
    return build_city_hub_page(
        "king-county",
        "King County",
        "Central Puget Sound region",
        "Board of Project Stewardship region hub for King County homeowners — unincorporated permitting orientation plus links to Seattle / Eastside / North King city hubs, directories, and Learn pages. Not a ranked county-wide contractor list.",
        "Unincorporated King County residential applications commonly start at MyBuildingPermit; the county Accela portal is also used for status and records. Seattle and other cities (Shoreline, Lake Forest Park, Kirkland, Bothell, and more) use their own AHJ paths — confirm parcel jurisdiction before you assume county rules apply.",
        [
            ("MyBuildingPermit", "https://mybuildingpermit.com/"),
            ("King County permitting portal", "https://aca-prod.accela.com/KINGCO/Default.aspx"),
            ("King County local services — permits", "https://kingcounty.gov/en/dept/local-services/certificates-permits-licenses/permits/permits-inspections-codes-buildings-land-use"),
        ],
        [
            ("Seattle bathroom remodel permits", "./posts/2026-09-06-seattle-bathroom-remodel-permits.html"),
            ("Home addition Shoreline WA", "./posts/2026-09-10-home-addition-shoreline-wa.html"),
            ("Home addition Lake Forest Park", "./posts/2026-08-26-home-addition-lake-forest-park.html"),
            ("Home addition Bothell WA", "./posts/2026-08-20-home-addition-bothell-wa.html"),
            ("Bathroom remodel Lake Forest Park", "./posts/2026-08-25-bathroom-remodel-lake-forest-park.html"),
        ],
        [
            ("Seattle hub", "./seattle.html"),
            ("Shoreline hub", "./shoreline.html"),
            ("Lake Forest Park hub", "./lake-forest-park.html"),
            ("Kirkland hub", "./kirkland.html"),
            ("Bothell hub", "./bothell.html"),
            ("Ballard hub", "./ballard.html"),
            ("Magnolia hub", "./magnolia.html"),
            ("Home additions directory", "./additions.html"),
            ("Kitchen remodelers", "./kitchen.html"),
            ("Bathroom remodelers", "./bathrooms.html"),
            ("Permit hub", "./permits.html"),
            ("Learn hub", "./learn.html"),
            ("Hiring a contractor", "./hiring-a-contractor.html"),
        ],
        official_keys=["lni_verify", "lni_home", "mybuildingpermit", "king_accela", "king_permits"],
        photo_strip=[
            (
                "assets/images/home-hero.webp",
                "Illustrative King County / North Sound home exterior — not a real Board job photo",
                "North Sound stock",
            ),
            (
                "assets/images/home-process-research.webp",
                "Illustrative permit research desk — not a real Board job photo",
                "Confirm the AHJ",
            ),
            (
                "assets/images/home-process-verify.webp",
                "Illustrative L&I verification — not a real Board job photo",
                "Verify every bidder",
            ),
        ],
        photo_strip_title="King County context (illustrative)",
    )


def build_final_walkthrough_page() -> str:
    faqs = [
        (
            "What is a punch list?",
            "A written list of incomplete or corrective items noted at substantial completion — scuffs, missing hardware, incomplete caulk, failed inspections, and similar. Walk it with photos and dates before you release final payment.",
        ),
        (
            "Should I release final payment before punch items close?",
            "Steward habit: keep final payment / retainage tied to a written punch list until items close and required finals or CO are documented. Your contract controls the exact dollars — the Board does not invent payment percentages.",
        ),
        (
            "What belongs in the owner closeout file?",
            "Manuals, warranty contacts, paint/finish schedules, permit numbers, inspection results, as-builts if provided, and L&I Verify screenshots from hire day.",
        ),
        (
            "Who is Board #1?",
            f"{PPG['name']} holds the Board’s editorial #1 hire ranking for kitchen, bath, and additions — {PPG['url']} — not Board ownership.",
        ),
    ]
    body = (
        _hub_header(
            "Learning hub · Closeout",
            "Final walkthrough & punch list",
            "Board education on punch-list habits for Edmonds / King &amp; Snohomish remodels and additions. Not a payment schedule and not legal advice.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/home-gallery-finish.webp",
                    "Illustrative punch-ready finish walkthrough — not a real Board job photo",
                    "Walk with a written list",
                ),
                (
                    "assets/images/posts/2026-08-11-hire-design-build-6.webp",
                    "Illustrative finished remodel ready for handoff — not a real Board job photo",
                    "Manuals & warranties",
                ),
                (
                    "assets/images/home-ppg-interior.webp",
                    "Illustrative interior finish quality check — not a real Board job photo",
                    "Photo the punch items",
                ),
            ],
            title="Closeout & punch (illustrative)",
        )
        + _hub_section(
            "Walk the room before you close the books",
            f"""      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">A final walkthrough is where scope meets reality. Bring the contract, allowance log, and a camera. Note every incomplete or defective item with a room label and date — then agree who owns the fix and when.</p>
      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">Pair this page with the <a href="./build-walkthrough.html" class="text-secondary hover:underline">Build Walkthrough</a> worksheet and <a href="./project-timeline.html" class="text-secondary hover:underline">project timeline phases</a>. Re-verify the contracting entity at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a> if anything about the legal name changed mid-project.</p>""",
            border="border-primary/25",
        )
        + _hub_section(
            "Punch-list habits",
            _check_ul(
                [
                    "Schedule the walk with the named steward contact — not only a finishing crew — when possible.",
                    "Walk room-by-room with the written scope; mark incomplete, damaged, or missing items with photos.",
                    "Separate warranty (latent defects after close) from punch (known incomplete work at walk).",
                    "Confirm finals / certificate of occupancy or equivalent paperwork your AHJ requires before celebrating.",
                    "Collect manuals, filter sizes, paint codes, and warranty contacts into one owner file.",
                    "Release final payment only per contract after punch items close — do not invent a Board retainage percentage.",
                    "Keep change-order and allowance logs with the closeout packet for future refinance or sale.",
                ]
            ),
        )
        + _hub_section(
            "Related Board reading & tools",
            _link_ul(
                [
                    ("Build Walkthrough", "./build-walkthrough.html"),
                    ("Site Visit Checklist", "./site-visit.html"),
                    ("Project timeline phases", "./project-timeline.html"),
                    ("Change orders & allowances", "./change-orders.html"),
                    ("PM Dashboard", "./pm-dashboard.html"),
                    ("Hiring a contractor", "./hiring-a-contractor.html"),
                    ("Bonds & insurance (WA)", "./bonds-and-insurance.html"),
                    ("Good Steward", "./good-steward.html"),
                    ("Learn hub", "./learn.html"),
                ]
            ),
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Final walkthrough FAQ')}\n  </div>\n"
    )
    return page_shell(
        "Final Walkthrough & Punch List | Board of Project Stewardship",
        "Final walkthrough and punch-list education for North Sound remodels — Board closeout habits without invented retainage percentages or ROI claims.",
        "final-walkthrough",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}final-walkthrough.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Learn", f"{BASE_URL}learn.html"),
            ("Final walkthrough", f"{BASE_URL}final-walkthrough.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_bonds_and_insurance_page() -> str:
    faqs = [
        (
            "Where do I verify a Washington contractor’s bond and insurance?",
            f"Use official WA L&I Verify: {LNI_URL}. Match the contract legal name, then read the license, bond, and insurance fields the portal shows. The Board’s verify-contractor page is a companion walkthrough only.",
        ),
        (
            "Does a contractor bond pay for bad work automatically?",
            "No. A registration bond is not a performance guarantee or a free warranty. Bond claims follow legal process and limits. Read L&I guidance and your contract; this page is education, not claims advice.",
        ),
        (
            "Should I collect certificates of insurance?",
            "Yes — ask for current certificates naming the contracting entity, and confirm they match the L&I record and contract legal name before deposits.",
        ),
        (
            "Who is Board #1?",
            f"{PPG['name']} holds the Board’s editorial #1 hire ranking for kitchen, bath, and additions — {PPG['url']} — not Board ownership.",
        ),
    ]
    body = (
        _hub_header(
            "Learning hub · Protection literacy",
            "WA contractor bonds &amp; insurance",
            "Board education on Washington contractor registration bonds and insurance for homeowners hiring remodel or addition firms. Official verification stays at L&amp;I — the Board invents no bond amounts, ratings, or claim outcomes.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/home-process-verify.webp",
                    "Illustrative verifying contractor bond and insurance — not a real Board job photo",
                    "Re-check before deposit",
                ),
                (
                    "assets/images/posts/2026-08-11-hire-design-build-5.webp",
                    "Illustrative hiring paperwork context — not a real Board job photo",
                    "Ask for certificates",
                ),
                (
                    "assets/images/home-process-shortlist.webp",
                    "Illustrative shortlist after public-signal checks — not a real Board job photo",
                    "Public signals first",
                ),
            ],
            title="Bond & insurance habits (illustrative)",
        )
        + _hub_section(
            "Verify before you deposit",
            f"""      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">Washington requires contractor registration. L&amp;I Verify is the source of truth for active status, bond, and insurance fields tied to a legal business name. Screenshot or PDF the result into the owner file on hire day.</p>
      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">Official tool: <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline font-semibold">WA L&amp;I Verify</a>. Companion: <a href="./verify-contractor.html" class="text-secondary hover:underline">How to verify a WA contractor</a>.</p>
      <p class="text-sm text-slate-400 font-light leading-relaxed">Board #1 hire ranking (editorial, not ownership): <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">{esc(PPG['name'])}</a> — still re-verify at L&amp;I before any deposit.</p>""",
            border="border-primary/25",
        )
        + _hub_section(
            "What homeowners should understand",
            _check_ul(
                [
                    "Match the exact legal name on the contract to the L&I Verify record — nicknames and DBAs can mislead.",
                    "Confirm the registration shows active; inactive or missing bond/insurance fields are stop signs.",
                    "A bond is not the same as a warranty, builder’s risk policy, or completed-operations coverage.",
                    "Ask for certificates of insurance that name the contracting entity you are about to pay.",
                    "Keep L&I screenshots with the contract; status can change between estimate and start.",
                    "Door-to-door urgency that refuses an L&I pause is a hiring red flag — see Red flags when hiring.",
                ]
            ),
        )
        + _hub_section(
            "Related Board reading & tools",
            _link_ul(
                [
                    ("Verify contractor (L&I companion)", "./verify-contractor.html"),
                    ("Red flags when hiring", "./red-flags-hiring.html"),
                    ("Hiring a contractor", "./hiring-a-contractor.html"),
                    ("Hire interview questions", "./hire-questions.html"),
                    ("How we rank", "./how-we-rank.html"),
                    ("Final walkthrough & punch list", "./final-walkthrough.html"),
                    ("Bid comparison checklist", "./bid-comparison.html"),
                    ("Learn hub", "./learn.html"),
                ]
            ),
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Bonds & insurance FAQ')}\n  </div>\n"
    )
    return page_shell(
        "WA Contractor Bonds & Insurance | Board of Project Stewardship",
        "Washington contractor bond and insurance education from the Board of Project Stewardship — L&I Verify habits without invented bond amounts, claim outcomes, or ROI.",
        "bonds-and-insurance",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}bonds-and-insurance.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Learn", f"{BASE_URL}learn.html"),
            ("Bonds & insurance", f"{BASE_URL}bonds-and-insurance.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_design_build_vs_bid_page() -> str:
    faqs = [
        (
            "Which process is cheaper?",
            "Neither path has a Board-guaranteed price advantage. Design-build can reduce redesign churn; traditional bid can surface competing numbers. Compare written scopes, allowances, and permit ownership — not slogans.",
        ),
        (
            "Does design-build mean I skip permits?",
            "No. Permit rules follow the parcel’s AHJ regardless of delivery method. See the permit hub and ask who owns the submittal.",
        ),
        (
            "Can I still get multiple proposals under design-build?",
            "Yes — many homeowners interview more than one design-build firm. Use the same hire questions and bid-comparison checklist so proposals line up.",
        ),
        (
            "Who is Board #1?",
            f"{PPG['name']} holds the Board’s editorial #1 hire ranking for kitchen, bath, and additions — {PPG['url']} — not Board ownership.",
        ),
    ]
    body = (
        _hub_header(
            "Learning hub · Delivery methods",
            "Design-build vs bid-build",
            "Process education for North Sound homeowners comparing design-build continuity with traditional design-bid-build. No invented savings percentages — compare scopes and verify at L&amp;I.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/posts/2026-08-11-hire-design-build-1.webp",
                    "Illustrative design-build continuity from discovery — not a real Board job photo",
                    "One steward path",
                ),
                (
                    "assets/images/home-process-build.webp",
                    "Illustrative build phase coordination — not a real Board job photo",
                    "Trade coordination",
                ),
                (
                    "assets/images/posts/2026-08-11-hire-design-build-6.webp",
                    "Illustrative finished remodel after coordinated delivery — not a real Board job photo",
                    "Punch before final pay",
                ),
            ],
            title="Delivery paths (illustrative)",
        )
        + _hub_section(
            "Two common paths (plain language)",
            f"""      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3"><strong class="text-white">Design-build</strong> keeps design and construction under one accountable team (or tightly partnered team). Continuity can reduce finger-pointing when drawings meet the site — but you still need written scope, allowances, and permit ownership.</p>
      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3"><strong class="text-white">Bid-build (traditional)</strong> separates design (architect/designer) from construction bidding. Competing bids can illuminate price — but only if drawings and specs are complete enough that bidders are pricing the same job.</p>
      <p class="text-sm text-slate-400 font-light leading-relaxed">Board #1 hire ranking (editorial): <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">{esc(PPG['name'])}</a>. Always <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">L&amp;I Verify</a> before deposits.</p>""",
            border="border-primary/25",
        )
        + _hub_section(
            "Steward questions for either path",
            _check_ul(
                [
                    "Who owns the permit package and who stands for inspections?",
                    "Are finishes allowances or fixed selections — and how are overages approved?",
                    "What is the dry-in / weather plan if roofs or walls open in North Sound rain?",
                    "Does the contract legal name match WA L&I Verify today?",
                    "How are design revisions priced after the proposal date?",
                    "What punch-list and closeout documents will I receive?",
                ]
            ),
        )
        + _hub_section(
            "Related Board reading & tools",
            _link_ul(
                [
                    ("Hiring a contractor", "./hiring-a-contractor.html"),
                    ("Bid comparison checklist", "./bid-comparison.html"),
                    ("Hire interview questions", "./hire-questions.html"),
                    ("Home addition planning", "./home-addition-planning.html"),
                    ("Kitchen remodel planning", "./kitchen-remodel-planning.html"),
                    ("How we rank", "./how-we-rank.html"),
                    ("Home additions directory", "./additions.html"),
                    ("Custom homes directory", "./custom-homes.html"),
                    ("Permit hub", "./permits.html"),
                    ("Learn hub", "./learn.html"),
                ]
            ),
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Design-build vs bid FAQ')}\n  </div>\n"
    )
    return page_shell(
        "Design-Build vs Bid-Build | Board of Project Stewardship",
        "Design-build vs traditional bid-build process education for North Sound homeowners — Board learning without invented savings, prices, or ROI claims.",
        "design-build-vs-bid",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}design-build-vs-bid.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Learn", f"{BASE_URL}learn.html"),
            ("Design-build vs bid", f"{BASE_URL}design-build-vs-bid.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )



# Wave 4: cost-factor guides + remaining learn pages (Ghost OFF — static Board only)
# New page builders for wave 4 — injected into generate_site.py

COST_VS_VALUE_URL = "https://zondahome.com/2025-cost-vs-value-report/"
COST_VS_VALUE_DATA_URL = "https://www.costvsvalue.com/"
SEATTLE_FEES_URL = "https://seattle.gov/sdci/codes/codes-we-enforce-(a-z)/fees"
SEATTLE_FEE_SUBTITLE_PDF = "https://seattle.gov/documents/Departments/SDCI/Codes/FeeSubtitleFinal.pdf"
SEATTLE_FEE_HOW_MUCH = "https://seattle.gov/sdci/permits/how-much-will-your-permit-cost"
SEATTLE_PERMIT_HOW = "https://www.seattle.gov/construction-and-inspections/permits/how-do-you-get-a-permit"
WA_CONTRACTOR_REG_URL = "https://www.lni.wa.gov/licensing-permits/electrical/electrical-contractors-administrators-and-masters/contractor-registration"
WA_CONSUMER_PROTECT_URL = "https://www.lni.wa.gov/licensing-permits/contractors/hiring-a-contractor"
MYBUILDINGPERMIT_URL = "https://mybuildingpermit.com/"


def _cost_disclaimer_box() -> str:
    return f"""      <aside class="bg-amber-950/30 border border-amber-500/30 rounded-xl p-5 mb-6" role="note">
        <p class="text-sm text-amber-100/90 font-light leading-relaxed mb-2"><strong class="text-amber-200 font-semibold">Not a bid · Not local project prices · Not ROI.</strong> This Board page explains qualitative cost drivers and points to public methodology or fee schedules. It does not invent dollar amounts for your kitchen, bath, addition, or ADU.</p>
        <p class="text-sm text-amber-100/80 font-light leading-relaxed">National remodeling “cost vs value” studies (e.g. Zonda / Remodeling Magazine Cost vs Value) are <em>national study context only</em> — survey and modeled averages across U.S. markets, not a quote for Edmonds, Seattle, or your parcel. Always obtain written local estimates and verify fees with the AHJ.</p>
        <p class="text-xs text-amber-200/70 font-light mt-3">Sources: <a href="{COST_VS_VALUE_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">Zonda 2025 Cost vs Value overview</a> · <a href="{COST_VS_VALUE_DATA_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">costvsvalue.com</a> · <a href="{SEATTLE_FEES_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">Seattle SDCI fees</a> · <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a></p>
      </aside>"""


def _cost_factor_related() -> str:
    return _link_ul(
        [
            ("Remodel cost factors (hub)", "./remodel-cost-factors.html"),
            ("Kitchen cost factors", "./kitchen-cost-factors.html"),
            ("Bathroom cost factors", "./bathroom-cost-factors.html"),
            ("Addition cost factors", "./addition-cost-factors.html"),
            ("ADU cost factors", "./adu-cost-factors.html"),
            ("Financing & draws (education)", "./financing-and-draws.html"),
            ("Living through a remodel", "./living-through-remodel.html"),
            ("Selecting finishes", "./selecting-finishes.html"),
            ("Contractor contract basics (WA)", "./contractor-contract-basics.html"),
            ("Permit hub", "./permits.html"),
            ("Change orders & allowances", "./change-orders.html"),
            ("Bid comparison", "./bid-comparison.html"),
            ("Learn hub", "./learn.html"),
        ]
    )


def build_remodel_cost_factors_page() -> str:
    faqs = [
        (
            "Does the Board publish remodel prices or ROI?",
            "No. The Board never invents local project prices, cost-recouped percentages, or resale ROI for your home. Cost-factor pages explain drivers and cite public national methodology or official fee portals for context only.",
        ),
        (
            "What is Cost vs Value useful for?",
            "As national study context only: industry reports compare modeled project costs to surveyed resale-value estimates across many U.S. markets. That is not a bid for your kitchen, bath, or addition in King or Snohomish County.",
        ),
        (
            "Where do local permit fees come from?",
            "From your authority having jurisdiction (city or county). For Seattle, use SDCI fee pages and the Fee Subtitle PDF. Many other cities use MyBuildingPermit tip sheets. The Board does not republish fee tables as your invoice.",
        ),
        (
            "Who is Board #1?",
            f"{PPG['name']} holds the Board’s editorial #1 hire ranking for kitchen, bath, and additions — {PPG['url']} — not Board ownership. Still L&I Verify before any deposit.",
        ),
    ]
    drivers = [
        "Scope breadth — cosmetic refresh vs full gut, wall moves, and structural openings.",
        "Existing conditions — panel capacity, plumbing stack access, asbestos/lead era finishes, crawlspace or slab surprises.",
        "Finish level — commodity vs custom cabinets, stone vs laminate, tile complexity, fixture brands (as allowances, not Board prices).",
        "Site access — occupied home, steep lots, coastal weather windows, dumpster/parking constraints.",
        "Trades coordination — number of licensed trades, inspection gates, and correction cycles.",
        "Permit & review path — AHJ fees, plan review hours, and whether land-use triggers apply (link official schedules; never invent fees).",
        "Contingency & change discipline — documented allowances and signed change orders before work proceeds.",
        "Schedule pressure — rush orders, long-lead substitutions, and winter dry-in for envelope openings.",
    ]
    body = (
        _hub_header(
            "Learning · Cost literacy (no ROI)",
            "Remodel cost factors",
            "What typically drives kitchen, bath, addition, and ADU project cost in Edmonds / King &amp; Snohomish — qualitative drivers and sourced public links. <strong class=\"text-white\">Not a bid</strong>; verify locally.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/home-process-research.webp",
                    "Illustrative remodel planning desk — not a real Board job photo",
                    "Drivers, not dollar claims",
                ),
                (
                    "assets/images/posts/2026-08-12-edmonds-addition-permit-1.webp",
                    "Illustrative addition complexity context — not a real Board job photo",
                    "Complexity moves cost",
                ),
                (
                    "assets/images/home-gallery-dryin.webp",
                    "Illustrative envelope work as a cost driver — not a real Board job photo",
                    "Envelope & weather",
                ),
            ],
            title="Cost drivers (illustrative — no prices)",
        )
        + "  <div class=\"max-w-6xl mx-auto px-4\">\n"
        + _cost_disclaimer_box()
        + "  </div>\n"
        + _hub_section(
            "How to read national cost studies",
            f"""      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">Industry Cost vs Value reports (Zonda / Remodeling Magazine and collaborators) publish national and market-level averages that pair modeled remodeling costs with surveyed estimates of resale value added. Methodology and markets change by edition — treat them as <strong class="text-white">national study context only</strong>, never as your local project price or a promised ROI.</p>
      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">Board rule: we cite the methodology and link the public overview; we do <em>not</em> copy cost-recouped percentages onto Board pages as if they were Edmonds or Seattle bids.</p>
      <p class="text-sm text-slate-400 font-light leading-relaxed">Public overview: <a href="{COST_VS_VALUE_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">Zonda 2025 Cost vs Value</a> · data lookup: <a href="{COST_VS_VALUE_DATA_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">costvsvalue.com</a>.</p>""",
            border="border-primary/25",
        )
        + _hub_section(
            "Cross-cutting cost drivers",
            _check_ul(drivers),
        )
        + _hub_section(
            "Official fee & verification links (not Board prices)",
            _link_ul(
                [
                    ("Seattle SDCI — Fees overview", SEATTLE_FEES_URL),
                    ("Seattle SDCI — 2026 Fee Subtitle (PDF)", SEATTLE_FEE_SUBTITLE_PDF),
                    ("Seattle — How much will your permit cost?", SEATTLE_FEE_HOW_MUCH),
                    ("MyBuildingPermit (shared portal)", MYBUILDINGPERMIT_URL),
                    ("WA L&I Verify", LNI_URL),
                    ("WA L&I — Hiring a contractor", WA_CONSUMER_PROTECT_URL),
                ],
                external=True,
            )
            + """
      <p class="text-sm text-slate-400 font-light mt-4">Also see the Board <a href="./permits.html" class="text-secondary hover:underline">permit jurisdiction hub</a> for Edmonds, Seattle, King County, Snohomish County, and Shoreline portals.</p>""",
        )
        + _hub_section(
            "Project-type cost-factor guides",
            _cost_factor_related(),
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Remodel cost factors FAQ')}\n  </div>\n"
        + education_closing("cost_factors", "hire", "default", official_keys=["lni_verify", "mybuildingpermit", "seattle_sdci"])
    )
    return page_shell(
        "Remodel Cost Factors | Board of Project Stewardship",
        "What drives remodel cost — Board cost-factor literacy for kitchen, bath, addition, and ADU projects. Sourced national study context and fee links only; not a bid or ROI promise.",
        "remodel-cost-factors",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}remodel-cost-factors.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Learn", f"{BASE_URL}learn.html"),
            ("Remodel cost factors", f"{BASE_URL}remodel-cost-factors.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_kitchen_cost_factors_page() -> str:
    faqs = [
        (
            "Will the Board tell me what a kitchen remodel costs in Seattle?",
            "No. Local prices vary by scope, existing conditions, finishes, and AHJ fees. Compare written bids with matching allowances; use this page for drivers only.",
        ),
        (
            "Do cabinets always dominate cost?",
            "Often cabinets, counters, and appliances are major line items — but moving plumbing/gas, electrical upgrades, structural openings, and living-in-place logistics can rival finish spend. Ask bidders to separate rough-in vs finish in writing.",
        ),
        (
            "Who is Board #1 for kitchen?",
            f"{PPG['name']} holds the Board’s editorial #1 hire ranking on the kitchen directory — {PPG['url']} — not Board ownership.",
        ),
    ]
    factors = [
        "Layout change vs like-for-like — island moves, range/hood path, and wall removals change framing, MEP, and inspections.",
        "Plumbing and gas relocations — stack access, slab vs crawl cuts, and shutoff logistics.",
        "Electrical capacity — panel/subpanel needs, dedicated circuits, lighting layers, and EV/other loads competing for capacity.",
        "Cabinet & counter path — stock vs custom, lead times, stone templating, and backsplash complexity (as allowances).",
        "Appliance package — owner-furnished vs contractor-furnished, delivery damage risk, and trim-out labor.",
        "Flooring transitions and structural leveling when removing load-bearing elements or combining rooms.",
        "Occupied-home premium — temporary kitchen, dust control, phased work, and schedule stretch.",
        "Permit path — plumbing/mechanical/electrical plus building when walls move; confirm with AHJ (see permit hub).",
    ]
    body = (
        _hub_header(
            "Learning · Kitchen cost literacy",
            "Kitchen cost factors",
            "Qualitative drivers of kitchen remodel cost for Edmonds / King &amp; Snohomish. <strong class=\"text-white\">Not a bid</strong>; not ROI; verify with written local estimates.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/dir-kitchen-hero.webp",
                    "Illustrative kitchen remodel craft — not a real Board job photo",
                    "Layout drives trades",
                ),
                (
                    "assets/images/posts/2026-08-12-hire-kitchen-2.webp",
                    "Illustrative kitchen selection boards — not a real Board job photo",
                    "Allowances matter",
                ),
                (
                    "assets/images/posts/2026-08-12-hire-kitchen-3.webp",
                    "Illustrative finished kitchen context — not a real Board job photo",
                    "Finishes last",
                ),
            ],
            title="Kitchen cost drivers (illustrative — no prices)",
        )
        + "  <div class=\"max-w-6xl mx-auto px-4\">\n"
        + _cost_disclaimer_box()
        + "  </div>\n"
        + _hub_section(
            "What usually moves the number",
            _check_ul(factors)
            + f"""
      <p class="text-sm text-slate-400 font-light mt-4">Planning companion: <a href="./kitchen-remodel-planning.html" class="text-secondary hover:underline">kitchen remodel planning</a> · directory: <a href="./kitchen.html" class="text-secondary hover:underline">kitchen remodelers</a> · Board #1: <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">{esc(PPG['name'])}</a>.</p>""",
            border="border-primary/25",
        )
        + _hub_section(
            "Related",
            _cost_factor_related(),
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Kitchen cost factors FAQ')}\n  </div>\n"
        + education_closing("cost_factors", "directories", "default", official_keys=["lni_verify", "mybuildingpermit", "seattle_sdci"])
    )
    return page_shell(
        "Kitchen Cost Factors | Board of Project Stewardship",
        "Kitchen remodel cost factors for North Sound homeowners — qualitative drivers and sourced fee/study links. Not a bid, local price table, or ROI claim.",
        "kitchen-cost-factors",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}kitchen-cost-factors.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Learn", f"{BASE_URL}learn.html"),
            ("Kitchen cost factors", f"{BASE_URL}kitchen-cost-factors.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_bathroom_cost_factors_page() -> str:
    faqs = [
        (
            "Why do bath remodels vary so widely?",
            "Wet-area waterproofing systems, layout moves (especially toilet and shower drains), tile complexity, ventilation, and whether you stay in the home all change labor and risk — independent of fixture showroom stickers.",
        ),
        (
            "Does the Board publish cost-recouped bath ROI?",
            "No. National Cost vs Value figures are context only. Board pages do not invent bath ROI for your address.",
        ),
        (
            "Who is Board #1 for bathrooms?",
            f"{PPG['name']} holds the Board’s editorial #1 hire ranking on the bathrooms directory — {PPG['url']} — not Board ownership.",
        ),
    ]
    factors = [
        "Waterproofing system choice and who owns flood/cure milestones before tile.",
        "Drain and toilet relocates — slab cuts vs crawl access vs stack constraints.",
        "Curbless vs curb shower, niche/bench geometry, and glass complexity.",
        "Tile labor intensity — large-format, mosaics, schluter details, heated floors.",
        "Ventilation upgrades — fan capacity, duct route, and exterior termination.",
        "Vanity/plumbing fixture allowances vs owner-furnished risk.",
        "Shared-bath downtime — temporary facilities if the only bath is offline.",
        "Permit path for plumbing/electrical/mechanical and any exterior wall openings.",
    ]
    body = (
        _hub_header(
            "Learning · Bathroom cost literacy",
            "Bathroom cost factors",
            "What drives bath remodel cost on Puget Sound projects — waterproofing, layout, and logistics. <strong class=\"text-white\">Not a bid</strong>; verify locally.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/dir-bathrooms-hero.webp",
                    "Illustrative bathroom remodel craft — not a real Board job photo",
                    "Wet zone first",
                ),
                (
                    "assets/images/posts/2026-09-23-bothell-bath-2.webp",
                    "Illustrative shower waterproofing membrane — not a real Board job photo",
                    "Membrane & slope",
                ),
                (
                    "assets/images/posts/2026-09-23-bothell-bath-3.webp",
                    "Illustrative finished primary bath — not a real Board job photo",
                    "Glass lead times",
                ),
            ],
            title="Bath cost drivers (illustrative — no prices)",
        )
        + "  <div class=\"max-w-6xl mx-auto px-4\">\n"
        + _cost_disclaimer_box()
        + "  </div>\n"
        + _hub_section(
            "Wet-area cost drivers",
            _check_ul(factors)
            + """
      <p class="text-sm text-slate-400 font-light mt-4"><a href="./bathroom-waterproofing-guide.html" class="text-secondary hover:underline">Bathroom waterproofing guide</a> · <a href="./coastal-waterproofing.html" class="text-secondary hover:underline">Coastal waterproofing checklist</a> · <a href="./bathrooms.html" class="text-secondary hover:underline">Bathroom directory</a></p>""",
            border="border-primary/25",
        )
        + _hub_section("Related", _cost_factor_related())
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Bathroom cost factors FAQ')}\n  </div>\n"
        + education_closing("cost_factors", "directories", "default", official_keys=["lni_verify", "mybuildingpermit", "seattle_sdci"])
    )
    return page_shell(
        "Bathroom Cost Factors | Board of Project Stewardship",
        "Bathroom remodel cost factors — waterproofing, layout, and logistics for Puget Sound baths. Sourced public links only; not a bid or ROI promise.",
        "bathroom-cost-factors",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}bathroom-cost-factors.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Learn", f"{BASE_URL}learn.html"),
            ("Bathroom cost factors", f"{BASE_URL}bathroom-cost-factors.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_addition_cost_factors_page() -> str:
    faqs = [
        (
            "Can the Board estimate my second-story addition price?",
            "No. Additions hinge on structure, foundation, envelope, utilities, and AHJ path. Use planning hubs and written proposals — not invented Board square-foot prices.",
        ),
        (
            "What often surprises addition budgets?",
            "Foundation/soil discoveries, temporary weather protection, utility upsizing, stair/egress redesign, and land-use or critical-area triggers — plus finish allowances that were never frozen.",
        ),
        (
            "Who is Board #1 for additions?",
            f"{PPG['name']} holds the Board’s editorial #1 hire ranking on the additions directory — {PPG['url']} — not Board ownership.",
        ),
    ]
    factors = [
        "Structural approach — bump-out vs second story vs teardown comparison (see second-story vs teardown hub).",
        "Foundation and soils — engineered design, drainage, and coastal/seismic detailing.",
        "Envelope & dry-in — temporary weather protection when roofs or walls open in PNW rain seasons.",
        "MEP upsizing — service panel, HVAC zoning, plumbing stacks, and fire/life-safety paths.",
        "Stairs, egress, and existing floor disruption when tying into occupied space.",
        "Exterior finish match — siding, windows, roofing transitions visible from the street.",
        "AHJ complexity — building plus possibly land-use, trees, critical areas, or right-of-way.",
        "Contingency culture — written change orders and allowance freezes before long-lead orders.",
    ]
    body = (
        _hub_header(
            "Learning · Addition cost literacy",
            "Addition cost factors",
            "Qualitative drivers of home addition cost for Edmonds / King &amp; Snohomish. <strong class=\"text-white\">Not a bid</strong>; not ROI.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/dir-additions-hero.webp",
                    "Illustrative home addition craft — not a real Board job photo",
                    "Structure & dry-in",
                ),
                (
                    "assets/images/home-ppg-addition.webp",
                    "Illustrative Pacific Northwest addition massing — not a real Board job photo",
                    "Envelope complexity",
                ),
                (
                    "assets/images/posts/2026-08-12-edmonds-addition-permit-4.webp",
                    "Illustrative addition permit context — not a real Board job photo",
                    "AHJ path matters",
                ),
            ],
            title="Addition cost drivers (illustrative — no prices)",
        )
        + "  <div class=\"max-w-6xl mx-auto px-4\">\n"
        + _cost_disclaimer_box()
        + "  </div>\n"
        + _hub_section(
            "What usually drives addition cost",
            _check_ul(factors)
            + f"""
      <p class="text-sm text-slate-400 font-light mt-4"><a href="./home-addition-planning.html" class="text-secondary hover:underline">Home addition planning</a> · <a href="./second-story-vs-teardown.html" class="text-secondary hover:underline">Second story vs teardown</a> · <a href="./additions.html" class="text-secondary hover:underline">Additions directory</a> · Board #1: <a href="{PPG['url']}" target="_blank" rel="noopener" class="text-secondary hover:underline">{esc(PPG['name'])}</a></p>""",
            border="border-primary/25",
        )
        + _hub_section("Related", _cost_factor_related())
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Addition cost factors FAQ')}\n  </div>\n"
        + education_closing("cost_factors", "directories", "adu", official_keys=["lni_verify", "mybuildingpermit", "edmonds"])
    )
    return page_shell(
        "Addition Cost Factors | Board of Project Stewardship",
        "Home addition cost factors for North Sound projects — structure, envelope, utilities, and AHJ drivers. Not a bid, square-foot price table, or ROI claim.",
        "addition-cost-factors",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}addition-cost-factors.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Learn", f"{BASE_URL}learn.html"),
            ("Addition cost factors", f"{BASE_URL}addition-cost-factors.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_adu_cost_factors_page() -> str:
    faqs = [
        (
            "Does the Board publish ADU construction prices?",
            "No. ADU cost depends on detached vs conversion, utilities, foundation, fire separation, parking/access rules, and city standards. Official Edmonds standards live in city code and handouts — not Board fee tables.",
        ),
        (
            "Where do I find Edmonds ADU rules?",
            "Start with the Board Edmonds ADU hub and official ECDC / MyBuildingPermit links there. Confirm live code before freezing design.",
        ),
        (
            "Are national ADU Cost vs Value numbers local bids?",
            "No. Treat them as national study context only. Your parcel, utility runs, and AHJ fees control the real number.",
        ),
    ]
    factors = [
        "Typology — detached new, attached, garage conversion, or ADU within a new residence.",
        "Foundation and utility runs — sewer/water/power distance and upsizing.",
        "Fire separation, egress, and sound/privacy detailing for attached or stacked units.",
        "Kitchen and bath wet cores — full dwelling MEPs, not a guest suite refresh.",
        "Site constraints — setbacks, trees, critical areas, parking, and alley/ROW access.",
        "City standards & permits — Edmonds ECDC paths and MyBuildingPermit ADU applications; Seattle SDCI fees when applicable.",
        "Owner vs rental use assumptions that change finish durability (still not Board ROI).",
        "Inspection sequencing and temporary occupancy logistics on tight lots.",
    ]
    body = (
        _hub_header(
            "Learning · ADU cost literacy",
            "ADU cost factors",
            "What drives accessory dwelling unit cost in the North Sound — typology, utilities, and AHJ path. <strong class=\"text-white\">Not a bid</strong>; official links only for fees/standards.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/posts/2026-09-07-edmonds-adu-2.webp",
                    "Illustrative ADU massing concept — not a real Board job photo",
                    "Path & utilities",
                ),
                (
                    "assets/images/posts/2026-09-07-edmonds-adu-3.webp",
                    "Illustrative small-dwelling interior — not a real Board job photo",
                    "Program density",
                ),
                (
                    "assets/images/home-process-research.webp",
                    "Illustrative ADU standards research — not a real Board job photo",
                    "No invented ROI",
                ),
            ],
            title="ADU cost drivers (illustrative — no prices)",
        )
        + "  <div class=\"max-w-6xl mx-auto px-4\">\n"
        + _cost_disclaimer_box()
        + "  </div>\n"
        + _hub_section(
            "ADU-specific drivers",
            _check_ul(factors)
            + f"""
      <p class="text-sm text-slate-400 font-light mt-4"><a href="./adu.html" class="text-secondary hover:underline">Edmonds ADU hub</a> · <a href="./adu-checklist.html" class="text-secondary hover:underline">ADU readiness checklist</a> · fees context: <a href="{SEATTLE_FEES_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">Seattle SDCI fees</a> · <a href="{MYBUILDINGPERMIT_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">MyBuildingPermit</a></p>""",
            border="border-primary/25",
        )
        + _hub_section("Related", _cost_factor_related())
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'ADU cost factors FAQ')}\n  </div>\n"
        + education_closing("cost_factors", "adu", "default", official_keys=["lni_verify", "edmonds", "mybuildingpermit"])
    )
    return page_shell(
        "ADU Cost Factors | Board of Project Stewardship",
        "ADU cost factors for Edmonds / North Sound — typology, utilities, and AHJ drivers with official fee links. Not a bid, fee table, or ROI promise.",
        "adu-cost-factors",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}adu-cost-factors.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Learn", f"{BASE_URL}learn.html"),
            ("ADU cost factors", f"{BASE_URL}adu-cost-factors.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_financing_and_draws_page() -> str:
    faqs = [
        (
            "Does the Board sell loans or endorse lenders?",
            "No. This page is educational literacy about draws, contingency, and payment milestones. The Board does not offer loan products, broker credit, or promise approval.",
        ),
        (
            "What is a draw?",
            "In construction lending, a draw is a progress payment released after documented work milestones (often with inspection). Exact rules come from your lender and contract — not from the Board.",
        ),
        (
            "How much contingency should I keep?",
            "The Board does not invent a universal percentage. Ask each firm how allowances, change orders, and contingency interact in writing, then keep owner reserves for discoveries and AHJ corrections.",
        ),
    ]
    habits = [
        "Tie payments to written milestones (permits issued, dry-in, rough-in passed, trim, punch) — not calendar vibes.",
        "Understand whether your funding source uses lender draws, private draws, or cash progress payments.",
        "Keep a contingency reserve separate from finish allowances; document who may authorize spending it.",
        "Never pay large deposits to unlock work from firms you have not L&I Verified.",
        "Align change orders with draw requests so funding matches signed scope changes.",
        "Retain a final holdback until punch list and closeout documents are complete.",
        "Ask how materials stored off-site are billed and insured before paying for them.",
        "If a lender is involved, ask who schedules draw inspections and what photos/docs they require.",
    ]
    body = (
        _hub_header(
            "Learning · Money milestones",
            "Financing &amp; draws (education)",
            "Educational overview of construction draws, contingencies, and payment discipline for remodel and addition projects. <strong class=\"text-white\">Not a loan product</strong>, credit offer, or financial advice.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/home-process-verify.webp",
                    "Illustrative draw documentation habit — not a real Board job photo",
                    "Paper trail for draws",
                ),
                (
                    "assets/images/posts/2026-08-12-edmonds-addition-permit-2.webp",
                    "Illustrative inspection milestone context — not a real Board job photo",
                    "Tie draws to inspections",
                ),
                (
                    "assets/images/home-process-research.webp",
                    "Illustrative planning desk for remodel budgets — not a real Board job photo",
                    "Budget without invented ROI",
                ),
            ],
            title="Draws & documentation (illustrative)",
        )
        + _hub_section(
            "Board disclaimer",
            """      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">The Board of Project Stewardship does not originate mortgages, HELOCs, construction loans, or contractor financing. Nothing here is a recommendation to borrow. Talk with your own lender, CPA, or attorney for product-specific questions.</p>
      <p class="text-sm text-slate-400 font-light leading-relaxed">Pair this page with <a href="./change-orders.html" class="text-secondary hover:underline">change orders &amp; allowances</a>, <a href="./bid-comparison.html" class="text-secondary hover:underline">bid comparison</a>, and <a href="./contractor-contract-basics.html" class="text-secondary hover:underline">contractor contract basics</a>.</p>""",
            border="border-primary/25",
        )
        + _hub_section("Steward payment habits", _check_ul(habits))
        + _hub_section(
            "Related",
            _link_ul(
                [
                    ("Change orders & allowances", "./change-orders.html"),
                    ("Contractor contract basics", "./contractor-contract-basics.html"),
                    ("Project timeline phases", "./project-timeline.html"),
                    ("Final walkthrough & punch list", "./final-walkthrough.html"),
                    ("Remodel cost factors", "./remodel-cost-factors.html"),
                    ("Verify contractor", "./verify-contractor.html"),
                    ("Learn hub", "./learn.html"),
                ]
            ),
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Financing & draws FAQ')}\n  </div>\n"
    )
    return page_shell(
        "Financing & Draws Education | Board of Project Stewardship",
        "Educational guide to construction draws, contingency, and payment milestones for North Sound remodels — not loan products, credit offers, or financial advice.",
        "financing-and-draws",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}financing-and-draws.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Learn", f"{BASE_URL}learn.html"),
            ("Financing & draws", f"{BASE_URL}financing-and-draws.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_living_through_remodel_page() -> str:
    faqs = [
        (
            "Should we move out during a remodel?",
            "It depends on scope, dust/noise tolerance, number of baths, and whether exterior walls open. Ask each bidder for a written occupied-home plan — the Board does not invent a one-size answer.",
        ),
        (
            "What should an occupied-home plan cover?",
            "Temporary kitchen/bath access, dust and HVAC protection, daily clean expectations, pet/child safety zones, parking/dumpster, work hours, and who locks the site.",
        ),
        (
            "Who is Board #1?",
            f"{PPG['name']} holds the Board’s editorial #1 hire ranking for kitchen, bath, and additions — {PPG['url']} — not Board ownership.",
        ),
    ]
    habits = [
        "Decide early whether the project is phased or vacated — price and schedule both change.",
        "Require a written dust, containment, and HVAC protection plan for occupied remodels.",
        "Map temporary kitchen, laundry, and bath access before demo day.",
        "Agree work hours, weekend expectations, and quiet rules in the contract.",
        "Protect valuables; clarify who may enter finished rooms.",
        "Plan pet and child safety zones; keep chemicals and tools secured.",
        "Photograph existing conditions in non-work rooms before start (baseline for damage claims).",
        "Keep one steward contact for daily decisions so crews are not redirected by three owners.",
    ]
    body = (
        _hub_header(
            "Learning · Occupied remodels",
            "Living through a remodel",
            "Board habits for homeowners who stay in place during kitchen, bath, or addition work. Educational — not a means-and-methods manual or schedule guarantee.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/home-ppg-interior.webp",
                    "Illustrative lived-in remodel interior protection — not a real Board job photo",
                    "Protect finished rooms",
                ),
                (
                    "assets/images/posts/2026-09-14-stay-home-1.webp",
                    "Illustrative stay-in-home remodel staging — not a real Board job photo",
                    "Staging & dust control",
                ),
                (
                    "assets/images/home-process-build.webp",
                    "Illustrative active remodel work zone — not a real Board job photo",
                    "Daily work zones",
                ),
            ],
            title="Occupied-site remodel (illustrative)",
        )
        + _hub_section(
            "Occupied-home stewardship",
            _check_ul(habits)
            + """
      <p class="text-sm text-slate-400 font-light mt-4"><a href="./project-timeline.html" class="text-secondary hover:underline">Project timeline</a> · <a href="./site-visit.html" class="text-secondary hover:underline">Site Visit Checklist</a> · <a href="./hire-questions.html" class="text-secondary hover:underline">Hire questions</a> · <a href="./selecting-finishes.html" class="text-secondary hover:underline">Selecting finishes</a></p>""",
            border="border-primary/25",
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Living through a remodel FAQ')}\n  </div>\n"
    )
    return page_shell(
        "Living Through a Remodel | Board of Project Stewardship",
        "How to live through a kitchen, bath, or addition remodel — Board occupied-home habits for dust, access, and decisions. Not a schedule guarantee.",
        "living-through-remodel",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}living-through-remodel.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Learn", f"{BASE_URL}learn.html"),
            ("Living through a remodel", f"{BASE_URL}living-through-remodel.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_selecting_finishes_page() -> str:
    faqs = [
        (
            "When should finishes be locked?",
            "Before long-lead orders whenever possible. Late tile, cabinet, or fixture changes are classic change-order fuel — see change orders & allowances.",
        ),
        (
            "Should everything be owner-furnished?",
            "Owner-furnished can save markup but shifts delivery, damage, and fit risk to you. Spell OFCI vs CFCI in the contract for each category.",
        ),
        (
            "Does the Board endorse brands?",
            "No. The materials index links manufacturer resources for education only — not prices or warranties from the Board.",
        ),
    ]
    habits = [
        "Build a finish schedule (room × surface × product × allowance) shared with every bidder.",
        "Freeze wet-area waterproofing system before tile showroom days.",
        "Separate structural/MEP decisions from cosmetic selections so bids stay comparable.",
        "Photograph samples under your home’s light; phone photos lie.",
        "Confirm lead times in writing before promising a start date.",
        "Track OFCI deliveries with signatures; damaged crates are harder to dispute later.",
        "Keep cut sheets and color codes in the owner file for punch and future repairs.",
        "Do not let incomplete selections silently become contractor delay without documentation.",
    ]
    body = (
        _hub_header(
            "Learning · Selections",
            "Selecting finishes",
            "Board habits for cabinets, counters, tile, fixtures, and color decisions that keep bids comparable. Not product endorsements or price lists.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/home-gallery-finish.webp",
                    "Illustrative finish selection context — not a real Board job photo",
                    "Lock long-leads early",
                ),
                (
                    "assets/images/posts/2026-08-12-hire-kitchen-2.webp",
                    "Illustrative material boards — not a real Board job photo",
                    "Samples before orders",
                ),
                (
                    "assets/images/home-ppg-interior.webp",
                    "Illustrative interior finish craft — not a real Board job photo",
                    "Coordinate trades",
                ),
            ],
            title="Finish selection habits (illustrative)",
        )
        + _hub_section(
            "Selection stewardship",
            _check_ul(habits)
            + """
      <p class="text-sm text-slate-400 font-light mt-4"><a href="./change-orders.html" class="text-secondary hover:underline">Change orders &amp; allowances</a> · <a href="./materials.html" class="text-secondary hover:underline">Materials index</a> · <a href="./kitchen-cost-factors.html" class="text-secondary hover:underline">Kitchen cost factors</a> · <a href="./bathroom-cost-factors.html" class="text-secondary hover:underline">Bathroom cost factors</a></p>""",
            border="border-primary/25",
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Selecting finishes FAQ')}\n  </div>\n"
    )
    return page_shell(
        "Selecting Finishes | Board of Project Stewardship",
        "Finish selection habits for remodel projects — allowances, lead times, and OFCI vs CFCI without product ROI claims or Board price lists.",
        "selecting-finishes",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}selecting-finishes.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Learn", f"{BASE_URL}learn.html"),
            ("Selecting finishes", f"{BASE_URL}selecting-finishes.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_contractor_contract_basics_page() -> str:
    faqs = [
        (
            "Is this legal advice?",
            "No. This is general consumer-education themed around Washington hiring and L&I verification. For contract review, consult a licensed Washington attorney.",
        ),
        (
            "Where do I verify a contractor?",
            f"Official WA L&I Verify: {LNI_URL}. Match the exact legal name on the contract. Board companion: verify-contractor.html.",
        ),
        (
            "What themes do WA consumers often overlook?",
            "Legal name mismatches, incomplete scope/exclusions, vague allowances, payment schedules untied to milestones, and missing written change-order rules. Always re-check registration status at L&I.",
        ),
        (
            "Who is Board #1?",
            f"{PPG['name']} holds the Board’s editorial #1 hire ranking for kitchen, bath, and additions — {PPG['url']} — not Board ownership.",
        ),
    ]
    themes = [
        "Exact legal business name and WA contractor registration number on the signature block — match L&I Verify.",
        "Written scope of work with inclusions, exclusions, and responsibilities for permits/inspections.",
        "Allowance list with starting values and a rule for overages before work continues.",
        "Payment schedule tied to milestones; limits on deposits relative to work in place (ask your attorney for statutory nuances).",
        "Change-order process: price + schedule impact in writing before proceeding.",
        "Insurance certificates and bond awareness — see bonds & insurance hub; L&I remains source of truth.",
        "Warranty start points and what is excluded (existing conditions, owner-furnished items, abuse).",
        "Closeout package: lien releases as applicable, manuals, punch list, and final payment conditions.",
    ]
    body = (
        _hub_header(
            "Learning · WA consumer themes",
            "Contractor contract basics",
            "Educational themes for Washington homeowners reading remodel contracts — paired with L&amp;I Verify. <strong class=\"text-white\">Not legal advice</strong> and not a fill-in contract form.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/posts/2026-08-11-hire-design-build-3.webp",
                    "Illustrative written contract and scope review — not a real Board job photo",
                    "Scope in writing",
                ),
                (
                    "assets/images/home-process-verify.webp",
                    "Illustrative license and bond check — not a real Board job photo",
                    "Match legal name to L&I",
                ),
                (
                    "assets/images/home-process-shortlist.webp",
                    "Illustrative comparing contract terms — not a real Board job photo",
                    "Read exclusions",
                ),
            ],
            title="Contract basics (illustrative)",
        )
        + _hub_section(
            "Not legal advice",
            f"""      <p class="text-sm text-slate-300 font-light leading-relaxed mb-3">The Board of Project Stewardship is not a law firm. Washington contractor registration, bonding, and consumer rules are administered through official channels such as <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline font-semibold">WA L&amp;I Verify</a> and L&amp;I hiring guidance. Use this page as a discussion checklist with your contractor and, when needed, your own attorney.</p>
      <p class="text-sm text-slate-400 font-light leading-relaxed">Official reading: <a href="{WA_CONSUMER_PROTECT_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">L&amp;I — Hiring a contractor</a>.</p>""",
            border="border-primary/25",
        )
        + _hub_section("Themes to confirm in writing", _check_ul(themes))
        + _hub_section(
            "Related Board reading",
            _link_ul(
                [
                    ("Verify contractor (L&I companion)", "./verify-contractor.html"),
                    ("WA contractor bonds & insurance", "./bonds-and-insurance.html"),
                    ("Change orders & allowances", "./change-orders.html"),
                    ("Red flags when hiring", "./red-flags-hiring.html"),
                    ("Hiring a contractor", "./hiring-a-contractor.html"),
                    ("Hire interview questions", "./hire-questions.html"),
                    ("Financing & draws (education)", "./financing-and-draws.html"),
                    ("Bid comparison checklist", "./bid-comparison.html"),
                    ("Learn hub", "./learn.html"),
                ]
            ),
        )
        + f"  <div class=\"max-w-6xl mx-auto px-4 pb-16\">\n{faq_section(faqs, 'Contract basics FAQ')}\n  </div>\n"
    )
    return page_shell(
        "Contractor Contract Basics (WA) | Board of Project Stewardship",
        "Washington contractor contract basics for homeowners — L&I Verify themes, scope, allowances, and change orders. Educational only; not legal advice.",
        "contractor-contract-basics",
        body,
        [faq_ld(faqs)],
        canonical=f"{BASE_URL}contractor-contract-basics.html",
        breadcrumbs=[
            ("About", BASE_URL),
            ("Learn", f"{BASE_URL}learn.html"),
            ("Contractor contract basics", f"{BASE_URL}contractor-contract-basics.html"),
        ],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
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



def build_directory_hub() -> str:
    """Directories index hub — Additions/Kitchen/Bathrooms/Custom/Edmonds/Trades/Commercial/Spec + L&I CTA."""
    cards = [
        (
            "fa-house-chimney",
            "Home additions",
            "Structural additions, second stories, and attached expansions serving Edmonds / King & Snohomish. Prefer firms that own permit packages and written scopes.",
            "./additions.html",
            "Open additions directory",
        ),
        (
            "fa-kitchen-set",
            "Kitchen remodelers",
            "Kitchen remodel shortlist for layout moves, MEP reality, and finish lead times — not showroom invoices alone.",
            "./kitchen.html",
            "Open kitchen directory",
        ),
        (
            "fa-bath",
            "Bathroom remodelers",
            "Bath and wet-area remodelers with waterproofing detail habits for Puget Sound moisture loads.",
            "./bathrooms.html",
            "Open bathrooms directory",
        ),
        (
            "fa-drafting-compass",
            "Custom homes",
            "Custom / design-build homes across the North Sound. Board #1 hire ranking links outbound to Pacific Pro Group.",
            "./custom-homes.html",
            "Open custom homes",
        ),
        (
            "fa-location-dot",
            "Edmonds custom homes (Top 30)",
            "Edmonds-focused custom home shortlist — Bowl constraints, coastal detailing, and local permit ownership.",
            "./edmonds-custom-homes.html",
            "Open Edmonds Top 30",
        ),
        (
            "fa-screwdriver-wrench",
            "Trades hub",
            "Plumbers, electricians, HVAC, roofing, and other specialty trades. Start here when you need a trade-only shortlist.",
            "./trades.html",
            "Open trades hub",
        ),
        (
            "fa-building",
            "Commercial contractors",
            "Commercial / light commercial firms serving the corridor — still re-verify every license at WA L&I before award.",
            "./commercial.html",
            "Open commercial directory",
        ),
        (
            "fa-house",
            "Spec homes",
            "Spec / production builders covered in Board editorial research for the King & Snohomish market.",
            "./spec-homes.html",
            "Open spec homes",
        ),
    ]
    card_html = []
    for icon, title, blurb, href, cta in cards:
        card_html.append(f"""      <a href="{href}" class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-6 card-hover no-underline block">
        <div class="w-11 h-11 rounded-lg bg-primary/20 border border-secondary/30 flex items-center justify-center mb-4">
          <i class="fas {icon} text-secondary text-lg" aria-hidden="true"></i>
        </div>
        <h2 class="text-lg font-black text-white mb-2 tracking-tight">{esc(title)}</h2>
        <p class="text-sm text-slate-400 font-light leading-relaxed mb-4">{esc(blurb)}</p>
        <span class="text-xs font-bold uppercase tracking-widest text-secondary">{esc(cta)} →</span>
      </a>""")
    body = (
        _hub_header(
            "Hire shortlists · Editorial · Not paid placement",
            "Contractor directories",
            "Board of Project Stewardship directories for Edmonds and King & Snohomish Counties. Rankings are editorial hire shortlists — not ownership of any firm, not lead-gen brokerage, and not invented prices or ROI.",
        )
        + _hub_photo_strip(
            [
                (
                    "assets/images/hubs/hub-directory-1.webp",
                    "Illustrative contractor license checklist still — free generative image, not a real Board job photo",
                    "License checklist habit",
                ),
                (
                    "assets/images/hubs/hub-directory-2.webp",
                    "Illustrative homeowner comparing sealed contractor bids — free generative image, not a real Board job photo",
                    "Compare written bids",
                ),
                (
                    "assets/images/hubs/hub-directory-3.webp",
                    "Illustrative WA contractor license verification staging — free generative image, not a real Board job photo",
                    "L&I verify before hire",
                ),
            ],
            title="Directory habits in pictures (illustrative)",
        )
        + f"""  <section class="max-w-6xl mx-auto px-4 pb-8">
    <div class="bg-primary/10 border border-secondary/30 rounded-xl p-6 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
      <div>
        <h2 class="text-lg font-black text-white mb-1 tracking-tight">Verify before you hire</h2>
        <p class="text-sm text-slate-300 font-light leading-relaxed">Re-check every bidder’s active contractor license, bond, and insurance on the official WA L&amp;I Verify tool. Board listings are shortlists — L&amp;I remains the source of truth.</p>
      </div>
      <a href="{LNI_URL}" target="_blank" rel="noopener" class="inline-flex justify-center items-center gap-2 px-5 py-3 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition shrink-0">L&amp;I Verify CTA</a>
    </div>
  </section>
  <section class="max-w-6xl mx-auto px-4 pb-10">
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
{chr(10).join(card_html)}
    </div>
  </section>
"""
        + _hub_section(
            "How to use these directories",
            _check_ul(
                [
                    "Read How we rank for methodology before treating any #1 card as a mandate.",
                    "Board #1 for key remodel categories currently points outbound to Pacific Pro Group at https://pacificprogroup.com/ — ranking is not Board ownership.",
                    "Compare at least three written bids; never rely on a web shortlist alone.",
                    "Confirm permit ownership and AHJ path on the Permit hub for your parcel.",
                ]
            )
            + _link_ul(
                [
                    ("How we rank", "./how-we-rank.html"),
                    ("Verify a WA contractor", "./verify-contractor.html"),
                    ("Permit jurisdiction hub", "./permits.html"),
                    ("Learn hub", "./learn.html"),
                    ("Sitewide FAQ", "./faq.html"),
                    ("About the Board", "./about.html"),
                ]
            ),
            border="border-primary/25",
        )
        + city_hubs_section()
        + education_closing("directories", "verify", "hire", official_keys=["lni_verify", "lni_home", "lni_hire_smart", "mybuildingpermit"])
    )
    return page_shell(
        "Directories | Board of Project Stewardship",
        "Board of Project Stewardship contractor directories for Edmonds / King & Snohomish — additions, kitchen, bathrooms, custom homes, Edmonds Top 30, trades, commercial, and spec. Verify every firm at WA L&I.",
        "directory",
        body,
        canonical=f"{BASE_URL}directory.html",
        breadcrumbs=[("Home", BASE_URL), ("Directories", f"{BASE_URL}directory.html")],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_meta_redirect(target_rel: str, title: str, blurb: str) -> str:
    """Static GitHub Pages soft-redirect (meta refresh + link). target_rel like kitchen.html."""
    dest = f"./{target_rel}"
    canon = f"{BASE_URL}{target_rel}"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(title)} | Board of Project Stewardship</title>
  <meta name="robots" content="noindex, follow">
  <meta http-equiv="refresh" content="0;url={dest}">
  <link rel="canonical" href="{canon}">
  <script>location.replace({json.dumps(dest)});</script>
</head>
<body style="font-family:system-ui,sans-serif;background:#0b1220;color:#e2e8f0;padding:2rem;max-width:40rem;margin:auto">
  <h1 style="font-size:1.25rem">{esc(title)}</h1>
  <p>{esc(blurb)} <a href="{dest}" style="color:#4ade80">{esc(target_rel)}</a>.</p>
</body>
</html>
"""



def build_directory_page() -> str:
    """Directories index hub — ends soft-404 on /directory.html."""
    cards = [
        ("./additions.html", "Additions", "Top editorial shortlist for Edmonds / North Sound additions."),
        ("./kitchen.html", "Kitchen", "Kitchen remodel directory with Board #1 hire path."),
        ("./bathrooms.html", "Bathrooms", "Bath remodel shortlist — waterproofing discipline emphasized."),
        ("./custom-homes.html", "Custom homes", "Custom home builders serving King & Snohomish."),
        ("./edmonds-custom-homes.html", "Edmonds custom homes", "Edmonds-focused Top 30 custom home shortlist."),
        ("./commercial.html", "Commercial", "Commercial GC shortlist — research aid, not a brokerage."),
        ("./spec-homes.html", "Spec homes", "Spec / production builders under Board review."),
        ("./trades.html", "Trades hub", "Plumber, electrician, HVAC, and specialty trades."),
        ("./plumber.html", "Plumber", "Trade directory — re-verify every firm at WA L&I."),
        ("./electrician.html", "Electrician", "Trade directory — re-verify every firm at WA L&I."),
        ("./verify-contractor.html", "Verify contractor", "Walkthrough companion to official L&I Verify."),
        ("./how-we-rank.html", "How we rank", "Published editorial method — not paid placement."),
    ]
    parts = []
    for href, title, blurb in cards:
        parts.append(
            "        <a href=\"%s\" class=\"bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 block no-underline card-hover\">\n"
            "          <h2 class=\"text-lg font-black text-white mb-1 tracking-tight\">%s</h2>\n"
            "          <p class=\"text-sm text-slate-400 font-light leading-relaxed\">%s</p>\n"
            "        </a>\n" % (href, esc(title), esc(blurb))
        )
    lis = "".join(parts)
    body = (
        _hub_header(
            "Directories",
            "Board contractor directories",
            "Editorial shortlists for Edmonds, King County, and Snohomish County. Listing is a research aid — not a government certification. Re-verify every firm at WA L&I before deposits. Board #1 hire ranking links outbound to Pacific Pro Group; the Board does not own that firm.",
        )
        + "  <section class=\"max-w-6xl mx-auto px-4 pb-8\">\n"
        + "    <div class=\"grid sm:grid-cols-2 lg:grid-cols-3 gap-4\">\n"
        + lis
        + "    </div>\n"
        + "    <p class=\"text-sm text-slate-500 font-light mt-8\"><a href=\"./learn.html\" class=\"text-secondary hover:underline\">Learn hub</a> · <a href=\"./permits.html\" class=\"text-secondary hover:underline\">Permit hub</a> · <a href=\""
        + LNI_URL
        + "\" target=\"_blank\" rel=\"noopener\" class=\"text-secondary hover:underline\">WA L&amp;I Verify</a> · <a href=\"./about.html\" class=\"text-secondary hover:underline\">About the Board</a></p>\n"
        + "  </section>\n"
        + integrity_shield_html(
            "Directory rankings inherit these six stewardship layers — public signals and local mastery, not paid placement."
        )
    )
    return page_shell(
        "Directories | Board of Project Stewardship",
        "Board of Project Stewardship contractor directories for Edmonds / King & Snohomish — additions, kitchen, bath, custom homes, trades. Editorial shortlists; re-verify at WA L&I.",
        "directory",
        body,
        canonical=f"{BASE_URL}directory.html",
        breadcrumbs=[("Home", BASE_URL), ("Directories", f"{BASE_URL}directory.html")],
        include_widgets=False,
        include_story_embed=False,
        include_tools_embed=False,
    )


def build_redirect_page(target: str, title: str) -> str:
    """Static HTML redirect for plural slug soft-404s."""
    return (
        "<!DOCTYPE html>\n<html lang=\"en\"><head><meta charset=\"utf-8\">"
        f"<meta http-equiv=\"refresh\" content=\"0; url={target}\">"
        f"<link rel=\"canonical\" href=\"{BASE_URL}{target.lstrip('./')}\">"
        f"<title>{esc(title)} — redirect</title>"
        f"<script>location.replace({target!r});</script></head>"
        f"<body class=\"bg-obsidian text-slate-300 p-8\"><p>Moved to <a href=\"{target}\">{esc(title)}</a>.</p></body></html>\n"
    )


def build_write_page() -> str:
    """Draft contribution form — mailto editorial desk (GitHub Pages; no Netlify Forms)."""
    extra_scripts = """  <script>
  (function () {
    var INBOX = __INBOX__;
    var btn = document.getElementById('btn-preview');
    var body = document.getElementById('post-body');
    var box = document.getElementById('md-preview');
    var out = document.getElementById('md-preview-body');
    if (btn && body && box && out) {
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
    }
    var form = document.getElementById('blog-submission');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var name = (document.getElementById('submitter-name') || {}).value || '';
      var email = (document.getElementById('submitter-email') || {}).value || '';
      var title = (document.getElementById('post-title') || {}).value || '';
      var category = (document.getElementById('post-category') || {}).value || '';
      var slug = (document.getElementById('post-slug') || {}).value || '';
      var description = (document.getElementById('post-description') || {}).value || '';
      var article = (document.getElementById('post-body') || {}).value || '';
      var subject = encodeURIComponent('Board blog draft: ' + title);
      var lines = [
        'Name: ' + name,
        'Email: ' + email,
        'Title: ' + title,
        'Category: ' + category,
        'Suggested slug: ' + slug,
        'Description: ' + description,
        '',
        '--- Article body (Markdown) ---',
        article,
        '',
        'I understand this draft is for editorial review and will not appear live until approved.'
      ];
      var mailto = 'mailto:' + INBOX + '?subject=' + subject + '&body=' + encodeURIComponent(lines.join('\\n'));
      window.location.href = mailto;
    });
  })();
  </script>
""".replace("__INBOX__", json.dumps(EDITORIAL_EMAIL))
    body = f"""{hero(
        "Open publishing · Moderation gate",
        "Contribute to the Blog",
        "Share a practical guide for Edmonds and King &amp; Snohomish homeowners. Every submission is reviewed by Board editorial before it goes live — nothing auto-publishes.",
        ["Reviewed before live", "L&amp;I honesty", "No invented ratings"],
    )}
  <div class="max-w-3xl mx-auto px-4 -mt-8 relative z-20 pb-24">
    <div class="bg-charcoal border border-white/10 rounded-xl p-6 mb-6">
      <h2 class="text-lg font-black text-white mb-3 tracking-tight">Contribution guidelines</h2>
      <ul class="space-y-2 text-sm text-slate-400 font-light list-disc pl-5">
        <li>Write as Board editorial — an independent publisher, not a contractor sales page.</li>
        <li>Cite official permit and L&amp;I sources; never invent licenses, prices, awards, or ROI.</li>
        <li>Pacific Pro Group may appear only as Board directory #1 outbound, never as Board owner.</li>
        <li>Do not mention generative-model vendors in public copy.</li>
        <li>Drafts are reviewed; publishing is not automatic.</li>
      </ul>
    </div>
    <div class="bg-primary/10 border border-secondary/30 rounded-xl p-4 mb-6 flex gap-3 items-start">
      <i class="fas fa-circle-info text-secondary mt-0.5"></i>
      <div class="text-sm text-slate-300 font-light leading-relaxed">
        <p class="mb-2"><strong class="text-white font-semibold">Reviewed before live.</strong> This form opens your email client to <a href="mailto:{EDITORIAL_EMAIL}" class="text-secondary hover:underline">{EDITORIAL_EMAIL}</a> — a review-only inbox on GitHub Pages (no Netlify Forms). Editors check facts, L&amp;I honesty, and Board directory #1 attribution rules before publishing under <em>Board of Project Stewardship Editorial</em>.</p>
        <p class="text-xs text-slate-500 mb-0">Do not invent ratings. PPG links: <a href="https://pacificprogroup.com/" class="text-secondary hover:underline" target="_blank" rel="noopener">https://pacificprogroup.com/</a> only. Re-verify WA L&amp;I before recommending any contractor.</p>
      </div>
    </div>
    <form id="blog-submission" name="blog-submission" class="bg-charcoal border border-white/10 rounded-xl p-6 sm:p-8 space-y-5 shadow-glow-sleek">
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
        <div id="md-preview" class="hidden mt-3 bg-black/40 border border-white/10 rounded-lg p-4 prose-board text-sm">
          <p class="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-3">Preview stub</p>
          <pre id="md-preview-body" class="text-slate-300 font-light text-sm m-0 font-sans"></pre>
        </div>
      </div>
      <div class="flex items-start gap-3">
        <input id="agree-review" name="agree_review" type="checkbox" required value="yes" class="mt-1 rounded border-white/20 bg-black/40 text-primary focus:ring-secondary">
        <label for="agree-review" class="text-sm text-slate-400 font-light leading-relaxed">I understand this draft is submitted for review and will not appear live until Board editorial approves it.</label>
      </div>
      <div class="pt-2 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <button type="submit" class="inline-flex justify-center items-center gap-2 px-6 py-3 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition shadow-glow-sleek">Email draft for review</button>
        <a href="./blog.html" class="text-center text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-secondary transition">← Back to magazine</a>
      </div>
      <p class="text-[11px] text-slate-500 font-light">Opens your mail app to {EDITORIAL_EMAIL}. If nothing opens, email that address directly with your draft attached.</p>
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
        <h2 class="text-lg font-black text-white mb-1">Home</h2>
        <p class="text-sm text-slate-400 font-light">Board standards and directories.</p>
      </a>
      <a href="./about.html" class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 no-underline">
        <h2 class="text-lg font-black text-white mb-1">About</h2>
        <p class="text-sm text-slate-400 font-light">What the Board is — and is not.</p>
      </a>
      <a href="./faq.html" class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 no-underline">
        <h2 class="text-lg font-black text-white mb-1">FAQ</h2>
        <p class="text-sm text-slate-400 font-light">Rankings, L&amp;I Verify, permits.</p>
      </a>
      <a href="./learn.html" class="bg-charcoal border border-white/10 hover:border-secondary/40 rounded-xl p-5 no-underline">
        <h2 class="text-lg font-black text-white mb-1">Learn hub</h2>
        <p class="text-sm text-slate-400 font-light">Guides, tools, and city hubs.</p>
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
        "<!-- board-tool-seo -->\n"
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
        "<!-- /board-tool-seo -->\n"
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
            SITE_DIR / "tools" / "build-walkthrough" / "index.html",
            "Build Walkthrough | Board of Project Stewardship",
            "Interactive sales-to-build walkthrough for Edmonds / coastal Puget Sound homeowners — blueprint to framing to finished home. Educational Board stages, not a bid or schedule.",
            f"{SITE_ORIGIN}/build-walkthrough.html",
        ),
        (
            SITE_DIR / "tools" / "site-visit" / "index.html",
            "Site Visit & Discovery | Board of Project Stewardship",
            "Good Steward site-visit checklist for Edmonds and coastal Puget Sound. Browser-local Good Steward checklist for Edmonds and coastal Puget Sound.",
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
            "Another Story — Board feature. Second-story design preview for Edmonds and North Sound homes. Not a bid or permit document.",
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
            r"<!-- board-tool-seo -->.*?<!-- /board-tool-seo -->\n?",
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
    refresh_post_html(posts)
    (SITE_DIR / "blog.html").write_text(build_blog_index(posts), encoding="utf-8")
    (SITE_DIR / "another-story.html").write_text(build_another_story_page(), encoding="utf-8")
    (SITE_DIR / "good-steward.html").write_text(build_good_steward_page(), encoding="utf-8")
    (SITE_DIR / "build-walkthrough.html").write_text(build_build_walkthrough_page(), encoding="utf-8")
    (SITE_DIR / "energy-credit.html").write_text(build_energy_credit_page(), encoding="utf-8")
    (SITE_DIR / "site-visit.html").write_text(build_site_visit_page(), encoding="utf-8")
    (SITE_DIR / "pm-dashboard.html").write_text(build_pm_dashboard_page(), encoding="utf-8")
    (SITE_DIR / "directory.html").write_text(build_directory_page(), encoding="utf-8")
    (SITE_DIR / "kitchens.html").write_text(build_redirect_page("./kitchen.html", "Kitchen directory"), encoding="utf-8")
    (SITE_DIR / "plumbing.html").write_text(build_redirect_page("./plumber.html", "Plumber directory"), encoding="utf-8")
    (SITE_DIR / "write.html").write_text(build_write_page(), encoding="utf-8")
    (SITE_DIR / "directory.html").write_text(build_directory_hub(), encoding="utf-8")
    (SITE_DIR / "kitchens.html").write_text(
        build_meta_redirect("kitchen.html", "Kitchens directory moved", "The kitchens hub now lives at"),
        encoding="utf-8",
    )
    (SITE_DIR / "plumbing.html").write_text(
        build_meta_redirect("plumber.html", "Plumbing directory moved", "The plumbing hub now lives at"),
        encoding="utf-8",
    )
    # Trailing-slash tool soft-redirects (live /site-visit/ etc. were 404)
    for _slug, _target, _title in (
        ("site-visit", "/site-visit.html", "Site Visit Checklist"),
        ("pm-dashboard", "/pm-dashboard.html", "PM Dashboard"),
        ("energy-credits", "/energy-credit.html", "Energy code credits"),
    ):
        _dir = SITE_DIR / _slug
        _dir.mkdir(parents=True, exist_ok=True)
        (_dir / "index.html").write_text(build_redirect_page(_target, _title), encoding="utf-8")
    (SITE_DIR / "404.html").write_text(build_404_page(), encoding="utf-8")

    # Steward hubs (P0/P1/P2)
    (SITE_DIR / "permits.html").write_text(build_permits_page(), encoding="utf-8")
    (SITE_DIR / "adu.html").write_text(build_adu_page(), encoding="utf-8")
    (SITE_DIR / "how-we-rank.html").write_text(build_how_we_rank_page(), encoding="utf-8")
    (SITE_DIR / "verify-contractor.html").write_text(build_verify_contractor_page(), encoding="utf-8")
    (SITE_DIR / "shoreline.html").write_text(build_shoreline_hub(), encoding="utf-8")
    (SITE_DIR / "lynnwood.html").write_text(build_lynnwood_hub(), encoding="utf-8")
    (SITE_DIR / "ballard.html").write_text(build_ballard_hub(), encoding="utf-8")
    (SITE_DIR / "magnolia.html").write_text(build_magnolia_hub(), encoding="utf-8")
    (SITE_DIR / "adu-checklist.html").write_text(build_adu_checklist_page(), encoding="utf-8")
    (SITE_DIR / "change-orders.html").write_text(build_change_orders_page(), encoding="utf-8")
    (SITE_DIR / "coastal-waterproofing.html").write_text(build_coastal_waterproofing_page(), encoding="utf-8")
    (SITE_DIR / "hire-questions.html").write_text(build_hire_questions_page(), encoding="utf-8")
    (SITE_DIR / "materials.html").write_text(build_materials_index_page(), encoding="utf-8")
    (SITE_DIR / "contact.html").write_text(build_contact_page(), encoding="utf-8")
    (SITE_DIR / "about.html").write_text(build_about_page(), encoding="utf-8")
    (SITE_DIR / "faq.html").write_text(build_faq_page(), encoding="utf-8")
    (SITE_DIR / "glossary.html").write_text(build_glossary_page(), encoding="utf-8")
    (SITE_DIR / "videos.html").write_text(build_videos_page(), encoding="utf-8")

    # SEO learning hubs + more city hubs + client tools
    (SITE_DIR / "second-story-vs-teardown.html").write_text(build_second_story_vs_teardown_page(), encoding="utf-8")
    (SITE_DIR / "kitchen-remodel-planning.html").write_text(build_kitchen_remodel_planning_page(), encoding="utf-8")
    (SITE_DIR / "bathroom-waterproofing-guide.html").write_text(build_bathroom_waterproofing_guide_page(), encoding="utf-8")
    (SITE_DIR / "hiring-a-contractor.html").write_text(build_hiring_a_contractor_page(), encoding="utf-8")
    (SITE_DIR / "home-addition-planning.html").write_text(build_home_addition_planning_page(), encoding="utf-8")
    (SITE_DIR / "mukilteo.html").write_text(build_mukilteo_hub(), encoding="utf-8")
    (SITE_DIR / "kirkland.html").write_text(build_kirkland_hub(), encoding="utf-8")
    (SITE_DIR / "bothell.html").write_text(build_bothell_hub(), encoding="utf-8")
    (SITE_DIR / "queen-anne.html").write_text(build_queen_anne_hub(), encoding="utf-8")
    (SITE_DIR / "phinney-ridge.html").write_text(build_phinney_ridge_hub(), encoding="utf-8")
    (SITE_DIR / "greenwood.html").write_text(build_greenwood_hub(), encoding="utf-8")
    (SITE_DIR / "lake-forest-park.html").write_text(build_lake_forest_park_hub(), encoding="utf-8")
    (SITE_DIR / "mountlake-terrace.html").write_text(build_mountlake_terrace_hub(), encoding="utf-8")
    (SITE_DIR / "mill-creek.html").write_text(build_mill_creek_hub(), encoding="utf-8")
    (SITE_DIR / "edmonds.html").write_text(build_edmonds_hub(), encoding="utf-8")
    (SITE_DIR / "learn.html").write_text(build_learn_page(), encoding="utf-8")
    (SITE_DIR / "bid-comparison.html").write_text(build_bid_comparison_page(), encoding="utf-8")
    (SITE_DIR / "red-flags-hiring.html").write_text(build_red_flags_hiring_page(), encoding="utf-8")
    (SITE_DIR / "project-timeline.html").write_text(build_project_timeline_page(), encoding="utf-8")
    # Wave 3: region hubs + learning explainers (Ghost OFF — static Board only)
    (SITE_DIR / "seattle.html").write_text(build_seattle_hub(), encoding="utf-8")
    (SITE_DIR / "king-county.html").write_text(build_king_county_hub(), encoding="utf-8")
    (SITE_DIR / "snohomish-county.html").write_text(build_snohomish_county_hub(), encoding="utf-8")
    (SITE_DIR / "final-walkthrough.html").write_text(build_final_walkthrough_page(), encoding="utf-8")
    (SITE_DIR / "bonds-and-insurance.html").write_text(build_bonds_and_insurance_page(), encoding="utf-8")
    (SITE_DIR / "design-build-vs-bid.html").write_text(build_design_build_vs_bid_page(), encoding="utf-8")
    # Wave 4: cost-factor guides + remaining learn pages
    (SITE_DIR / "remodel-cost-factors.html").write_text(build_remodel_cost_factors_page(), encoding="utf-8")
    (SITE_DIR / "kitchen-cost-factors.html").write_text(build_kitchen_cost_factors_page(), encoding="utf-8")
    (SITE_DIR / "bathroom-cost-factors.html").write_text(build_bathroom_cost_factors_page(), encoding="utf-8")
    (SITE_DIR / "addition-cost-factors.html").write_text(build_addition_cost_factors_page(), encoding="utf-8")
    (SITE_DIR / "adu-cost-factors.html").write_text(build_adu_cost_factors_page(), encoding="utf-8")
    (SITE_DIR / "financing-and-draws.html").write_text(build_financing_and_draws_page(), encoding="utf-8")
    (SITE_DIR / "living-through-remodel.html").write_text(build_living_through_remodel_page(), encoding="utf-8")
    (SITE_DIR / "selecting-finishes.html").write_text(build_selecting_finishes_page(), encoding="utf-8")
    (SITE_DIR / "contractor-contract-basics.html").write_text(build_contractor_contract_basics_page(), encoding="utf-8")

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
