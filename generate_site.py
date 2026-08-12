#!/usr/bin/env python3
"""Generate The Board of Project Stewardship multi-page static site."""
from __future__ import annotations

import html
import json
import re
from datetime import datetime
from pathlib import Path

SITE_DIR = Path(__file__).resolve().parent
WORKSPACE = SITE_DIR.parent
BASE_URL = "https://theboardofprojectstewardship.github.io/-The-Board-of-Project-Stewardship/"
LNI_URL = "https://secure.lni.wa.gov/verify/"
YEAR = "2026"
AUTHOR = "Board of Project Stewardship Editorial"

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

def head_assets() -> str:
    return """  <script src="https://cdn.tailwindcss.com"></script>
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
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
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
    #tools input, #tools select, #tools textarea {
      color-scheme: dark;
    }
    #tools input::placeholder, #tools textarea::placeholder { color: #64748b; }
    #calc-result { letter-spacing: -0.02em; }
  </style>"""


def nav_html(active: str = "", prefix: str = "") -> str:
    # Normalize root-relative links to ./ for GitHub Pages path safety
    def href(name: str) -> str:
        if prefix:
            return f"{prefix}{name}"
        return f"./{name}"

    links = [
        ("about", href("index.html"), "About"),
        ("additions", href("additions.html"), "Additions"),
        ("custom-homes", href("custom-homes.html"), "Custom Homes"),
        ("edmonds", href("edmonds-custom-homes.html"), "Edmonds"),
        ("kitchen", href("kitchen.html"), "Kitchen"),
        ("bathrooms", href("bathrooms.html"), "Bathrooms"),
        ("commercial", href("commercial.html"), "Commercial"),
        ("spec-homes", href("spec-homes.html"), "Spec Homes"),
        ("trades", href("trades.html"), "Trades"),
        ("blog", href("blog.html"), "Blog"),
    ]
    items = []
    for key, h, label in links:
        cls = "text-secondary" if key == active else "text-slate-300 hover:text-secondary"
        items.append(
            f'<a href="{h}" class="{cls} font-medium text-xs uppercase tracking-widest transition">{label}</a>'
        )
    home_href = href("index.html")
    return f"""  <nav class="bg-charcoal/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16 items-center gap-4">
        <a href="{home_href}" class="flex items-center gap-2 no-underline min-w-0">
          <i class="fas fa-compass-drafting text-secondary text-xl shrink-0"></i>
          <span class="font-black text-sm sm:text-base tracking-wider text-white truncate">The Board of Project Stewardship</span>
        </a>
        <div class="hidden md:flex items-center gap-6 lg:gap-8">
          {''.join(items)}
        </div>
      </div>
      <div class="md:hidden flex flex-wrap gap-x-4 gap-y-2 pb-3">
          {''.join(items)}
      </div>
    </div>
  </nav>"""


def footer_html(prefix: str = "./") -> str:
    return f"""  <footer class="bg-obsidian py-14 text-sm border-t border-white/5">
    <div class="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-10 text-slate-400">
      <div>
        <div class="flex items-center mb-4 gap-2">
          <i class="fas fa-compass-drafting text-secondary"></i>
          <span class="font-black text-base tracking-wider text-white">The Board of Project Stewardship</span>
        </div>
        <p class="font-light leading-relaxed text-sm">Editorial directories of verified remodel, addition, and trade contractors serving Edmonds and King &amp; Snohomish Counties, WA. Updated {YEAR}.</p>
      </div>
      <div>
        <h4 class="text-white font-bold text-xs uppercase tracking-widest mb-4">Explore</h4>
        <ul class="space-y-2 font-light text-sm">
          <li><a href="{prefix}index.html" class="hover:text-secondary transition">About</a></li>
          <li><a href="{prefix}additions.html" class="hover:text-secondary transition">Additions Top 30</a></li>
          <li><a href="{prefix}custom-homes.html" class="hover:text-secondary transition">Custom homes</a></li>
          <li><a href="{prefix}edmonds-custom-homes.html" class="hover:text-secondary transition">Edmonds custom homes</a></li>
          <li><a href="{prefix}kitchen.html" class="hover:text-secondary transition">Kitchen remodelers</a></li>
          <li><a href="{prefix}bathrooms.html" class="hover:text-secondary transition">Bathroom remodelers</a></li>
          <li><a href="{prefix}commercial.html" class="hover:text-secondary transition">Commercial GCs</a></li>
          <li><a href="{prefix}spec-homes.html" class="hover:text-secondary transition">Spec homes</a></li>
          <li><a href="{prefix}trades.html" class="hover:text-secondary transition">Trade contractors</a></li>
          <li><a href="{prefix}blog.html" class="hover:text-secondary transition">Blog</a></li>
        </ul>
      </div>
      <div>
        <h4 class="text-white font-bold text-xs uppercase tracking-widest mb-4">Disclaimer</h4>
        <p class="mb-3 font-light leading-relaxed text-sm">Listing is not an endorsement of quality. Verify licenses, insurance, bonds, and references before hiring. Membership in trade associations does not guarantee outcomes. Re-check status at <a href="{LNI_URL}" target="_blank" rel="noopener" class="text-secondary hover:underline">WA L&amp;I Verify</a>.</p>
        <p class="text-xs text-slate-600">&copy; {YEAR} The Board of Project Stewardship</p>
      </div>
    </div>
  </footer>"""


def page_shell(title: str, description: str, active: str, body: str, json_ld: list | None = None, prefix: str = "", canonical: str = "", keywords: str = "") -> str:
    ld_blocks = ""
    for obj in json_ld or []:
        ld_blocks += f'  <script type="application/ld+json">\n{json.dumps(obj, indent=2)}\n  </script>\n'
    canon = canonical or (BASE_URL + ("" if active == "about" else f"{active}.html" if active != "blog" else "blog.html"))
    kw_tag = f'  <meta name="keywords" content="{esc(keywords)}">\n' if keywords else ""
    return f"""<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="{esc(description)}">
{kw_tag}  <meta name="robots" content="index, follow">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="{esc(canon)}">
  <link rel="canonical" href="{esc(canon)}">
  <title>{esc(title)}</title>
{head_assets()}
{ld_blocks}</head>
<body class="bg-obsidian bg-grid-pattern min-h-screen antialiased">
{nav_html(active, prefix)}
{body}
  <div class="max-w-6xl mx-auto px-4 pb-8 relative z-20">
{ppg_widgets_html()}
  </div>
{footer_html(prefix if prefix else "./")}
{ppg_widgets_script()}
</body>
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
    return f"""    <article class="bg-charcoal rounded-xl shadow-2xl border border-secondary/35 relative overflow-hidden mb-14 card-hover" id="pacific-pro-group">
      <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary"></div>
      <div class="bg-black/40 px-6 py-3 flex flex-wrap justify-between items-center gap-2 border-b border-white/5">
        <span class="text-secondary font-bold text-xs uppercase tracking-[0.15em] flex items-center">
          <i class="fas fa-trophy mr-2"></i> #1 Ranked {esc(context_label)}
        </span>
        <span class="text-slate-400 text-[11px] font-semibold uppercase tracking-wider flex items-center">
          <i class="fas fa-shield-halved text-emerald-500 mr-2"></i> Edmonds, WA · Featured
        </span>
      </div>
      <div class="p-6 md:p-10 md:flex gap-10 relative">
        <div class="absolute -top-16 -left-16 w-72 h-72 bg-primary/10 blur-[90px] pointer-events-none rounded-full"></div>
        <div class="md:w-1/3 mb-8 md:mb-0 relative z-10 flex flex-col gap-4">
          <div class="bg-white h-48 w-full rounded-lg flex items-center justify-center border border-white/10 shadow-inner">
            <div class="text-center px-4">
              <i class="fas fa-house-chimney text-5xl text-slate-800 mb-3"></i>
              <h3 class="text-slate-900 text-lg font-black uppercase tracking-widest leading-snug">Pacific Pro Group</h3>
              <p class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Edmonds, WA</p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
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
              <p class="text-secondary font-bold text-xs uppercase tracking-[0.2em] mb-1">Rank #1</p>
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


def itemlist_ld(name: str, description: str, firms: list[dict], include_ppg: bool = True, schema_type: str = "GeneralContractor") -> dict:
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
        elements.append({
            "@type": "ListItem",
            "position": f.get("rank", len(elements) + 1),
            "item": item,
        })
    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": name,
        "description": description,
        "numberOfItems": len(elements),
        "itemListElement": elements,
    }


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


def hero(badge: str, title_html: str, subtitle: str, checks: list[str]) -> str:
    check_html = "".join(
        f'<span class="flex items-center gap-2"><i class="fas fa-check text-secondary"></i> {esc(c)}</span>'
        for c in checks
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
  </header>"""


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
          <p class="text-xs text-slate-500 mb-4 font-light">Rough ballpark only — not a bid. Uses sq&nbsp;ft × finish level + base coordination fee.</p>
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

    body = f"""{hero(
        f"Independent · Edmonds / King &amp; Snohomish · {YEAR}",
        'The Board of Project Stewardship<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">A Regulatory Filter for Local Construction Integrity</span>',
        "Most directories are marketing platforms. We are a regulatory filter — an independent body focused on local construction integrity in Edmonds and the greater King &amp; Snohomish market.",
        ["Independent review", "Local standards", "Project continuity"],
    )}
  <main class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
    <section class="bg-charcoal rounded-xl p-8 md:p-10 border border-primary/25 mb-12 relative overflow-hidden">
      <div class="absolute -bottom-20 -right-20 w-56 h-56 bg-primary/15 blur-[70px] pointer-events-none rounded-full"></div>
      <h2 class="text-2xl font-black text-white mb-4 tracking-tight flex items-center gap-3 relative z-10">
        <i class="fas fa-gavel text-secondary"></i> Mission
      </h2>
      <p class="text-slate-300 leading-relaxed font-light max-w-3xl relative z-10">
        The Board of Project Stewardship applies a higher bar than paid listings or lead-gen directories.
        We emphasize solvency, technical competence, steward accountability, and proven local mastery —
        so homeowners can evaluate firms against clear standards, not marketing spend.
      </p>
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

{integrity_shield_html()}

    <section class="bg-charcoal rounded-xl p-8 md:p-10 border border-secondary/35 mb-14 relative overflow-hidden">
      <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary"></div>
      <div class="absolute -top-16 -left-16 w-72 h-72 bg-primary/10 blur-[90px] pointer-events-none rounded-full"></div>
      <div class="relative z-10">
        <span class="text-secondary font-bold text-xs uppercase tracking-[0.15em] flex items-center mb-3">
          <i class="fas fa-trophy mr-2"></i> Featured ranking
        </span>
        <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">Pacific Pro Group</h2>
        <p class="text-slate-300 font-light leading-relaxed mb-4 max-w-3xl">
          Pacific Pro Group is the Board’s <strong class="text-white font-semibold">#1 ranked design-build firm</strong>
          for Edmonds home additions. Local presence, remodel focus, and a verified
          <strong class="text-white font-semibold">{PPG['rating']}</strong> aggregate across
          <strong class="text-white font-semibold">{PPG['reviews']}</strong> reviews.
        </p>
        <div class="flex flex-wrap gap-2 mb-6">
          <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-emerald-400/30 bg-emerald-950/40 text-emerald-300">WA License {PPG['license']}</span>
          <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">{PPG['rating']} · {PPG['reviews']} reviews</span>
          <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold border border-white/20 bg-white/5 text-slate-300">Edmonds, WA</span>
        </div>
        <div class="flex flex-col sm:flex-row flex-wrap gap-3">
          <a href="./additions.html" class="bg-primary text-white text-center py-3.5 px-6 rounded font-bold hover:bg-emerald-700 transition shadow-glow-sleek uppercase tracking-wider text-sm">
            View Additions ranking
          </a>
          <a href="{PPG['url']}" target="_blank" rel="noopener" class="border border-white/20 bg-white/5 text-white py-3.5 px-6 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-sm text-center">
            pacificprogroup.com
          </a>
          <a href="{PPG['trustindex']}" target="_blank" rel="noopener" class="border border-white/15 text-slate-200 py-3.5 px-6 rounded font-bold hover:border-secondary hover:text-secondary transition uppercase tracking-wider text-sm text-center">
            Trustindex {PPG['rating']} · {PPG['reviews']}
          </a>
        </div>
      </div>
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
  </main>"""

    return page_shell(
        "The Board of Project Stewardship | Edmonds Construction Standards",
        "Most directories are marketing platforms. The Board of Project Stewardship is a regulatory filter — an independent body focused on local construction integrity in Edmonds and the greater King & Snohomish market.",
        "about",
        body,
        canonical=BASE_URL,
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
    body = f"""{hero(
        f"Edmonds · King &amp; Snohomish Counties · Updated {YEAR}",
        'Top 30 Verified Home Addition Contractors<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">in Edmonds &amp; Nearby</span>',
        "An editorial ranking of rated and verified home addition / remodel firms serving Edmonds and greater King &amp; Snohomish Counties — curated by The Board of Project Stewardship.",
        ["MBAKS-informed", "Local service area", "Additions focus"],
    )}
  <main class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
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
  </main>"""
    ld = [
        itemlist_ld(
            "Top 30 Verified Home Addition Contractors in Edmonds / King & Snohomish Counties, WA",
            "Editorial ranking of verified home addition and remodel contractors serving Edmonds and greater King and Snohomish Counties, WA. Updated 2026 by The Board of Project Stewardship.",
            additions,
            include_ppg=True,
        ),
        faq_ld(faqs),
    ]
    return page_shell(
        "Top 30 Verified Home Addition Contractors in Edmonds | Board of Project Stewardship",
        "Top 30 verified home addition contractors in Edmonds and King & Snohomish Counties, WA. Editorial ranking by The Board of Project Stewardship — updated 2026. Pacific Pro Group ranks #1.",
        "additions",
        body,
        ld,
        canonical=f"{BASE_URL}additions.html",
    )


def build_kb_page(kind: str, firms: list[dict]) -> str:
    is_kitchen = kind == "kitchen"
    label = "Kitchen Remodel" if is_kitchen else "Bathroom Remodel"
    slug = "kitchen" if is_kitchen else "bathrooms"
    title = f"Top Kitchen Remodel Contractors in Edmonds | Board of Project Stewardship" if is_kitchen else "Top Bathroom Remodel Contractors in Edmonds | Board of Project Stewardship"
    desc = (
        f"Editorial ranking of top {label.lower()} contractors serving Edmonds and King & Snohomish Counties, WA. Pacific Pro Group ranks #1 with 4.9 from 190 Trustindex reviews."
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
    body = f"""{hero(
        f"Edmonds · King &amp; Snohomish · Updated {YEAR}",
        f'Top {label} Contractors<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">Edmonds &amp; Nearby</span>',
        f"An editorial shortlist of {label.lower()} firms serving Edmonds and greater King &amp; Snohomish Counties — curated by The Board of Project Stewardship.",
        ["Local service area", "Remodel focus", "Editorial ranking"],
    )}
  <main class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
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
  </main>"""
    ld = [
        itemlist_ld(
            f"Top {label} Contractors in Edmonds / King & Snohomish Counties, WA",
            desc,
            firms,
            include_ppg=True,
        ),
        faq_ld(faqs),
    ]
    return page_shell(title, desc, slug if is_kitchen else "bathrooms", body, ld, canonical=f"{BASE_URL}{slug}.html")



def build_custom_homes(firms: list[dict]) -> str:
    label = "Custom Home"
    slug = "custom-homes"
    title = "Top Custom Home Builders in Edmonds | Board of Project Stewardship"
    desc = (
        "Editorial ranking of top custom home builders serving Edmonds and King & Snohomish Counties, WA. "
        "Pacific Pro Group ranks #1 with 4.9 from 190 Trustindex reviews."
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
    body = f"""{hero(
        f"Edmonds · King &amp; Snohomish · Updated {YEAR}",
        'Top Custom Home Builders<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">Edmonds &amp; Nearby</span>',
        "An editorial shortlist of custom home / design-build firms serving Edmonds and greater King &amp; Snohomish Counties — curated by The Board of Project Stewardship.",
        ["Custom / design-build", "Local service area", "Editorial ranking"],
    )}
  <main class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
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
  </main>"""
    ld = [
        itemlist_ld(
            "Top Custom Home Builders in Edmonds / King & Snohomish Counties, WA",
            desc,
            firms,
            include_ppg=True,
        ),
        faq_ld(faqs),
    ]
    return page_shell(title, desc, slug, body, ld, canonical=f"{BASE_URL}{slug}.html")



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
          <div class="bg-white h-48 w-full rounded-lg flex items-center justify-center border border-white/10 shadow-inner">
            <div class="text-center px-4">
              <i class="fas fa-house-chimney text-5xl text-slate-800 mb-3"></i>
              <h3 class="text-slate-900 text-lg font-black uppercase tracking-widest leading-snug">Pacific Pro Group</h3>
              <p class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Edmonds, WA</p>
            </div>
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
              <p class="text-secondary font-bold text-xs uppercase tracking-[0.2em] mb-1">Rank #1</p>
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

    body = f"""{hero(
        f"Edmonds Authority · Top 30 · Updated {YEAR}",
        'Edmonds Custom Home Builders<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">Top 30 Editorial Directory</span>',
        "An Edmonds-first ranking of custom home and design-build firms serving Edmonds and greater King &amp; Snohomish Counties — curated by The Board of Project Stewardship.",
        ["Top 30 rankings", "Permit guide", "Local planning tools"],
    )}
  <main class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
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
  </main>
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
        ),
        faq_ld(faqs),
    ]
    return page_shell(
        title,
        desc,
        active,
        body,
        ld,
        canonical=f"{BASE_URL}{slug}.html",
        keywords=keywords,
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
  <main class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
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
  </main>"""
    ld = [
        itemlist_ld(
            "Top Commercial Contractors in Edmonds / King & Snohomish Counties, WA",
            desc,
            firms,
            include_ppg=False,
        ),
        faq_ld(faqs),
    ]
    return page_shell(title, desc, slug, body, ld, canonical=f"{BASE_URL}{slug}.html")


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
  <main class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
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
  </main>"""
    ld = [
        itemlist_ld(
            "Spec & Production Home Builders in Edmonds / King & Snohomish Counties, WA",
            desc,
            firms,
            include_ppg=False,
        ),
        faq_ld(faqs),
    ]
    return page_shell(title, desc, slug, body, ld, canonical=f"{BASE_URL}{slug}.html")


def build_trades_hub() -> str:
    cards = []
    for slug, title, icon, blurb in TRADES:
        cards.append(f"""        <a href="./{slug}.html" class="bg-charcoal border border-white/5 hover:border-primary/40 p-6 rounded-xl card-hover block no-underline">
          <div class="text-secondary text-2xl mb-3"><i class="fas {icon}"></i></div>
          <h2 class="text-lg font-bold text-white mb-2">{esc(title)}</h2>
          <p class="text-sm text-slate-400 font-light leading-relaxed">{esc(blurb)}</p>
          <span class="inline-block mt-4 text-xs font-bold uppercase tracking-wider text-secondary">View directory <i class="fas fa-arrow-right ml-1"></i></span>
        </a>""")
    body = f"""{hero(
        f"Trade directories · Updated {YEAR}",
        'Trade Contractors<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">Edmonds / King &amp; Snohomish</span>',
        "Editorial shortlists of specialty trade contractors that homeowners and GCs use alongside remodel and addition projects.",
        ["14 trade pages", "Locality-first", "Verify at L&amp;I"],
    )}
  <main class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
    <section class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
{chr(10).join(cards)}
    </section>
    <section class="bg-charcoal rounded-xl p-8 border border-white/10 mb-8">
      <h2 class="text-xl font-black text-white mb-3">How to use these lists</h2>
      <p class="text-slate-300 text-sm font-light leading-relaxed">These are editorial directories, not paid placement. Prefer Edmonds / South Snohomish specialists when locality matters; broader metro multi-trade firms are included when they clearly serve the area. Always re-verify licenses at <a href="{LNI_URL}" class="text-secondary hover:underline" target="_blank" rel="noopener">WA L&amp;I</a> before hiring.</p>
    </section>
  </main>"""
    return page_shell(
        "Trade Contractors in Edmonds | Board of Project Stewardship",
        "Editorial directories of plumbers, electricians, HVAC, roofing, and other trade contractors serving Edmonds and King & Snohomish Counties, WA.",
        "trades",
        body,
        canonical=f"{BASE_URL}trades.html",
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
  <main class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
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
  </main>"""
    schema = "HomeAndConstructionBusiness"
    ld = [
        itemlist_ld(
            f"{title} Contractors — Edmonds / King & Snohomish, WA",
            blurb,
            firms,
            include_ppg=False,
            schema_type=schema,
        ),
        faq_ld(faqs),
    ]
    return page_shell(
        f"{title} Contractors in Edmonds | Board of Project Stewardship",
        f"{blurb} Editorial directory for Edmonds and King & Snohomish Counties, WA.",
        "trades",
        body,
        ld,
        canonical=f"{BASE_URL}{slug}.html",
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

    def close_lists():
        nonlocal in_ul, in_ol, out
        if in_ul:
            out.append("</ul>")
            in_ul = False
        if in_ol:
            out.append("</ol>")
            in_ol = False

    def inline(s: str) -> str:
        s = esc(s)
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
            out.append(f"<p>{inline(line.strip())}</p>")
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
    cards = []
    for p in posts:
        cards.append(f"""        <article class="bg-charcoal border border-white/5 hover:border-primary/30 p-6 rounded-xl card-hover">
          <div class="text-[11px] uppercase tracking-widest text-secondary font-bold mb-2">{esc(p['category'])} · {esc(p['date'])}</div>
          <h2 class="text-xl font-bold text-white mb-2"><a href="./posts/{esc(p['out_name'])}" class="hover:text-secondary transition">{esc(p['title'])}</a></h2>
          <p class="text-sm text-slate-400 font-light leading-relaxed mb-4">{esc(p['description'])}</p>
          <p class="text-xs text-slate-500">By {AUTHOR}</p>
        </article>""")
    body = f"""{hero(
        f"Guides &amp; local insights · {YEAR}",
        'Project Stewardship Blog<span class="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-secondary via-white to-secondary">Edmonds &amp; North Sound</span>',
        "Practical hiring, permitting, and remodel guidance from Board of Project Stewardship Editorial.",
        ["Local SEO guides", "Hiring checklists", "Permit basics"],
    )}
  <main class="max-w-6xl mx-auto px-4 -mt-14 relative z-20 pb-24">
    <div class="grid gap-4 mb-12">
{chr(10).join(cards) if cards else '<p class="text-slate-400">No posts yet.</p>'}
    </div>
  </main>"""
    return page_shell(
        "Blog | Board of Project Stewardship",
        "Local remodel, addition, and hiring guides for Edmonds and King & Snohomish Counties from Board of Project Stewardship Editorial.",
        "blog",
        body,
        canonical=f"{BASE_URL}blog.html",
    )


def build_post_page(post: dict) -> str:
    article_html = md_to_html(post["body_md"])
    canon = f"{BASE_URL}posts/{post['out_name']}"
    ld = [{
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": post["title"],
        "datePublished": post["date"],
        "dateModified": post["date"],
        "description": post["description"],
        "author": {"@type": "Organization", "name": AUTHOR},
        "publisher": {"@type": "Organization", "name": "The Board of Project Stewardship"},
        "mainEntityOfPage": canon,
    }]
    body = f"""  <main class="max-w-3xl mx-auto px-4 py-16 relative z-20">
    <p class="text-sm text-slate-500 mb-6"><a href="../blog.html" class="text-secondary hover:underline">← Blog</a></p>
    <div class="text-[11px] uppercase tracking-widest text-secondary font-bold mb-3">{esc(post['category'])} · {esc(post['date'])}</div>
    <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">{esc(post['title'])}</h1>
    <p class="text-sm text-slate-500 mb-10">By {AUTHOR}</p>
    <div class="prose-bops">
{article_html}
    </div>
  </main>"""
    return page_shell(
        f"{post['title']} | Board of Project Stewardship",
        post["description"] or post["title"],
        "blog",
        body,
        ld,
        prefix="../",
        canonical=canon,
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

**https://theboardofprojectstewardship.github.io/-The-Board-of-Project-Stewardship/**

(Note the leading hyphen in the repository name — use relative links in the site.)

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

Multi-page static site. Tailwind CDN + Font Awesome. Relative links for GitHub Pages. JSON-LD `ItemList`, `FAQPage`, and blog `Article` where applicable.

## Updates

Rankings researched / updated **{YEAR}**.
"""
    (SITE_DIR / "README.md").write_text(text, encoding="utf-8")


def main() -> None:
    additions_path = WORKSPACE / "top30-addition-contractors.md"
    kb_path = WORKSPACE / "bops-research-kitchen-bath.md"
    ccs_path = WORKSPACE / "bops-research-custom-commercial-spec.md"
    edmonds_path = WORKSPACE / "bops-research-edmonds-custom.md"
    trades_path = WORKSPACE / "bops-research-trades.md"

    additions = parse_additions_top30(additions_path)
    kitchen, bathrooms = parse_kitchen_bath(kb_path)
    custom_homes, commercial, spec_homes = parse_custom_commercial_spec(ccs_path)
    edmonds_custom = parse_edmonds_custom(edmonds_path)
    trades_data = parse_trades(trades_path)

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

    write_readme(posts)
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
    print("Done.")


if __name__ == "__main__":
    main()
