#!/usr/bin/env python3
"""Write the original /learn/ house guide. Does not run generate_site.py."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATE = "2026-10-14"
BRAND = "Board of Project Stewardship"
ORIGIN = "https://boardofprojectstewardship.com"
OG = f"{ORIGIN}/assets/images/home-hero.webp"
FORBIDDEN = re.compile(r"\b(?:BOPS|ChatGPT|Gemini|Imagen|Veo|Higgsfield|Pollinations)\b|\bAI\b")

STEPS = [
    ("survey", "survey", "Survey", "Survey and soils", "Before digging",
     "The house has to sit on a known piece of ground. A survey locates the property lines and the grades. When the site needs it, a soils report says what the ground can carry and where water sits. This drawing is not a survey and not a soils report. It only shows the footprint of this house and its garage."),
    ("stake", "stake", "Stake", "Stake the corners", "Before digging",
     "The corners of the house and the garage are marked on the ground from the survey, with offsets so the marks survive the digging. On these plan sheets the main wing is about 45 feet and the garage is about 22 feet. Those figures are not a substitute for stakes on a real lot."),
    ("clear", "clear", "Clear", "Clear and protect", "Before digging",
     "Trees, shrubs, and paving that stay are fenced before machines arrive. Topsoil can be stripped and saved for planting beds. It is a poor material under a footing. The sketch keeps the paths and the planted strip beside the garage so the finished ground has something to aim at."),
    ("excavate", "excavate", "Dig", "Excavate", "Groundwork",
     "The pad is dug to the depth the foundation needs, and wide enough to form the footings. On a slope, soil is cut from the high side and may be placed on the low side. Fill under a footing has to be proper material, placed in layers and compacted. This model shows the pad, not the hole."),
    ("footings", "footings", "Footings", "Footings", "Groundwork",
     "Footings are the wide concrete bases that spread wall and post loads into the soil. A continuous footing follows a bearing wall. A pad footing sits under a post, such as a porch post. Width and thickness come from the load and the soil. This sketch does not calculate them."),
    ("foundwall", "foundwall", "Walls", "Foundation walls", "Groundwork",
     "Walls rise off the footings to the height the floor needs. On a slab they may be short stem walls. A crawl space or a basement needs taller walls. This house is drawn as a low pad, so the model shows a low base, not a basement."),
    ("damp", "damp", "Drain", "Dampproof and drain", "Groundwork",
     "Concrete against soil needs a way for water to leave. A dampproof coating suits a wall that is drained. A waterproof membrane is for water that can press on the wall. A perforated drain at the footing, set in clean stone, leads water to daylight or a sump. The sketch does not draw the pipe. The base is where that work sits."),
    ("slab", "slab", "Slab", "Under-slab work and the slab", "Groundwork",
     "Before the slab is poured, drains that run under the floor are in place, stone breaks the path of moisture rising from the ground, and a vapor retarder goes under the concrete. The slab is then poured. In this model the floor line is the top of that work. Pipes are not located."),
    ("sill", "sill", "Sill", "Sill and first floor", "Groundwork",
     "A sill, usually treated wood, is anchored to the foundation. On a crawl space the first floor is a platform of rim, joists, and subfloor. On a slab, the wall plates bear on the concrete. This house is drawn on a slab, so the main-floor walls start at that line."),
    ("backfill", "backfill", "Fill", "Backfill and rough grade", "Groundwork",
     "Soil goes back against the foundation only after the wall can take the pressure and the drain is in place. It is placed in layers. The rough grade slopes away so rain does not stand at the wall. Planting waits until the heavy work is done."),
    ("frame1", "frame1", "Frame", "First-floor walls", "Framing",
     "Exterior walls are framed on the platform: bottom plate, studs, headers over openings, and top plates. The garage door and the wide windows need headers because studs are missing there. Partitions that only divide rooms are not the load path in this sketch. Nothing here sizes a header."),
    ("frame2", "frame2", "Upper", "Second floor and walls", "Framing",
     "The upper floor is another platform on the walls below, then the upper walls. The stair opening is framed before that deck is closed. On this house the upper floor holds the primary bedroom, two other bedrooms, baths, and the laundry. The balcony is an outdoor piece of that floor, and it needs a guard."),
    ("roof", "roof", "Roof", "Roof framing", "Framing",
     "Rafters or trusses set the roof shape and tie the tops of the walls. This house has a gable on the east, a hip toward the balcony, a dormer on the front slope, and lower roofs on the garage and the porch. The drawing shows those planes. It does not show every member, and it is not a truss design."),
    ("dryin", "dryin", "Dry-in", "Dry in", "Closing in",
     "The frame is dried in when the roof sheds water and the openings are covered: sheathing, underlayment, and a cover at the windows and doors. Siding can wait. In a wet climate an open roof is the emergency, so this comes before interior finishes. At this step the roof planes are on and the siding strokes are still off."),
    ("rough", "rough", "Rough", "Rough-in", "Closing in",
     "With the shell closed to weather, plumbing, heating, and electrical lines run in the open walls and floors. Drains, vents, and ducts have to miss the joists where the structure needs the wood. The baths, kitchen, and laundry are the rooms that need water. The sketch does not route a pipe."),
    ("insulate", "insulate", "Seal", "Insulate and air-seal", "Closing in",
     "Insulation slows heat moving through the assembly. Sealing stops the leaks that carry both heat and moisture. Gaps at plates, windows, and penetrations are closed, then the cavities are filled. In a marine climate the wall also has to be able to dry. The sketch shows the open frame, not a product."),
    ("siding", "siding", "Siding", "Siding and trim", "Finishing",
     "Cladding is the rain coat. On this house the east gable reads as board-and-batten and the other walls as horizontal courses. A drainage plane behind the siding lets water that gets past the face run out. Trim covers the edges of openings. The strokes are that skin, not a siding order."),
    ("drywall", "drywall", "Inside", "Drywall and finishes", "Finishing",
     "Interior board closes the walls. Joints are finished, then the rooms are painted, floored, and fitted. Cabinets and fixtures come after the surfaces they sit on. The plan shows how this house is divided. It does not name a finish."),
    ("grade", "grade", "Grade", "Final grade and landscape", "Finishing",
     "The ground is finished so water leaves the house: slope, downspouts that discharge away from the wall, and planting that does not hold water at the siding. Walks and the patio are set to those elevations. The model returns to the whole house."),
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
        f'<path {INK} d="M20 150 L120 70 L240 70 L340 160"/>'
        f'<path {SOFT} d="M120 70 L120 150 L240 150 L240 70"/>'
        f'<path {INK} d="M128 150 H232"/>'
        f'<path {SOFT} d="M40 140 L100 90 M55 145 L115 95 M70 150 L130 100"/>'
        f'<path {SOFT} d="M250 90 L320 155 M265 85 L335 150"/>'
        f'<text {TXT} x="36" y="40">Cut</text>'
        f'<text {TXT} x="286" y="40">Fill</text>'
        f'<text {TXT} x="150" y="172">Level pad</text>',
        "A slope cut on the high side and filled on the low side",
    ),
    "footing": svg(
        f'<path {SOFT} d="M20 168 H340"/>'
        f'<path {INK} d="M70 168 H290 V148 H250 V70 H110 V148 H70 Z"/>'
        f'<path {INK} d="M40 188 H320 V168"/>'
        f'<circle {INK} cx="78" cy="160" r="4"/>'
        f'<path {SOFT} d="M78 164 V188 M86 176 H150"/>'
        f'<text {TXT} x="118" y="58">Wall</text>'
        f'<text {TXT} x="130" y="204">Footing wider than the wall</text>',
        "A wall sitting on a wider footing, with a drain at the base",
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
        f'<path {INK} d="M40 150 L180 40"/>'
        f'<path {INK} d="M180 40 L320 150"/>'
        f'<path {INK} d="M70 150 H290"/>'
        f'<rect {INK} x="150" y="78" width="60" height="44"/>'
        f'<path {SOFT} d="M158 86 H202 M158 96 H202 M158 106 H202 M166 78 V122 M178 78 V122 M190 78 V122"/>'
        f'<text {TXT} x="130" y="190">Plate at the joint, not a cut in the wood</text>',
        "A gusset plate at a truss joint",
    ),
    "attic": svg(
        f'<path {INK} d="M30 160 L180 36 L330 160"/>'
        f'<path {INK} d="M30 160 H330"/>'
        f'<path {INK} d="M80 160 V100 H280 V160"/>'
        f'<path {INK} d="M80 100 L180 36 L280 100"/>'
        f'<text {TXT} x="132" y="150">Open middle</text>'
        f'<text {TXT} x="120" y="28">Raised heel at the wall</text>',
        "A room-in-attic truss, with a raised heel at the eaves",
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
        "name": "Cut and fill",
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
        "name": "Building systems",
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
        "name": "Load path",
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
        "name": "Columns",
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
        "name": "Beams",
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
        "name": "Trusses",
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
        "name": "Lateral stability",
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
        "name": "Arches and vaults",
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
        "name": "Foundation types",
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
        "name": "Excavation and backfill",
        "desc": "Dig to the footing depth, keep the hole stable, then put soil back only after the wall and the drain can take it.",
        "preset": "excavate",
        "diagram": "footing",
        "body": [
            p("Excavation opens the ground to the bottom of the footings, wide enough to form them and to stand safely. The sides of a deep cut have to be sloped, benched, or supported under the safety rules for that depth. Water in the hole is pumped out so concrete is not poured into mud."),
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
        "name": "Spread footings",
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
        "name": "Masonry bonding",
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
        "name": "Platform framing",
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
        "name": "Roof framing",
        "desc": "Rafters and trusses make the roof shape and tie the walls. This house shows a gable, a hip, and a dormer.",
        "diagram": "rafter",
        "preset": "roof",
        "body": [
            p("A common rafter runs from the wall to the ridge. A tie or a ceiling joist keeps the two eaves from spreading. A hip rafter runs to an outside corner. A valley rafter sits where two slopes meet in a gutter. A dormer is a small roof and wall cut into a slope, and it has to flash into that slope."),
            p("This house has an east gable, a hip toward the balcony, a dormer on the front, and lower roofs on the garage and the porch. Trusses can make the same shapes. The planes are drawn. The members inside them are not."),
        ],
        "related": [("../trusses/", "Trusses"), ("../trussed-rafters/", "Trussed rafters"), ("../sequence/#roof", "Roof framing in order")],
    },
    {
        "slug": "truss-connections",
        "name": "Truss connections",
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
        "name": "Trussed rafters",
        "desc": "A trussed rafter spans like a rafter pair but uses webs. A raised heel leaves room for insulation at the eaves.",
        "diagram": "attic",
        "preset": "roof",
        "body": [
            p("A common truss has webs that fill the attic, which is fine until someone wants storage or a deep insulation blanket at the wall. A raised heel lifts the top chord at the eaves so the insulation can keep its depth where the roof meets the wall. An attic truss leaves a clear middle for a room and carries the loads in the webs at the sides."),
            p("Site-built rafters are cut one by one and need a ridge and ties. Trussed rafters arrive designed as units. Neither is drawn inside this roof. The shape of the house could be built either way."),
        ],
        "related": [("../roof-framing/", "Roof framing"), ("../trusses/", "Trusses"), ("../heat-air-moisture/", "Heat, air, and moisture")],
    },
    {
        "slug": "wall-assembly",
        "name": "Wall assembly",
        "desc": "Cladding, a drainage gap, the weather barrier, sheathing, the stud cavity, and the interior board. One wall, several jobs.",
        "diagram": "wall",
        "preset": "siding",
        "body": [
            p("From the weather inward, a typical wood wall here is cladding, a gap or drainage plane, a weather-resistive barrier, sheathing, studs with insulation in the cavity, and interior board. The cladding sheds most of the rain. The gap lets the rest drain and the back of the siding dry. The barrier is the second line. Sheathing may also be the brace against sideways load."),
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
        "name": "Stairs",
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
        "name": "Heating and cooling",
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
        "name": "Plumbing",
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
        "name": "Electrical",
        "desc": "Power arrives at a meter and a panel, then leaves on branch circuits. This is not a load calculation.",
        "diagram": "power",
        "preset": "rough",
        "body": [
            p("The utility lands at a meter. A panel beside it splits the service into branch circuits, each with an overcurrent device. Equipment grounds and the neutral are separated as the code requires at the service. Kitchens, baths, and laundry have extra rules for dedicated circuits and for protection against ground faults. Bedrooms need smoke alarms. Those rules are in the electrical code, not in this sketch."),
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
        "name": "Second-story addition",
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
        "name": "Heat, air, moisture",
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
        "name": "Rooms on this plan",
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
        "name": "Marine climate",
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
    ("cut-and-fill", "Cut and fill"),
    ("sequence", "Building a house"),
    ("building-systems", "Building systems"),
    ("load-path", "Load path"),
    ("columns", "Columns"),
    ("beams", "Beams"),
    ("trusses", "Trusses"),
    ("lateral-stability", "Lateral stability"),
    ("arches-and-vaults", "Arches and vaults"),
    ("foundation-types", "Foundation types"),
    ("excavation", "Excavation and backfill"),
    ("spread-footings", "Spread footings"),
    ("masonry-bonding", "Masonry bonding"),
    ("platform-framing", "Platform framing"),
    ("roof-framing", "Roof framing"),
    ("truss-connections", "Truss connections"),
    ("trussed-rafters", "Trussed rafters"),
    ("wall-assembly", "Wall assembly"),
    ("stairs", "Stairs"),
    ("heating-and-cooling", "Heating and cooling"),
    ("plumbing", "Plumbing"),
    ("electrical", "Electrical"),
]

CATEGORIES = [
    ("Design", "Rooms, use, and the walk between them.", ["rooms"], ["Daylight from each room", "Furniture clearances"]),
    ("Site and ground", "Soil, slope, water, and the foundation line.", ["cut-and-fill", "excavation", "foundation-types", "spread-footings"], ["Reading a soils report", "Roof water to the street"]),
    ("Structure", "Loads, members, and what keeps the house from racking.", ["load-path", "columns", "beams", "trusses", "lateral-stability", "arches-and-vaults", "platform-framing", "roof-framing", "truss-connections", "trussed-rafters", "stairs"], ["Diaphragm nailing"]),
    ("Envelope", "The layers that separate weather from the rooms.", ["wall-assembly"], ["Window flashing", "Roof edge and gutter"]),
    ("Building physics", "Heat, air, and moisture moving through the shell.", ["heat-air-moisture"], ["Sound between rooms", "Daylight levels"]),
    ("Services", "Water, heat, and power.", ["heating-and-cooling", "plumbing", "electrical"], ["Outdoor-air ventilation rates"]),
    ("Interiors", "The rooms after the shell is closed.", ["rooms"], ["Finish floors", "Accessible bathroom clearances"]),
    ("Construction", "The order of the work, and the systems as one house.", ["sequence", "building-systems"], ["Temporary bracing as its own page"]),
    ("Remodeling existing homes", "What is already standing has to carry the new work.", ["second-story"], ["Finding rot", "Seismic retrofit of an older house"]),
    ("PNW regional construction", "Rain, slow drying, and seismic design in this region.", ["marine-climate"], ["Cedar shingle walls", "Steep-slope roofing"]),
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
     "Rafters are cut on site, one pair at a time, with a ridge and ties. They leave the attic more open, and they take more labor.",
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
     "Siding nailed tight over the barrier relies on the face and the laps alone. It can work in a protected wall. It is less forgiving in wind-driven rain.",
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
     "A tankless unit heats water as it flows. It needs enough gas or electrical capacity for the peak, and a vent or a condensate drain. It does not store a long shower.",
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
        return {"name": "Building a house", "desc": "Nineteen steps from the survey to the finished grade, on this one house.", "href": "sequence/"}
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
        "dateModified": DATE,
        "isPartOf": {"@id": ORIGIN + "/#website"},
        "publisher": {"@id": ORIGIN + "/#organization"},
        "inLanguage": "en-US",
    })


def head(name: str, desc: str, canon_path: str, extra_ld: str, depth: int) -> str:
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
  <meta property="og:type" content="article">
  <meta property="og:url" content="{canon}">
  <meta property="og:image" content="{OG}">
  <meta property="og:image:alt" content="Board of Project Stewardship">
  <meta property="og:site_name" content="{BRAND}">
  <meta property="og:locale" content="en_US">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{esc(title)}">
  <meta name="twitter:description" content="{esc(desc)}">
  <meta name="twitter:image" content="{OG}">
  <link rel="canonical" href="{canon}">
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
    <a class="learn-brand" href="{root}">Board of Project Stewardship</a>
    <button type="button" class="learn-menu" aria-expanded="false" aria-controls="learn-menu-panel">Menu</button>
    <nav class="learn-nav" id="learn-menu-panel" aria-label="Primary">
      <a href="{root}">Home</a>
      <a href="{root}learn.html">Learn hub</a>
      <a href="{root}learn/">This house</a>
      <a href="{root}learn/sequence/">Build order</a>
      <a href="{root}learn/explore/">Explore</a>
      <a href="{root}learn/compare/">Compare</a>
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


def footer(depth: int) -> str:
    root = "../" * depth
    return f"""
  <footer class="learn-foot">
    <p>Teaching sketch. Not a structural design, a bid, or a permit set. Confirm the work with the drawings and the jurisdiction.</p>
    <p><a href="{root}">Home</a> · <a href="{root}learn.html">Learn hub</a> · <a href="{root}learn/">How a house is built</a> · <a href="mailto:editorial@boardofprojectstewardship.com">editorial@boardofprojectstewardship.com</a></p>
  </footer>
  <script src="/assets/js/scroll-house.js" defer></script>
  <script src="/assets/js/learn-house.js" defer></script>
</body>
</html>
"""


def viewer(preset: str, label: str) -> str:
    return (
        f'<figure class="learn-still" data-learn-view="still" data-preset="{esc(preset)}">'
        f'<canvas width="960" height="540" tabindex="0" aria-label="{esc(label)}"></canvas>'
        f'<figcaption class="learn-caption">Tap the drawing, then drag to turn it. Teaching sketch of this house. Not a structural design.</figcaption>'
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
        head(item["name"], desc, canon, article + crumb_ld([(n, ORIGIN + "/" + (h or "")) for n, h in crumbs]), 2)
        + f'<main id="main-content">\n{crumb_nav(crumbs, 2)}\n'
        + '<article class="learn-wrap learn-hero">'
        + f'<p class="learn-kicker">How a house is built</p><h1>{esc(item["name"])}</h1>'
        + f'<p class="learn-dek">{esc(desc)}</p>'
        + "".join(body)
        + "</article></main>"
        + footer(2)
    )


def build_sequence() -> str:
    desc = "Nineteen steps from survey and soils to final grade, drawn on one house. Teaching sketch, not a structural design."
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
<main id="main-content">
{crumb_nav(crumbs, 2)}
<section class="learn-seq" id="learn-seq" data-learn-view="sequence" aria-labelledby="learn-seq-title">
  <div class="learn-seq-track">
    <div class="learn-seq-sticky">
      <p class="learn-kicker" id="learn-step-phase">Before digging</p>
      <h1 id="learn-seq-title">Building this house, in order</h1>
      <ol class="learn-rail" aria-label="Build steps">{''.join('<li>'+b+'</li>' for b in rail)}</ol>
      <label class="learn-scrub">Step <span id="learn-step-count">01 of 19</span>
        <input type="range" min="1" max="19" value="1" aria-valuemin="1" aria-valuemax="19" aria-valuetext="Survey and soils">
      </label>
      <div class="learn-sheet">
        <canvas width="960" height="540" tabindex="0" aria-label="This house at the current build step. Tap, then drag to turn it."></canvas>
      </div>
      <div class="learn-copy">
        <h2 id="learn-step-title">Survey and soils</h2>
        <p id="learn-step-body">{esc(STEPS[0][5])}</p>
      </div>
      <p class="learn-aside">Teaching sketch. Not a structural design. Scroll this page or use the steps.</p>
      <div class="learn-dirs">
        <button type="button" class="learn-btn" data-learn-dir="-1">Previous</button>
        <button type="button" class="learn-btn" data-learn-dir="1">Next</button>
      </div>
      <p class="learn-fallback">The drawing needs WebGL. The written steps are below.</p>
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
    return head("House build sequence", desc, canon, extra + crumb_ld([(n, ORIGIN + "/" + (h or "")) for n, h in crumbs]), 2) + sticky + footer(2)


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
    for pid, label, preset, title, body, href, link in parts:
        payload.append({"id": pid, "preset": preset, "title": title, "body": body, "href": href, "link": link})
        buttons.append(f'<button type="button" class="learn-btn" data-part="{pid}">{esc(label)}</button>')
    crumbs = [("Home", ""), ("How a house is built", "learn/"), ("Explore", canon)]
    main = f"""
<main id="main-content">
{crumb_nav(crumbs, 2)}
<div class="learn-explore" data-learn-view="explore">
  <div>
    <p class="learn-kicker">One house</p>
    <h1>Explore this house</h1>
    <p class="learn-dek">{esc(desc)}</p>
    <div class="learn-sheet">
      <canvas width="960" height="540" tabindex="0" aria-label="This house. Choose a part, then tap and drag to turn the drawing."></canvas>
    </div>
    <p class="learn-fallback">The drawing needs WebGL. The part list still links to the written pages.</p>
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
    return head("Explore this house", desc, canon, crumb_ld([(n, ORIGIN + "/" + (h or "")) for n, h in crumbs]), 2) + main + footer(2)


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
        "author": {"@type": "Organization", "name": BRAND, "@id": ORIGIN + "/#organization"},
        "publisher": {"@id": ORIGIN + "/#organization"},
    })
    crumbs = [("Home", ""), ("How a house is built", "learn/"), ("Compare", canon)]
    main = f"""
<main id="main-content">
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
    return head("Why this, not that", desc, canon, extra + crumb_ld([(n, ORIGIN + "/" + (h or "")) for n, h in crumbs]), 2) + main + footer(2)


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
        "dateModified": DATE,
        "mainEntity": {"@type": "ItemList", "itemListElement": item_ld},
    })
    crumbs = [("Home", ""), ("How a house is built", canon)]
    main = f"""
<main id="main-content">
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
    return head("How a house is built", desc, canon, extra + crumb_ld([(n, ORIGIN + "/" + (h or "")) for n, h in crumbs]), 1) + main + footer(1)


def update_sitemap(paths: list[str]) -> None:
    sitemap = ROOT / "sitemap.xml"
    text = sitemap.read_text(encoding="utf-8")
    text = re.sub(
        r"\n  <url>\n    <loc>https://boardofprojectstewardship.com/learn/.*?</url>",
        "",
        text,
        flags=re.S,
    )
    block = []
    for path in paths:
        block.append(
            "  <url>\n"
            f"    <loc>{ORIGIN}/{path}</loc>\n"
            f"    <lastmod>{DATE}</lastmod>\n"
            "    <changefreq>weekly</changefreq>\n"
            "    <priority>0.7</priority>\n"
            "  </url>"
        )
    text = text.replace("</urlset>", "\n".join(block) + "\n</urlset>")
    sitemap.write_text(text, encoding="utf-8")


def update_search(entries: list[dict]) -> None:
    path = ROOT / "search-index.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data = [item for item in data if not str(item.get("url", "")).startswith("/learn/")]
    data.extend(entries)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    pages: list[tuple[str, str, str, str]] = []
    landing = build_landing()
    write(ROOT / "learn" / "index.html", landing)
    pages.append(("learn/", "How a house is built", "How this house is built, from the ground up, with the parts you can open. Teaching sketch, not a structural design.", "learn/index.html"))
    sequence = build_sequence()
    write(ROOT / "learn" / "sequence" / "index.html", sequence)
    pages.append(("learn/sequence/", "House build sequence", "Nineteen steps from survey and soils to final grade, drawn on one house. Teaching sketch, not a structural design.", "learn/sequence/index.html"))
    explore = build_explore()
    write(ROOT / "learn" / "explore" / "index.html", explore)
    pages.append(("learn/explore/", "Explore this house", "Start with this house. Turn a system on, pick a part, and follow it to a closer explanation.", "learn/explore/index.html"))
    compare = build_compare()
    write(ROOT / "learn" / "compare" / "index.html", compare)
    pages.append(("learn/compare/", "Why this, not that", "Construction choices side by side. Neither column is a rule for every house.", "learn/compare/index.html"))
    for item in ARTICLES:
        write(ROOT / "learn" / item["slug"] / "index.html", build_article(item))
        pages.append((f"learn/{item['slug']}/", item["name"], item["desc"], f"learn/{item['slug']}/index.html"))
    update_sitemap([p[0] for p in pages])
    update_search([
        {"title": title_of(name), "url": "/" + url, "description": desc}
        for url, name, desc, _rel in pages
    ])
    print(f"wrote {len(pages)} learn pages")


if __name__ == "__main__":
    main()
