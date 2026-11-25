#!/usr/bin/env python3
"""BOPS internal-linking + YouTube-links pass.

Method: see METHOD.md (adapted from @asaio87's "internal linking on autopilot" thread).

Commands (run from anywhere; --repo defaults to /workspace/bops-repo):
  plan             Build the review table (plan.json + plan.md). Changes nothing.
  apply            Apply the plan to posts/*.md and news/*.md AND patch the matching published
                   HTML in place (so pre-existing generator drift is never pulled into the PR).
                   Writes changelog.json (for revert). Idempotent: the Related line and the
                   YouTube block are refreshed from youtube_map.json; inline links are added once.
  sync-youtube     Read the channel's public RSS feed and append videos missing from
                   youtube_map.json (title pattern "N Best <service> in <Place>, WA").
  verify           curl every new internal URL and YouTube URL (200 + public + on our channel).
  report           Print counts from changelog.json.

Rules enforced (see METHOD.md): 3-6 new internal links per page, one link per target, never to
itself, none in headings / intro / Key Takeaways / PPG sections / existing links / figcaptions,
anchors only wrap words already on the page, nothing else in the prose is rewritten. No Pacific
Pro Group mention is added. Pages dated 2026-11-25 or later are skipped unless --include-new.
"""
from __future__ import annotations

import argparse, csv, hashlib, html, json, re, sys, time, urllib.request, urllib.error
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
CHANNEL_ID = "UCpej558rCLbYWTt3tEW6a5A"
LIVE = "https://boardofprojectstewardship.com/"
SKIP_FROM = "2026-11-25"          # Nexus ships these with its own links
MAX_INLINE, MAX_NEW = 4, 6
YT_HEADING = "Watch on the Board's YouTube"
REL_LABEL = "Related on the Board:"

def esc(s: str) -> str:
    return html.escape(s or "", quote=True)

# ---------------------------------------------------------------- geography / services
CITIES = {  # slug: (Display, county slug)
 "edmonds": ("Edmonds", "snohomish-county"), "lynnwood": ("Lynnwood", "snohomish-county"),
 "mountlake-terrace": ("Mountlake Terrace", "snohomish-county"), "mukilteo": ("Mukilteo", "snohomish-county"),
 "mill-creek": ("Mill Creek", "snohomish-county"), "everett": ("Everett", "snohomish-county"),
 "marysville": ("Marysville", "snohomish-county"), "monroe": ("Monroe", "snohomish-county"),
 "lake-stevens": ("Lake Stevens", "snohomish-county"), "woodway": ("Woodway", "snohomish-county"),
 "brier": ("Brier", "snohomish-county"), "arlington": ("Arlington", "snohomish-county"),
 "stanwood": ("Stanwood", "snohomish-county"), "sultan": ("Sultan", "snohomish-county"),
 "granite-falls": ("Granite Falls", "snohomish-county"), "gold-bar": ("Gold Bar", "snohomish-county"),
 "darrington": ("Darrington", "snohomish-county"), "skykomish": ("Skykomish", "king-county"),
 "seattle": ("Seattle", "king-county"), "ballard": ("Ballard", "king-county"),
 "greenwood": ("Greenwood", "king-county"), "magnolia": ("Magnolia", "king-county"),
 "phinney-ridge": ("Phinney Ridge", "king-county"), "queen-anne": ("Queen Anne", "king-county"),
 "bellevue": ("Bellevue", "king-county"), "kirkland": ("Kirkland", "king-county"),
 "redmond": ("Redmond", "king-county"), "bothell": ("Bothell", "king-county"),
 "kenmore": ("Kenmore", "king-county"), "shoreline": ("Shoreline", "king-county"),
 "lake-forest-park": ("Lake Forest Park", "king-county"), "woodinville": ("Woodinville", "king-county"),
 "sammamish": ("Sammamish", "king-county"), "issaquah": ("Issaquah", "king-county"),
 "mercer-island": ("Mercer Island", "king-county"), "renton": ("Renton", "king-county"),
 "kent": ("Kent", "king-county"), "auburn": ("Auburn", "king-county"),
 "federal-way": ("Federal Way", "king-county"), "burien": ("Burien", "king-county"),
 "tukwila": ("Tukwila", "king-county"), "seatac": ("SeaTac", "king-county"),
 "des-moines": ("Des Moines", "king-county"), "covington": ("Covington", "king-county"),
 "maple-valley": ("Maple Valley", "king-county"), "snoqualmie": ("Snoqualmie", "king-county"),
 "north-bend": ("North Bend", "king-county"), "duvall": ("Duvall", "king-county"),
 "carnation": ("Carnation", "king-county"), "newcastle": ("Newcastle", "king-county"),
 "medina": ("Medina", "king-county"), "clyde-hill": ("Clyde Hill", "king-county"),
 "yarrow-point": ("Yarrow Point", "king-county"), "hunts-point": ("Hunts Point", "king-county"),
 "enumclaw": ("Enumclaw", "king-county"), "normandy-park": ("Normandy Park", "king-county"),
}
COUNTIES = {"king-county": "King County", "snohomish-county": "Snohomish County"}
MAIN_SERVICES = {"kitchen", "bathroom", "additions", "custom-homes", "adu"}
SERVICE_KW = {
 "adu": r"\badus?\b|dadu|accessory dwelling|backyard cottage",
 "kitchen": r"kitchen", "bathroom": r"bath(?:room)?s?\b|shower|\btub\b|waterproof",
 "additions": r"addition|second[- ]story|sunroom|primary suite|dormer|\bgarage|bump[- ]out",
 "custom-homes": r"custom home|new home|teardown|spec home|new construction|home ?builder",
 "electrician": r"electric", "plumber": r"plumb|side sewer|\bsewer", "hvac": r"\bhvac|heat pump|furnace|ductless",
 "roofing": r"\broof", "concrete": r"concrete|foundation|slab", "excavation": r"excavat|grading|site work",
 "framing": r"\bframing\b|carpentr", "drywall": r"drywall", "painting": r"\bpaint", "flooring": r"flooring|hardwood floor",
 "windows": r"\bwindows?\b|\bdoors?\b", "insulation": r"insulat", "siding": r"\bsiding", "tile": r"\btile",
}

# ---------------------------------------------------------------- target catalog
# (path from site root, label for Related line, tags, aliases [longest-first handled in code])
CATALOG = [
 ("additions.html", "home addition contractors in King and Snohomish counties", {"s": ["additions"]},
   ["home addition contractors", "addition contractors", "home addition builders", "addition builders"]),
 ("kitchen.html", "kitchen remodelers in King and Snohomish counties", {"s": ["kitchen"]},
   ["kitchen remodelers", "kitchen remodeling contractors", "kitchen remodel contractors"]),
 ("bathrooms.html", "bathroom remodelers in King and Snohomish counties", {"s": ["bathroom"]},
   ["bathroom remodelers", "bathroom remodeling contractors", "bathroom remodel contractors"]),
 ("custom-homes.html", "custom home builders in King and Snohomish counties", {"s": ["custom-homes"]},
   ["custom home builders", "custom homebuilders"]),
 ("edmonds-custom-homes.html", "Edmonds custom home builders", {"s": ["custom-homes"], "p": ["edmonds"]},
   ["Edmonds custom home builders"]),
 ("trades.html", "trade contractors in King and Snohomish counties", {"s": []},
   ["trade contractors", "specialty trade contractors", "trade contractor directory"]),
 ("permits.html", "the permit jurisdiction hub", {"s": []},
   ["permit jurisdiction hub", "permit jurisdictions", "permit jurisdiction", "permitting jurisdiction", "which permit office", "permit office", "permit applications", "permitting process", "permit requirements", "building permits", "building permit"]),
 ("build-here.html", "the What Can I Build Here? lot report", {"s": ["additions", "custom-homes"]},
   ["what can I build here", "what you can build", "can I build", "lot feasibility", "feasibility report", "lot report", "feasibility study"]),
 ("verify-contractor.html", "how to verify a WA contractor", {"s": []},
   ["verify a contractor", "verifying a contractor", "verify the contractor", "verify a WA contractor", "contractor license check", "check a contractor's license", "check the contractor's license", "verify the license", "contractor registration", "contractor's license", "contractor license", "registered contractor", "license lookup"]),
 ("hiring-a-contractor.html", "hiring a contractor", {"s": []},
   ["hiring a general contractor", "hiring a contractor", "hire a general contractor", "hire a contractor", "choosing a contractor", "choose a contractor", "hiring a remodeler", "how to hire a contractor"]),
 ("hire-questions.html", "questions to ask before you hire", {"s": []},
   ["interview questions", "questions to ask a contractor", "questions to ask before you hire", "questions to ask before hiring"]),
 ("red-flags-hiring.html", "red flags when hiring", {"s": []}, ["red flags when hiring", "contractor red flags", "red flags"]),
 ("bid-comparison.html", "the bid comparison checklist", {"s": []},
   ["bid comparison", "compare bids", "comparing bids", "compare the bids", "compare proposals", "comparing proposals", "written bids", "multiple bids", "three bids", "apples-to-apples", "side-by-side bids"]),
 ("change-orders.html", "change orders and allowances", {"s": []}, ["change orders", "change order", "change-order", "allowances and change orders"]),
 ("contractor-contract-basics.html", "contractor contract basics", {"s": []},
   ["contract basics", "written contract", "contractor contract", "contract terms", "written scope of work", "scope of work"]),
 ("bonds-and-insurance.html", "WA contractor bonds and insurance", {"s": []},
   ["bonds and insurance", "bond and insurance", "bonded and insured", "contractor bond", "contractor's bond", "surety bond", "liability insurance", "general liability", "certificate of insurance", "proof of insurance"]),
 ("financing-and-draws.html", "financing and draw schedules", {"s": []}, ["draw schedule", "draw schedules", "financing and draws", "construction draws", "progress payments", "payment schedule"]),
 ("project-timeline.html", "project timeline phases", {"s": []}, ["project timeline", "construction timeline", "remodel timeline", "project schedule", "project phases"]),
 ("living-through-remodel.html", "living through a remodel", {"s": []}, ["living through a remodel", "living in the house during"]),
 ("design-build-vs-bid.html", "design-build vs bid-build", {"s": []}, ["design-build vs bid-build", "design-build versus bid-build", "design-build and bid-build", "design-build vs. bid", "design-bid-build", "bid-build", "design-build process", "design-build approach"]),
 ("kitchen-remodel-planning.html", "kitchen remodel planning", {"s": ["kitchen"]}, ["kitchen remodel planning", "plan a kitchen remodel", "planning a kitchen remodel"]),
 ("kitchen-cost-factors.html", "kitchen cost factors", {"s": ["kitchen"]}, ["kitchen cost factors", "kitchen remodel costs", "kitchen remodel cost", "kitchen costs", "kitchen budget", "cost of a kitchen remodel"]),
 ("bathroom-waterproofing-guide.html", "the bathroom waterproofing guide", {"s": ["bathroom"]}, ["bathroom waterproofing", "shower waterproofing", "waterproofing guide", "waterproofing"]),
 ("bathroom-cost-factors.html", "bathroom cost factors", {"s": ["bathroom"]}, ["bathroom cost factors", "bathroom remodel costs", "bathroom remodel cost", "bathroom costs", "bathroom budget", "cost of a bathroom remodel"]),
 ("home-addition-planning.html", "home addition planning", {"s": ["additions"]}, ["home addition planning", "planning a home addition", "plan a home addition", "planning an addition"]),
 ("addition-cost-factors.html", "home addition cost factors", {"s": ["additions"]}, ["addition cost factors", "home addition costs", "home addition cost", "addition costs", "addition budget", "cost of a home addition"]),
 ("second-story-vs-teardown.html", "second story vs teardown", {"s": ["additions", "custom-homes"]}, ["second story vs teardown", "second-story addition or a teardown", "second story versus teardown"]),
 ("adu-checklist.html", "the ADU readiness checklist", {"s": ["adu"]}, ["ADU checklist", "ADU readiness checklist", "ADU readiness"]),
 ("adu-cost-factors.html", "ADU cost factors", {"s": ["adu"]}, ["ADU cost factors", "ADU costs", "ADU cost", "ADU budget", "cost of an ADU"]),
 ("adu.html", "ADU planning", {"s": [], "p": ["edmonds"]}, ["ADU planning", "ADU planning hub"]),
 ("remodel-cost-factors.html", "remodel cost factors", {"s": []}, ["remodel cost factors", "remodeling costs", "remodel costs"]),
 ("energy-credit.html", "the WSEC-R prescriptive credit worksheet", {"s": []}, ["WSEC-R credits", "WSEC-R", "prescriptive energy credits", "energy credit worksheet", "energy credits", "energy credit"]),
 ("how-we-rank.html", "how the Board ranks contractors", {"s": []}, ["how the Board ranks", "how we rank"]),
 ("videos.html", "the Board video library", {"s": []}, ["video library"]),
 ("glossary.html", "the remodel glossary", {"s": []}, ["glossary"]),
 ("electrician.html", "electrician and electrical directory", {"s": ["electrician"]}, ["electrical contractors", "licensed electricians", "electricians", "electrical contractor"]),
 ("plumber.html", "plumber and plumbing directory", {"s": ["plumber"]}, ["plumbing contractors", "licensed plumbers", "plumbers", "plumbing contractor"]),
 ("hvac.html", "HVAC directory", {"s": ["hvac"]}, ["HVAC contractors", "HVAC contractor", "HVAC installers"]),
 ("roofing.html", "roofing directory", {"s": ["roofing"]}, ["roofing contractors", "roofing contractor", "roofers"]),
 ("concrete.html", "concrete and foundation directory", {"s": ["concrete"]}, ["concrete contractors", "foundation contractors", "concrete contractor"]),
 ("excavation.html", "excavation and site work directory", {"s": ["excavation"]}, ["excavation contractors", "excavation contractor", "site work contractors"]),
 ("framing.html", "framing and carpentry directory", {"s": ["framing"]}, ["framing contractors", "framing contractor", "framers"]),
 ("drywall.html", "drywall directory", {"s": ["drywall"]}, ["drywall contractors", "drywall contractor", "drywall finishers"]),
 ("painting.html", "painting directory", {"s": ["painting"]}, ["painting contractors", "painting contractor", "painters"]),
 ("flooring.html", "flooring directory", {"s": ["flooring"]}, ["flooring contractors", "flooring contractor", "flooring installers"]),
 ("windows.html", "windows and doors directory", {"s": ["windows"]}, ["window installers", "window contractors", "windows and doors contractors"]),
 ("insulation.html", "insulation directory", {"s": ["insulation"]}, ["insulation contractors", "insulation contractor", "insulation installers"]),
 ("siding.html", "siding directory", {"s": ["siding"]}, ["siding contractors", "siding contractor", "siding installers"]),
 ("tile.html", "tile directory", {"s": ["tile"]}, ["tile contractors", "tile contractor", "tile installers", "tile setters"]),
 ("restoration.html", "water, fire and mold restoration", {"s": []}, ["restoration contractors", "water damage restoration", "mold remediation"]),
]
# City / county hubs get descriptive aliases generated per place.
HUB_SUFFIX = ["remodel guides", "remodeling", "home additions?", "home addition", "kitchen remodels?", "bathroom remodels?", "permits?", "remodel", "remodels"]
GENERIC_TARGETS = {"permits.html", "verify-contractor.html", "hiring-a-contractor.html", "hire-questions.html",
                   "bid-comparison.html", "change-orders.html", "contractor-contract-basics.html",
                   "bonds-and-insurance.html", "red-flags-hiring.html", "remodel-cost-factors.html"}
SKIP_SECTION = re.compile(r"Pacific Pro Group|\bPPG\b|Key Takeaways|Sources?\b|Related|Watch on the Board|Questions or corrections|Contact", re.I)
SKIP_BLOCK = re.compile(r"Pacific Pro Group|\bPPG\b|Questions or corrections|Corrections or tips|editorial@boardofprojectstewardship", re.I)

# ---------------------------------------------------------------- page model
class Page:
    def __init__(self, kind: str, md_path: Path, repo: Path):
        self.kind, self.md_path, self.repo = kind, md_path, repo
        self.text = md_path.read_text(encoding="utf-8")
        m = re.match(r"^---\n(.*?)\n---\n?(.*)$", self.text, re.S)
        self.fm_raw, self.body = (m.group(1), m.group(2)) if m else ("", self.text)
        self.meta = {}
        for ln in self.fm_raw.splitlines():
            if ":" in ln and not ln.startswith((" ", "-")):
                k, v = ln.split(":", 1); self.meta[k.strip()] = v.strip().strip('"').strip("'")
        stem = md_path.stem
        if kind == "post":
            self.rel = f"posts/{stem}.html"; self.date = stem[:10]
        else:
            self.slug = self.meta.get("slug") or stem[11:]
            self.rel = f"news/{self.slug}.html"; self.date = self.meta.get("date") or stem[:10]
        self.title = self.meta.get("title", stem)
        self.html_path = repo / self.rel
        self.html = self.html_path.read_text(encoding="utf-8") if self.html_path.exists() else ""
        self.slugtext = (stem + " " + self.title).lower().replace("-", " ")
        self.places, self.services = self._classify()

    def _classify(self):
        t = (self.title + " " + stem_slug(self.md_path.stem)).lower()
        clean = re.sub(rf"## {re.escape(YT_HEADING)}\n+(?:- [^\n]*(?:\n|$))+", "", self.body)
        clean = re.sub(rf"\*\*{re.escape(REL_LABEL)}\*\* [^\n]*", "", clean)   # generated blocks never feed classification
        body = (self.meta.get("description", "") + " " + clean).lower()
        places = defaultdict(float)
        for slug, (name, cty) in CITIES.items():
            n = name.lower()
            if re.search(rf"\b{re.escape(n)}\b", t): places[slug] += 5
            places[slug] += min(len(re.findall(rf"\b{re.escape(n)}\b", body)), 8) * 0.4
        city_meta = (self.meta.get("city") or "").lower()
        for slug, (name, _) in CITIES.items():
            if name.lower() == city_meta: places[slug] += 5
        for c, label in COUNTIES.items():
            if label.lower() in t: places[c] += 3
            places[c] += min(body.count(label.lower()), 5) * 0.3
        services = defaultdict(float)
        for s, rx in SERVICE_KW.items():
            services[s] += 5 * len(re.findall(rx, t))
            if s in MAIN_SERVICES: services[s] += min(len(re.findall(rx, body)), 12) * 0.3
        cat = (self.meta.get("category") or "").lower()
        for s, w in (("kitchen", "kitchen"), ("bathroom", "bath"), ("additions", "addition")):
            if w in cat: services[s] += 4
        for c, label in COUNTIES.items():
            if c in places and places[c] < 2.4 and label.lower() not in t: places[c] = 0
        return ({k: v for k, v in places.items() if v >= 2.4}, {k: v for k, v in services.items() if v >= 3.0})

def stem_slug(stem: str) -> str:
    return re.sub(r"^\d{4}-\d{2}-\d{2}-", "", stem).replace("-", " ")

def load_pages(repo: Path, include_new: bool):
    pages = []
    for kind, d in (("post", "posts"), ("news", "news")):
        for p in sorted((repo / d).glob("*.md")):
            if p.name.startswith("_"): continue
            if p.name[:10] >= SKIP_FROM and not include_new: continue
            pg = Page(kind, p, repo)
            if pg.html: pages.append(pg)
    return pages

# ---------------------------------------------------------------- html helpers
def prose_span(h: str):
    m = re.search(r'<div class="[^"]*\bprose-board\b[^"]*">', h)
    if not m: return None
    depth, pos = 1, m.end()
    for t in re.finditer(r"<(/?)div\b[^>]*>", h[pos:]):
        depth += -1 if t.group(1) else 1
        if depth == 0: return (m.end(), pos + t.start())
    return None

FORBID_RX = re.compile(r"<a\b.*?</a>|<h[1-6]\b.*?</h[1-6]>|<figure\b.*?</figure>|<figcaption\b.*?</figcaption>|<script\b.*?</script>|<style\b.*?</style>|<iframe\b.*?</iframe>|<[^>]+>", re.S | re.I)

def forbidden_spans(h: str):
    return [(m.start(), m.end()) for m in FORBID_RX.finditer(h)]

def overlaps(spans, a, b):
    return any(s < b and a < e for s, e in spans)

def existing_hrefs(h: str):
    return set(re.findall(r'href="([^"]+)"', h))

def norm_target(href: str, page_rel: str) -> str:
    href = href.split("#")[0].split("?")[0]
    if href.startswith("http"):
        href = href.replace(LIVE, "").replace("https://www.boardofprojectstewardship.com/", "")
        return href if not href.startswith("http") else href
    base = Path(page_rel).parent
    return str((base / href).resolve().relative_to(Path("/").resolve())) if False else _normpath(base, href)

def _normpath(base: Path, href: str) -> str:
    parts = [] if str(base) == "." else list(base.parts)
    for seg in href.split("/"):
        if seg in ("", "."): continue
        if seg == "..": parts and parts.pop()
        else: parts.append(seg)
    return "/".join(parts)

def rel_href(from_rel: str, to_rel: str) -> str:
    fd = Path(from_rel).parent.as_posix()
    if fd == ".": return to_rel
    td = Path(to_rel).parent.as_posix()
    if fd == td: return Path(to_rel).name
    return "../" + to_rel

# ---------------------------------------------------------------- md block iteration
MASK = "\x00"
def mask_line(line: str) -> str:
    def blank(m): return MASK * len(m.group(0))
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", blank, line)
    s = re.sub(r"\[[^\]]*\]\((?:[^()]|\([^()]*\))*\)", blank, s)
    s = re.sub(r"<[^>]+>", blank, s)
    s = re.sub(r"https?://\S+", blank, s)
    s = re.sub(r"`[^`]*`", blank, s)
    s = re.sub(r"\*\*[^*]+\*\*", blank, s)
    s = re.sub(r"(?<!\*)\*[^*]+\*(?!\*)", blank, s)
    return s

def eligible_lines(body: str, kind: str):
    """Yield (line_index, text) for md lines allowed to carry an inline link."""
    lines = body.splitlines()
    seen_h2, skip = False, False
    paras = 0
    out = []
    for i, ln in enumerate(lines):
        st = ln.strip()
        if not st: continue
        if st.startswith("#"):
            if ln.startswith("## "):
                seen_h2 = True
                skip = bool(SKIP_SECTION.search(ln))
            continue
        if st.startswith("!") or st.startswith("[[") or st.startswith("tool:") or st.startswith("video:") or st.endswith(".mp4"): continue
        if re.match(r"^(https?://|youtube:)", st): continue
        is_block = bool(re.match(r"^([-*] |\d+\. )", st)) or True
        paras += 1
        if skip or SKIP_BLOCK.search(ln): continue
        if kind == "post" and not seen_h2: continue      # intro + Key Takeaways lead
        if paras <= (2 if kind == "news" else 0): continue  # news lede / nut graf
        out.append((i, ln))
    return lines, out

# ---------------------------------------------------------------- planning
def build_targets(repo: Path, pages, gsc):
    targets = {}
    def add(rel, label, tags, aliases, kind="page"):
        if (repo / rel).exists():
            targets[rel] = {"rel": rel, "label": label, "tags": tags, "aliases": aliases, "kind": kind}
    for rel, label, tags, aliases in CATALOG:
        add(rel, label, tags, aliases)
    for slug, (name, cty) in CITIES.items():
        al = [f"{name} {s}" for s in HUB_SUFFIX if "?" not in s] + [f"{name} home additions", f"{name} kitchen remodels", f"{name} bathroom remodels", f"{name} permits"]
        add(f"{slug}.html", f"{name} remodel and addition guides", {"p": [slug], "s": []}, al + [f"{name} remodeling"], "city")
    for c, name in COUNTIES.items():
        add(f"{c}.html", f"{name} remodel and addition hub", {"p": [c], "s": []},
            [f"{name} remodel guides", f"{name} permits", f"{name} home additions", f"{name} remodeling", f"{name} remodel"], "county")
    # Bare place-name anchors: lowest priority, hub pages only.
    for rel, t in list(targets.items()):
        if t["kind"] == "city": t["bare"] = CITIES[rel[:-5]][0]
        if t["kind"] == "county": t["bare"] = COUNTIES[rel[:-5]]
    for pg in pages:
        short = pg.title.split(" — ")[0].split(" | ")[0].strip()
        label = short if len(short) <= 100 else pg.title[:97].rsplit(" ", 1)[0] + "…"
        al = []
        mt = re.match(r"^(.+?)\s+(" + "|".join(re.escape(v[0]) for v in CITIES.values()) + r")\s+WA\b", short)
        if mt and len(mt.group(1).split()) >= 2:
            topic = mt.group(1).strip()
            al = [f"{topic.lower()} in {mt.group(2)}", f"{mt.group(2)} {topic.lower()}"]
        targets[pg.rel] = {"rel": pg.rel, "label": label, "tags": {"p": list(pg.places), "s": list(pg.services)},
                           "aliases": al, "kind": pg.kind, "page": pg}
    for rel, t in targets.items():           # GSC-derived anchors (optional)
        qs = gsc.get(rel, [])
        t["aliases"] = [q["query"] for q in qs if q["position"] <= 15 and len(q["query"].split()) >= 2] + t["aliases"]
        t["gsc_pos"] = min([q["position"] for q in qs], default=None)
    return targets

def relevance(pg: Page, t: dict, inbound: dict) -> float:
    sc = 0.0
    for s in t["tags"].get("s", []):
        if s in pg.services: sc += 3
    for p in t["tags"].get("p", []):
        if p in pg.places: sc += 3 + min(pg.places[p], 6) * 0.1
        elif p in COUNTIES and any(CITIES.get(c, ("", ""))[1] == p for c in pg.places): sc += 1.5
    if t["rel"] in GENERIC_TARGETS: sc += 1.5
    if t["kind"] in ("post", "news"):
        if t["kind"] != pg.kind: return -1       # repo contract: news and blog never link to each other (tests/test_news.py)
        pos = t["page"]
        top = lambda d: set(sorted(d, key=lambda k: -d[k])[:2])
        shared_s = len(top(pg.services) & top(pos.services)); shared_p = len(top(pg.places) & top(pos.places))
        if shared_p == 0 and shared_s < 1: return -1
        sc = shared_s * 2 + shared_p * 3
        if sc < 3: return -1
        if t["kind"] == "news" and pg.kind == "post": sc -= 0.5
        if pg.kind == "news" and t["kind"] == "post" and not (shared_s >= 1 and shared_p >= 1): return -1
        n = inbound.get(t["rel"], 0); return sc - 0.6 * n
    if t.get("gsc_pos") and 4 <= t["gsc_pos"] <= 15: sc += 2          # thread: prioritize pages ranking 4-15
    n = inbound.get(t["rel"], 0); sc -= 1.5 * n / (n + 25)                              # spread links to under-linked pages
    return sc

def alias_regex(a: str, exact_case: bool = False):
    pat = re.escape(a).replace(r"\ ", r"\s+")
    return re.compile(rf"(?<![\w-]){pat}(?![\w-])", 0 if exact_case else re.I)

def find_inline(pg: Page, lines, elig, t, used_lines, forb, prose_html, spans, bare_ok):
    """Return a placement dict or None. Placement = unique, markup-free occurrence in md and html."""
    names = sorted(t["aliases"], key=len, reverse=True) + ([t["bare"]] if bare_ok and t.get("bare") else [])
    for alias in names:
        is_bare = alias == t.get("bare")
        rx = alias_regex(alias, exact_case=is_bare)
        for i, ln in elig:
            if used_lines.get(i, 0) >= 1: continue
            masked = mask_line(ln)
            for m in rx.finditer(masked):
                a, b = m.start(), m.end()
                phrase = ln[a:b]
                if is_bare and (a == 0 or re.match(r"\s*[—–-]", ln[b:b+3]) or ln[:a].strip() in ("-", "*") or re.match(r"^(?:[-*]|\d+\.)\s+$", ln[:a])): continue
                if is_bare:   # bare place names: never inside proper names ("Seattle City Light", "City of Seattle")
                    if re.match(r"\s+[A-Z]", ln[b:b+3]) or re.search(r"(?:City|Town|Port|County|University|Department|State) of\s+$", ln[max(0, a-20):a], re.I): continue
                if MASK in phrase or "\x00" in ln[max(0, a-1):b+1] and False: continue
                left = re.split(r"[\[\]*`<>]", ln[max(0, a-32):a])[-1]
                right = re.split(r"[\[\]*`<>]", ln[b:b+32])[0]
                pat = esc(left) + esc(phrase) + esc(right)
                hits = [h for h in re.finditer(re.escape(pat), prose_html)]
                good = []
                for h in hits:
                    s = h.start() + len(esc(left)); e = s + len(esc(phrase))
                    if not overlaps(spans, s, e): good.append((s, e))
                if len(hits) != 1 or len(good) != 1: continue
                # also: phrase must not already sit inside a markdown emphasis in the md line
                return {"line": i, "start": a, "end": b, "phrase": phrase, "alias": alias,
                        "left": left, "right": right, "html_span": good[0]}
    return None

def plan_page(pg: Page, targets, inbound, ytmap, repo, bare_used):
    sp = prose_span(pg.html)
    if not sp: return None
    prose_html = pg.html[sp[0]:sp[1]]
    spans = forbidden_spans(prose_html)
    lines, elig = eligible_lines(pg.body, pg.kind)
    clean_html = re.sub(r"\n?<h2>" + re.escape(esc(YT_HEADING)) + r"</h2>\n<ul>.*?</ul>", "", prose_html, flags=re.S)
    clean_html = re.sub(r"\n?<p><strong>" + re.escape(REL_LABEL) + r"</strong>.*?</p>", "", clean_html, flags=re.S)
    linked = {_normpath(Path(pg.rel).parent, h) if not h.startswith("http") else h for h in existing_hrefs(clean_html)}
    linked.add(pg.rel)
    scored = []
    for rel, t in targets.items():
        if rel in linked or rel == pg.rel: continue
        r = relevance(pg, t, inbound)
        if r <= 0.5: continue
        scored.append((r, rel))
    scored.sort(key=lambda x: (-x[0], x[1]))
    inline, used_lines, used_t = [], {}, set()
    prev = pg_changes.get(pg.rel) if pg_changes else None
    if prev:
        inline = []   # inline links were already applied on an earlier run; never re-add
    else:
        for r, rel in scored:
            if len(inline) >= MAX_INLINE: break
            t = targets[rel]
            pl = find_inline(pg, lines, elig, t, used_lines, None, prose_html, spans, bare_ok=(bare_used.get(pg.rel, 0) < 1))
            if not pl: continue
            if pl["alias"] == t.get("bare"): bare_used[pg.rel] = bare_used.get(pg.rel, 0) + 1
            pl.update({"rel": rel, "score": round(r, 2), "kind": t["kind"]})
            inline.append(pl); used_lines[pl["line"]] = used_lines.get(pl["line"], 0) + 1; used_t.add(rel)
            inbound[rel] = inbound.get(rel, 0) + 1
    n_prev = len(prev["inline"]) if prev else 0
    n_rel = max(2, 3 - (len(inline) + n_prev)); n_rel = min(n_rel, 3)
    rel_items = []
    # one related post/news first (topic match), then hubs / guides
    chosen = []
    qual = [(r, rel) for r, rel in scored if r >= 2.0]
    for want_kinds in (("post", "news"), ("city", "county", "page")):
        for r, rel in qual:
            if len(chosen) >= n_rel: break
            t = targets[rel]
            if rel in used_t or rel in chosen or t["kind"] not in want_kinds: continue
            if want_kinds[0] == "post" and any(targets[c]["kind"] in ("post", "news") for c in chosen): break
            chosen.append(rel)
    if len(chosen) < n_rel:   # generic fallbacks, rotated so they spread
        gen = sorted((g for g in GENERIC_TARGETS if g in targets and g not in linked and g not in used_t and g not in chosen),
                     key=lambda g: hashlib.md5((pg.rel + g).encode()).hexdigest())
        chosen += gen[: n_rel - len(chosen)]
    if prev and prev.get("related") and not STATE.get("refresh_related"):   # sticky: re-runs never reshuffle the Related line
        chosen = [r["target"] for r in prev["related"] if r["target"] in targets]
    for rel in chosen:
        inbound[rel] = inbound.get(rel, 0) + 1
        rel_items.append({"rel": rel, "label": targets[rel]["label"], "kind": targets[rel]["kind"]})
    return {"page": pg.rel, "kind": pg.kind, "md": str(pg.md_path.relative_to(repo)), "inline": inline,
            "related": rel_items, "services": sorted(pg.services, key=lambda s: -pg.services[s])[:3],
            "places": sorted(pg.places, key=lambda s: -pg.places[s])[:3]}

pg_changes = {}
STATE = {}

def inbound_counts(pages):
    c = defaultdict(int)
    for pg in pages:
        for h in existing_hrefs(pg.html):
            if not h.startswith("http"):
                c[_normpath(Path(pg.rel).parent, h.split("#")[0])] += 1
    return c

# ---------------------------------------------------------------- youtube
def load_ytmap():
    d = json.loads((HERE / "youtube_map.json").read_text())
    assert d["channel_id"] == CHANNEL_ID
    return d

def yt_choose(pg: Page, ytmap, taken=()):
    vids = [v for v in ytmap["videos"] if v["id"] not in taken and not v.get("disabled")]
    def score(v):
        s = 0.0
        if v["service"] in pg.services: s += 4 + min(pg.services[v["service"]], 10) * 0.1
        if v["service"] == "general": s += 0.5
        p = v.get("place")
        if p:
            if p in pg.places: s += 4
            elif p in COUNTIES and any(CITIES.get(c, ("", ""))[1] == p for c in pg.places): s += 2
            elif p in CITIES and any(CITIES.get(c, ("", ""))[1] == CITIES[p][1] for c in pg.places): s += 1.5
        if v["kind"] == "short": s += 0.3
        tie = int(hashlib.md5((pg.rel + v["id"]).encode()).hexdigest()[:6], 16) / 0xFFFFFF   # deterministic rotation
        return s + tie * 0.5
    ranked = sorted(vids, key=lambda v: -score(v))
    n = 4 if score(ranked[0]) >= 7 and len([v for v in ranked if score(v) >= 4]) >= 4 else 3
    return ranked[:max(3, n)]

def yt_inline(pg: Page, ytmap, lines, elig, prose_html, spans, used_lines):
    nouns = {"kitchen": ["kitchen remodelers", "kitchen remodeling contractors"], "bathroom": ["bathroom remodelers"],
             "additions": ["home addition contractors", "addition contractors"], "custom-homes": ["custom home builders"]}
    for v in ytmap["videos"]:
        if v["kind"] != "listicle" or v.get("disabled"): continue
        p = v.get("place")
        pname = CITIES[p][0] if p in CITIES else COUNTIES.get(p)
        if not pname: continue
        for noun in nouns.get(v["service"], []):
            aliases = [f"{pname} {noun}", f"{noun} in {pname}"]
            if p in pg.places or (p in COUNTIES and any(CITIES.get(c, ("", ""))[1] == p for c in pg.places)): aliases.append(noun)
            for alias in aliases:
                pl = find_inline(pg, lines, elig, {"aliases": [alias], "bare": None}, used_lines, None, prose_html, spans, False)
                if pl:
                    pl["video"] = v["id"]; return pl
    return None

# ---------------------------------------------------------------- apply
def md_apply(pg: Page, ap: dict, yt: dict, new_inline, related_md):
    body = pg.body
    lines = body.splitlines()
    by_line = defaultdict(list)
    for pl in new_inline: by_line[pl["line"]].append(pl)
    for i, pls in by_line.items():
        for pl in sorted(pls, key=lambda x: -x["start"]):
            ln = lines[i]
            assert ln[pl["start"]:pl["end"]] == pl["phrase"], (pg.rel, pl["phrase"])
            lines[i] = ln[:pl["start"]] + f"[{pl['phrase']}]({pl['href']})" + ln[pl["end"]:]
    # strip previous generated blocks
    txt = "\n".join(lines)
    txt = re.sub(rf"\n*## {re.escape(YT_HEADING)}\n+(?:- [^\n]*(?:\n|$))+", "\n", txt)
    txt = re.sub(rf"\n*\*\*{re.escape(REL_LABEL)}\*\* [^\n]*\n?", "\n", txt)
    txt = txt.rstrip("\n")
    tail = ""
    ls = txt.split("\n")
    if ls and SKIP_BLOCK.search(ls[-1]) and re.search(r"Questions or corrections|Corrections or tips", ls[-1]):
        tail = ls.pop(); txt = "\n".join(ls).rstrip("\n")
    block = related_md + "\n\n" + yt["md"]
    txt = txt + "\n\n" + block + ("\n\n" + tail if tail else "")
    pg.md_path.write_text(f"---\n{pg.fm_raw}\n---\n\n{txt.strip()}\n" if pg.text.startswith("---\n") else txt + "\n", encoding="utf-8")

def html_apply(pg: Page, new_inline, related_html, yt_html):
    h = pg.html
    sp = prose_span(h); s0, s1 = sp
    prose = h[s0:s1]
    for pl in sorted(new_inline, key=lambda x: -x["html_span"][0]):
        a, b = pl["html_span"]
        assert prose[a:b] == esc(pl["phrase"]), (pg.rel, pl["phrase"])
        prose = prose[:a] + f'<a href="{esc(pl["href"])}">{esc(pl["phrase"])}</a>' + prose[b:]
    prose = re.sub(r"\n?<h2>" + re.escape(esc(YT_HEADING)) + r"</h2>\n<ul>.*?</ul>", "", prose, flags=re.S)
    prose = re.sub(r"\n?<p><strong>" + re.escape(REL_LABEL) + r"</strong>.*?</p>", "", prose, flags=re.S)
    trail = re.search(r"\s*$", prose).group(0); prose = prose[: len(prose) - len(trail)]
    if "\n" not in trail: trail = "\n" + trail
    block = related_html + "\n" + yt_html
    ps = [m for m in re.finditer(r"<p>.*?</p>", prose, re.S)]
    if ps and re.search(r"Questions or corrections|Corrections or tips", ps[-1].group(0)) and prose.rstrip().endswith(ps[-1].group(0)):
        at = ps[-1].start()
        prose = prose[:at] + block + "\n" + prose[at:]
    else:
        prose = prose + "\n" + block
    prose += trail
    pg.html_path.write_text(h[:s0] + prose + h[s1:], encoding="utf-8")

def render_related(pg, items, targets):
    parts_md, parts_html = [], []
    for it in items:
        href = rel_href(pg.rel, it["rel"])
        parts_md.append(f"[{it['label']}]({href})"); parts_html.append(f'<a href="{esc(href)}">{esc(it["label"])}</a>')
    def join(ps): return ps[0] if len(ps) == 1 else ", ".join(ps[:-1]) + " and " + ps[-1]
    return (f"**{REL_LABEL}** {join(parts_md)}.", f"<p><strong>{esc(REL_LABEL)}</strong> {join(parts_html)}.</p>")

def render_yt(vids):
    md = f"## {YT_HEADING}\n\n" + "\n".join(f"- [{v['title']}]({v['url']})" for v in vids)
    h = f"<h2>{esc(YT_HEADING)}</h2>\n<ul>\n" + "\n".join(f'<li><a href="{esc(v["url"])}">{esc(v["title"])}</a></li>' for v in vids) + "\n</ul>"
    return {"md": md, "html": h}

# ---------------------------------------------------------------- commands
def load_gsc(path):
    out = defaultdict(list)
    if not path: return out
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            pg = r.get("page") or r.get("Top pages") or ""
            rel = pg.replace("https://boardofprojectstewardship.com/", "").lstrip("/")
            try:
                out[rel].append({"query": (r.get("query") or r.get("Top queries") or "").strip().lower(),
                                 "position": float(r.get("position") or r.get("Position") or 99),
                                 "impressions": float(r.get("impressions") or r.get("Impressions") or 0)})
            except ValueError: pass
    for rel in out: out[rel].sort(key=lambda q: -q["impressions"])
    return out

def build_plan(args):
    global pg_changes
    repo = Path(args.repo)
    ch = HERE / "changelog.json"
    pg_changes = json.loads(ch.read_text()).get("pages", {}) if ch.exists() else {}
    pages = load_pages(repo, args.include_new)
    gsc = load_gsc(args.gsc)
    targets = build_targets(repo, pages, gsc)
    inbound = inbound_counts(pages)
    ytmap = load_ytmap()
    plans, bare_used = [], {}
    for pg in sorted(pages, key=lambda p: p.rel):
        p = plan_page(pg, targets, inbound, ytmap, repo, bare_used)
        if not p: continue
        sp = prose_span(pg.html); prose_html = pg.html[sp[0]:sp[1]]
        lines, elig = eligible_lines(pg.body, pg.kind)
        spans = forbidden_spans(prose_html)
        used_lines = defaultdict(int)
        for pl in p["inline"]: used_lines[pl["line"]] += 1
        vin = yt_inline(pg, ytmap, lines, elig, prose_html, spans, used_lines) if not pg_changes.get(pg.rel) else None
        taken = {vin["video"]} if vin else set()
        if pg_changes.get(pg.rel): taken = {y for y in pg_changes[pg.rel].get("youtube_inline", [])}
        vids = yt_choose(pg, ytmap, taken)
        p["youtube_inline"] = vin
        p["youtube_block"] = [v["id"] for v in vids]
        plans.append(p)
    return plans, targets, ytmap, pages

def cmd_plan(args):
    plans, targets, ytmap, pages = build_plan(args)
    (HERE / "plan.json").write_text(json.dumps(plans, indent=1))
    vt = {v["id"]: v for v in ytmap["videos"]}
    rows = ["| source | anchor | target | score | where |", "|---|---|---|---|---|"]
    for p in plans:
        for pl in p["inline"]:
            rows.append(f"| {p['page']} | {pl['phrase']} | {pl['rel']} | {pl['score']} | inline |")
        if p["youtube_inline"]:
            v = vt[p["youtube_inline"]["video"]]; rows.append(f"| {p['page']} | {p['youtube_inline']['phrase']} | {v['url']} | - | inline YouTube |")
        for it in p["related"]:
            rows.append(f"| {p['page']} | {it['label']} | {it['rel']} | - | Related line |")
        for vid in p["youtube_block"]:
            rows.append(f"| {p['page']} | {vt[vid]['title']} | {vt[vid]['url']} | - | YouTube block |")
    (HERE / "plan.md").write_text("\n".join(rows) + "\n")
    n_in = sum(len(p["inline"]) for p in plans); n_rel = sum(len(p["related"]) for p in plans)
    print(f"plan: {len(plans)} pages, {n_in} inline internal, {n_rel} related-line internal, "
          f"{sum(len(p['youtube_block']) for p in plans)} YouTube block links, {sum(1 for p in plans if p['youtube_inline'])} inline YouTube")

def cmd_apply(args):
    global pg_changes
    plans, targets, ytmap, pages = build_plan(args)
    ch = HERE / "changelog.json"
    log = json.loads(ch.read_text()) if ch.exists() else {"pages": {}}
    vt = {v["id"]: v for v in ytmap["videos"]}
    byrel = {p.rel: p for p in pages}
    for p in plans:
        pg = byrel[p["page"]]
        new_inline = []
        for pl in p["inline"]:
            pl = dict(pl); pl["href"] = rel_href(pg.rel, pl["rel"]); new_inline.append(pl)
        if p["youtube_inline"]:
            pl = dict(p["youtube_inline"]); pl["href"] = vt[pl["video"]]["url"]; new_inline.append(pl)
        # two placements must not share a line span
        rel_md, rel_html = render_related(pg, p["related"], targets)
        ytb = render_yt([vt[v] for v in p["youtube_block"]])
        orig_md = pg.md_path.read_text(); orig_html = pg.html
        html_apply(pg, new_inline, rel_html, ytb["html"])
        md_apply(pg, None, ytb, new_inline, rel_md)
        prev = log["pages"].get(pg.rel, {})
        log["pages"][pg.rel] = {
            "md": p["md"],
            "inline": prev.get("inline", []) + [{"anchor": x["phrase"], "href": x["href"], "target": x.get("rel") or x.get("video")} for x in new_inline if "video" not in x],
            "youtube_inline": prev.get("youtube_inline", []) + [x["video"] for x in new_inline if "video" in x],
            "related": [{"label": i["label"], "target": i["rel"]} for i in p["related"]],
            "youtube_block": p["youtube_block"],
        }
        pg_changes = log["pages"]
    log["generated"] = time.strftime("%Y-%m-%d %H:%M %Z")
    ch.write_text(json.dumps(log, indent=1))
    print(f"applied to {len(plans)} pages")

def http_status(url, method="HEAD"):
    req = urllib.request.Request(url, method=method, headers={"User-Agent": "Mozilla/5.0 bops-link-pass"})
    try:
        with urllib.request.urlopen(req, timeout=25) as r: return r.status
    except urllib.error.HTTPError as e: return e.code
    except Exception: return 0

def cmd_verify(args):
    log = json.loads((HERE / "changelog.json").read_text())
    ytmap = load_ytmap()
    internal, yts = set(), set()
    for rel, c in log["pages"].items():
        base = Path(rel).parent
        for i in c["inline"]: internal.add(_normpath(base, i["href"]))
        for r in c["related"]: internal.add(r["target"])
        yts.update(c["youtube_block"]); yts.update(c.get("youtube_inline", []))
    bad = []
    for rel in sorted(internal):
        s = http_status(LIVE + rel)
        if s != 200: bad.append((LIVE + rel, s))
    print(f"internal URLs checked: {len(internal)}; non-200: {len(bad)}")
    feed = urllib.request.urlopen(f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}", timeout=30).read().decode()
    feed_ids = set(re.findall(r"<yt:videoId>(.*?)<", feed))
    vt = {v["id"]: v for v in ytmap["videos"]}
    for vid in sorted(yts):
        v = vt[vid]
        oe = http_status("https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(v["url"], safe=""), "GET") if False else 0
        try:
            d = json.loads(urllib.request.urlopen("https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote("https://www.youtube.com/watch?v=" + vid, safe=""), timeout=25).read())
            oe_ok = "Board of Project Stewardship" in d.get("author_name", "")
        except Exception: oe_ok = False
        s = http_status(v["url"], "GET")
        ok = vid in feed_ids and oe_ok and s == 200
        print(f"  yt {vid}: feed={vid in feed_ids} oembed_author_ok={oe_ok} http={s} -> {'OK' if ok else 'BAD'}")
        if not ok: bad.append((v["url"], "yt"))
    for b in bad: print("BAD", b)
    sys.exit(1 if bad else 0)

def cmd_sync(args):
    ytmap = load_ytmap()
    feed = urllib.request.urlopen(f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}", timeout=30).read().decode()
    have = {v["id"] for v in ytmap["videos"]}
    svc = [("kitchen", "kitchen remodel"), ("bathroom", "bathroom remodel"), ("additions", "addition"), ("custom-homes", "custom home")]
    added = 0
    for e in re.findall(r"<entry>(.*?)</entry>", feed, re.S):
        vid = re.search(r"<yt:videoId>(.*?)<", e).group(1)
        if vid in have: continue
        title = html.unescape(re.search(r"<title>(.*?)</title>", e).group(1))
        title = re.sub(r"\s*\|\s*Board of Project Stewardship$", "", title)
        short = "#shorts" in title.lower() or "/shorts/" in e
        title = re.sub(r"\s*#Shorts\s*$", "", title, flags=re.I)
        m = re.search(r"Best (.+?) in (.+?), WA", title)
        service, place = "general", None
        if m:
            low = m.group(1).lower(); place_name = m.group(2)
            service = next((s for s, k in svc if k in low), "general")
            pl = place_name.lower().replace(" ", "-")
            place = pl if (pl in CITIES or pl in COUNTIES) else None
            if place is None and place_name.lower().endswith("county"): place = pl
        url = f"https://www.youtube.com/shorts/{vid}" if short else f"https://youtu.be/{vid}"
        ytmap["videos"].append({"id": vid, "url": url, "title": title, "kind": "short" if short else "listicle", "service": service, "place": place})
        added += 1; print("added", vid, title, service, place)
    (HERE / "youtube_map.json").write_text(json.dumps(ytmap, indent=1))
    print(f"sync: {added} new")

def cmd_report(args):
    log = json.loads((HERE / "changelog.json").read_text())
    pages = log["pages"]
    posts = [r for r in pages if r.startswith("posts/")]; news = [r for r in pages if r.startswith("news/")]
    inl = sum(len(c["inline"]) for c in pages.values()); rel = sum(len(c["related"]) for c in pages.values())
    yb = sum(len(c["youtube_block"]) for c in pages.values()); yi = sum(len(c.get("youtube_inline", [])) for c in pages.values())
    print(f"posts {len(posts)}, news {len(news)}, inline internal {inl}, related-line internal {rel}, "
          f"youtube block {yb}, youtube inline {yi}")

if __name__ == "__main__":
    import urllib.parse
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["plan", "apply", "verify", "sync-youtube", "report"])
    ap.add_argument("--repo", default=str(HERE.parents[1]) if (HERE.parents[1] / "posts").is_dir() else "/workspace/bops-repo")
    ap.add_argument("--gsc", help="optional Search Console CSV (page,query,clicks,impressions,position)")
    ap.add_argument("--refresh-related", action="store_true", help="recompute the Related line on pages already in changelog.json")
    ap.add_argument("--include-new", action="store_true", help=f"also touch pages dated {SKIP_FROM} or later")
    a = ap.parse_args()
    STATE['refresh_related'] = a.refresh_related
    {"plan": cmd_plan, "apply": cmd_apply, "verify": cmd_verify, "sync-youtube": cmd_sync, "report": cmd_report}[a.cmd](a)
