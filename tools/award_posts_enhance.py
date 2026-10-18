#!/usr/bin/env python3
"""Interactive blocks for the 2026 Best in the PNW award news story and blog guide.

generate_site.py calls enhance_file() after it writes each news or post page.
Pages without [[ap:...]] placeholders are left alone.
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

PENDING = '<span class="ap-pending">[QUOTE PENDING ALEX APPROVAL]</span>'
NEWS_IMG = "../assets/images/news/"
NEWS_VID = "../assets/videos/news/"
POST_VID = "../assets/videos/posts/"


def loop(base: str, label: str, caption: str) -> str:
    return (
        '<figure class="ap-loop">'
        f'<video muted loop playsinline preload="none" poster="{base}-poster.webp" aria-label="{html.escape(label)}">'
        f'<source src="{base}-720.mp4" type="video/mp4"></video>'
        '<button type="button">Play</button>'
        f"<figcaption>{caption}</figcaption></figure>"
    )


def checklist(key: str, title: str, items: list[str], note: str) -> str:
    lis = "".join(
        f'<li><label><input type="checkbox" value="c{i}"> <span>{t}</span></label></li>' for i, t in enumerate(items)
    )
    return (
        f'<section class="ap-widget ap-check" data-key="{key}" aria-labelledby="{key}-h">'
        f'<h3 id="{key}-h">{title}</h3><p class="ap-note">{note}</p>'
        f'<ul>{lis}</ul><p><span class="ap-progress"></span> '
        '<button type="button" class="ap-reset">Clear checklist</button></p></section>'
    )


CHECK_NOTE = "Your checks are saved in this browser only. Nothing is sent anywhere."

TIMELINE = [
    ("May 11 to 22", "Nominations", "Nominations opened at noon Monday, May 11, and closed at 5 p.m. Friday, May 22. One nomination puts a qualified business on the ballot, but a category needs at least five separate businesses to go to a vote."),
    ("June 8 to 26", "Voting", "Voting ran from noon Monday, June 8, to 5 p.m. Friday, June 26, on VotethePNW.com. Voters choose one nominee per category and may vote in each category once a day."),
    ("After June 26", "Counting", "A third party tabulates nominations and votes. The Seattle Times says it does not know the results until the count is done."),
    ("Sept. 20", "Winners announced", "Winners were posted Sunday, Sept. 20, on BestinthePNW.com and honored in a winner's magazine in The Seattle Times. The announcement embargo ended that day. Pacific Pro Group's listing reads \u201c2026: Bronze Best Bathroom Remodeler.\u201d"),
    ("Oct. 8", "Badge use cleared", "The Seattle Times okayed use of the Bronze badge. Under the logo license, the winning category must appear with the badge."),
]


def timeline() -> str:
    tabs, panels = [], []
    for i, (d, t, body) in enumerate(TIMELINE):
        sel, ti, hid = ("true", "0", "") if i == 0 else ("false", "-1", " hidden")
        tabs.append(
            f'<li role="presentation"><button type="button" role="tab" id="ap-tl-t{i}" aria-controls="ap-tl-p{i}" aria-selected="{sel}" tabindex="{ti}"><small>{d}</small>{t}</button></li>'
        )
        panels.append(f'<div role="tabpanel" id="ap-tl-p{i}" aria-labelledby="ap-tl-t{i}" tabindex="0"{hid}><h4>{d}: {t}</h4><p>{html.escape(body)}</p></div>')
    return (
        '<section class="ap-widget ap-tl" aria-labelledby="ap-tl-h"><h3 id="ap-tl-h">Timeline: how the 2026 award came together</h3>'
        '<p class="ap-note">Select a date. Arrow keys move between dates. Dates from the program\'s official rules and the award listing.</p>'
        f'<ol role="tablist" aria-label="Award timeline">{"".join(tabs)}</ol>{"".join(panels)}</section>'
    )


NEWS = {
    "badge": (
        '<aside class="ap-badge ap-badge-text" aria-label="Award"><p class="ap-badge-cat">BRONZE - Bathroom Remodeler</p>'
        "<p>2026 The Seattle Times Best in the PNW</p></aside>"
    ),
    "pullquote": (
        '<blockquote class="ap-pull"><p>\u201cBest in the PNW nominations and winners are solely chosen by the public through online nominations and voting.\u201d</p>'
        '<cite>Official rules, The Seattle Times Best in the PNW</cite></blockquote>'
    ),
    "factbox": (
        '<aside class="ap-box" aria-labelledby="ap-fact-h"><h3 id="ap-fact-h">Fact box: the award</h3><dl>'
        "<dt>Award</dt><dd>BRONZE - Bathroom Remodeler - 2026 The Seattle Times Best in the PNW</dd>"
        "<dt>Run by</dt><dd>The Seattle Times. Fourth year of the program.</dd>"
        "<dt>Area</dt><dd>Businesses that serve Snohomish, King and Pierce counties</dd>"
        "<dt>Category</dt><dd>Bathroom Remodeler. Each category awards Gold, Silver and Bronze.</dd>"
        "<dt>How it's decided</dt><dd>Public online nominations and voting. No judging panel. Licenses, trade groups and online ratings are not considered.</dd>"
        "<dt>Voting rules</dt><dd>One nominee per category, one vote per category per day. A category needs at least five competing businesses. A third party counts the votes.</dd>"
        "<dt>Announced</dt><dd>Sunday, Sept. 20, 2026</dd>"
        '</dl><p class="ap-note">Source: <a href="https://www.shopbestinthepnw.com/official-rules">official rules</a> and <a href="https://www.bestinthepnw.com/listing/pacific-pro-group.html">winner listing</a>.</p></aside>'
    ),
    "timeline": timeline(),
    "stats": (
        '<ul class="ap-stats" aria-label="2026 Best in the PNW by the numbers">'
        "<li><b>316</b><span>categories</span></li>"
        "<li><b>10,000+</b><span>businesses, groups and people competing</span></li>"
        "<li><b>407,000+</b><span>ballots submitted</span></li>"
        "<li><b>1 million+</b><span>votes cast</span></li>"
        "<li><b>16%</b><span>more votes than 2025</span></li>"
        "<li><b>3</b><span>counties: Snohomish, King and Pierce</span></li>"
        '</ul><p class="ap-stats-src">Source: The Seattle Times, <a href="https://www.shopbestinthepnw.com/">Best in the PNW program site</a> and official rules.</p>'
    ),
    "loop1": loop(NEWS_VID + "2026-10-18-ppg-bronze-loop-1", "Sunset light moving across bronze fixtures in a finished bathroom", "Illustrative clip, not a real project."),
    "loop2": loop(NEWS_VID + "2026-10-18-ppg-bronze-loop-2", "Rain on a waterfront street at dusk", "Illustrative clip of a Puget Sound waterfront street in the rain, not a specific place."),
    "loop3": loop(NEWS_VID + "2026-10-18-ppg-bronze-loop-3", "Rain falling on a hillside house with a lit upstairs window", "Illustrative clip, not a real project."),
    "magnolia": (
        '<figure class="ap-figure"><img src="' + NEWS_IMG + '2026-10-18-ppg-bronze-bathroom-remodeler-magnolia-shower.webp" width="1138" height="1400" loading="lazy" '
        'alt="A deep green tile shower with a built-in bench and recessed niche in a Magnolia, Seattle, home">'
        "<figcaption>A green tile shower with a bench and niche from a Pacific Pro Group project in Seattle's Magnolia neighborhood. Photo courtesy of Pacific Pro Group.</figcaption></figure>"
    ),
    "checklist": checklist(
        "news-hire",
        "Before you hire: a quick checklist",
        [
            "Looked up the contractor on Washington L&amp;I Verify (registration, bond, insurance)",
            "Got a written scope of work, not just a total price",
            "Asked who handles design and who submits the permit",
            "Asked how the shower will be waterproofed behind the tile",
            "Received the state-required disclosure statement before work starts",
            "Read recent reviews and talked to at least one past client",
        ],
        CHECK_NOTE,
    ),
}

FAQ = [
    ("Does a Best in the PNW award mean a contractor is licensed?", "No. The official rules say The Seattle Times does not review licenses, trade affiliations, Better Business Bureau ratings or online ratings when choosing nominees or winners. Check any contractor on Washington L&I Verify before you sign."),
    ("How do readers vote in Best in the PNW?", "Nominations and voting happen online. Voters pick one nominee per category and can vote in each category once a day during the voting period. A third party counts the votes."),
    ("Do I need a permit for a bathroom remodel in Seattle or Edmonds?", "Often, yes, when the work moves plumbing, changes walls or adds electrical circuits. Seattle permits go through the Seattle Department of Construction and Inspections, and Edmonds permits through the city's Development Services Department. Ask your contractor which permits your job needs and who pulls them."),
    ("What is a flood test?", "Before tile goes on, the installer plugs the shower drain, fills the pan with water and checks that the level holds. It shows whether the waterproofing leaks while it is still cheap to fix."),
    ("Why does bathroom ventilation matter so much in the Pacific Northwest?", "Long wet seasons and cool walls make moisture linger. A bathroom exhaust fan that vents outdoors and runs long enough to clear the room protects paint, grout, cabinets and the framing above the ceiling."),
    ("What paperwork should a Washington contractor give me?", "For residential work of $1,000 or more, RCW 18.27.114 requires a disclosure statement before work starts. It lists the contractor's registration number and bond and warns that the bond might not cover every claim."),
    ("How much does a bathroom remodel cost?", "It depends on size, scope and finishes. As a reference point, the Journal of Light Construction 2025 Cost vs. Value Report lists national average job costs of $26,138 for a midrange bath remodel, $42,183 for a universal design bath remodel and $81,612 for an upscale bath remodel. Seattle-area bids vary, so compare written scopes."),
]


def faq_html() -> str:
    items = "".join(f"<details><summary>{html.escape(q)}</summary><p>{html.escape(a)}</p></details>" for q, a in FAQ)
    return f'<div class="ap-faq">{items}</div>'


def faq_schema() -> str:
    data = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ],
    }
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + "</script>"


LAYERS = [
    ("stud", "Wood framing", "The studs and blocking. Blocking for a future grab bar or a bench goes in now, before the walls close.", "#8b5a2b"),
    ("board", "Backer board", "A cement, foam or gypsum board made for wet areas. It holds the membrane and tile. It is not the waterproofing on its own unless the maker says so.", "#94a3b8"),
    ("membrane", "Waterproof membrane", "A continuous sheet or liquid layer, with seams and corners sealed, tied into the drain flange. This is the layer that keeps water out of the wall.", "#f97316"),
    ("thinset", "Thin-set mortar", "The bonding layer that holds tile to the membrane. Coverage matters: voids behind tile can crack it.", "#e5e7eb"),
    ("tile", "Tile and grout", "The finish surface. Grout and most tile are not waterproof on their own, which is why the membrane behind them matters.", "#15803d"),
    ("pan", "Sloped pan and drain", "The floor slopes toward the drain, and the membrane bonds to the drain flange. Flood test it before tile.", "#0ea5e9"),
]


def layers_html() -> str:
    x = 20
    widths = {"stud": 60, "board": 30, "membrane": 12, "thinset": 14, "tile": 30}
    shapes = []
    for key, name, _t, color in LAYERS:
        if key == "pan":
            continue
        w = widths[key]
        shapes.append(f'<rect data-layer="{key}" x="{x}" y="20" width="{w}" height="300" fill="{color}" stroke="#0f172a" stroke-width="1"><title>{name}</title></rect>')
        x += w
    shapes.append('<polygon data-layer="pan" points="20,320 380,300 380,340 20,340" fill="#0ea5e9" stroke="#0f172a" stroke-width="1"><title>Sloped pan and drain</title></polygon>')
    shapes.append('<rect x="330" y="298" width="40" height="8" fill="#cbd5e1"/>')
    svg = (
        '<svg viewBox="0 0 400 360" role="img" aria-labelledby="ap-svg-t"><title id="ap-svg-t">Cross-section of a tiled shower wall and floor, from framing to tile</title>'
        '<rect x="0" y="0" width="400" height="360" fill="#0b1220"/>' + "".join(shapes) +
        '<text x="250" y="60" fill="#e2e8f0" font-size="14">Shower side</text><text x="250" y="80" fill="#94a3b8" font-size="12">water hits tile first</text></svg>'
    )
    btns = "".join(
        f'<button type="button" aria-pressed="false" data-show="{k}" data-title="{html.escape(n)}" data-text="{html.escape(t)}">{n}</button>'
        for k, n, t, _c in LAYERS
    )
    return (
        '<section class="ap-widget" aria-labelledby="ap-layers-h"><h3 id="ap-layers-h">Layers of a waterproof shower</h3>'
        '<p class="ap-note">Tap a layer in the drawing or pick one from the list. Simplified teaching diagram, not to scale. Assemblies vary by system.</p>'
        f'<div class="ap-layers"><div>{svg}</div><div><div class="ap-layer-btns">{btns}</div>'
        '<p class="ap-layer-detail"></p></div></div></section>'
    )


def scope_html() -> str:
    return (
        '<section class="ap-widget ap-scope" aria-labelledby="ap-scope-h"><h3 id="ap-scope-h">Scope builder and cost reference</h3>'
        '<p class="ap-note">Pick what your project looks like. You get the closest published national benchmark and a list of questions to bring to a first meeting. Estimate reference only, not a bid.</p>'
        '<div class=\"ap-scope-group\"><label for=\"ap-fp\">Footprint</label><select id="ap-fp" name="footprint">'
        '<option value="same">Keep the same footprint</option><option value="expand">Expand into nearby space</option><option value="add">Add a new bathroom</option></select></div>'
        '<div class=\"ap-scope-group\"><label for=\"ap-fin\">Finish level</label><select id="ap-fin" name="finish">'
        '<option value="mid">Midrange finishes</option><option value="high">High-end finishes</option></select></div>'
        '<div class=\"ap-scope-group\"><label for=\"ap-acc\">Planning for aging in place?</label><select id="ap-acc" name="access">'
        '<option value="no">No</option><option value="yes">Yes (low or no curb, grab bar blocking, wider door)</option></select></div>'
        '<div class=\"ap-scope-group\"><label for=\"ap-fan\">Is there a working exhaust fan that vents outside?</label><select id="ap-fan" name="fan">'
        '<option value="yes">Yes</option><option value="no">No or not sure</option></select></div>'
        '<div class="ap-out"></div>'
        '<p class="ap-note">Source: <a href="https://www.jlconline.com/cost-vs-value/2025/">Journal of Light Construction, 2025 Cost vs. Value Report</a>, national averages. '
        'Published figures: Bath Remodel Midrange $26,138; Universal Design $42,183; Upscale $81,612; Bathroom Addition Midrange $60,645; Upscale $111,255.</p></section>'
    )


TOC = [
    ("start", "The morning the toilet leaves the house"),
    ("vote", "Why a reader vote is a useful starting point"),
    ("visit", "Stage 1: The first visit"),
    ("design", "Stage 2: Drawings and decisions"),
    ("permit", "Stage 3: Waiting on the permit"),
    ("contract", "Stage 4: Signing the contract"),
    ("household", "Before demolition: planning the household"),
    ("demo", "Stage 5: Demolition"),
    ("rough", "Stage 6: Rough-in and the first inspections"),
    ("waterproof", "Stage 7: Behind the tile"),
    ("finish", "Stage 8: Tile, fixtures and glass"),
    ("punch", "Stage 9: The punch list and the last walkthrough"),
    ("later", "A year later"),
    ("hiring", "Choosing who takes you through it"),
    ("faq", "Frequently asked questions"),
]

POST = {
    "toc": '<nav class="ap-toc" aria-labelledby="ap-toc-h"><strong id="ap-toc-h">In this guide</strong><ol>'
    + "".join(f'<li><a href="#{i}">{html.escape(t)}</a></li>' for i, t in TOC)
    + "</ol></nav>",
    "loop1": loop(POST_VID + "2026-10-18-ppg-bronze-bath-loop-1", "Rain running down a window beside a green tile shower", "Illustrative clip, not a real project."),
    "loop2": loop(POST_VID + "2026-10-18-ppg-bronze-bath-loop-2", "Water flowing across shower floor tile into a linear drain", "Illustrative clip: water sheeting toward a linear drain."),
    "loop3": loop(POST_VID + "2026-10-18-ppg-bronze-bath-loop-3", "Steam drifting toward a ceiling exhaust fan", "Illustrative clip: steam drawn toward an exhaust fan."),
    "layers": layers_html(),
    "scope": scope_html(),
    "checklist": checklist(
        "blog-hire",
        "Hiring checklist for a Seattle-area bathroom remodel",
        [
            "Checked registration, bond and insurance on Washington L&amp;I Verify",
            "Compared written scopes line by line, not just totals",
            "Know which waterproofing system goes behind the tile",
            "Confirmed a flood test before tile",
            "Know which exhaust fan is planned and where it vents outside",
            "Know who draws the plans and who submits the permit",
            "Understand when selections lock and how change orders work",
            "Know how to handle rot or damaged framing found during demolition",
            "Received the RCW 18.27.114 disclosure statement",
            "Know who is on site day to day and how progress is shared",
        ],
        CHECK_NOTE,
    ),
    "quote": (
        '<blockquote class="ap-pull ap-review"><p>\u201cDuring construction the crew protected the rest of the house, kept the site livable, and finished the shower, vanity, and tile to a level we have not seen\u2026\u201d</p>'
        '<cite>Ella Boyko, review of a full bathroom remodel in Seattle, posted Sept. 28, 2026, on '
        '<a href="https://www.bestinthepnw.com/listing/pacific-pro-group.html">Pacific Pro Group\'s Best in the PNW listing</a>. Excerpt as shown publicly; the listing truncates the review.</cite></blockquote>'
    ),
    "faq": faq_html(),
}

ASSETS = '<link rel="stylesheet" href="/assets/css/award-posts.css">\n<script src="/assets/js/award-posts.js" defer></script>\n'
PH = re.compile(r"<p>\s*\[\[ap:([a-z0-9]+)\]\]\s*</p>|\[\[ap:([a-z0-9]+)\]\]")
HID = re.compile(r"<(h[23])([^>]*)>(.*?)\s*\{#([a-z0-9-]+)\}</\1>")


def enhance_html(text: str, kind: str) -> str:
    if "[[ap:" not in text:
        return text
    blocks = NEWS if kind == "news" else POST
    text = PH.sub(lambda m: blocks.get(m.group(1) or m.group(2), ""), text)
    text = HID.sub(lambda m: f'<{m.group(1)}{m.group(2)} id="{m.group(4)}">{m.group(3)}</{m.group(1)}>', text)
    head_add = ASSETS + (faq_schema() + "\n" if kind == "post" and "[[ap:faq]]" in text else "")
    if "award-posts.css" not in text.split("</head>", 1)[0]:
        text = text.replace("</head>", head_add + "</head>", 1)
    return text


def enhance_file(path: Path) -> None:
    path = Path(path)
    text = path.read_text(encoding="utf-8")
    kind = "news" if path.parent.name == "news" else "post"
    new = enhance_html(text, kind)
    if new != text:
        path.write_text(new, encoding="utf-8")
