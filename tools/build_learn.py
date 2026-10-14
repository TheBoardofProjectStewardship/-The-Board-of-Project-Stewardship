#!/usr/bin/env python3
"""Write the original /learn/ house guide. Does not run generate_site.py."""
from __future__ import annotations

import html
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATE = "2026-10-14"
BRAND = "Board of Project Stewardship"
ORIGIN = "https://boardofprojectstewardship.com"
OG = f"{ORIGIN}/assets/images/home-hero.webp"
FORBIDDEN = re.compile(r"\b(?:BOPS|ChatGPT|Gemini|Imagen|Veo|Higgsfield|Pollinations)\b|\bAI\b")

STEPS = [
    ("survey", "survey", "Survey", "What the survey has to settle", "The lot",
     "The house has to sit on a known piece of ground. A survey locates the property lines and the grades. When the site needs it, a soils report says what the ground can carry and where water sits. This drawing is not a survey and not a soils report. It only shows the footprint of this house and its garage."),
    ("stake", "stake", "Corners", "Corners that survive the dig", "The lot",
     "The corners of the house and the garage are marked on the ground from the survey, with offsets so the marks survive the digging. On these plan sheets the main wing is about 45 feet and the garage is about 22 feet. Those figures are not a substitute for stakes on a real lot."),
    ("clear", "clear", "Trees", "Trees and topsoil", "The lot",
     "Trees, shrubs, and paving that stay are fenced before machines arrive. Topsoil can be stripped and saved for planting beds. It is a poor material under a footing. The sketch keeps the paths and the planted strip beside the garage so the finished ground has something to aim at."),
    ("excavate", "excavate", "Hole", "The hole for a slab house", "The lot",
     "Before anyone enters an excavation, a competent person evaluates the soil, water, adjacent loads, and required protective system. Protection can be needed in shallow cuts as well as deep ones. Dewatering and safe access are planned as part of that work. On a slope, soil is cut from the high side. Fill under a footing has to be proper material, placed in layers and compacted. This model shows the pad, not the hole."),
    ("footings", "footings", "Spread", "Concrete that spreads the walls", "The slab hold",
     "Footings are the wide concrete bases that spread wall and post loads into the soil. A continuous footing follows a bearing wall. A pad footing sits under a post, such as a porch post. On this slab house the walls that rise off those footings are short stem walls, not a basement. Width and thickness come from the load and the soil. This sketch does not calculate them."),
    ("drains", "slab", "Drains", "Drains the slab will bury", "The slab hold",
     "Drains that run under the floor go in before the concrete. A trap needs a vent, and an under-slab drain cannot be moved after the pour. Stone under the slab breaks the path of moisture rising from the ground, and a vapor retarder goes on that stone. The sketch names the idea. It does not route a pipe."),
    ("slab", "slab", "Slab", "The floor you walk on", "The slab hold",
     "The slab is poured on that prepared base. In this model the floor line is the top of that work. A treated sill, or the wall plates themselves, is anchored to the concrete so the wood frame starts off the soil. A crawl-space house would build a wood platform here instead. This house is drawn on a slab."),
    ("damp", "damp", "Water", "Water at the outside of the concrete", "The slab hold",
     "Concrete against soil needs a way for water to leave. A dampproof coating suits a wall that is drained. A waterproof membrane is for water that can press on the wall. A perforated drain at the footing, set in clean stone and outside the footing, leads water to daylight or a sump. The sketch does not draw the pipe."),
    ("backfill", "backfill", "Fill", "Soil back, sloping away", "The slab hold",
     "Soil goes back against the foundation only after the wall can take the pressure and the drain is in place. It is placed in layers. The rough grade slopes away so rain does not stand at the wall. Planting waits until the heavy work is done."),
    ("frame1", "frame1", "Studs", "The first story of studs", "The frame hold",
     "Exterior walls are framed on the slab: bottom plate, studs, headers over openings, and top plates. The garage door and the wide windows need headers because studs are missing there. Partitions that only divide rooms are not the load path in this sketch. Nothing here sizes a header."),
    ("frame2", "frame2", "Upper", "The bedroom floor and the stair hole", "The frame hold",
     "The upper floor is another platform on the walls below, then the upper walls. The stair opening is framed before that deck is closed. On this house the upper floor holds the primary bedroom, two other bedrooms, baths, and the laundry. The balcony is an outdoor piece of that floor, and it needs a guard."),
    ("roof", "roof", "Roofs", "Gable, hip, and the lower roofs", "The frame hold",
     "Site-built rafters are assembled on site. A conventional ridge-board roof uses ties to resist outward thrust; a designed structural ridge-beam roof uses a different support arrangement. This house has a gable on the east, a hip toward the balcony, a dormer on the front slope, and lower roofs on the garage and the porch. The drawing shows those planes. It is not a truss design."),
    ("brace", "systemsFrame", "Brace", "Brace it before it is covered", "The frame hold",
     "Before the walls are covered, the frame that resists wind and earthquakes has to be in place: structural sheathing, the nailing the design calls for, and hold-downs where the shear walls end. A framing inspection looks at that work while it is still visible. This sketch highlights the walls. It does not give a nailing schedule."),
    ("dryin", "dryin", "Dry-in", "A roof that sheds", "Close and finish",
     "The frame is dried in when the roof sheds water and the openings are covered: sheathing, underlayment, and a cover at the windows and doors. Siding can wait. In a wet climate an open roof is the emergency, so this comes before interior finishes. At this step the roof planes are on and the siding strokes are still off."),
    ("rough", "rough", "Trades", "Open walls for the trades", "Close and finish",
     "With the shell closed to weather, plumbing, heating, and electrical lines run in the open walls and floors. Drains, vents, and ducts have to miss the joists where the structure needs the wood. The baths, kitchen, and laundry are the rooms that need water. The sketch does not route a pipe."),
    ("insulate", "insulate", "Energy", "The energy check", "Close and finish",
     "Insulation slows heat moving through the assembly. Sealing stops the leaks that carry both heat and moisture. Gaps at plates, windows, and penetrations are closed, then the cavities are filled. An energy inspection looks at that work before it is covered. In a marine climate the wall also has to be able to dry. The sketch shows the open frame, not a product."),
    ("siding", "siding", "Coat", "The rain coat", "Close and finish",
     "Direct-applied siding still relies on a properly integrated water-resistive barrier and flashing behind it. A separate drainage gap can improve drainage and drying. Whether that gap is required depends on the cladding, assembly, manufacturer's instructions, and applicable code. On this house the east gable reads as board-and-batten and the other walls as horizontal courses."),
    ("drywall", "drywall", "Rooms", "Rooms you can live in", "Close and finish",
     "Interior board closes the walls. Joints are finished, then the rooms are painted, floored, and fitted. Cabinets and fixtures come after the surfaces they sit on. The plan shows how this house is divided. It does not name a finish."),
    ("grade", "grade", "Grade", "Gutters and the final walk", "Close and finish",
     "The ground is finished so water leaves the house: slope, gutters, downspouts that discharge away from the wall, and planting that does not hold water at the siding. Walks and the patio are set to those elevations. The final walk checks that the house matches the approved work. The model returns to the whole house."),
]


def esc(text: str) -> str:
    return html.escape(text, quote=True)


def title_of(name: str) -> str:
    title = f"{name} | {BRAND}"
    if len(title) > 60:
        raise SystemExit(f"title too long ({len(title)}): {title}")
    return title


def svg(inner: str, label: str) -> str:
    return (
        f'<figure class="learn-fig"><svg viewBox="0 0 360 210" role="img" aria-label="{esc(label)}">'
        f'<rect width="360" height="210" fill="#f7f6f2"/>{inner}</svg>'
        f"<figcaption>{esc(label)}. Teaching sketch, not a detail drawing.</figcaption></figure>"
    )


INK = 'fill="none" stroke="#1c1916" stroke-width="1.25" stroke-linejoin="round"'
SOFT = 'fill="none" stroke="#5c584f" stroke-width="1"'
TXT = 'fill="#1c1916" font-family="system-ui,sans-serif" font-size="11"'

DIAGRAMS = {
    "cutfill": svg(
        f'<path {SOFT} stroke-dasharray="6 4" d="M16 46 L170 112 L346 184"/>'
        f'<path {INK} d="M72 112 H252"/>'
        f'<path {INK} d="M72 112 V120 H252 V112"/>'
        f'<path {SOFT} d="M84 78 L108 102 M100 70 L128 98 M118 78 L148 108 M136 88 L164 116"/>'
        f'<path {SOFT} d="M176 124 H240 M184 136 H258 M196 148 H272 M208 160 H286"/>'
        f'<text {TXT} x="28" y="36">Cut</text>'
        f'<text {TXT} x="286" y="176">Fill</text>'
        f'<text {TXT} x="128" y="108">Level pad</text>',
        "Existing grade falls across a level pad, cut above it and fill below it",
    ),
    "footing": svg(
        f'<path {SOFT} d="M20 168 H340"/>'
        f'<path {INK} d="M70 168 H290 V148 H250 V70 H110 V148 H70 Z"/>'
        f'<path {INK} d="M40 188 H320 V168"/>'
        f'<circle fill="#8d877c" stroke="none" cx="46" cy="152" r="2.2"/>'
        f'<circle fill="#8d877c" stroke="none" cx="54" cy="148" r="2"/>'
        f'<circle fill="#8d877c" stroke="none" cx="60" cy="156" r="2.1"/>'
        f'<circle fill="#8d877c" stroke="none" cx="50" cy="160" r="1.8"/>'
        f'<circle fill="#8d877c" stroke="none" cx="58" cy="164" r="2"/>'
        f'<circle {INK} cx="54" cy="160" r="3.5"/>'
        f'<path {SOFT} stroke-dasharray="3 3" d="M54 164 V186"/>'
        f'<text {TXT} x="118" y="58">Wall</text>'
        f'<text {TXT} x="24" y="144">Stone</text>'
        f'<text {TXT} x="118" y="204">Footing wider than the wall</text>',
        "A wall on a wider footing, with stone and a drain outside the footing",
    ),
    "wall": svg(
        f'<path {INK} d="M40 30 H70 V180 H40 Z"/>'
        f'<path {INK} d="M78 30 H92 V180 H78 Z"/>'
        f'<path {INK} d="M100 30 H118 V180 H100 Z"/>'
        f'<path {INK} d="M126 30 H200 V180 H126 Z"/>'
        f'<path {SOFT} d="M140 50 H186 M140 70 H186 M140 90 H186 M140 110 H186 M140 130 H186 M140 150 H186"/>'
        f'<path {INK} d="M208 30 H232 V180 H208 Z"/>'
        f'<text {TXT} x="36" y="198">Siding</text>'
        f'<text {TXT} x="250" y="48">Gap</text>'
        f'<text {TXT} x="250" y="72">Barrier</text>'
        f'<text {TXT} x="250" y="96">Sheathing</text>'
        f'<text {TXT} x="250" y="120">Stud and insulation</text>'
        f'<text {TXT} x="250" y="144">Interior board</text>',
        "Outside to inside: cladding, a gap, the weather barrier, sheathing, the stud cavity, interior board",
    ),
    "truss": svg(
        f'<path {INK} d="M40 150 L180 40 L320 150 Z"/>'
        f'<path {INK} d="M40 150 H320"/>'
        f'<path {INK} d="M110 150 L180 40 L250 150"/>'
        f'<path {INK} d="M110 150 L180 95 L250 150"/>'
        f'<text {TXT} x="150" y="28">Top chord</text>'
        f'<text {TXT} x="140" y="172">Bottom chord</text>'
        f'<text {TXT} x="186" y="100">Webs</text>',
        "A simple roof truss: two top chords, a bottom chord, and webs",
    ),
    "gusset": svg(
        f'<path {INK} d="M28 164 L180 72"/>'
        f'<path {INK} d="M180 72 L332 164"/>'
        f'<path {INK} d="M36 164 H324"/>'
        f'<path {INK} d="M180 72 V164"/>'
        f'<rect {INK} x="152" y="48" width="56" height="52"/>'
        f'<path {SOFT} d="M160 56 H200 M160 66 H200 M160 76 H200 M168 48 V100 M180 48 V100 M192 48 V100"/>'
        f'<text {TXT} x="118" y="196">Plate overlapping the joint</text>',
        "A gusset plate overlapping the members where they meet",
    ),
    "attic": svg(
        f'<path {INK} d="M36 168 H324"/>'
        f'<path {INK} d="M36 168 V116"/>'
        f'<path {INK} d="M324 116 V168"/>'
        f'<path {INK} d="M36 116 L180 30 L324 116"/>'
        f'<path {INK} d="M96 168 V108 H264 V168"/>'
        f'<text {TXT} x="128" y="148">Room inside</text>'
        f'<text {TXT} x="8" y="108">Heel</text>'
        f'<text {TXT} x="300" y="108">Heel</text>',
        "A room-in-attic truss with a raised heel, the room kept inside the roof",
    ),
    "arch": svg(
        f'<path {INK} d="M50 160 A110 90 0 0 1 310 160"/>'
        f'<path {INK} d="M50 160 V190 M310 160 V190"/>'
        f'<path {SOFT} d="M70 150 L40 175 M290 150 L320 175"/>'
        f'<text {TXT} x="118" y="110">Compression</text>'
        f'<text {TXT} x="20" y="205">Thrust</text>'
        f'<text {TXT} x="286" y="205">Thrust</text>',
        "An arch in compression, pushing outward at each support",
    ),
    "platform": svg(
        f'<path {INK} d="M40 170 H320 V150 H40 Z"/>'
        f'<path {INK} d="M60 150 V100 H300 V150"/>'
        f'<path {INK} d="M50 100 H310 V82 H50 Z"/>'
        f'<path {INK} d="M70 82 V36 H290 V82"/>'
        f'<path {INK} d="M40 36 H320 V20 H40 Z"/>'
        f'<text {TXT} x="130" y="166">Foundation</text>'
        f'<text {TXT} x="118" y="128">Main walls</text>'
        f'<text {TXT} x="124" y="96">Upper floor</text>'
        f'<text {TXT} x="124" y="62">Upper walls</text>',
        "Platform framing: each floor is a deck, and the next walls stand on it",
    ),
    "rafter": svg(
        f'<path {INK} d="M40 160 L180 40 L320 160"/>'
        f'<path {INK} d="M40 160 H320"/>'
        f'<path {SOFT} d="M70 132 L150 70 M290 132 L210 70"/>'
        f'<text {TXT} x="150" y="28">Ridge</text>'
        f'<text {TXT} x="130" y="188">Tie across the walls</text>',
        "A rafter pair. The tie keeps the eaves from spreading.",
    ),
    "shear": svg(
        f'<path {INK} d="M110 30 H250 V180 H110 Z"/>'
        f'<path {INK} d="M118 172 L242 40 M118 40 L242 172"/>'
        f'<path {INK} d="M100 180 H130 V168 H100 Z M230 180 H260 V168 H230 Z"/>'
        f'<text {TXT} x="40" y="100">Sheathing</text>'
        f'<text {TXT} x="96" y="202">Hold-downs at the ends</text>',
        "A shear wall: sheathing in the field, anchorage at the ends",
    ),
    "stair": svg(
        f'<path {INK} d="M40 180 H90 V150 H130 V120 H170 V90 H210 V60 H250 V30 H320"/>'
        f'<path {SOFT} d="M40 30 H320"/>'
        f'<text {TXT} x="40" y="24">Headroom</text>'
        f'<text {TXT} x="40" y="202">Rise and run stay consistent</text>',
        "A straight stair, with headroom above the walking line",
    ),
    "masonry": svg(
        f'<g {INK}><rect x="30" y="40" width="50" height="22"/><rect x="80" y="40" width="50" height="22"/>'
        f'<rect x="130" y="40" width="50" height="22"/>'
        f'<rect x="55" y="62" width="50" height="22"/><rect x="105" y="62" width="50" height="22"/>'
        f'<rect x="30" y="84" width="50" height="22"/><rect x="80" y="84" width="50" height="22"/>'
        f'<rect x="130" y="84" width="50" height="22"/></g>'
        f'<g {INK}><rect x="210" y="40" width="40" height="22"/><rect x="250" y="40" width="40" height="22"/>'
        f'<rect x="290" y="40" width="40" height="22"/>'
        f'<rect x="210" y="62" width="40" height="22"/><rect x="250" y="62" width="40" height="22"/>'
        f'<rect x="290" y="62" width="40" height="22"/>'
        f'<rect x="210" y="84" width="40" height="22"/><rect x="250" y="84" width="40" height="22"/>'
        f'<rect x="290" y="84" width="40" height="22"/></g>'
        f'<text {TXT} x="48" y="130">Running bond</text>'
        f'<text {TXT} x="220" y="130">Stack bond</text>'
        f'<text {TXT} x="40" y="170">Overlapped joints share the load. Lined-up joints need reinforcement.</text>',
        "Running bond overlaps the units. Stack bond lines the joints up.",
    ),
    "heat": svg(
        f'<rect {INK} x="30" y="70" width="70" height="50"/>'
        f'<rect {INK} x="150" y="50" width="90" height="70"/>'
        f'<path {INK} d="M100 85 H150 M240 70 H320 V50 H240"/>'
        f'<path {SOFT} d="M240 110 H320"/>'
        f'<text {TXT} x="36" y="150">Outdoor unit</text>'
        f'<text {TXT} x="156" y="150">Air handler</text>'
        f'<text {TXT} x="250" y="44">Supply</text>'
        f'<text {TXT} x="250" y="128">Return</text>',
        "A ducted heat pump: outdoor unit, indoor handler, supply and return",
    ),
    "plumb": svg(
        f'<path {INK} d="M40 40 V90 H120 V40"/>'
        f'<rect {INK} x="150" y="28" width="36" height="50"/>'
        f'<path {INK} d="M186 50 H250 V90"/>'
        f'<path {INK} d="M40 120 H300"/>'
        f'<path {INK} d="M80 120 V170 M160 120 V170 M250 120 V170"/>'
        f'<text {TXT} x="36" y="28">Supply</text>'
        f'<text {TXT} x="146" y="96">Heater</text>'
        f'<text {TXT} x="36" y="196">Vents rise; drains fall</text>',
        "Supply, a heater, and drains with vents. Not a pipe layout.",
    ),
    "power": svg(
        f'<rect {INK} x="40" y="40" width="50" height="70"/>'
        f'<rect {INK} x="120" y="30" width="70" height="100"/>'
        f'<path {INK} d="M190 60 H240 M190 90 H280 M190 110 H260"/>'
        f'<text {TXT} x="44" y="130">Meter</text>'
        f'<text {TXT} x="128" y="150">Panel</text>'
        f'<text {TXT} x="210" y="48">Branch circuits</text>',
        "Service, panel, and branch circuits. Not a load calculation.",
    ),
    "load": svg(
        f'<path {INK} d="M80 50 L180 20 L280 50 V70 H80 Z"/>'
        f'<path {INK} d="M100 70 V140 H150 V70 M210 70 V140 H260 V70"/>'
        f'<path {INK} d="M70 140 H290 V160 H70 Z"/>'
        f'<path {SOFT} d="M180 70 V150 M160 90 L180 110 L200 90"/>'
        f'<text {TXT} x="150" y="186">Load continues into the ground</text>',
        "Gravity load moves from the roof, through the walls, into the foundation",
    ),
}


def p(text: str) -> str:
    return f"<p>{text}</p>"


ARTICLES = [
    {
        "slug": "cut-and-fill",
        "name": "Leveling a sloping lot",
        "desc": "How a sloping lot is cut and filled to make a level pad, and why the soil under the house is not topsoil.",
        "preset": "excavate",
        "diagram": "cutfill",
        "body": [
            p("On a slope the house wants a level pad. Soil taken from the high side is the cut. Soil placed on the low side is the fill. The volumes are rarely equal once organic soil is stripped and the fill is compacted."),
            p("Fill that will carry a footing is placed in layers and compacted. Topsoil, stumps, and debris do not belong in that fill. They settle. A soils report, when the site needs one, says what the ground can carry and whether the fill is allowed under the house."),
            p("This model is already a flat pad. It shows the result, not the hillside and not a grading plan."),
        ],
        "related": [
            ("../excavation/", "Excavation and backfill"),
            ("../foundation-types/", "Foundation types"),
        ],
    },
    {
        "slug": "building-systems",
        "name": "One house, four jobs",
        "desc": "Structure, enclosure, services, and finishes are four different jobs in the same house.",
        "preset": "grade",
        "switches": [("systemsFrame", "Frame only"), ("systemsSkin", "With the skin"), ("grade", "Whole house")],
        "body": [
            p("A house is several systems sharing one footprint. The structure carries weight. The enclosure keeps out rain and slows heat. Services move water, air, and power. Finishes are what you touch. They are built in that order because each one has to be reachable before the next one covers it."),
            p("On this model the frame is the walls, floors, and roof planes. The skin is the siding strokes and the roof cover. The rooms you see in plan are where the services will land: kitchen, baths, laundry, and the utility room. The drawing does not hide pipes inside the walls."),
            p("Turn the buttons to peel the skin off the frame, then put it back. Follow any part into its own page from Explore."),
        ],
        "related": [("../explore/", "Explore this house"), ("../sequence/", "Build order")],
    },
    {
        "slug": "load-path",
        "name": "Where the weight goes",
        "desc": "Gravity load moves from the roof through the walls and into the ground. This sketch does not size that path.",
        "preset": "load",
        "diagram": "load",
        "body": [
            p("Weight from the roof, the floors, and snow or people has to reach the ground without a gap. That route is the load path. On a wood house it is usually roof to walls or beams, walls to the foundation, and the foundation to the soil."),
            p("On this house the outside walls of the main wing and the garage are drawn as the bearing lines. The highlighted walls are that idea, not a check of what they can carry. A partition that only divides rooms is not on that path in this sketch. On a real house, look at what sits on a wall before anyone removes it."),
            p("Wind and earthquakes are a different path. They push sideways and are carried by the floors into braced walls. That is the lateral page."),
        ],
        "related": [("../lateral-stability/", "Lateral stability"), ("../beams/", "Beams"), ("../spread-footings/", "Spread footings")],
    },
    {
        "slug": "columns",
        "name": "Posts you can see",
        "desc": "A column carries load in compression. On this house the porch posts are the columns you can see.",
        "preset": "columns",
        "body": [
            p("A column takes load from above and delivers it below, mostly in compression. How tall it is compared with its thickness, and how it is held at each end, decides whether it stays straight. A wall of studs is a row of small columns sharing the load."),
            p("The posts under the porch roof are the clear columns on this house. Each one needs a footing of its own, or a beam that reaches a footing. The sketch shows the posts. It does not size them or the footing."),
        ],
        "related": [("../beams/", "Beams"), ("../spread-footings/", "Spread footings"), ("../load-path/", "Load path")],
    },
    {
        "slug": "beams",
        "name": "Beams over openings",
        "desc": "A beam carries load sideways to its supports. A header is a short beam over an opening. This sketch does not size one.",
        "preset": "beams",
        "body": [
            p("A beam bends. The top is squeezed, the bottom is stretched, and the supports at each end take the vertical load. Deeper beams can span farther, but depth, species, grade, and the supports are a design. A header is the short beam that replaces the studs taken out for a window or a door."),
            p("The garage door on this house is the opening that makes the header obvious. The wide windows need the same idea. Highlighted edges in the model mark openings. They are not a beam schedule."),
        ],
        "related": [("../load-path/", "Load path"), ("../platform-framing/", "Platform framing"), ("../columns/", "Columns")],
    },
    {
        "slug": "trusses",
        "name": "Triangles in the roof",
        "desc": "A truss is a frame of triangles. The members stay in tension or compression when the joints are left intact.",
        "diagram": "truss",
        "preset": "roof",
        "body": [
            p("A truss spans with less depth of solid wood by folding the shape into triangles. The top chords follow the roof, the bottom chord ties the walls, and the webs fill the middle. Each member is sized for tension or compression. The joint is part of that design."),
            p("Cutting a web, or notching a chord, breaks the triangle. Storage and ducts have to fit the openings the truss was designed to have, not holes made later. This house is drawn as roof planes. Those planes could be trusses or rafters. The drawing does not choose."),
        ],
        "related": [("../truss-connections/", "Truss connections"), ("../trussed-rafters/", "Trussed rafters"), ("../roof-framing/", "Roof framing")],
    },
    {
        "slug": "lateral-stability",
        "name": "Wind and earthquakes",
        "desc": "Wind and earthquakes push sideways. Floors share that push with braced walls. This sketch does not show the nailing.",
        "diagram": "shear",
        "preset": "systemsFrame",
        "body": [
            p("Gravity goes down. Wind and earthquakes push the house sideways, and they try to slide it or tip it. Floors and roofs can act as stiff diaphragms that hand that push to walls which are braced to take it. A shear wall uses its sheathing for that push and is held down at the ends so it does not lift. A moment frame resists by bending of beams and columns, which is useful when a wall cannot be solid."),
            p("The Puget Sound region is not a low-seismic place. The design category comes from the site and the code edition, not from this drawing. The model shows walls that could be braced. It does not show hold-downs, nail spacing, or a frame."),
        ],
        "related": [("../load-path/", "Load path"), ("../wall-assembly/", "Wall assembly"), ("../platform-framing/", "Platform framing")],
    },
    {
        "slug": "arches-and-vaults",
        "name": "Why there is no arch",
        "desc": "An arch works in compression and pushes outward. This wood house uses bending members instead.",
        "diagram": "arch",
        "preset": "grade",
        "body": [
            p("An arch carries load by compression along its curve. The curve wants to flatten, so each support is pushed outward. Those thrusts need heavy abutments or a tie across the opening. A vault is that idea extended into a roof. Masonry arches and vaults are old, and they still explain why a curved structure cannot simply sit on a thin wall."),
            p("This house does not use an arch. Its floors and roof are beams, joists, rafters, or trusses, which work in bending and deliver mostly vertical load when they are tied. The comparison is here so the wood frame has a contrast, not because the model is hiding a vault."),
        ],
        "related": [("../beams/", "Beams"), ("../trusses/", "Trusses")],
    },
    {
        "slug": "foundation-types",
        "name": "What the house sits on",
        "desc": "Slab, crawl space, basement, and piers solve different ground, frost, and access problems. This house is drawn as a slab-level pad.",
        "diagram": "footing",
        "preset": "footings",
        "body": [
            p("A slab on grade pours the floor on a prepared base, with a thickened edge or a stem wall and footing. A crawl space lifts the floor on short walls so someone can reach pipes and ducts. A basement is that wall, tall enough to be a room, and it has to resist soil and water. Piers and grade beams carry the house on points when the soil near the surface is poor or the site is steep."),
            p("The choice follows the soil, the slope, frost depth, and whether anyone needs to get under the floor. This sketch is a low pad with the main floor at grade. It is not a soils recommendation and not a basement."),
        ],
        "related": [("../spread-footings/", "Spread footings"), ("../excavation/", "Excavation and backfill"), ("../cut-and-fill/", "Cut and fill")],
    },
    {
        "slug": "excavation",
        "name": "Digging and backfill",
        "desc": "Dig to the footing depth, keep the hole stable, then put soil back only after the wall and the drain can take it.",
        "preset": "excavate",
        "diagram": "footing",
        "body": [
            p("Before anyone enters an excavation, a competent person evaluates the soil, water, adjacent loads, and required protective system. Protection can be needed in shallow cuts as well as deep ones. Dewatering and safe access are planned as part of that work."),
            p("Backfill waits until the foundation wall can resist the pressure and the drain at the footing is in place. Soil goes back in layers. The finished grade slopes away from the house. This model shows the pad those steps are aiming at."),
        ],
        "related": [
            ("../cut-and-fill/", "Cut and fill"),
            ("../sequence/#backfill", "Backfill in the build order"),
            ("../../project-timeline.html", "Project timeline guide"),
        ],
    },
    {
        "slug": "spread-footings",
        "name": "How wide the concrete is",
        "desc": "A footing is wider than the wall so the same load presses the soil more gently. This sketch does not size one.",
        "diagram": "footing",
        "preset": "footings",
        "body": [
            p("Soil can take only so much pressure. Spreading the load over a wider footing keeps that pressure down. A continuous footing follows a bearing wall. An isolated footing sits under a post. The bottom has to reach the depth the local code sets for frost, unless the design is a frost-protected slab, which is its own assembly."),
            p("The highlighted base of this house is the idea of that line. Bearing pressure, reinforcement, and thickness are calculated from the loads and the soil. None of those numbers are in the drawing."),
        ],
        "related": [("../foundation-types/", "Foundation types"), ("../load-path/", "Load path"), ("../columns/", "Columns")],
    },
    {
        "slug": "masonry-bonding",
        "name": "Face versus structure",
        "desc": "Overlapped joints let masonry act together. Brick on a wood house is usually a cladding, not the structure.",
        "diagram": "masonry",
        "preset": "siding",
        "body": [
            p("In running bond, each unit overlaps the joint below. The wall shares load across those overlaps. In stack bond the joints line up, which is weaker unless the wall is reinforced to make up for it. A structural masonry wall is the structure. Brick veneer tied to a wood frame is a rain coat. It needs a cavity, weep holes, and ties. It does not hold up the floors."),
            p("This house is drawn with siding courses and a board-and-batten gable, not with brick. The bond diagram is here because the question comes up as soon as someone asks whether the outside face is holding the roof."),
        ],
        "related": [("../wall-assembly/", "Wall assembly"), ("../load-path/", "Load path")],
    },
    {
        "slug": "platform-framing",
        "name": "Two floors stacked",
        "desc": "Each story is a deck. The next walls stand on that deck. This house is drawn as two platforms.",
        "diagram": "platform",
        "preset": "frame2",
        "body": [
            p("In platform framing the crew builds a floor deck, stands walls on it, then builds the next deck on those walls. Stories stay the height of the studs. Balloon framing, the older pattern, runs studs past the floor and hangs the joists on a ledger. It needs fireblocking at the floors so a cavity cannot act as a flue."),
            p("This house shows a main floor and an upper floor with a stair opening. That stacking is platform framing. The joist direction, the hangers, and the nailing are not in the model."),
        ],
        "related": [("../sequence/#frame2", "Second floor in the build order"), ("../roof-framing/", "Roof framing"), ("../stairs/", "Stairs")],
    },
    {
        "slug": "roof-framing",
        "name": "The roof shape",
        "desc": "Rafters and trusses make the roof shape and tie the walls. This house shows a gable, a hip, and a dormer.",
        "diagram": "rafter",
        "preset": "roof",
        "body": [
            p("Site-built rafters are assembled on site. A conventional ridge-board roof uses ties to resist outward thrust; a designed structural ridge-beam roof uses a different support arrangement. In a conventional tied-rafter roof, a rafter tie or suitably connected ceiling joist keeps the two eaves from spreading. A hip rafter runs to an outside corner. A valley rafter sits where two slopes meet in a gutter. A dormer is a small roof and wall cut into a slope, and it has to flash into that slope."),
            p("This house has an east gable, a hip toward the balcony, a dormer on the front, and lower roofs on the garage and the porch. Trusses can make the same shapes. The planes are drawn. The members inside them are not."),
        ],
        "related": [("../trusses/", "Trusses"), ("../trussed-rafters/", "Trussed rafters"), ("../sequence/#roof", "Roof framing in order")],
    },
    {
        "slug": "truss-connections",
        "name": "The plate at a joint",
        "desc": "The plate or gusset at a truss joint transfers the force. The joint is not a place to cut or drill.",
        "diagram": "gusset",
        "preset": "roof",
        "body": [
            p("Members of a truss meet at a joint. A metal plate pressed into the wood, or a nailed plywood gusset on site-built work, transfers the force from one member to the next. The plate size and the tooth pattern are part of the truss engineering. The lumber face alone is not the connection."),
            p("Do not cut, notch, or drill the plate or the member at that joint to run a duct or a wire. If a service has to pass, it passes through an opening the truss design already allows. This page shows the joint. It is not a plate specification."),
        ],
        "related": [("../trusses/", "Trusses"), ("../trussed-rafters/", "Trussed rafters")],
    },
    {
        "slug": "trussed-rafters",
        "name": "Attic room or storage",
        "desc": "A trussed rafter spans like a rafter pair but uses webs. A raised heel leaves room for insulation at the eaves.",
        "diagram": "attic",
        "preset": "roof",
        "body": [
            p("A common truss has webs that fill the attic, which is fine until someone wants storage or a deep insulation blanket at the wall. A raised heel lifts the top chord at the eaves so the insulation can keep its depth where the roof meets the wall. An attic truss leaves a clear middle for a room and carries the loads in the webs at the sides."),
            p("Site-built rafters are assembled on site. A conventional ridge-board roof uses ties to resist outward thrust; a designed structural ridge-beam roof uses a different support arrangement. Trussed rafters arrive designed as units. Neither is drawn inside this roof. The shape of the house could be built either way."),
        ],
        "related": [("../roof-framing/", "Roof framing"), ("../trusses/", "Trusses"), ("../heat-air-moisture/", "Heat, air, and moisture")],
    },
    {
        "slug": "wall-assembly",
        "name": "Layers of an outside wall",
        "desc": "Cladding, a drainage gap, the weather barrier, sheathing, the stud cavity, and the interior board. One wall, several jobs.",
        "diagram": "wall",
        "preset": "siding",
        "body": [
            p("From the weather inward, this example shows cladding, a drainage gap, a water-resistive barrier, sheathing, insulated stud cavities, and interior board. The barrier and its flashings form the drainage plane. Sheathing may also brace the wall against sideways load."),
            p("Western Washington is marine climate zone 4C. Rain is the main wetting, and winter drying is slow. Whether the interior face uses a vapor retarder, and which class, depends on the whole assembly and the code edition. A sheet of plastic on the inside can trap water if the outside cannot dry. This section is the idea of the layers. It is not a wall specification for this house."),
        ],
        "related": [
            ("../heat-air-moisture/", "Heat, air, and moisture"),
            ("../marine-climate/", "Marine climate"),
            ("../../bathroom-waterproofing-guide.html", "Bathroom waterproofing guide"),
            ("../../coastal-waterproofing.html", "Coastal waterproofing"),
        ],
    },
    {
        "slug": "stairs",
        "name": "The flight of stairs",
        "desc": "The stair on this house links the two floors. Rise, run, headroom, and a guard are the teaching points, not a stair design.",
        "diagram": "stair",
        "preset": "stairs",
        "body": [
            p("A stair is a floor folded so people can change level. The rise of each step and the run of each tread stay consistent, or the gait breaks. In the International Residential Code a common limit is a riser no taller than 7 3/4 inches and a tread at least 10 inches. Local amendments differ. A guard is required on the open side, and a handrail where the code asks for one. Headroom has to clear the walking line, including at the landing."),
            p("The flight on this house runs across the plan and arrives on the upper floor. The treads in the model are drawn so the stair reads. They are not a claim that this flight meets the code numbers. The opening in the upper floor is part of the framing, cut before that deck is finished."),
        ],
        "related": [("../platform-framing/", "Platform framing"), ("../second-story/", "A second-story addition")],
    },
    {
        "slug": "heating-and-cooling",
        "name": "Heat and cooling",
        "desc": "A heat pump moves heat. A furnace makes it. Either one needs a path for air, and this sketch does not size the equipment.",
        "diagram": "heat",
        "preset": "rough",
        "body": [
            p("A heat pump moves heat instead of making it by burning fuel. In winter it pulls heat from outside air. In summer it runs the other way. A ducted system uses an outdoor unit, an indoor air handler, and supply and return ducts. Ductless heads skip the ducts and sit in the rooms. A gas furnace makes heat and needs a vent and combustion air. Cooling can be added to a furnace, or the heat pump can do both."),
            p("This house has a utility room on the main floor, which is a common place for the indoor unit. The model does not draw ducts or name a capacity. Fresh air is a separate question from heating: baths and kitchens need exhaust, and the house needs a planned path for outdoor air, not only leaks."),
        ],
        "related": [("../sequence/#rough", "Rough-in"), ("../heat-air-moisture/", "Heat, air, and moisture")],
    },
    {
        "slug": "plumbing",
        "name": "Water in and waste out",
        "desc": "Supply, a water heater, fixtures, and drains with vents. The wet rooms on this plan are the kitchen, baths, and laundry.",
        "diagram": "plumb",
        "preset": "rough",
        "body": [
            p("Supply pipes bring water under pressure. A heater stores it or heats it as it passes. Fixtures use it, then the drain carries waste by gravity. Each trap needs a vent so the water seal is not sucked out. Vents rise to open air. Drains slope. Under-slab drains have to be in place before the slab is poured."),
            p("On this plan the wet rooms are the kitchen, the powder room, the upper baths, and the laundry. Stacking them shortens the drains. The utility room is a likely heater location. The drawing names the rooms. It does not route a pipe or pick copper or cross-linked polyethylene."),
        ],
        "related": [("../sequence/#slab", "Under-slab work"), ("../electrical/", "Electrical")],
    },
    {
        "slug": "electrical",
        "name": "Power from the meter",
        "desc": "Power arrives at a meter and a panel, then leaves on branch circuits. This is not a load calculation.",
        "diagram": "power",
        "preset": "rough",
        "body": [
            p("At the service disconnect, the neutral is bonded to the grounding system. Downstream panels keep neutral conductors isolated from equipment grounds. The exact arrangement follows the approved electrical design and applicable code. The utility lands at a meter, and a panel splits the service into branch circuits. Kitchens, baths, and laundry have extra rules for dedicated circuits and for protection against ground faults. Bedrooms need smoke alarms. Those rules are in the electrical code, not in this sketch."),
            p("The utility room is a plausible panel location because it is inside, dry, and reachable. The model does not show a panel, a wire, or a service size."),
        ],
        "related": [
            ("../../posts/2026-08-10-electrical-upgrades-bathroom-remodels-wa.html", "Electrical upgrades in bathroom remodels"),
            ("../plumbing/", "Plumbing"),
            ("../sequence/#rough", "Rough-in"),
        ],
    },
    {
        "slug": "second-story",
        "name": "Adding a story",
        "desc": "Adding a story loads the walls and foundation that are already there, and it opens the roof. This drawing is already two stories.",
        "preset": "frame2",
        "body": [
            p("A second story puts a new floor and a new roof on walls and a foundation that were built for the old roof. Someone has to check that those walls, the lateral bracing, and the footings can take the added weight and the taller wind and seismic load. Bedrooms need a legal way out. The new stair has to fit, with headroom, often by giving up part of a room below."),
            p("The roof of the existing house is opened to build the new floor. Until the new roof sheds water, the house below is exposed. Weather protection of that opening is the first site problem, ahead of finishes. The new floor has to tie into the old frame, not merely sit on it."),
            p("This model is already a two-story house. It shows what stacking a floor looks like. It is not a design for adding a story to a different house, and it is not a cost."),
        ],
        "related": [
            ("../../posts/2026-08-08-another-story-method-weatherproof-first.html", "Weatherproof-first method"),
            ("../../posts/2026-08-09-second-story-vs-teardown-edmonds.html", "Second story or teardown"),
            ("../../second-story-vs-teardown.html", "Second story and teardown guide"),
            ("../../home-addition-planning.html", "Home addition planning"),
            ("../../additions.html", "Additions directory"),
        ],
    },
    {
        "slug": "heat-air-moisture",
        "name": "Heat, leaks, and drying",
        "desc": "Insulation slows heat. Sealing stops leaks. The wall still has to dry after rain. Marine climate zone 4C.",
        "diagram": "wall",
        "preset": "insulate",
        "body": [
            p("Heat moves through materials, with leaking air, and by radiation. Insulation slows the first. Sealing slows the second. A shiny surface can slow the third, but only if it faces an air space. Most of the comfort problem in an ordinary wall is the first two."),
            p("Moisture rides with leaking air and, more slowly, as vapor. A wall in western Washington gets wet from rain. Winter drying is slow. If the cladding and the weather barrier cannot let that water out, insulation will not save the sheathing. Climate zone 4C is the marine zone used for much of this region. The class of vapor retarder on the inside is chosen for the whole assembly. It is not automatically a polyethylene sheet."),
        ],
        "related": [("../wall-assembly/", "Wall assembly"), ("../marine-climate/", "Marine climate"), ("../../coastal-waterproofing.html", "Coastal waterproofing")],
    },
    {
        "slug": "rooms",
        "name": "Rooms on this drawing",
        "desc": "The rooms drawn on this house: garage and main floor, then bedrooms, baths, and laundry above.",
        "preset": "drywall",
        "body": [
            p("The main floor, as drawn, holds a two-car garage, a utility room, a pantry, the kitchen and its island, dining, a living room with a fireplace, a powder room, a mudroom, the foyer and entrance, a home office, storage, and a patio. The stair leaves this floor near the middle."),
            p("The upper floor holds a primary bedroom with a walk-in closet and a bath, two more bedrooms, two baths, laundry, and a balcony beside the garage. The same stair arrives here. The garage roof is below the upper floor, not a room."),
            p("Those names are the plan. The sketch does not give furniture clearances, door swings, or a finish schedule. Overall width on the upper sheet is about 45 feet. The garage is about 22 feet. Other small figures on the sheets are too unclear to treat as dimensions."),
        ],
        "related": [("../stairs/", "Stairs"), ("../explore/", "Explore this house")],
    },
    {
        "slug": "marine-climate",
        "name": "Rain in this region",
        "desc": "Western Washington is wet and slow to dry. Overhangs, drained cladding, and grade that falls away match that weather.",
        "preset": "siding",
        "body": [
            p("The Puget Sound climate is mild and wet. Rain comes for much of the year, and a wall that gets wet in winter may not dry until spring. The regional habits that match that are simple: a roof overhang where the massing allows it, cladding that drains behind the face, flashings that kick water out, and soil that slopes away from the wall."),
            p("The coast takes harder wind-driven rain than an inland Seattle lot. Seismic design still applies across the region. This house is a teaching model with a gable, a hip, and a drained-cladding idea. It is not a coastal assembly and not a seismic design."),
        ],
        "related": [
            ("../wall-assembly/", "Wall assembly"),
            ("../../coastal-waterproofing.html", "Coastal waterproofing"),
            ("../../bathroom-waterproofing-guide.html", "Bathroom waterproofing"),
        ],
    },
]

COLLECTION = [
    ("sequence", "The work, hold by hold"),
    ("cut-and-fill", "Leveling a sloping lot"),
    ("excavation", "Digging and backfill"),
    ("foundation-types", "What the house sits on"),
    ("spread-footings", "How wide the concrete is"),
    ("load-path", "Where the weight goes"),
    ("columns", "Posts you can see"),
    ("beams", "Beams over openings"),
    ("platform-framing", "Two floors stacked"),
    ("roof-framing", "The roof shape"),
    ("trusses", "Triangles in the roof"),
    ("truss-connections", "The plate at a joint"),
    ("trussed-rafters", "Attic room or storage"),
    ("stairs", "The flight of stairs"),
    ("lateral-stability", "Wind and earthquakes"),
    ("arches-and-vaults", "Why there is no arch"),
    ("masonry-bonding", "Face versus structure"),
    ("wall-assembly", "Layers of an outside wall"),
    ("building-systems", "One house, four jobs"),
    ("heating-and-cooling", "Heat and cooling"),
    ("plumbing", "Water in and waste out"),
    ("electrical", "Power from the meter"),
]

CATEGORIES = [
    ("Understanding the site", "The lot, the soil, the pad, and the rain that falls on it.", ["cut-and-fill", "excavation", "foundation-types", "spread-footings", "rooms", "marine-climate"], ["Reading a soils report", "Roof water to the street"]),
    ("Following loads", "Where the weight goes, and what keeps the house from racking.", ["load-path", "columns", "beams", "platform-framing", "roof-framing", "trusses", "truss-connections", "trussed-rafters", "stairs", "lateral-stability", "arches-and-vaults", "masonry-bonding"], ["Diaphragm nailing"]),
    ("Keeping rain out", "The layers that shed water, and how the wall dries.", ["wall-assembly", "heat-air-moisture"], ["Window flashing", "Roof edge", "Sound between rooms", "Daylight levels"]),
    ("Coordinating services", "Structure, water, heat, and power as one house.", ["building-systems", "heating-and-cooling", "plumbing", "electrical"], ["Outdoor-air rates"]),
    ("Changing an existing home", "A second story loads walls and a foundation that are already there.", ["second-story"], ["Finding rot", "Seismic retrofit"]),
]

COMPARISONS = [
    ("Slab on grade, or a crawl space",
     "The floor is concrete on a stone base and a vapor retarder. Pipes under it are buried, so they are planned before the pour. The edge has to deal with frost and with heat loss.",
     "Short walls lift a wood floor. Someone can reach drains and ducts later. The crawl space has to be dried and vented, or sealed and conditioned. A wet crawl space rots the floor above it.",
     "This house is drawn as a slab-level pad. A crawl space would show taller foundation walls."),
    ("Platform frame, or balloon frame",
     "Each story is a deck. Walls are one story tall, so the lumber is ordinary stud length and the floor stops the cavity.",
     "Studs run past the floor and the joists hang on a ledger. It was common in older houses. The floor cavity needs fireblocking so it is not a chimney.",
     "The two floor lines on this model are platform framing."),
    ("Roof trusses, or site-built rafters",
     "Trusses are designed as units and set quickly. The webs are part of the structure. You do not cut them to make an attic.",
     "Site-built rafters are assembled on site. A conventional ridge-board roof uses ties to resist outward thrust; a designed structural ridge-beam roof uses a different support arrangement.",
     "The roof planes on this house could be either. The drawing does not decide."),
    ("A gable end, or a hip",
     "A gable is a triangular wall. It is simple, and it takes wind on that flat face. The east end of this house is a gable.",
     "A hip slopes on all sides, so there is no tall flat face. It needs hip rafters and more intersections. The west side of this house hips toward the balcony.",
     "Both are already on this roof. Neither is called better."),
    ("Cavity insulation alone, or a layer outside the sheathing",
     "Filling the stud bay is the usual first move. The studs themselves remain cold bridges.",
     "A continuous layer outside the sheathing covers those bridges. It changes the drying of the wall and the thickness at windows, so it belongs to the whole assembly.",
     "The model shows the frame, not an insulation product."),
    ("Cladding that drains, or cladding tight to the wall",
     "A gap or a drainage mat behind the siding lets water that passes the face run out and lets the back dry.",
     "Direct-applied siding still relies on a properly integrated water-resistive barrier and flashing behind it. A separate drainage gap can improve drainage and drying. Whether that gap is required depends on the cladding, assembly, manufacturer's instructions, and applicable code.",
     "The siding strokes on this house stand for a drained skin."),
    ("Dampproofing, or waterproofing",
     "A dampproof coating on a foundation resists moisture when water is drained away and does not press on the wall.",
     "Waterproofing is a continuous membrane for walls that can see standing water, such as a basement in wet soil. It still wants a drain. The coating is not a substitute for slope.",
     "This pad is not drawn as a basement."),
    ("A heat pump, or a furnace",
     "A heat pump moves heat and can cool as well. In a mild marine winter it is often the simpler year-round machine. Cold snaps still need a design that holds up.",
     "A furnace makes heat by burning fuel and needs a vent and combustion air. Cooling is a separate coil if you want it.",
     "The utility room could hold either. Capacity is not in the sketch."),
    ("Shear walls, or a moment frame",
     "A solid wall with structural sheathing and hold-downs is the ordinary way to take sideways load.",
     "A moment frame resists by bending when a wall cannot be solid, such as a long glass line. It is designed, not improvised from a window header.",
     "The model has walls that could be shear walls. It has no moment frame drawn."),
    ("Cut the high side, or fill the low side",
     "Cutting native ground leaves the house on soil that is already in place.",
     "Filling can level the pad, but only with material placed in layers and compacted. Organic soil is stripped first. A footing on loose fill settles.",
     "See the cut-and-fill diagram. This house is shown after the pad is level."),
    ("A second story, or a teardown",
     "Keeping the main floor and adding above saves the part of the house that still works, if the foundation and the walls can carry the new load and the roof can be opened safely.",
     "A teardown starts from a new foundation. It is the clearer structure when the existing frame, the foundation, or the plan is not worth keeping. It is also a larger project.",
     "This drawing is already two stories. It does not price either path."),
    ("Dry the roof in first, or finish inside while it is open",
     "Closing the roof and the openings protects the structure and the existing rooms. In this climate that is the urgent work.",
     "Interior finishes before the shell sheds water get wet, and wet board and insulation are often thrown out.",
     "The sequence on this site puts dry-in before the rough-in is buried."),
    ("Copper supply pipe, or PEX",
     "Copper is rigid, handles sunlight better, and is joined by solder or press fittings. It costs more in labor on a remodel.",
     "Cross-linked polyethylene is flexible and is common in remodels because it can snake through existing bays. It has to be kept off flames and out of sunlight, and the fittings have to be the listed ones.",
     "This plan does not choose a pipe."),
    ("A tank heater, or a tankless heater",
     "A tank stores hot water. The recovery rate and the tank size set how long it lasts. A gas tank needs a vent. An electric tank needs a circuit.",
     "A tankless unit heats water as it flows. Its capacity depends on the required flow and temperature rise, together with the available gas or electrical supply. Indoor gas units need approved combustion venting; condensing gas units also need condensate drainage. Electric tankless units do not need a combustion vent.",
     "The utility room could hold either. The sketch does not size one."),
]

SOON_COMPARISONS = [
    "Window frame materials",
    "Ridge vent or gable vents",
    "Nail schedules for shear walls",
    "Specific code editions side by side",
]


def article_by_slug(slug: str) -> dict:
    if slug == "sequence":
        return {"name": "The work, hold by hold", "desc": "Nineteen hold points from the survey to the final walk, on this slab house.", "href": "sequence/"}
    for item in ARTICLES:
        if item["slug"] == slug:
            found = dict(item)
            found["href"] = f"{item['slug']}/"
            return found
    raise KeyError(slug)


def json_ld(obj: dict) -> str:
    return '<script type="application/ld+json">\n' + json.dumps(obj, indent=2) + "\n</script>"


def crumb_ld(items: list[tuple[str, str]]) -> str:
    elements = []
    for i, (name, url) in enumerate(items, 1):
        elements.append({"@type": "ListItem", "position": i, "name": name, "item": url})
    return json_ld({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": elements,
    })


def webpage_ld(name: str, url: str, desc: str) -> str:
    return json_ld({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": url + "#webpage",
        "url": url,
        "name": name,
        "description": desc,
        "datePublished": DATE,
        "dateModified": DATE,
        "isPartOf": {"@id": ORIGIN + "/#website"},
        "publisher": {"@id": ORIGIN + "/#organization"},
        "inLanguage": "en-US",
    })


OG_ALT = "Illustrative Pacific Northwest home concept for Board of Project Stewardship — not a bid or stamped plan"
SEAL_ALT = "The Board of Project Stewardship seal"


def seal_picture(kind: str) -> str:
    """Same official seal as the site header and footer. Root-absolute."""
    base = "/assets/icons/"
    webp = f"{base}seal-96.webp 96w, {base}seal-192.webp 192w, {base}seal-512.webp 512w"
    png = f"{base}seal-96.png 96w, {base}seal-192.png 192w, {base}seal-512.png 512w"
    if kind == "header":
        cls = "site-seal"
        sizes = "(min-width: 1280px) 52px, 40px"
        width = height = 40
        loading = "eager"
    else:
        cls = "site-footer-seal"
        sizes = "112px"
        width = height = 112
        loading = "lazy"
    return (
        f'<picture class="{cls}-picture">'
        f'<source type="image/webp" srcset="{webp}" sizes="{sizes}">'
        f'<img class="{cls}" src="{base}seal-192.png" srcset="{png}" sizes="{sizes}" '
        f'width="{width}" height="{height}" alt="{SEAL_ALT}" loading="{loading}" decoding="async">'
        f"</picture>"
    )


def head(name: str, desc: str, canon_path: str, extra_ld: str, depth: int, og_type: str = "website") -> str:
    title = title_of(name)
    canon = ORIGIN + "/" + canon_path
    root = "../" * depth
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="{esc(desc)}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#14181c">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(desc)}">
  <meta property="og:type" content="{esc(og_type)}">
  <meta property="og:url" content="{canon}">
  <meta property="og:image" content="{OG}">
  <meta property="og:image:alt" content="{esc(OG_ALT)}">
  <meta property="og:site_name" content="{BRAND}">
  <meta property="og:locale" content="en_US">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{esc(title)}">
  <meta name="twitter:description" content="{esc(desc)}">
  <meta name="twitter:image" content="{OG}">
  <link rel="canonical" href="{canon}">
  <link rel="preload" href="/assets/fonts/InterLatin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="alternate" type="application/rss+xml" title="{BRAND} Blog" href="{ORIGIN}/blog/rss.xml">
  <link rel="icon" href="{ORIGIN}/assets/icons/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="{ORIGIN}/assets/icons/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="{ORIGIN}/assets/icons/apple-touch-icon.png">
  <title>{esc(title)}</title>
  <link rel="stylesheet" href="/assets/css/learn.css">
  {webpage_ld(title, canon, desc)}
  {extra_ld}
</head>
<body>
  <a class="learn-skip" href="#main-content">Skip to content</a>
  <header class="learn-top">
    <a class="learn-brand" href="{root}">{seal_picture("header")}<span class="learn-brand-name">Board of Project Stewardship</span></a>
    <button type="button" class="learn-menu" aria-expanded="false" aria-controls="learn-menu-panel">Menu</button>
    <nav class="learn-nav" id="learn-menu-panel" aria-label="Primary">
      <a href="{root}"{ ' aria-current="page"' if canon_path in ("", "index.html") else ""}>Home</a>
      <a href="{root}learn.html"{ ' aria-current="page"' if canon_path == "learn.html" else ""}>Learn hub</a>
      <a href="{root}learn/"{ ' aria-current="page"' if canon_path == "learn/" else ""}>This house</a>
      <a href="{root}learn/sequence/"{ ' aria-current="page"' if canon_path == "learn/sequence/" else ""}>Build order</a>
      <a href="{root}learn/explore/"{ ' aria-current="page"' if canon_path == "learn/explore/" else ""}>Explore</a>
      <a href="{root}learn/compare/"{ ' aria-current="page"' if canon_path == "learn/compare/" else ""}>Compare</a>
    </nav>
  </header>
"""


def crumb_nav(items: list[tuple[str, str]], depth: int) -> str:
    root = "../" * depth
    parts = []
    for i, (name, href) in enumerate(items):
        if i:
            parts.append('<span aria-hidden="true">/</span>')
        if i == len(items) - 1:
            parts.append(f'<span aria-current="page">{esc(name)}</span>')
        else:
            url = root + href if not href.startswith("http") else href
            if href == "":
                url = root
            parts.append(f'<a href="{esc(url)}">{esc(name)}</a>')
    return '<nav class="learn-crumb" aria-label="Breadcrumb">' + "".join(parts) + "</nav>"


def footer(depth: int, viewer_script: bool = False) -> str:
    root = "../" * depth
    scripts = '<script src="/assets/js/learn-house.js" defer></script>'
    if viewer_script:
        scripts = '<script src="/assets/js/scroll-house.js" defer></script>\n  ' + scripts
    return f"""
  <footer class="learn-foot">
    <a class="learn-foot-brand" href="{root}">{seal_picture("footer")}<span class="learn-foot-name">Board of Project Stewardship</span></a>
    <p>Teaching sketch. Not a structural design, a bid, or a permit set. Confirm the work with the drawings and the jurisdiction.</p>
    <p><a href="{root}">Home</a> · <a href="{root}learn.html">Learn hub</a> · <a href="{root}learn/">How a house is built</a> · <a href="mailto:editorial@boardofprojectstewardship.com">editorial@boardofprojectstewardship.com</a></p>
  </footer>
  {scripts}
</body>
</html>
"""


def viewer(preset: str, label: str) -> str:
    return (
        f'<figure class="learn-still" data-learn-view="still" data-preset="{esc(preset)}">'
        f'<canvas width="960" height="540" tabindex="0" role="application" aria-describedby="learn-keys" aria-label="{esc(label)}"></canvas>'
        f'<div class="learn-actions">'
        f'<button type="button" class="learn-btn" data-learn-zoom="in">Zoom in</button>'
        f'<button type="button" class="learn-btn" data-learn-zoom="out">Zoom out</button>'
        f'<button type="button" class="learn-btn" data-learn-reset>Reset view</button>'
        f'</div>'
        f'<p id="learn-keys" class="learn-keys">Arrow keys turn the house. Plus and minus, or the zoom buttons, change the zoom. A horizontal drag turns it after you tap the drawing. Reset view returns to the step camera.</p>'
        f'<figcaption class="learn-caption">Teaching sketch of this house. Not a structural design.</figcaption>'
        f'<p class="learn-fallback">The drawing needs WebGL. The notes on the page still stand.</p>'
        f"</figure>"
    )


def switches(items: list[tuple[str, str]] | None) -> str:
    if not items:
        return ""
    buttons = []
    for i, (preset, label) in enumerate(items):
        pressed = "true" if i == len(items) - 1 else "false"
        buttons.append(
            f'<button type="button" class="learn-btn" data-learn-preset="{esc(preset)}" aria-pressed="{pressed}">{esc(label)}</button>'
        )
    return '<div class="learn-switch">' + "".join(buttons) + "</div>"


def related(links: list[tuple[str, str]]) -> str:
    lis = "".join(f'<li><a href="{esc(href)}">{esc(text)}</a></li>' for href, text in links)
    return f'<section class="learn-related"><h2>Related reading</h2><ul>{lis}</ul></section>'


def write(path: Path, text: str) -> None:
    if FORBIDDEN.search(text):
        raise SystemExit(f"forbidden term in {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def build_article(item: dict) -> str:
    slug = item["slug"]
    canon = f"learn/{slug}/"
    url = f"{ORIGIN}/{canon}"
    desc = item["desc"]
    article = json_ld({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": item["name"],
        "description": desc,
        "datePublished": DATE,
        "dateModified": DATE,
        "url": url,
        "mainEntityOfPage": url,
        "image": OG,
        "author": {"@type": "Organization", "name": BRAND, "@id": ORIGIN + "/#organization"},
        "publisher": {"@id": ORIGIN + "/#organization"},
        "inLanguage": "en-US",
    })
    crumbs = [("Home", ""), ("How a house is built", "learn/"), (item["name"], canon)]
    body = []
    if item.get("preset"):
        body.append(viewer(item["preset"], item["name"] + ", drawn on this house"))
    body.append(switches(item.get("switches")))
    if item.get("diagram"):
        body.append(DIAGRAMS[item["diagram"]])
    body.append('<div class="learn-prose">' + "".join(item["body"]) + "</div>")
    body.append(related(item["related"]))
    return (
        head(item["name"], desc, canon, article + crumb_ld([(n, ORIGIN + "/" + (h or "")) for n, h in crumbs]), 2, "article")
        + f'<main id="main-content" tabindex="-1">\n{crumb_nav(crumbs, 2)}\n'
        + '<article class="learn-wrap learn-hero">'
        + f'<p class="learn-kicker">How a house is built</p><h1>{esc(item["name"])}</h1>'
        + f'<p class="learn-dek">{esc(desc)}</p>'
        + "".join(body)
        + "</article></main>"
        + footer(2, bool(item.get("preset")))
    )


def build_sequence() -> str:
    desc = "Nineteen hold points for this slab house, from the survey to the final walk. Teaching sketch, not a structural design."
    canon = "learn/sequence/"
    url = ORIGIN + "/" + canon
    howto_steps = []
    for i, (sid, _preset, _short, title, phase, body) in enumerate(STEPS, 1):
        howto_steps.append({
            "@type": "HowToStep",
            "position": i,
            "name": title,
            "text": body,
            "url": url + "#" + sid,
        })
    extra = json_ld({
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": "How this house goes together from the ground up",
        "description": desc,
        "url": url,
        "datePublished": DATE,
        "dateModified": DATE,
        "step": howto_steps,
    })
    steps_json = []
    rail = []
    reading = []
    for i, (sid, preset, short, title, phase, body) in enumerate(STEPS):
        steps_json.append({
            "id": sid, "preset": preset, "kicker": f"{i+1:02d}",
            "title": title, "phase": phase, "body": body,
        })
        rail.append(f'<button type="button" class="learn-btn" data-index="{i}">{esc(short)}</button>')
        reading.append(
            f'<li id="{sid}"><h3>{i+1:02d} {esc(title)}</h3><p>{esc(body)}</p></li>'
        )
    crumbs = [("Home", ""), ("How a house is built", "learn/"), ("Build order", canon)]
    sticky = f"""
<main id="main-content" tabindex="-1">
{crumb_nav(crumbs, 2)}
<section class="learn-seq" id="learn-seq" data-learn-view="sequence" aria-labelledby="learn-seq-title">
  <div class="learn-seq-track">
    <div class="learn-seq-sticky">
      <p class="learn-kicker" id="learn-step-phase">{esc(STEPS[0][4])}</p>
      <h1 id="learn-seq-title">Hold points on this house</h1>
      <ol class="learn-rail" aria-label="Build steps">{''.join('<li>'+b+'</li>' for b in rail)}</ol>
      <label class="learn-scrub">Step <span id="learn-step-count">01 of 19</span>
        <input type="range" min="1" max="19" value="1" aria-valuemin="1" aria-valuemax="19" aria-valuetext="{esc(STEPS[0][3])}">
      </label>
      <div class="learn-sheet">
        <canvas width="960" height="540" tabindex="0" aria-describedby="learn-keys" aria-label="This house at the current build step."></canvas>
      </div>
      <div class="learn-copy">
        <h2 id="learn-step-title">{esc(STEPS[0][3])}</h2>
        <p id="learn-step-body">{esc(STEPS[0][5])}</p>
      </div>
      <p id="learn-keys" class="learn-keys">Arrow keys turn the house. Plus and minus, or the zoom buttons, change the zoom. A horizontal drag turns it after you tap the drawing. Reset view returns to the step camera.</p>
      <div class="learn-dirs">
        <button type="button" class="learn-btn" data-learn-zoom="in">Zoom in</button>
        <button type="button" class="learn-btn" data-learn-zoom="out">Zoom out</button>
        <button type="button" class="learn-btn" data-learn-reset>Reset view</button>
        <button type="button" class="learn-btn" data-learn-dir="-1" disabled>Previous</button>
        <button type="button" class="learn-btn" data-learn-dir="1">Next</button>
      </div>
      <p class="learn-fallback">The drawing needs WebGL. The written steps below still stand.</p>
    </div>
  </div>
</section>
<script type="application/json" id="learn-steps">{json.dumps(steps_json)}</script>
<section class="learn-read" aria-labelledby="learn-read-title">
  <h2 id="learn-read-title">The nineteen steps, in words</h2>
  <ol>{''.join(reading)}</ol>
  <p><a href="../explore/">Explore the finished house</a> · <a href="../compare/">Why this, not that</a> · <a href="../../posts/2026-08-08-another-story-method-weatherproof-first.html">Weatherproof-first, when a roof is opened</a></p>
</section>
</main>
"""
    return head("Hold points on this house", desc, canon, extra + crumb_ld([(n, ORIGIN + "/" + (h or "")) for n, h in crumbs]), 2) + sticky + footer(2, True)


def build_explore() -> str:
    desc = "Start with this house. Turn a system on, pick a part, and follow it to a closer explanation."
    canon = "learn/explore/"
    parts = [
        ("whole", "Whole house", "grade", "The whole house",
         "This is the finished massing: garage, two stories, porch, balcony, gable, hip, and dormer. Tap the drawing, then drag to turn it. Pick a part to see what it is doing.",
         "../sequence/", "Follow the build order"),
        ("ground", "Ground", "footings", "Ground and footings",
         "The base spreads the house into the soil. On this sketch it is a low pad, not a basement and not a soils report.",
         "../spread-footings/", "Follow the footing"),
        ("walls", "Walls", "load", "Bearing walls",
         "The outside walls carry the floors and the roof down. Partitions divide rooms. The highlight is the idea of the load path, not a wall check.",
         "../load-path/", "Follow the load path"),
        ("upper", "Upper floor", "frame2", "The upper floor",
         "A second platform sits on the main-floor walls, with the stair opening framed in it. Bedrooms, baths, laundry, and the balcony are on this level.",
         "../platform-framing/", "Follow the platform"),
        ("roof", "Roof", "roof", "The roof",
         "Gable, hip, dormer, and the lower garage and porch roofs. The planes are drawn. The rafters or trusses inside them are not.",
         "../roof-framing/", "Follow the roof"),
        ("stairs", "Stairs", "stairs", "The stair",
         "One flight connects the floors. It needs a consistent rise and run, headroom, and a guard. The treads here are for the picture.",
         "../stairs/", "Follow the stair"),
        ("porch", "Porch", "columns", "The porch",
         "The porch roof lands on posts. Those posts are the columns you can see, and each needs a path to a footing.",
         "../columns/", "Follow the posts"),
        ("skin", "Skin", "siding", "Siding and roof cover",
         "The strokes are the rain coat: board-and-batten on the east gable, courses elsewhere, roofs that shed water.",
         "../wall-assembly/", "Follow the wall layers"),
        ("rooms", "Rooms", "drywall", "The rooms",
         "Cut the main floor open and the room names appear: garage, kitchen, living, office, and the stair. The upper floor has the bedrooms.",
         "../rooms/", "Follow the rooms"),
    ]
    payload = []
    buttons = []
    fallback_links = []
    for pid, label, preset, title, body, href, link in parts:
        payload.append({"id": pid, "preset": preset, "title": title, "body": body, "href": href, "link": link})
        buttons.append(f'<button type="button" class="learn-btn" data-part="{pid}">{esc(label)}</button>')
        fallback_links.append(f'<li><a href="{esc(href)}">{esc(link)}</a></li>')
    crumbs = [("Home", ""), ("How a house is built", "learn/"), ("Explore", canon)]
    main = f"""
<main id="main-content" tabindex="-1">
{crumb_nav(crumbs, 2)}
<div class="learn-explore" data-learn-view="explore">
  <div>
    <p class="learn-kicker">One house</p>
    <h1>Explore this house</h1>
    <p class="learn-dek">{esc(desc)}</p>
    <div class="learn-sheet">
      <canvas width="960" height="540" tabindex="0" aria-describedby="learn-keys" aria-label="This house. Choose a part, then turn the drawing."></canvas>
    </div>
    <div class="learn-actions">
      <button type="button" class="learn-btn" data-learn-zoom="in">Zoom in</button>
      <button type="button" class="learn-btn" data-learn-zoom="out">Zoom out</button>
      <button type="button" class="learn-btn" data-learn-reset>Reset view</button>
    </div>
    <p id="learn-keys" class="learn-keys">Arrow keys turn the house. Plus and minus, or the zoom buttons, change the zoom. A horizontal drag turns it after you tap the drawing. Reset view returns to the part camera.</p>
    <p id="learn-status" class="learn-status" aria-live="polite"></p>
    <p class="learn-fallback">The drawing needs WebGL. The written pages below still stand.</p>
    <ul class="learn-fallback-links">{''.join(fallback_links)}</ul>
  </div>
  <div>
    <div class="learn-parts" role="group" aria-label="Parts of the house">{''.join(buttons)}</div>
    <article class="learn-prose">
      <h2 id="learn-part-title">The whole house</h2>
      <p id="learn-part-body">{esc(parts[0][4])}</p>
      <p><a class="learn-follow" id="learn-part-link" href="../sequence/">Follow the build order</a></p>
    </article>
  </div>
</div>
<script type="application/json" id="learn-parts">{json.dumps(payload)}</script>
</main>
"""
    return head("Explore this house", desc, canon, crumb_ld([(n, ORIGIN + "/" + (h or "")) for n, h in crumbs]), 2) + main + footer(2, True)


def build_compare() -> str:
    desc = "Construction choices side by side. Neither column is a rule. The right one depends on the site, the code, and the house."
    canon = "learn/compare/"
    url = ORIGIN + "/" + canon
    blocks = []
    for title, left, right, note in COMPARISONS:
        blocks.append(
            "<article class=\"learn-choice\">"
            f"<h2>{esc(title)}</h2>"
            "<div class=\"learn-choice-grid\">"
            f"<div><h3>One way</h3><p>{esc(left)}</p></div>"
            f"<div><h3>The other way</h3><p>{esc(right)}</p></div>"
            "</div>"
            f"<p class=\"learn-choice-note\">{esc(note)} Teaching sketch, not a specification.</p>"
            "</article>"
        )
    soon = "".join(f'<li class="is-soon"><span>{esc(name)}</span> <em>Coming soon</em></li>' for name in SOON_COMPARISONS)
    extra = json_ld({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "Why this, not that",
        "description": desc,
        "datePublished": DATE,
        "dateModified": DATE,
        "url": url,
        "mainEntityOfPage": url,
        "image": OG,
        "author": {"@type": "Organization", "name": BRAND, "@id": ORIGIN + "/#organization"},
        "publisher": {"@id": ORIGIN + "/#organization"},
    })
    crumbs = [("Home", ""), ("How a house is built", "learn/"), ("Compare", canon)]
    main = f"""
<main id="main-content" tabindex="-1">
{crumb_nav(crumbs, 2)}
<article class="learn-wrap learn-hero">
  <p class="learn-kicker">Choices</p>
  <h1>Why this, not that</h1>
  <p class="learn-dek">{esc(desc)}</p>
  {''.join(blocks)}
  <section class="learn-section">
    <h2>Still to write</h2>
    <ul class="learn-index">{soon}</ul>
  </section>
  <p class="learn-related"><a href="../sequence/">Build order</a> · <a href="../second-story/">Second-story addition</a> · <a href="../../second-story-vs-teardown.html">Second story or teardown</a></p>
</article>
</main>
"""
    return head("Why this, not that", desc, canon, extra + crumb_ld([(n, ORIGIN + "/" + (h or "")) for n, h in crumbs]), 2, "article") + main + footer(2)


def build_landing() -> str:
    desc = "How this house is built, from the ground up, with the parts you can open. Teaching sketch, not a structural design."
    canon = "learn/"
    url = ORIGIN + "/" + canon
    cats = []
    for title, dek, slugs, soon in CATEGORIES:
        lis = []
        for slug in slugs:
            item = article_by_slug(slug)
            lis.append(f'<li><a href="{esc(item["href"])}">{esc(item["name"])}</a></li>')
        for name in soon:
            lis.append(f'<li class="is-soon"><span>{esc(name)}</span> <em>Coming soon</em></li>')
        cats.append(
            f'<section class="learn-cat"><h3>{esc(title)}</h3><p>{esc(dek)}</p><ol>{"".join(lis)}</ol></section>'
        )
    collection = []
    item_ld = []
    for i, (slug, label) in enumerate(COLLECTION, 1):
        item = article_by_slug(slug)
        href = item["href"]
        collection.append(f'<li><a href="{esc(href)}"><span>{i:02d}</span> {esc(label)}</a></li>')
        item_ld.append({
            "@type": "ListItem",
            "position": i,
            "name": label,
            "url": url + href,
        })
    extra = json_ld({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "How a house is built",
        "description": desc,
        "url": url,
        "datePublished": DATE,
        "dateModified": DATE,
        "mainEntity": {"@type": "ItemList", "itemListElement": item_ld},
    })
    crumbs = [("Home", ""), ("How a house is built", canon)]
    main = f"""
<main id="main-content" tabindex="-1">
{crumb_nav(crumbs, 1)}
<article class="learn-wrap">
  <header class="learn-hero">
    <p class="learn-kicker">One house, opened up</p>
    <h1>How a house is built</h1>
    <p class="learn-dek">The same house as the homepage drawing. Follow it from the ground up, open a part, or compare two ways of building. Written pages are finished. Anything still unnamed as a page is marked coming soon.</p>
  </header>
  {viewer("grade", "The finished house used throughout this guide")}
  <div class="learn-actions">
    <a class="learn-btn is-primary" href="sequence/">Build order</a>
    <a class="learn-btn" href="explore/">Explore the house</a>
    <a class="learn-btn" href="compare/">Why this, not that</a>
  </div>
  <section class="learn-section" aria-labelledby="learn-topics">
    <h2 id="learn-topics">Topics</h2>
    <div class="learn-cats">{''.join(cats)}</div>
  </section>
  <section class="learn-section" aria-labelledby="learn-order">
    <h2 id="learn-order">Building this house, in order</h2>
    <p class="learn-dek">Nineteen steps. Scroll them, or open the full sequence.</p>
    <ol class="learn-index">
      {''.join(f'<li><a href="sequence/#{sid}">{i:02d} {esc(title)}</a></li>' for i, (sid, _p, _s, title, _ph, _b) in enumerate(STEPS, 1))}
    </ol>
  </section>
  <section class="learn-section" aria-labelledby="learn-collection">
    <h2 id="learn-collection">The collection</h2>
    <ol class="learn-index">{''.join(collection)}</ol>
  </section>
</article>
</main>
"""
    return head("How a house is built", desc, canon, extra + crumb_ld([(n, ORIGIN + "/" + (h or "")) for n, h in crumbs]), 1) + main + footer(1, True)


SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"


def update_sitemap(paths: list[str], sitemap_path: Path | None = None) -> None:
    sitemap_path = sitemap_path or (ROOT / "sitemap.xml")
    ET.register_namespace("", SITEMAP_NS)
    tree = ET.parse(sitemap_path)
    root = tree.getroot()
    ns = {"sm": SITEMAP_NS}
    for url in list(root):
        loc = url.find("sm:loc", ns)
        if loc is None or not loc.text:
            continue
        text = loc.text.strip()
        if "/learn/" in text and not text.rstrip("/").endswith("learn.html"):
            root.remove(url)
    for path in paths:
        url = ET.SubElement(root, f"{{{SITEMAP_NS}}}url")
        loc = ET.SubElement(url, f"{{{SITEMAP_NS}}}loc")
        loc.text = f"{ORIGIN}/{path}"
        lastmod = ET.SubElement(url, f"{{{SITEMAP_NS}}}lastmod")
        lastmod.text = DATE
        freq = ET.SubElement(url, f"{{{SITEMAP_NS}}}changefreq")
        freq.text = "weekly"
        priority = ET.SubElement(url, f"{{{SITEMAP_NS}}}priority")
        priority.text = "0.7"
    locs = []
    for url in root:
        loc = url.find("sm:loc", ns)
        if loc is not None and loc.text:
            locs.append(loc.text.strip())
    duplicates = sorted({item for item in locs if locs.count(item) > 1})
    if duplicates:
        raise SystemExit(f"duplicate sitemap locs: {duplicates}")
    ET.indent(root, space="  ")
    body = ET.tostring(root, encoding="unicode")
    sitemap_path.write_text('<?xml version="1.0" encoding="UTF-8"?>\n' + body + "\n", encoding="utf-8")


def update_search(entries: list[dict]) -> None:
    path = ROOT / "search-index.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data = [item for item in data if not str(item.get("url", "")).startswith("/learn/")]
    data.extend(entries)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def page_set() -> list[tuple[str, str, str, str]]:
    landing_desc = "How this house is built, from the ground up, with the parts you can open. Teaching sketch, not a structural design."
    sequence_desc = "Nineteen hold points for this slab house, from the survey to the final walk. Teaching sketch, not a structural design."
    explore_desc = "Start with this house. Turn a system on, pick a part, and follow it to a closer explanation."
    compare_desc = "Construction choices side by side. Neither column is a rule. The right one depends on the site, the code, and the house."
    pages = [
        ("learn/", "How a house is built", landing_desc, build_landing()),
        ("learn/sequence/", "Hold points on this house", sequence_desc, build_sequence()),
        ("learn/explore/", "Explore this house", explore_desc, build_explore()),
        ("learn/compare/", "Why this, not that", compare_desc, build_compare()),
    ]
    for item in ARTICLES:
        pages.append((f"learn/{item['slug']}/", item["name"], item["desc"], build_article(item)))
    return pages


def write_pages(dest: Path, update_indexes: bool = True) -> list[tuple[str, str, str]]:
    written = []
    for url, name, desc, html_text in page_set():
        write(dest / url / "index.html", html_text)
        written.append((url, name, desc))
    if update_indexes and dest == ROOT:
        update_sitemap([url for url, _name, _desc in written])
        update_search([
            {"title": title_of(name), "url": "/" + url, "description": desc}
            for url, name, desc in written
        ])
    return written


def main() -> None:
    pages = write_pages(ROOT, update_indexes=True)
    print(f"wrote {len(pages)} learn pages")


if __name__ == "__main__":
    main()
