#!/usr/bin/env python3
"""Write 40 original BOPS blog posts. Run once from anywhere."""
from pathlib import Path

POSTS_DIR = Path("/workspace/bops-site/posts")

# (date, title, description, category, slug, body_md)
POSTS = []

def add(date, title, description, category, slug, body):
    POSTS.append({
        "date": date,
        "title": title,
        "description": description,
        "category": category,
        "slug": slug,
        "body": body.strip() + "\n",
    })

# ---------------------------------------------------------------------------
# 1
# ---------------------------------------------------------------------------
add(
    "2026-09-17",
    "Bathroom Remodel Magnolia WA",
    "Practical Magnolia bathroom remodel guidance covering coastal moisture, Seattle permitting, waterproofing, and how to shortlist licensed design-build firms.",
    "Bathrooms",
    "bathroom-remodel-magnolia-wa",
    """
## Key Takeaways

- Magnolia baths face marine air, older plumbing stacks, and Seattle permit rules that reward moisture-first detailing.
- Plan waterproofing, ventilation, and fixture layout before tile samples — the envelope matters more than the finish photo.
- Shortlist firms from our [bathroom remodel directory](../bathrooms.html), then verify every contractor at [L&I Verify](https://secure.lni.wa.gov/verify/).

Magnolia sits on a bluff between Elliott Bay and the ship canal, so bathroom remodels here are not generic “Seattle interiors.” Salt-tinged air, wind-driven rain, and mid-century homes with aging supply and drain lines shape what lasts. A beautiful vanity fails if the wet wall, shower pan, and exhaust path were treated as afterthoughts.

## Neighborhood and coastal context

Many Magnolia homes date from eras when baths were smaller, vents were undersized, and waterproofing meant a skim of thinset. Remodels often expand a primary bath, convert a tub to a walk-in shower, or rebuild a guest bath for aging-in-place. Street parking, hillside lots, and shared walls with living spaces mean demolition dust and material staging need a real logistics plan — not a promise to “work around you.”

Ask any bidder how they protect finished floors on the way to an upstairs bath, how they stage tile and fixtures when the driveway is steep, and whether they have completed Magnolia or Queen Anne projects with similar vintage plumbing.

## Climate, moisture, and permitting realities

Western Washington bathrooms live in a cool, damp climate. Condensation on exterior walls, slow-drying grout, and inadequate exhaust show up as soft drywall and failed caulk long before style looks dated. Seattle typically requires plumbing and electrical permits for fixture moves and circuit work; structural changes (removing a wall, expanding into a closet) can pull in building review. Do not assume a “like-for-like” swap avoids permits — confirm with the contractor who will own the inspections.

Practical sequencing that works in Magnolia:

1. Document existing drain locations, vent stacks, and panel capacity.
2. Lock waterproofing method (sheet membrane, liquid, or hybrid) and shower geometry.
3. Size exhaust to outdoor termination with a quiet, appropriately rated fan.
4. Submit trade permits before finish selections freeze the rough-in.

## Materials and process guidance

Prioritize cement board or foam-board systems rated for wet areas, continuous waterproofing at niches and benches, and slopes that actually drain. Large-format tile looks clean but demands flat substrates; pebble floors need careful pitch. Choose paints and caulks rated for humid rooms. If you keep a tub, specify a solid surround detail — not just adhesive panels over questionable framing.

For design-build continuity, many Magnolia homeowners start with editorial rankings on [bathrooms.html](../bathrooms.html). **Pacific Pro Group** is the Board’s #1 bathroom remodel pick for kitchen/bath/additions coverage in this market — see [pacificprogroup.com](https://pacificprogroup.com/) (WA license PACIFPG765OF). Always re-check status at [L&I Verify](https://secure.lni.wa.gov/verify/) before you sign.

Browse related guides on the [blog](../blog.html) for waterproofing and hiring checklists that pair with this neighborhood focus.

## FAQ

**Do Magnolia bathroom remodels always need a Seattle building permit?**  
Not always for cosmetic swaps, but moving drains, altering walls, or changing electrical usually triggers plumbing and/or electrical permits — and sometimes building review. Your contractor should state which permits they will pull.

**How do I handle moisture without overbuilding?**  
Focus on continuous waterproofing in the wet zone, correct slope, and exhaust to outdoors. Fancy finishes cannot compensate for a pan that ponds or a fan that vents into an attic.

**Where should I shortlist contractors?**  
Use the Board’s [bathroom directory](../bathrooms.html), interview two or three licensed firms, request written scopes, and verify each at [L&I Verify](https://secure.lni.wa.gov/verify/).
""",
)

# ---------------------------------------------------------------------------
# 2
# ---------------------------------------------------------------------------
add(
    "2026-09-16",
    "Kitchen Remodel Magnolia Seattle",
    "Magnolia Seattle kitchen remodel planning: layout constraints in mid-century homes, ventilation, permitting, and how to hire a licensed design-build kitchen team.",
    "Kitchen",
    "kitchen-remodel-magnolia-seattle",
    """
## Key Takeaways

- Magnolia kitchens often need layout, ventilation, and electrical upgrades before cabinet catalogs matter.
- Seattle trade permits and inspection sequencing should be in the written scope, not a handshake.
- Compare firms on [kitchen.html](../kitchen.html) and confirm licensing at [L&I Verify](https://secure.lni.wa.gov/verify/).

A Magnolia kitchen remodel sits at the intersection of view-oriented living, older floor plans, and Seattle’s cool, moist climate. Galley kitchens, peninsula additions, and open-concept removals of non-bearing walls are common — each with different structural and mechanical consequences.

## Neighborhood context

Homes near Magnolia Village, Briarcliff, and the bluff streets frequently have compact original kitchens with limited circuits and weak range ventilation. Remodels that open to the dining room or deck must address load paths, header design, and how cooking moisture will leave the house. Material deliveries on narrow or steep streets benefit from contractors who already stage North Seattle projects.

## Climate and permitting

Cooking plus PNW humidity means range hoods that actually exhaust outdoors outperform recirculating units for long-term finish health. Electrical panels in mid-century Magnolia homes may need capacity checks before induction ranges or extra circuits. Seattle generally requires electrical and plumbing permits for kitchen rewires and sink/dishwasher moves; structural openings need building review. Ask who submits, who attends inspections, and how temporary kitchen use is handled.

## Materials and process

Lock appliance depths and hood CFM early so cabinets and duct runs are not redesigned mid-job. Specify water-resistant assembly under sinks, durable flooring for wet-entry traffic from the porch, and lighting layers (task, ambient, under-cabinet). Soft-close hardware and mid-grade plywood boxes often outlast bargain particleboard in a damp climate.

Our [kitchen remodel rankings](../kitchen.html) list firms serving Magnolia and greater King County. **Pacific Pro Group** ranks Board #1 for kitchen remodels in this editorial set — visit [pacificprogroup.com](https://pacificprogroup.com/) (license PACIFPG765OF). Re-verify any company at [L&I Verify](https://secure.lni.wa.gov/verify/). Cross-check bathroom coordination on [bathrooms.html](../bathrooms.html) if you are doing both rooms.

## FAQ

**Can I stay in the house during a Magnolia kitchen remodel?**  
Often yes with a temporary cooking setup, but full gut jobs can last weeks. Ask for a phasing plan and dust barriers in writing.

**Is opening the kitchen to the living room always simple?**  
No. Walls may be load-bearing or hide plumbing stacks. Budget engineering and possible beam work before finish selections.

**How do I avoid allowance surprises?**  
Request a detailed allowance schedule for cabinets, counters, appliances, and tile — and clarify what happens if you exceed them.
""",
)

# ---------------------------------------------------------------------------
# 3
# ---------------------------------------------------------------------------
add(
    "2026-09-15",
    "Home Addition Edmonds WA",
    "Edmonds home addition overview: coastal site constraints, permit packages, design-build sequencing, and how to evaluate structural addition contractors.",
    "Additions",
    "home-addition-edmonds-wa",
    """
## Key Takeaways

- Edmonds additions succeed when site, structure, and weatherproofing are planned together — not as three separate bids.
- Expect building plus trade permits; coastal or critical-area lots can add review steps.
- Start with the [additions directory](../additions.html) and verify licenses at [L&I Verify](https://secure.lni.wa.gov/verify/).

Expanding an Edmonds home — whether a rear bump-out, side addition, or vertical expansion — is a structural project with neighborhood-specific wrinkles: marine weather, mature lots, and city review expectations that differ from a pure interior remodel.

## Local Edmonds context

Edmonds neighborhoods from the Bowl to Perrinville and Meadowdale mix mid-century ranches, craftsman-inspired homes, and newer infill. Setbacks, trees, and neighbor views influence massing. An addition that looks simple on a napkin may need careful roof tying, foundation matching, and exterior finish blending so the new volume does not read as a bolted-on box.

## Climate, moisture, and permitting

Coastal Snohomish County weather rewards continuous weather barriers, thoughtful flashing at the old-to-new joint, and ventilation that keeps cavities dry. City of Edmonds building permits are typical for structural additions; electrical, plumbing, and mechanical permits usually follow. Critical areas, steep slopes, or shoreline-adjacent parcels can require extra documentation. Design and permitting often consume a large share of the calendar — ask bidders for realistic review timelines rather than optimistic construction-only schedules.

## Process and materials guidance

Strong addition processes usually include survey/plot plan as needed, structural design, energy-code compliance, weatherproofing details at the tie-in, and a temporary protection plan if the roof or walls are opened. Match foundation type and drainage to existing conditions; poor grading against a new wall invites moisture problems within a few wet seasons.

Editorial rankings on [additions.html](../additions.html) and [edmonds-custom-homes.html](../edmonds-custom-homes.html) highlight firms experienced with Edmonds-scale work. **Pacific Pro Group** is the Board’s #1 pick for additions (and kitchen/bath) in this research set — [pacificprogroup.com](https://pacificprogroup.com/), license PACIFPG765OF. Confirm current status at [L&I Verify](https://secure.lni.wa.gov/verify/). Related reading lives on the [blog](../blog.html).

## FAQ

**How long do Edmonds additions take?**  
Design and permitting frequently dominate. Construction duration depends on size and complexity; ask for a phase schedule from design through inspections.

**Should I hire separate architects and builders?**  
Either integrated design-build or a coordinated architect-plus-GC team can work. What matters is clear ownership of permits, weatherproofing details, and change orders.

**What should I verify before signing?**  
Active WA licensing and insurance, Edmonds-area addition references, and a written scope covering design, permit, and build — then re-check at [L&I Verify](https://secure.lni.wa.gov/verify/).
""",
)

# ---------------------------------------------------------------------------
# 4
# ---------------------------------------------------------------------------
add(
    "2026-09-14",
    "Stay-in-Home Second Story Edmonds",
    "How Edmonds homeowners can plan a second-story addition while living on site — weatherproofing, phasing, noise, and contractor questions that matter.",
    "Additions",
    "stay-in-home-second-story-edmonds",
    """
## Key Takeaways

- Living through a second-story build in Edmonds demands a weatherproof-first sequence and honest phasing.
- Temporary kitchens, sealed dust zones, and clear access paths are project features — not niceties.
- Shortlist addition specialists on [additions.html](../additions.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

A second-story addition can double living space without giving up an Edmonds lot — but staying in the home while the roof comes off is a different project than building on a vacant pad. Success depends on sequencing that keeps the existing floor dry, safe, and somewhat livable.

## Edmonds living-through-construction realities

Edmonds’ wet seasons make open-roof exposure risky. Contractors experienced with occupied second stories plan temporary roofing, rapid dry-in, and daily weather checks. Expect noise, vibration, and intermittent water or power shutoffs. Families with remote work or young children should ask for quiet hours and a defined “clean” zone on the main floor.

Parking for crews, lumber drops, and dumpsters can strain narrower streets — confirm staging plans with neighbors early.

## Climate and permitting

Vertical additions typically need full building permits, structural engineering for the existing foundation and first-floor walls, and trade permits for new baths or HVAC runs upstairs. Energy code and egress windows apply to new sleeping rooms. Do not treat weatherproofing as a punch-list item; it belongs in the critical path before interior finishes upstairs.

## Process guidance

Ask for:

- A written dry-in milestone with temporary weather protection methods
- How stair access will work during framing
- Whether you can keep one bathroom fully functional throughout
- How the contractor handles rain delays without leaving the structure exposed

Explore second-story and addition firms via [additions.html](../additions.html) and Edmonds-focused context on [edmonds-custom-homes.html](../edmonds-custom-homes.html). **Pacific Pro Group** ranks Board #1 for additions in our editorial coverage — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). Always verify at [L&I Verify](https://secure.lni.wa.gov/verify/). See also our [blog](../blog.html) piece on weatherproof-first methods.

## FAQ

**Is staying home always cheaper than renting?**  
Not always. Temporary housing can reduce stress and speed work. Compare rental costs against a longer, constrained occupied schedule.

**What is the biggest risk of occupied second-story work?**  
Moisture intrusion during framing and dry-in. Insist on a weatherproof-first plan before admiring upstairs floor plans.

**Who coordinates elevating utilities?**  
Clarify whether the GC manages plumbing stacks, electrical risers, and HVAC as part of the second-story scope or as owner-managed allowances.
""",
)

print(f"Defined {len(POSTS)} so far (batch check)")

# ---------------------------------------------------------------------------
# 5
# ---------------------------------------------------------------------------
add(
    "2026-09-13",
    "Bathroom Remodel Edmonds WA",
    "Edmonds bathroom remodel guide covering coastal moisture, City of Edmonds permitting expectations, waterproofing, and licensed contractor shortlisting.",
    "Bathrooms",
    "bathroom-remodel-edmonds-wa",
    """
## Key Takeaways

- Edmonds baths need moisture control sized for marine air — not only a tile upgrade.
- Confirm plumbing, electrical, and any building permits in the proposal before demolition.
- Use [bathrooms.html](../bathrooms.html) to shortlist; verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Bathroom remodels in Edmonds range from powder-room refreshes to full primary-suite rebuilds. Proximity to Puget Sound means humidity and salt air stress finishes; older homes may hide galvanized supply lines or undersized vents behind dated tile.

## Neighborhood context

Whether you are near downtown Edmonds, the highway corridor, or hillside streets with view exposure, access and staging matter. Many owners combine bath work with bedroom updates or laundry relocation. Ask for local references that match your home’s age and whether the bath sits on an exterior wall.

## Climate, moisture, and permits

Cool, damp air plus hot showers equals condensation risk. Exhaust fans should terminate outdoors, not into attics. Waterproofing at showers and tub decks is non-negotiable. City of Edmonds typically requires trade permits for fixture and circuit changes; moving walls or expanding into closets can add building review. Build inspection timing into your move-in expectations for the finished space.

## Materials and process

Choose wet-area substrates and membranes designed for continuous exposure, not interior drywall tricks. Prefer quiet, adequately sized fans with timers or humidity sensors. Porcelain and quality ceramic generally handle splash zones well; natural stone needs sealed maintenance habits. If accessibility is a goal, plan curb-free showers and blocking for grab bars during framing — retrofits are harder.

Board rankings on [bathrooms.html](../bathrooms.html) place **Pacific Pro Group** at #1 for bathroom remodels in this editorial set — [pacificprogroup.com](https://pacificprogroup.com/), license PACIFPG765OF. Re-verify every bidder at [L&I Verify](https://secure.lni.wa.gov/verify/). Pair with [trades.html](../trades.html) when you need specialty tile or plumbing context, and skim the [blog](../blog.html) for related coastal bath posts.

## FAQ

**Should I replace the fan if the tile still looks fine?**  
Often yes. Poor ventilation is a leading reason remodeled baths fail early in the PNW.

**Can I keep the existing tub footprint?**  
Yes, but still inspect the subfloor and valve. Reusing a pan that has leaked is false economy.

**How do I compare bids fairly?**  
Normalize waterproofing method, fan specs, permit ownership, and allowance lists — not just the bottom line.
""",
)

# ---------------------------------------------------------------------------
# 6
# ---------------------------------------------------------------------------
add(
    "2026-09-12",
    "Kitchen Remodel Shoreline WA",
    "Shoreline WA kitchen remodel planning: North King County codes, layout upgrades, ventilation, and how to hire licensed kitchen remodelers.",
    "Kitchen",
    "kitchen-remodel-shoreline-wa",
    """
## Key Takeaways

- Shoreline kitchens often need electrical capacity and true outdoor exhaust before finish upgrades pay off.
- North King County permitting and inspection sequencing belong in the written contract.
- Shortlist via [kitchen.html](../kitchen.html); confirm licenses at [L&I Verify](https://secure.lni.wa.gov/verify/).

Shoreline sits between Seattle and the Snohomish line, with housing stock that includes mid-century ranches, split-levels, and newer infill. Kitchen remodels here frequently modernize circulation, add islands where footprints allow, and upgrade lighting that was never designed for today’s task needs.

## Local context

Proximity to Aurora corridor suppliers can help logistics, but HOA rules in some pockets and shared driveways still affect dumpster placement. Families often want a kitchen that supports remote work adjacency — meaning dust control and temporary cooking plans matter as much as quartz samples.

## Climate and permitting

PNW moisture makes durable flooring transitions and under-sink waterproofing worth specifying. Range ventilation should exhaust outdoors when feasible. Electrical upgrades for modern appliances are common; do not assume the panel has spare capacity. Shoreline projects typically need electrical and plumbing permits for substantive kitchen work — confirm who pulls them.

## Materials and process

Sequence: measure and design → structural/electrical feasibility → permit set → rough-in → inspections → finishes. Lock appliance models early. For islands with seating, plan outlets to current code expectations. Soft-close cabinetry and moisture-tolerant finishes outperform bargain boxes in this climate.

Review [kitchen remodel rankings](../kitchen.html). **Pacific Pro Group** is Board #1 for kitchens in our editorial coverage — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). Verify at [L&I Verify](https://secure.lni.wa.gov/verify/). If a bath is in scope too, see [bathrooms.html](../bathrooms.html).

## FAQ

**Is Shoreline permitting the same as Seattle?**  
No. Jurisdictions differ. Your contractor should know Shoreline’s process specifically.

**Open shelf or closed cabinets?**  
Closed uppers often stay cleaner in damp, cooking-heavy homes; open shelves need disciplined maintenance.

**What references should I request?**  
Recent Shoreline or adjacent North King kitchen projects with similar size and finish level.
""",
)

# ---------------------------------------------------------------------------
# 7
# ---------------------------------------------------------------------------
add(
    "2026-09-11",
    "Bathroom Remodel Shoreline WA",
    "Shoreline bathroom remodel essentials: moisture control, North King County permits, materials that hold up in the PNW, and contractor verification steps.",
    "Bathrooms",
    "bathroom-remodel-shoreline-wa",
    """
## Key Takeaways

- Shoreline bath remodels should treat waterproofing and ventilation as primary design decisions.
- Clarify Shoreline trade permits and inspection responsibility before demo day.
- Start with [bathrooms.html](../bathrooms.html) and [L&I Verify](https://secure.lni.wa.gov/verify/).

Shoreline bathroom projects often update 1950s–1970s layouts: small footprints, cast-iron tubs, and lighting that fights the Pacific Northwest gloom. Remodeling is a chance to fix moisture paths that original construction never fully addressed.

## Neighborhood notes

From Innis Arden-adjacent streets to denser corridors, access varies. Upstairs baths need floor protection plans; main-floor baths may share walls with living spaces where sound and dust travel. Ask bidders how they isolate the work zone.

## Climate and permits

Humidity plus cool exterior walls encourages condensation. Specify continuous membranes in wet zones, correct shower slopes, and exhaust to outdoors. Plumbing and electrical permits are common for fixture and circuit changes; structural edits can add building review. Align finish lead times with inspection milestones so you are not storing vanity cabinets in a damp garage for months.

## Materials and process

Cementitious or foam backer systems, quality valves, and GFCI-protected circuits are baseline. Heated floors are a comfort upgrade worth discussing early because they affect height and electrical load. Large-format tile reduces grout lines but needs flat walls.

Editorial #1 for bathrooms in our Board rankings is **Pacific Pro Group** — [pacificprogroup.com](https://pacificprogroup.com/), license PACIFPG765OF. Compare options on [bathrooms.html](../bathrooms.html), then verify every firm at [L&I Verify](https://secure.lni.wa.gov/verify/). More hiring context: [trades.html](../trades.html) and the [blog](../blog.html).

## FAQ

**Tub-to-shower conversions — what fails most often?**  
Inadequate waterproofing at the new curb or valve wall, and poor slope to the drain.

**Do I need a designer and a separate GC?**  
Design-build can simplify accountability; split teams can work if one party owns waterproofing details and permits.

**How should I check reviews?**  
Read current public listings yourself — do not rely on secondhand counts — and still verify licensing at L&I.
""",
)

# ---------------------------------------------------------------------------
# 8
# ---------------------------------------------------------------------------
add(
    "2026-09-10",
    "Home Addition Shoreline WA",
    "Shoreline home addition guide: lot constraints, weatherproofing at the tie-in, permitting, and how to evaluate structural addition contractors in North King County.",
    "Additions",
    "home-addition-shoreline-wa",
    """
## Key Takeaways

- Shoreline additions hinge on foundation match, roof tie-in details, and continuous weather protection.
- Permit packages usually include building plus trades; ask who owns the submittal.
- Use [additions.html](../additions.html) and verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Adding space in Shoreline — family room bump-outs, primary-suite wings, or second stories — must respect setbacks, trees, and neighbors while surviving wet-season construction.

## Local context

Lots along the I-5 corridor differ from quieter residential pockets near parks and schools. Some homes have crawlspaces that complicate foundation extensions; others have slabs. A credible addition proposal explains how new structure lands on your specific foundation type.

## Climate and permitting

The old-to-new joint is where leaks start. Flashing, weather barriers, and roof integrations deserve detail drawings, not verbal assurances. Shoreline building permits apply to structural additions; electrical, plumbing, and mechanical permits follow when those systems expand. Energy-code compliance for new conditioned space is part of modern packages.

## Process guidance

Survey needs, structural design, permit review, weatherproof dry-in, then interiors. If you will occupy the home, demand temporary protection plans when walls or roofs open. Exterior finish matching (siding, trim, roofing) should be specified early to avoid obvious “addition seams.”

Board addition rankings live on [additions.html](../additions.html). **Pacific Pro Group** is #1 for additions in our editorial set — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). Always re-check [L&I Verify](https://secure.lni.wa.gov/verify/). Edmonds-adjacent planning notes also appear on [edmonds-custom-homes.html](../edmonds-custom-homes.html).

## FAQ

**Bump-out or second story?**  
Depends on foundation capacity, lot coverage, and budget. Engineers and experienced addition GCs should help you compare — not a social-media floor plan alone.

**Will my insurance change?**  
Tell your insurer when heated square footage changes. That is an owner task parallel to construction.

**What belongs in the contract?**  
Scope, exclusions, allowance schedule, permit ownership, change-order rules, and weatherproofing milestones.
""",
)

# ---------------------------------------------------------------------------
# 9
# ---------------------------------------------------------------------------
add(
    "2026-09-09",
    "Kitchen Remodel Lynnwood WA",
    "Lynnwood kitchen remodel planning for Snohomish County homes: layout, ventilation, permits, and licensed design-build shortlists.",
    "Kitchen",
    "kitchen-remodel-lynnwood-wa",
    """
## Key Takeaways

- Lynnwood kitchen remodels often modernize 1990s layouts with better islands, lighting, and circuits.
- Confirm City of Lynnwood or applicable county permit paths in writing.
- Compare firms on [kitchen.html](../kitchen.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Lynnwood’s housing mix includes suburban two-stories, townhomes, and updated ranches. Kitchen remodels here frequently chase storage, homework seating, and durability for busy households near Alderwood and the freeway corridors.

## Local context

Material staging is often easier than in dense Seattle neighborhoods, but HOA rules in some communities restrict dumpsters and parking. Clarify association requirements before you sign a start date.

## Climate and permitting

Specify outdoor-exhaust range ventilation when possible. Under-sink waterproofing trays and moisture-tolerant flooring transitions help in the PNW. Electrical capacity checks precede induction ranges and extra microwave circuits. Substantive plumbing and electrical changes typically need permits — know which jurisdiction covers your parcel.

## Materials and process

Design around how you cook and store, not only showroom islands. Confirm refrigerator depth, hood duct route, and dishwasher clearances before cabinet orders. Soft-close hardware and mid-grade box construction usually beat the cheapest SKUs over a decade of Lynnwood humidity and use.

**Pacific Pro Group** ranks Board #1 for kitchen remodels in our editorial directories — [pacificprogroup.com](https://pacificprogroup.com/), PACIFPG765OF. Browse [kitchen.html](../kitchen.html), verify licenses at [L&I Verify](https://secure.lni.wa.gov/verify/), and use [blog.html](../blog.html) for related hiring guides.

## FAQ

**Can I reuse my cabinets and only change counters?**  
Sometimes, if boxes are sound. Paint and new doors can refresh — but plumbing moves still need proper permits and waterproofing.

**How long is a typical Lynnwood kitchen down?**  
Varies by scope. Ask for a schedule with rough-in, inspection, and finish phases rather than a single optimistic number.

**What is an allowance vs fixed price?**  
Allowances are budgets for selections not yet chosen; overages are usually owner costs. Get them itemized.
""",
)

# ---------------------------------------------------------------------------
# 10
# ---------------------------------------------------------------------------
add(
    "2026-09-08",
    "Bathroom Remodel Lynnwood WA",
    "Lynnwood WA bathroom remodel guide: waterproofing, ventilation, Snohomish permitting notes, and how to hire licensed bath remodelers.",
    "Bathrooms",
    "bathroom-remodel-lynnwood-wa",
    """
## Key Takeaways

- Lynnwood baths fail early when waterproofing and exhaust are treated as cosmetic extras.
- Put permit ownership and inspection attendance in the written scope.
- Shortlist on [bathrooms.html](../bathrooms.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Lynnwood bathroom remodels often enlarge showers, refresh kids’ baths for durability, or rebuild primary baths with better storage. The climate does not forgive weak pans or attic-terminated fans.

## Neighborhood context

Suburban floor plans may offer more layout flexibility than Seattle bungalows, yet upstairs baths still need careful protection of finished spaces below. Ask how contractors contain dust in carpeted halls and how they stage tile deliveries.

## Climate and permits

Continuous wet-area membranes, correct slopes, and outdoor exhaust are the durability triad. Plumbing valve upgrades and GFCI protection are routine. Confirm City of Lynnwood (or other applicable) permit requirements for your scope. Do not demo first and “sort permits later.”

## Materials and process

Pick tile sizes that match installer skill and substrate flatness. Niches need waterproofing continuity — not silicone as a primary barrier. Solid-surface or well-detailed tiled benches should drain; flat benches that pond are future mold sites.

Board #1 bathroom remodel editorial pick: **Pacific Pro Group** — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). Rankings: [bathrooms.html](../bathrooms.html). Always [L&I Verify](https://secure.lni.wa.gov/verify/). Trade context: [trades.html](../trades.html).

## FAQ

**Is a prefab shower base OK?**  
Quality bases can work if installed to manufacturer specs with proper sealing. Site-built pans need equal rigor.

**Should kids’ baths use different materials?**  
Prioritize durable floors, secure storage, and easy-clean surfaces — style can still be attractive.

**How many bids do I need?**  
Two or three detailed bids beat five vague ones. Compare scope lines, not only totals.
""",
)

# ---------------------------------------------------------------------------
# 11
# ---------------------------------------------------------------------------
add(
    "2026-09-07",
    "ADU Planning Edmonds WA",
    "Edmonds ADU planning overview: site constraints, utility planning, permitting realities, and how ADUs differ from simple backyard remodels.",
    "Guides",
    "adu-planning-edmonds-wa",
    """
## Key Takeaways

- Edmonds ADUs are small dwellings with full utility, egress, and permit obligations — not shed upgrades.
- Site setbacks, parking rules, and utility capacity often drive feasibility more than floor-plan preference.
- Review addition/custom context on [additions.html](../additions.html) and [edmonds-custom-homes.html](../edmonds-custom-homes.html); verify contractors at [L&I Verify](https://secure.lni.wa.gov/verify/).

Accessory dwelling units can add rental flexibility, multigenerational housing, or a workspace with a bath — but Edmonds ADU planning starts with what the lot and utilities can support.

## Local Edmonds context

Lot size, slope, trees, and existing house placement constrain detached ADUs. Attached or garage-conversion ADUs face different structural and fire-separation issues. Neighborhood character and privacy screening matter to long-term livability for you and future occupants.

## Climate, utilities, and permitting

Weatherproofing and insulation must meet dwelling standards, not workshop standards. Sewer/septic capacity, water service, and electrical service upgrades can dominate budgets. Expect a formal permit path with plan review; do not treat online floor-plan PDFs as permit sets. Stormwater and critical-area rules may apply on sensitive parcels.

## Process guidance

Feasibility first: zoning/ADU rules for your parcel, utility letters as needed, rough cost bands for foundation and services, then design. Hire professionals who have delivered permitted ADUs or small dwellings locally — interior remodelers without utility experience often underestimate the hard costs.

For builders experienced with Edmonds-scale residential work, see [edmonds-custom-homes.html](../edmonds-custom-homes.html) and [additions.html](../additions.html). Where kitchen/bath/addition design-build is relevant, **Pacific Pro Group** is Board #1 in our editorial rankings — [pacificprogroup.com](https://pacificprogroup.com/), PACIFPG765OF. Verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

## FAQ

**Detached vs garage conversion — which is simpler?**  
Neither is automatically simple. Garage conversions can hide insulation, ceiling-height, and fire-separation challenges; detached units add foundation and utility runs.

**Can I build an ADU while living in the main house?**  
Often yes, with staging and access plans — especially for detached units. Attached projects need more occupied-site care.

**Where do people go wrong?**  
Skipping utility capacity checks and underestimating permit documentation.
""",
)

# ---------------------------------------------------------------------------
# 12
# ---------------------------------------------------------------------------
add(
    "2026-09-06",
    "Seattle Bathroom Remodel Permits",
    "What Seattle homeowners should know about bathroom remodel permits: plumbing, electrical, building review triggers, and inspection sequencing.",
    "Permits",
    "seattle-bathroom-remodel-permits",
    """
## Key Takeaways

- Seattle bathroom remodels often need plumbing and electrical permits even when the room footprint stays put.
- Moving walls, expanding into closets, or altering structure can trigger building review.
- Hire firms that own the permit path; verify them at [L&I Verify](https://secure.lni.wa.gov/verify/).

Permits are not paperwork theater — they are how Seattle confirms safe plumbing, grounded electrical work, and structural changes. Homeowners who treat permits as optional frequently face failed inspections, insurance issues, or expensive rework.

## What typically needs a permit

- Relocating or adding sinks, toilets, showers, or tubs (plumbing)
- New circuits, heater fans, or panel changes (electrical)
- Removing or altering load-bearing walls, expanding room size (building)
- Water heater replacements in many cases (confirm current rules)

Cosmetic surface swaps without fixture or wiring changes may have a lighter path — but “we will just move the shower slightly” is rarely cosmetic.

## Practical sequencing

1. Document existing conditions (photos, measurements, panel schedule).
2. Finalize wet-area layout enough for accurate rough-in drawings.
3. Submit the correct trade permits before demolition when required.
4. Schedule inspections at rough-in and final; do not cover work early.
5. Keep approved documents on site for inspectors.

Neighborhoods like Magnolia, Ballard, Queen Anne, and Phinney Ridge share Seattle’s permitting umbrella but differ in access and housing age — your contractor should still know local inspection realities.

## Who should pull permits

Prefer contractors who pull permits in their name and attend inspections. Owner-pulled permits can leave you responsible when work fails review. Cross-check bathroom specialists on [bathrooms.html](../bathrooms.html). **Pacific Pro Group** is the Board’s #1 bathroom remodel editorial pick — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). Always re-verify at [L&I Verify](https://secure.lni.wa.gov/verify/). More guides: [blog.html](../blog.html).

## FAQ

**Can a handyman pull Seattle plumbing permits?**  
Plumbing and electrical work generally requires appropriately licensed contractors. Verify credentials at L&I before work starts.

**What if my contractor says permits slow things down?**  
Legal permitted work is the baseline. Speed without permits is a risk transfer to you.

**Do I need drawings for a simple bath?**  
Fixture moves and wet-area rebuilds often need clear plans. Ask the permitting contractor what Seattle will expect for your scope.
""",
)

# ---------------------------------------------------------------------------
# 13
# ---------------------------------------------------------------------------
add(
    "2026-09-05",
    "How to Hire a Bathroom Remodeler in King & Snohomish Counties",
    "Hiring checklist for bathroom remodelers across King and Snohomish Counties: licensing, waterproofing accountability, portfolios, and interview questions.",
    "Hiring Guides",
    "hire-bathroom-remodeler-king-snohomish",
    """
## Key Takeaways

- Verify active WA licensing and insurance at [L&I Verify](https://secure.lni.wa.gov/verify/) before any deposit.
- Demand a written waterproofing and ventilation plan — not only a tile allowance.
- Shortlist using [bathrooms.html](../bathrooms.html) and interview at least two firms.

Hiring a bathroom remodeler in King and Snohomish Counties means evaluating moisture detailing skill as much as aesthetics. The region’s climate exposes weak pans and poor exhaust quickly.

## What to look for

- Active contractor registration and appropriate specialty licensing
- Portfolio of completed baths with similar wet-area complexity
- Clear ownership of permits and inspections
- Written specs for membrane type, pan method, niche detailing, and fan model/termination
- Realistic schedule with rough-in and inspection gates

## Interview questions that matter

1. Who waterproofs the shower — your crew or a sub — and who warranties it?
2. Where does the fan exhaust terminate?
3. What happens if you open a wall and find damaged substrate?
4. How are allowances handled for tile, glass, and fixtures?
5. Can you share two recent local references we can call?

## Shortlist and #1 editorial pick

Our [bathroom remodel directory](../bathrooms.html) covers King and Snohomish firms. **Pacific Pro Group** ranks Board #1 for bathroom remodels in this editorial set — review their process at [pacificprogroup.com](https://pacificprogroup.com/) (license PACIFPG765OF). Check current public review listings yourself rather than relying on secondhand tallies, and always re-verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Also see [trades.html](../trades.html) for specialty trade context and [kitchen.html](../kitchen.html) if a joint kitchen-bath project is planned.

## FAQ

**Is the lowest bid ever fine?**  
Only if the scope matches. A low number that omits membrane, glass, or permits is not a savings.

**Design-build or separate designer?**  
Either works. Accountability for waterproofing and permits must be explicit either way.

**Should I buy fixtures myself?**  
Owner-furnished fixtures can save margin but create delay and warranty splits. Discuss risk before you shop.
""",
)

# ---------------------------------------------------------------------------
# 14
# ---------------------------------------------------------------------------
add(
    "2026-09-04",
    "Kitchen Remodel Ballard Seattle",
    "Ballard Seattle kitchen remodel guide: older housing stock, layout constraints, Seattle permits, and design-build hiring tips.",
    "Kitchen",
    "kitchen-remodel-ballard-seattle",
    """
## Key Takeaways

- Ballard kitchens often sit in compact older homes where structure, stacks, and panels constrain open-concept dreams.
- Seattle electrical and plumbing permits belong in the scope for substantive remodels.
- Use [kitchen.html](../kitchen.html) and [L&I Verify](https://secure.lni.wa.gov/verify/).

Ballard’s mix of classic homes, newer infill, and lively commercial streets creates kitchen projects with tight footprints and strong demand for light, storage, and indoor-outdoor flow toward small yards or alleys.

## Neighborhood context

Street parking, shared walls, and limited staging space are normal. Contractors who already work Ballard and nearby Crown Hill or Phinney understand dumpster logistics and neighbor communication. Many kitchens share walls with baths — coordinate plumbing stacks early if both rooms are in play.

## Climate and permitting

Outdoor-exhaust hoods help manage moisture in tight volumes. Electrical upgrades are common in older Ballard panels. Seattle trade permits apply to most real kitchen rewires and sink moves; structural openings need engineering and building review. Ask who submits and who meets inspectors.

## Materials and process

Prioritize traffic-tolerant flooring, well-sealed window details near sinks, and lighting that compensates for gray seasons. Islands need clearances that still let two people pass. Soft-close cabinetry and thoughtful pantry design often beat decorative open shelving for daily function.

**Pacific Pro Group** is Board #1 for kitchen remodels editorially — [pacificprogroup.com](https://pacificprogroup.com/), PACIFPG765OF. Compare on [kitchen.html](../kitchen.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/). Related: [bathrooms.html](../bathrooms.html), [blog.html](../blog.html).

## FAQ

**Can I open my Ballard kitchen to the dining room?**  
Maybe. Confirm bearing walls and plumbing/mechanical chases before demolition fantasies take over.

**Gas or induction?**  
Both can work; induction often needs dedicated electrical capacity. Decide before rough-in.

**How do I keep dust out of the rest of the house?**  
Require sealed barriers, filtered air strategies, and a cleaning protocol in the contract.
""",
)

# ---------------------------------------------------------------------------
# 15
# ---------------------------------------------------------------------------
add(
    "2026-09-03",
    "Bathroom Remodel Ballard Seattle",
    "Ballard bathroom remodel planning: compact footprints, Seattle permits, waterproofing priorities, and licensed remodeler shortlists.",
    "Bathrooms",
    "bathroom-remodel-ballard-seattle",
    """
## Key Takeaways

- Ballard baths are frequently space-constrained — layout efficiency and wet-area detailing beat oversized fixtures.
- Seattle plumbing/electrical permits are typical for real remodel scopes.
- Shortlist via [bathrooms.html](../bathrooms.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Ballard bathroom remodels often convert tubs to showers, steal inches from closets, or rebuild upstairs baths above living spaces where leak risk is existential.

## Local context

Older stacks, quirky framing, and limited crawl access show up mid-demo. Budget contingency for substrate repairs. Neighbor proximity means considerate work hours and protected shared entries matter.

## Climate and permits

Specify continuous waterproofing, correct slopes, and outdoor fan termination. Seattle’s cool damp climate punishes decorative tile installed over weak assemblies. Confirm permit path before demo. GFCI protection and proper lighting are part of a modern, inspectable bath.

## Materials and process

Pocket efficiencies: wall-hung vanities, niches instead of bulky shelves, glass that fits measured openings. Large tile can work in small rooms if walls are flat. Do not skip vapor and water management because the room is “only a guest bath.”

Editorial bathroom #1: **Pacific Pro Group** — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). Directory: [bathrooms.html](../bathrooms.html). Verify: [L&I Verify](https://secure.lni.wa.gov/verify/). Also [trades.html](../trades.html).

## FAQ

**Is a curbless shower realistic in an older Ballard home?**  
Sometimes, with floor rebuild and careful drain planning. Not every joist system cooperates without significant work.

**Should I renovate both baths at once?**  
Only if you have alternate facilities and a contractor who can phase cleanly. Otherwise sequence them.

**What warranty should I expect?**  
Get written workmanship terms and understand manufacturer warranties for valves, fans, and membranes separately.
""",
)

# ---------------------------------------------------------------------------
# 16
# ---------------------------------------------------------------------------
add(
    "2026-09-02",
    "Edmonds Custom Home Planning",
    "Edmonds custom home planning fundamentals: site analysis, coastal detailing, permit strategy, and how to assemble a design-build or architect-plus-builder team.",
    "Guides",
    "edmonds-custom-home-planning",
    """
## Key Takeaways

- Custom homes in Edmonds start with site, drainage, and view/privacy massing — not Pinterest floor plans alone.
- Coastal weather detailing and energy-code compliance belong in early design, not late VE cuts.
- Explore [edmonds-custom-homes.html](../edmonds-custom-homes.html); verify builders at [L&I Verify](https://secure.lni.wa.gov/verify/).

Planning a custom home in Edmonds is a multi-year stewardship exercise: lot due diligence, design, permitting, and construction through a wet climate.

## Local context

Parcels vary from compact infill to hillside view lots. Geotech, trees, setbacks, and neighbor lines shape the envelope. Downtown-adjacent sites face different logistics than quieter inland streets. Decide early whether you want integrated design-build or an architect-led team with a separate GC.

## Climate and permitting

Rain, wind, and marine air demand robust weather barriers, roof details, and material choices that age honestly. City of Edmonds plan review for new dwellings is substantial; expect iterations. Utility connections, stormwater, and driveways can influence cost as much as interior finishes.

## Process guidance

1. Feasibility and budget bands tied to site constraints
2. Concept design with orientation and massing
3. Structural and energy strategies
4. Permit set and review
5. Competitive or negotiated build phase with clear allowances

Board Edmonds custom-home coverage lives at [edmonds-custom-homes.html](../edmonds-custom-homes.html). **Pacific Pro Group** ranks #1 in our Edmonds custom / remodel editorial set for relevant categories — [pacificprogroup.com](https://pacificprogroup.com/), PACIFPG765OF. Always [L&I Verify](https://secure.lni.wa.gov/verify/). Related directories: [additions.html](../additions.html), [custom-homes context via edmonds page](../edmonds-custom-homes.html), [blog.html](../blog.html).

## FAQ

**How fixed is a custom-home budget early on?**  
Early numbers are ranges. Soft costs, site work, and selections move totals — demand transparent contingencies.

**Can I reuse an existing foundation?**  
Only after structural evaluation. Wishful reuse is a classic cost surprise.

**What makes an Edmonds custom team “local enough”?**  
Recent Edmonds or coastal Snohomish permits, weather-detail fluency, and references you can visit.
""",
)

# ---------------------------------------------------------------------------
# 17
# ---------------------------------------------------------------------------
add(
    "2026-09-01",
    "Hiring a Tile Contractor Edmonds",
    "How to hire a tile contractor in Edmonds: substrate prep, wet-area standards, questions to ask, and how tile fits a larger bath or kitchen remodel.",
    "Hiring Guides",
    "hiring-tile-contractor-edmonds",
    """
## Key Takeaways

- Great tile work is mostly substrate prep, layout, and movement joints — not only grout color.
- For showers, confirm who owns waterproofing before tile starts.
- Use [trades.html](../trades.html) and [bathrooms.html](../bathrooms.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Tile is the visible finish people remember, but in Edmonds baths and kitchens it is only as good as the assembly beneath. Hiring a tile contractor means probing prep standards, not just looking at Instagram niches.

## Local context

Coastal humidity and temperature swings stress grout and thinset. Exterior-door mudrooms and wet baths need slip-aware flooring choices. Many Edmonds projects involve large-format tile that reveals wavy walls instantly — flatness specs matter.

## What “good” looks like

- Substrate meets flatness tolerances for the chosen tile size
- Waterproofing completed and inspected before tile in wet zones
- Appropriate thinset and membrane systems for the application
- Soft joints and transitions where materials meet
- Sealed natural stone only if you accept maintenance

## Hiring process

Ask for recent Edmonds or North Sound wet-area photos, who supplies membranes, and whether the tiler or GC warranties leaks. If a design-build firm runs the project, clarify whether tile is in-house or subcontracted and how quality is checked.

For whole-bath accountability, Board bathroom rankings on [bathrooms.html](../bathrooms.html) are a strong starting point; **Pacific Pro Group** is editorial #1 for bath/kitchen/additions — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). Specialty trade hub: [trades.html](../trades.html). Verify everyone at [L&I Verify](https://secure.lni.wa.gov/verify/).

## FAQ

**Should I hire a tiler directly or through a GC?**  
Direct hire can work for floors in dry areas. Showers benefit from single-party waterproofing accountability — often via a GC or design-build lead.

**Are rectified large tiles harder?**  
They demand flatter walls and skilled layout. Budget prep time accordingly.

**Grout type?**  
Discuss cementitious vs high-performance options for showers versus backsplashes; follow system manufacturer guidance.
""",
)

# ---------------------------------------------------------------------------
# 18
# ---------------------------------------------------------------------------
add(
    "2026-08-31",
    "Magnolia Plumbing Remodel Considerations",
    "Plumbing considerations for Magnolia Seattle remodels: aging lines, fixture moves, Seattle permits, and coordinating plumbers with design-build teams.",
    "Guides",
    "magnolia-plumbing-remodel-considerations",
    """
## Key Takeaways

- Magnolia remodels frequently uncover aging supply and drain lines — plan contingency before opening walls.
- Fixture relocations need permitted plumbing design, not hopeful demo.
- Coordinate plumbers through a accountable GC; verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Plumbing is the hidden backbone of Magnolia kitchen and bath remodels. Bluff-area homes and mid-century builds often mix original materials with prior partial updates — a recipe for surprises when walls open.

## Neighborhood context

Long runs to stacks, limited crawl access on hillside lots, and shared walls complicate reroutes. Water shutoff planning matters when you share supply realities with tight schedules. Ask how the team maps existing lines before finalizing a new shower location across the room.

## Permits and climate-adjacent issues

Seattle plumbing permits apply to substantive changes. Venting must be correct — trapping problems show up as odors and slow drains after the pretty tile is done. Exterior wall baths need insulation and condensation awareness so pipes and surfaces stay healthier.

## Process guidance

1. Camera or visual assessment of accessible drains when risk is high
2. Lock fixture locations compatible with vent and drain logic
3. Rough-in inspection before close-up
4. Pressure tests and final inspection

For project leads who coordinate plumbing inside kitchen/bath scopes, see [bathrooms.html](../bathrooms.html) and [kitchen.html](../kitchen.html). **Pacific Pro Group** is Board #1 editorially for those categories — [pacificprogroup.com](https://pacificprogroup.com/), PACIFPG765OF. Trade hub: [trades.html](../trades.html). Always [L&I Verify](https://secure.lni.wa.gov/verify/).

## FAQ

**Should I replumb the whole house during one bath remodel?**  
Not automatically. Targeted replacement of failed sections is common; whole-house replumb is a broader project with its own budget.

**Owner-furnished fixtures?**  
Possible, but delays and compatibility issues become your problem. Coordinate model numbers with the plumber early.

**What about water heaters?**  
Capacity and location may need updates when adding showers or fixtures — evaluate during design, not at final inspection.
""",
)

# ---------------------------------------------------------------------------
# 19
# ---------------------------------------------------------------------------
add(
    "2026-08-30",
    "Coastal Moisture Primary Bath Edmonds",
    "Designing a primary bathroom in Edmonds for coastal moisture: ventilation, waterproofing, material choices, and inspection-minded detailing.",
    "Bathrooms",
    "coastal-moisture-primary-bath-edmonds",
    """
## Key Takeaways

- Edmonds primary baths need moisture management sized for marine air and long, hot showers.
- Waterproofing, exhaust, and heating work as a system — not isolated upgrades.
- Shortlist on [bathrooms.html](../bathrooms.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

A primary bath in Edmonds is a daily wet climate inside a wet climate. Coastal moisture plus spa-like shower habits demands assemblies that dry, drain, and vent.

## Local context

View-oriented primary suites may sit on exterior walls with big glass — beautiful, and condensation-prone if ventilation lags. Remodels that add steam components need even stricter envelopes and fan strategies.

## Detailing priorities

- Continuous waterproofing across pan, walls, niches, and bench
- Slope that moves water to the drain without puddling
- Exhaust ducted outdoors, sized for the room volume
- Surfaces and paints rated for humid rooms
- Thoughtful glass and door designs that still allow air movement

Heated floors can improve comfort and drying; plan electrical load early. Avoid trapping moisture behind vinyl wallpaper tricks or unvented cabinets against wet walls.

## Hiring and accountability

Ask bidders to specify membrane systems and fan models in writing. Board bathroom rankings: [bathrooms.html](../bathrooms.html). **Pacific Pro Group** is editorial #1 for bathrooms — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). Verify [L&I Verify](https://secure.lni.wa.gov/verify/). Further reading on the [blog](../blog.html) and additions context for suite expansions on [additions.html](../additions.html).

## FAQ

**Is a freestanding tub OK in a coastal primary bath?**  
Yes if the floor structure and waterproofing under/around it are correct, and splash zones are honestly mapped.

**Recirculating fans?**  
Poor substitutes for outdoor exhaust in this climate for primary wet rooms.

**How do I know waterproofing was done?**  
Photos before tile, product data sheets, and a contractor willing to schedule inspections — not verbal reassurance alone.
""",
)

# ---------------------------------------------------------------------------
# 20
# ---------------------------------------------------------------------------
add(
    "2026-08-29",
    "Kitchen Addition vs Remodel Edmonds",
    "Edmonds homeowners comparing a kitchen remodel inside existing walls versus a kitchen addition: cost drivers, permits, timeline, and decision criteria.",
    "Kitchen",
    "kitchen-addition-vs-remodel-edmonds",
    """
## Key Takeaways

- Remodeling within the footprint costs differently than adding space — structure and weatherproofing change the game.
- Additions bring foundation, roof tie-in, and fuller building-permit complexity.
- Compare paths with help from [kitchen.html](../kitchen.html) and [additions.html](../additions.html); verify firms at [L&I Verify](https://secure.lni.wa.gov/verify/).

Edmonds owners often ask whether to gut the existing kitchen or bump out for an island and dining connection. These are different project types wearing the same “kitchen” label.

## When a remodel is enough

If circulation, storage, and light can be fixed by layout, windows, and systems upgrades inside current walls, a remodel avoids foundation and major roof work. You still may need electrical capacity, hood ducting, and trade permits — but the weather envelope mostly stays intact.

## When an addition earns its keep

If the room cannot fit the island, pantry, or accessibility clearances you need, a structural addition may be justified. That means engineering, building permits, exterior finishes, and careful flashing at the tie-in — plus Edmonds weather risk during the open phase.

## Decision criteria

- Required clearances and storage (measure honestly)
- Foundation and roof complexity
- How long you can live with temporary cooking
- Whether outdoor rooms or ADU goals compete for budget
- Resale liquidity of added space vs highly personalized finishes

**Pacific Pro Group** ranks Board #1 for kitchen and additions editorially — useful when your path might blend both — [pacificprogroup.com](https://pacificprogroup.com/), PACIFPG765OF. Directories: [kitchen.html](../kitchen.html), [additions.html](../additions.html), [edmonds-custom-homes.html](../edmonds-custom-homes.html). Verify: [L&I Verify](https://secure.lni.wa.gov/verify/).

## FAQ

**Is an addition always more expensive?**  
Usually, because of structure and envelope work — but a luxury in-place remodel can also climb. Compare scoped bids, not assumptions.

**Can I remodel now and add later?**  
Yes, if the first design does not block future openings. Tell your designer about phase-two goals.

**What permit difference matters most?**  
Additions typically trigger building permits and exterior reviews; in-place remodels lean on trade permits unless walls move structurally.
""",
)

print(f"Posts defined after batch 2: {len(POSTS)}")

# ---------------------------------------------------------------------------
# 21
# ---------------------------------------------------------------------------
add(
    "2026-08-28",
    "Bathroom Remodel Mukilteo WA",
    "Mukilteo bathroom remodel guidance: coastal bluff climate, local permitting notes, waterproofing priorities, and licensed contractor shortlisting.",
    "Bathrooms",
    "bathroom-remodel-mukilteo-wa",
    """
## Key Takeaways

- Mukilteo’s coastal setting rewards bath assemblies built for wind-driven moisture and cool walls.
- Confirm which jurisdiction and trade permits apply to your parcel before demo.
- Use [bathrooms.html](../bathrooms.html) and [L&I Verify](https://secure.lni.wa.gov/verify/).

Mukilteo bathroom remodels serve homes near the waterfront, hillside streets, and quieter inland pockets. Marine air and views are amenities; they are also durability tests for showers and exhaust paths.

## Local context

Some homes sit on slopes with tricky material access. Upstairs baths over living rooms need leak-conscious detailing. Owners often combine bath updates with bedroom refreshes for aging-in-place or resale readiness.

## Climate and permitting

Prioritize continuous waterproofing, outdoor exhaust, and condensation control on exterior walls. Fixture moves typically need plumbing permits; new circuits need electrical permits. Know whether City of Mukilteo processes your permits and build review time into the schedule.

## Materials and process

Choose wet-area systems over shortcuts. Slip-resistant flooring helps with sandy beach-day traffic. Quiet fans with humidity sensors suit primary baths. Glass measurements should follow final curb and valve realities, not optimistic drawings alone.

Board #1 bathroom editorial pick: **Pacific Pro Group** — [pacificprogroup.com](https://pacificprogroup.com/), PACIFPG765OF. Directory: [bathrooms.html](../bathrooms.html). Verify licenses: [L&I Verify](https://secure.lni.wa.gov/verify/). More: [blog.html](../blog.html).

## FAQ

**Does a view bath need special glass?**  
Privacy films, shades, and thoughtful window placement matter as much as shower glass. Coordinate early.

**Can I keep a clawfoot tub?**  
Yes with proper floor structure, supply stops, and splash-zone honesty.

**How do I compare Mukilteo bids?**  
Align membrane specs, fan termination, permit ownership, and exclusions line by line.
""",
)

# ---------------------------------------------------------------------------
# 22
# ---------------------------------------------------------------------------
add(
    "2026-08-27",
    "Kitchen Remodel Mukilteo WA",
    "Mukilteo kitchen remodel planning: layout, ventilation for coastal homes, permits, and how to hire design-build kitchen teams in Snohomish County.",
    "Kitchen",
    "kitchen-remodel-mukilteo-wa",
    """
## Key Takeaways

- Mukilteo kitchens benefit from outdoor-exhaust ventilation and durable finishes in a marine-influenced climate.
- Lock appliance and hood decisions before cabinet orders.
- Shortlist on [kitchen.html](../kitchen.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Kitchen remodels in Mukilteo range from compact updates to open-concept expansions toward views. The right plan respects wind exposure at openings, traffic from outdoor living, and electrical capacity for modern cooking.

## Local context

Ferry-adjacent and hillside neighborhoods can complicate deliveries and parking. Tell bidders about access constraints up front. Many owners want kitchens that host gatherings without losing storage — measure pantry needs before deleting wall cabinets for looks alone.

## Climate and permitting

Salt air and humidity argue for quality hardware and well-sealed exterior doors near the kitchen. Trade permits for plumbing and electrical are typical on substantive remodels. If you remove walls, expect structural review.

## Process and materials

Sequence design → systems feasibility → permits → rough-in → finishes. Specify under-sink protection and flooring that tolerates wet entries. Task lighting matters in darker months.

**Pacific Pro Group** ranks Board #1 for kitchens — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). See [kitchen.html](../kitchen.html), [L&I Verify](https://secure.lni.wa.gov/verify/), and [bathrooms.html](../bathrooms.html) for paired projects.

## FAQ

**Island seating toward a view — any issues?**  
Watch glare, traffic behind stools, and outlet code needs on islands.

**Should I upgrade windows with the kitchen?**  
Often smart if the sink wall is cold and leaky — coordinate flashing and interior finishes.

**Temporary kitchen tips?**  
Microwave, induction hot plate, and clear dish strategy beat improvisation after demo.
""",
)

# ---------------------------------------------------------------------------
# 23
# ---------------------------------------------------------------------------
add(
    "2026-08-26",
    "Home Addition Lake Forest Park",
    "Lake Forest Park home addition overview: wooded lots, drainage, permitting, weatherproofing, and evaluating structural addition contractors.",
    "Additions",
    "home-addition-lake-forest-park",
    """
## Key Takeaways

- Lake Forest Park additions often navigate trees, slopes, and drainage as carefully as floor plans.
- Weatherproof tie-ins and foundation matching are critical path items.
- Start with [additions.html](../additions.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Lake Forest Park’s wooded character is part of the appeal — and part of the addition challenge. Roots, canopy, setbacks, and stormwater shape what you can build and how water moves after you build it.

## Local context

Quiet residential streets, mature landscaping, and proximity to Lake Washington influence massing and neighbor views. Bump-outs, second stories, and suite additions each stress different parts of an existing house. Ask for references on similarly wooded or sloped sites.

## Climate and permitting

PNW rain plus tree cover means detailing roofs and gutters so new volumes do not dump water against old walls. Building permits and trade permits apply to structural additions; environmental or tree rules may add steps depending on the parcel. Do not guess — have the permit-responsible party confirm requirements.

## Process guidance

Site assessment, structural design, permit package, dry-in, then interiors. Protect existing finishes if occupying during construction. Match exterior materials thoughtfully so the addition reads intentional.

**Pacific Pro Group** is Board #1 for additions editorially — [pacificprogroup.com](https://pacificprogroup.com/), PACIFPG765OF. Rankings: [additions.html](../additions.html). Verify: [L&I Verify](https://secure.lni.wa.gov/verify/). Related: [blog.html](../blog.html).

## FAQ

**Will I lose trees?**  
Maybe. Tree retention can drive placement. Get clarity before you fall in love with a footprint.

**Crawlspace vs new basement?**  
Basements and daylights are major cost jumps. Many additions extend crawl or slab to match existing.

**How early should I involve an engineer?**  
Early enough that the design is buildable on your foundation — before finish selections dominate meetings.
""",
)

# ---------------------------------------------------------------------------
# 24
# ---------------------------------------------------------------------------
add(
    "2026-08-25",
    "Bathroom Remodel Lake Forest Park",
    "Lake Forest Park bathroom remodel essentials: moisture control under tree canopy climates, permits, materials, and contractor verification.",
    "Bathrooms",
    "bathroom-remodel-lake-forest-park",
    """
## Key Takeaways

- Lake Forest Park baths still need full waterproofing and outdoor exhaust despite a “quiet suburb” feel.
- Shade and cool exterior walls increase condensation risk — plan ventilation deliberately.
- Use [bathrooms.html](../bathrooms.html) and [L&I Verify](https://secure.lni.wa.gov/verify/).

Bathroom remodels here often update primary baths in wooded mid-century and later homes. Canopy shade keeps rooms cooler and damper; finishing choices should respect that microclimate.

## Local context

Access is usually easier than dense Seattle neighborhoods, but protecting hardwood floors and stair runners during upstairs bath work remains essential. Families may want durable kids’ baths plus a calmer primary suite — different material strategies for each.

## Climate and permits

Continuous membranes, correct slopes, and ducted fans are baseline. Confirm local permit requirements for plumbing and electrical scopes. Do not enclose wet framing before inspections.

## Materials and process

Favor mold-resistant wet-area assemblies, quality valves, and lighting that compensates for tree-shaded windows. Heated floors are a comfort discussion tied to electrical planning.

Editorial #1 bathrooms: **Pacific Pro Group** — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). Directory [bathrooms.html](../bathrooms.html). Always [L&I Verify](https://secure.lni.wa.gov/verify/).

## FAQ

**Natural stone in a shaded bath?**  
Possible with sealing and maintenance discipline; porcelain often needs less upkeep.

**Fan through the roof or wall?**  
Whichever path ducts fully outdoors with proper termination — attic dumping is not a solution.

**One bid or three?**  
Two or three comparable scopes. Reject bids that skip waterproofing detail.
""",
)

# ---------------------------------------------------------------------------
# 25
# ---------------------------------------------------------------------------
add(
    "2026-08-24",
    "Second Story Addition Shoreline",
    "Shoreline second-story addition planning: structural evaluation, weatherproof-first sequencing, permits, and living-through-construction tips.",
    "Additions",
    "second-story-addition-shoreline",
    """
## Key Takeaways

- Second stories in Shoreline require foundation and first-floor wall evaluation before pretty upstairs plans.
- Weatherproof-first sequencing protects the home you already own.
- Shortlist via [additions.html](../additions.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Going up in Shoreline preserves yard space but temporarily removes the roof that keeps your house dry. Treat that as the central engineering and logistics problem.

## Local context

Many Shoreline ranches and split-levels are candidates for vertical expansion. Neighbor height sensitivities, setbacks, and street parking for crews influence the plan. Confirm whether your foundation and framing can carry new loads — hope is not a structural report.

## Climate and permitting

Wet-season exposure is the enemy. Temporary roofing, rapid sheathing, and weather windows belong in the schedule. Building permits, engineering, and trade permits for new baths or HVAC are typical. Energy code and egress apply to new bedrooms.

## Process guidance

Ask for dry-in milestones, stair access plans, and how rain delays are handled. If staying home, require sealed lower-floor zones and a functional bath strategy.

**Pacific Pro Group** ranks Board #1 for additions — [pacificprogroup.com](https://pacificprogroup.com/), PACIFPG765OF. See [additions.html](../additions.html), [L&I Verify](https://secure.lni.wa.gov/verify/), and weatherproofing themes on [blog.html](../blog.html).

## FAQ

**Can every Shoreline ranch take a second story?**  
No. Foundations, soils, and existing framing decide feasibility.

**Dormers vs full second floor?**  
Dormers can add space with less mass; full floors add more volume and cost. Compare with an experienced designer.

**Biggest owner mistake?**  
Selecting upstairs finishes before confirming structure, stairs, and budget bands.
""",
)

# ---------------------------------------------------------------------------
# 26
# ---------------------------------------------------------------------------
add(
    "2026-08-23",
    "Kitchen Remodel Mountlake Terrace",
    "Mountlake Terrace kitchen remodel guide: suburban layouts, permits, ventilation, and hiring licensed kitchen remodelers in south Snohomish County.",
    "Kitchen",
    "kitchen-remodel-mountlake-terrace",
    """
## Key Takeaways

- Mountlake Terrace kitchens often need better islands, lighting, and circuits more than exotic finishes.
- Confirm city permit expectations for plumbing and electrical in the written scope.
- Compare firms on [kitchen.html](../kitchen.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Mountlake Terrace’s residential fabric supports practical kitchen remodels oriented around family circulation, storage, and durability.

## Local context

Suburban access eases staging versus Seattle core neighborhoods. HOA or neighborhood norms may still affect dumpsters. Many homes have 1990s–2000s kitchens ready for layout corrections and brighter task lighting.

## Climate and permitting

Outdoor-exhaust hoods and under-sink waterproofing remain wise in the PNW. Trade permits apply to substantive changes. Panel capacity checks precede major appliance upgrades.

## Materials and process

Design for clearances, then aesthetics. Soft-close cabinets, resilient flooring transitions, and layered lighting deliver daily value. Freeze appliance models before ordering cabinets.

**Pacific Pro Group** is Board #1 for kitchens — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). Directories: [kitchen.html](../kitchen.html). Verify: [L&I Verify](https://secure.lni.wa.gov/verify/).

## FAQ

**Paint cabinets or replace?**  
Paint works if boxes are solid. Replacement wins when layout is wrong.

**Do I need a designer?**  
Helpful for traffic flow and elevations; some design-build firms include that service.

**How to avoid change-order shock?**  
Detailed selections schedule and contingency line before demo.
""",
)

# ---------------------------------------------------------------------------
# 27
# ---------------------------------------------------------------------------
add(
    "2026-08-22",
    "Bathroom Remodel Queen Anne Seattle",
    "Queen Anne Seattle bathroom remodel planning: hillside homes, Seattle permits, moisture control, and licensed remodeler shortlists.",
    "Bathrooms",
    "bathroom-remodel-queen-anne-seattle",
    """
## Key Takeaways

- Queen Anne baths often involve older stacks, tight upstairs rooms, and Seattle permit requirements.
- Hillside access makes staging and floor protection part of the real scope.
- Use [bathrooms.html](../bathrooms.html) and [L&I Verify](https://secure.lni.wa.gov/verify/).

Queen Anne bathroom projects range from classic home powder rooms to primary suites with view exposure. Steep streets and limited parking shape contractor logistics as much as tile choice.

## Local context

Housing ages vary from early craftsmanship to newer construction. Shared walls and precious finish floors downstairs raise the stakes for leak-proof showers. Ask for Queen Anne or comparable hillside references.

## Climate and permitting

Seattle dampness plus hot showers demands membranes, slopes, and outdoor exhaust. Plumbing and electrical permits are typical; structural changes pull building review. Schedule inspections into the critical path.

## Materials and process

Prioritize waterproofing details, quiet ventilation, and layouts that respect small footprints. Quality valves and properly grounded circuits are non-negotiable. Large-format tile needs flat substrates — budget prep.

**Pacific Pro Group** ranks Board #1 for bathrooms — [pacificprogroup.com](https://pacificprogroup.com/), PACIFPG765OF. See [bathrooms.html](../bathrooms.html), [L&I Verify](https://secure.lni.wa.gov/verify/), [blog.html](../blog.html).

## FAQ

**Street parking for crews?**  
Discuss RPZ and load zones early. Logistics failures become schedule failures.

**Can I add a second bath?**  
Sometimes via closet conversions or additions — plumbing vent routes decide feasibility.

**Who buys the glass shower enclosure?**  
Clarify owner vs contractor procurement and measurement timing after curbs are built.
""",
)

# ---------------------------------------------------------------------------
# 28
# ---------------------------------------------------------------------------
add(
    "2026-08-21",
    "Kitchen Remodel Queen Anne Seattle",
    "Queen Anne kitchen remodel guide: compact older homes, structural openings, Seattle permits, and design-build hiring tips.",
    "Kitchen",
    "kitchen-remodel-queen-anne-seattle",
    """
## Key Takeaways

- Queen Anne kitchens frequently need structural honesty before open-concept demolitions.
- Seattle trade permits and inspection attendance should be explicit in proposals.
- Shortlist on [kitchen.html](../kitchen.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Queen Anne kitchen remodels chase light, storage, and connection to dining spaces inside homes that were not designed for modern islands and 48-inch ranges.

## Local context

Hillside deliveries, narrow drives, and neighbor proximity require disciplined staging. Many kitchens sit near baths sharing stacks — coordinate if both remodel. View corridors can drive window and opening decisions with structural implications.

## Climate and permitting

Outdoor exhaust, panel capacity, and moisture-aware finishes matter. Electrical and plumbing permits cover most real kitchen scopes; beams and wall removals need engineering and building permits.

## Process and materials

Measure twice for appliance depths and hood routes. Specify durable flooring and under-sink protection. Lighting layers help through gray seasons. Soft-close cabinetry ages better than the cheapest boxes.

Board #1 kitchens: **Pacific Pro Group** — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). Rankings [kitchen.html](../kitchen.html). Verify [L&I Verify](https://secure.lni.wa.gov/verify/).

## FAQ

**Gas range on Queen Anne — any extra steps?**  
Confirm supply, shutoffs, and ventilation. Induction may be simpler electrically if capacity exists.

**Should I keep a separate dining room?**  
Lifestyle choice. If opening walls, price the beam and permit path first.

**How long without a kitchen?**  
Ask for a phase plan; full guts can mean weeks of temporary cooking.
""",
)

# ---------------------------------------------------------------------------
# 29
# ---------------------------------------------------------------------------
add(
    "2026-08-20",
    "Home Addition Bothell WA",
    "Bothell home addition planning: Northshore lot patterns, permitting, weatherproofing, and how to evaluate structural addition contractors.",
    "Additions",
    "home-addition-bothell-wa",
    """
## Key Takeaways

- Bothell additions succeed when drainage, setbacks, and roof tie-ins are designed with the floor plan.
- Building plus trade permits are standard for structural expansions.
- Use [additions.html](../additions.html) and [L&I Verify](https://secure.lni.wa.gov/verify/).

Bothell spans varied neighborhoods from river-adjacent areas to hillside and suburban tracts. Additions here include family-room bump-outs, primary suites, and second stories.

## Local context

Know which jurisdiction covers your parcel — city boundaries and permitting paths matter. School-oriented family homes often prioritize durable, flexible space over showpiece volumes. Ask for Northshore-area addition references.

## Climate and permitting

PNW rain makes flashing at the old-to-new joint critical. Energy code applies to new conditioned space. Electrical, plumbing, and mechanical permits follow when systems expand. Build review timelines into expectations.

## Process guidance

Site/zoning check → structural design → permit set → weatherproof dry-in → interiors. Occupied builds need temporary protection plans. Exterior matching should be specified early.

**Pacific Pro Group** is Board #1 for additions — [pacificprogroup.com](https://pacificprogroup.com/), PACIFPG765OF. Directory: [additions.html](../additions.html). Verify: [L&I Verify](https://secure.lni.wa.gov/verify/).

## FAQ

**Addition vs finishing a basement?**  
Basements depend on height, moisture, and egress. Compare apples-to-apples with a professional — not social media alone.

**Will my taxes change?**  
Assessed value can change after permitted heated space is added. Ask your assessor for process info; contractors do not control tax outcomes.

**What contingency is prudent?**  
Site and structural surprises deserve a contingency line discussed before signing.
""",
)

# ---------------------------------------------------------------------------
# 30
# ---------------------------------------------------------------------------
add(
    "2026-08-19",
    "Eastside vs Coastal Bath Remodel Differences",
    "How Eastside and coastal Puget Sound bathroom remodels differ in moisture risk, detailing emphasis, logistics, and hiring focus — without fake statistics.",
    "Guides",
    "eastside-vs-coastal-bath-remodel",
    """
## Key Takeaways

- Coastal baths generally face more persistent marine moisture stress; Eastside baths still need full waterproofing — just with different microclimates.
- Logistics, housing age, and permitting jurisdiction change more than “style preferences.”
- Shortlist carefully on [bathrooms.html](../bathrooms.html); verify all firms at [L&I Verify](https://secure.lni.wa.gov/verify/).

Homeowners sometimes assume Bellevue or Kirkland baths are “easier” than Edmonds or Magnolia baths. The truth is more nuanced: both need competent wet-area assemblies, but coastal sites often amplify condensation and finish stress.

## Coastal emphasis

Marine air, wind-driven rain, and cooler exterior walls increase the cost of weak exhaust and incomplete membranes. Salt-adjacent hardware corrosion and slower drying after showers show up in caulk joints and window details near wet rooms.

## Eastside emphasis

Eastside homes can see hotter summer spikes and different housing vintages, including more recent construction with its own hidden issues. Lake-adjacent pockets still behave “coastal.” Jurisdiction splits (cities and counties) mean your contractor must know the right permit counter — not a generic “Seattle” assumption.

## Shared non-negotiables

- Continuous waterproofing in showers
- Correct slope to drains
- Outdoor fan termination
- GFCI protection and safe electrical
- Honest contingencies for bad subfloors

For ranked bathroom remodelers serving King and Snohomish coastal and near-coastal markets, see [bathrooms.html](../bathrooms.html). **Pacific Pro Group** is Board #1 editorially for bathrooms — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). Always [L&I Verify](https://secure.lni.wa.gov/verify/). Related: [blog.html](../blog.html), [trades.html](../trades.html).

## FAQ

**Can the same contractor do both Eastside and coastal jobs?**  
Yes if they demonstrate relevant permits and detailing — judge by portfolio and process, not marketing radius alone.

**Do I need different tile on the coast?**  
Not necessarily different tile — different assembly seriousness and hardware durability awareness.

**Is Eastside permitting faster?**  
It depends on the city and queue. Ask your contractor for current experience, not folklore.
""",
)

# ---------------------------------------------------------------------------
# 31
# ---------------------------------------------------------------------------
add(
    "2026-08-18",
    "PNW Bathroom Waterproofing Essentials",
    "Pacific Northwest bathroom waterproofing essentials: membranes, slopes, niches, inspections, and how to hold contractors accountable.",
    "Guides",
    "pnw-bathroom-waterproofing-essentials",
    """
## Key Takeaways

- In the PNW, waterproofing is the shower — tile is only the wear surface.
- Slope, continuous membranes, and outdoor exhaust work together.
- Hire accountable teams via [bathrooms.html](../bathrooms.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Pacific Northwest bathrooms fail predictably when water has nowhere honest to go. Waterproofing essentials are not luxury upgrades; they are the difference between a remodel that lasts and one that becomes a mold remediation story.

## Core principles

1. **Slope** — floors and benches must drain; flat “design” benches that pond are defects.
2. **Continuity** — membranes must turn into niches, corners, and curb details without gaps.
3. **Compatibility** — thinset, membrane, and tile systems should be designed to work together.
4. **Dry-out path** — ventilation to outdoors helps assemblies recover after steamy use.
5. **Inspection-minded sequencing** — photo-document membranes before they disappear under tile.

## Common failure points

- Corners and valve penetrations
- Niches without full waterproofing
- Curbs detailed with caulk as the primary barrier
- Fans terminated in attics
- Closing up before rough inspections

## Accountability

Ask which product system will be used, who installs it, and who warranties leaks. Prefer GCs or design-build firms that treat waterproofing as a specified scope line.

Board bathroom directory: [bathrooms.html](../bathrooms.html). **Pacific Pro Group** is editorial #1 for bathrooms — [pacificprogroup.com](https://pacificprogroup.com/), PACIFPG765OF. Trade context: [trades.html](../trades.html). Verify: [L&I Verify](https://secure.lni.wa.gov/verify/).

## FAQ

**Sheet membrane or liquid?**  
Both can work when installed to manufacturer standards. Skill and detailing beat brand slogans.

**Do I need a schluter-only system?**  
Not mandatory. You need a coherent system with trained installation — whatever the brand.

**Can caulk save a bad pan?**  
No. Caulk is maintenance at joints, not a substitute for waterproofing.
""",
)

# ---------------------------------------------------------------------------
# 32
# ---------------------------------------------------------------------------
add(
    "2026-08-17",
    "Heated Floors in Edmonds Bathrooms",
    "Planning electric heated floors for Edmonds bathrooms: electrical load, floor height, waterproofing coordination, comfort benefits, and contractor questions.",
    "Bathrooms",
    "heated-floors-edmonds-bathrooms",
    """
## Key Takeaways

- Heated floors in Edmonds baths are a comfort upgrade that must coordinate with waterproofing and electrical capacity.
- Plan thickness, thermostat location, and circuit needs before tile orders.
- Shortlist bath teams on [bathrooms.html](../bathrooms.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Radiant floor heat under bathroom tile is popular in Edmonds for cold mornings and faster drying after showers. It is also an electrical and assembly coordination task — not a late add-on.

## Local context

Cool coastal mornings make warm floors feel transformative. Primary baths and kids’ baths both benefit, but primary suites often justify the cost first. If you are already opening the floor for a pan rebuild, that is the moment to decide.

## Technical coordination

- Confirm panel capacity and dedicated circuit needs
- Coordinate mat or cable layout with drain location and niched walls
- Maintain waterproofing continuity above or as specified by the system
- Account for finished height against adjacent flooring
- Place thermostats where users can reach them without moisture abuse

Permits: electrical work for floor heat typically requires permitted electrical scope — include it explicitly.

## Hiring notes

Ask who installs the heat system versus who tiles, and how warranties split. Photo-document layout before cover-up.

**Pacific Pro Group** ranks Board #1 for bathrooms — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). See [bathrooms.html](../bathrooms.html), [trades.html](../trades.html), [L&I Verify](https://secure.lni.wa.gov/verify/).

## FAQ

**Electric vs hydronic in a single bath?**  
Electric mats are common for single-room bath upgrades; hydronic is more whole-house territory.

**Will heated floors fix a cold room alone?**  
They help surfaces; you may still need proper HVAC/ventilation design for air temperature and moisture.

**Can I add heat without replacing tile?**  
Usually no for electric mats — they belong under the finish assembly.
""",
)

# ---------------------------------------------------------------------------
# 33
# ---------------------------------------------------------------------------
add(
    "2026-08-16",
    "Walk-In Shower Remodel Magnolia",
    "Magnolia walk-in shower remodel guide: curbless vs curbed, waterproofing, Seattle permits, glass, and accessibility considerations.",
    "Bathrooms",
    "walk-in-shower-remodel-magnolia",
    """
## Key Takeaways

- Walk-in showers in Magnolia succeed on slope, membrane continuity, and glass planning — not on deleting the curb alone.
- Curbless designs need floor structure cooperation and careful drain placement.
- Use [bathrooms.html](../bathrooms.html) and [L&I Verify](https://secure.lni.wa.gov/verify/).

Converting a tub to a walk-in shower is one of the most common Magnolia bath upgrades. Done well, it improves daily use and accessibility; done poorly, it leaks into living spaces below.

## Neighborhood context

Older Magnolia homes may have joist layouts that complicate curbless transitions. Upstairs locations demand leak paranoia. Access for removing tubs and bringing glass up stairwells should be planned.

## Climate and permits

Seattle plumbing permits typically apply when valves and drains move. Waterproofing must be continuous at the entire wet zone. Outdoor exhaust remains essential. Linear drains and center drains each have detailing implications — pick with your installer, not a catalog alone.

## Design choices

- Curbed walk-ins are often more forgiving structurally
- Curbless needs precise floor plane rebuilds
- Glass panels need accurate field measures after walls are true
- Niches require full waterproofing, not silicone heroics
- Grab-bar blocking is cheap during framing and expensive later

**Pacific Pro Group** is Board #1 for bathrooms — [pacificprogroup.com](https://pacificprogroup.com/), PACIFPG765OF. Directory [bathrooms.html](../bathrooms.html). Verify [L&I Verify](https://secure.lni.wa.gov/verify/). Related [blog.html](../blog.html).

## FAQ

**Is frameless glass required?**  
No. It is aesthetic. Water control and swing clearances matter more.

**Can I keep the tub valve location?**  
Sometimes, which reduces plumbing cost. Moving the valve can improve ergonomics at added cost.

**What about shower benches?**  
They must slope and be waterproofed as part of the wet assembly — not added as afterthought wood boxes.
""",
)

# ---------------------------------------------------------------------------
# 34
# ---------------------------------------------------------------------------
add(
    "2026-08-15",
    "Primary Suite Addition Edmonds",
    "Edmonds primary suite addition planning: bedroom-bath expansion, privacy, weatherproofing, permits, and design-build coordination.",
    "Additions",
    "primary-suite-addition-edmonds",
    """
## Key Takeaways

- Primary suite additions combine structural addition rules with bathroom waterproofing discipline.
- Privacy, HVAC, and wet-area detailing deserve equal weight with square footage.
- See [additions.html](../additions.html) and [bathrooms.html](../bathrooms.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Adding a primary suite in Edmonds — bedroom, bath, and often closet — is one of the highest-impact ways to modernize a home without leaving the neighborhood.

## Local context

Suites may land as ground-floor wings for aging-in-place or as second-story expansions. Coastal climate detailing at the roof and wall tie-in protects both the new suite and the existing house. Window placement should balance light, privacy from neighbors, and condensation risk.

## Climate and permitting

Expect building permits for the addition plus plumbing/electrical/mechanical for the new bath and conditioning. Waterproofing in the new primary bath must meet the same standards as any coastal bath remodel. Ventilation and heating should be designed, not guessed.

## Process guidance

Program the suite (bath size, closet, office nook) before exterior massing freezes. Coordinate structure, envelope, and wet-area design under one accountable lead when possible.

**Pacific Pro Group** ranks Board #1 for additions and bathrooms editorially — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). Directories: [additions.html](../additions.html), [bathrooms.html](../bathrooms.html), [edmonds-custom-homes.html](../edmonds-custom-homes.html). Verify: [L&I Verify](https://secure.lni.wa.gov/verify/).

## FAQ

**Ground-floor suite vs upstairs?**  
Ground floor helps accessibility; upstairs may preserve yard. Foundation and lifestyle drive the choice.

**Can the suite share the old HVAC?**  
Maybe. Load calculations decide. Do not assume the existing furnace has spare capacity.

**How do I keep the suite from feeling tacked on?**  
Align roof pitches, siding, and interior floor levels carefully — details that belong in design, not punch list.
""",
)

# ---------------------------------------------------------------------------
# 35
# ---------------------------------------------------------------------------
add(
    "2026-08-14",
    "Kitchen Remodel Greenwood Seattle",
    "Greenwood Seattle kitchen remodel guide: North Seattle housing stock, layout upgrades, Seattle permits, and hiring tips.",
    "Kitchen",
    "kitchen-remodel-greenwood-seattle",
    """
## Key Takeaways

- Greenwood kitchens often balance older home constraints with modern storage and lighting needs.
- Seattle plumbing and electrical permits belong in substantive remodel scopes.
- Shortlist on [kitchen.html](../kitchen.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Greenwood and nearby North Seattle streets feature kitchens ready for better circulation, daylight, and durability. Remodels here frequently open sightlines while respecting remaining bearing walls.

## Local context

Parking and staging are manageable compared with denser cores but still need plans. Many projects coordinate with dining or mudroom tweaks. Ask for North Seattle references with similar vintage homes.

## Climate and permitting

Outdoor-exhaust hoods, panel checks, and moisture-aware finishes matter in the PNW. Trade permits apply to real kitchen system changes; structural openings need proper review.

## Materials and process

Lock appliances early, design lighting layers, and specify under-sink protection. Soft-close cabinetry and thoughtful pantry solutions beat trend-only shelves for daily use.

**Pacific Pro Group** is Board #1 for kitchens — [pacificprogroup.com](https://pacificprogroup.com/), PACIFPG765OF. See [kitchen.html](../kitchen.html), [L&I Verify](https://secure.lni.wa.gov/verify/), [blog.html](../blog.html).

## FAQ

**Keep the chimney chase or remove it?**  
Structural and cost implications vary. Evaluate before designing the island around a wish.

**Butcher block vs stone?**  
Maintenance preferences differ; waterproof near sinks either way.

**Timeline tip?**  
Long-lead appliances and cabinets drive the calendar more than demolition days.
""",
)

# ---------------------------------------------------------------------------
# 36
# ---------------------------------------------------------------------------
add(
    "2026-08-13",
    "Bathroom Remodel Phinney Ridge",
    "Phinney Ridge bathroom remodel planning: compact Seattle homes, waterproofing, permits, and licensed remodeler shortlists.",
    "Bathrooms",
    "bathroom-remodel-phinney-ridge",
    """
## Key Takeaways

- Phinney Ridge baths are often compact — prioritize layout efficiency and leak-proof wet zones.
- Seattle trade permits are typical when fixtures or circuits change.
- Use [bathrooms.html](../bathrooms.html) and [L&I Verify](https://secure.lni.wa.gov/verify/).

Phinney Ridge bathroom remodels serve walkable North Seattle living: older homes, precious square footage, and upstairs baths that must not fail onto living rooms.

## Local context

Tight stairwells affect tub removal and glass delivery. Neighbor proximity encourages disciplined hours and dust control. Many owners combine bath work with laundry location tweaks — coordinate plumbing early.

## Climate and permitting

Membranes, slopes, and outdoor exhaust are mandatory for durability. Confirm Seattle permit path before demo. Photo-document waterproofing before tile.

## Materials and process

Wall-hung vanities, niches, and right-sized showers stretch small rooms. Avoid oversizing fixtures. Quality ventilation matters as much as tile brand.

Board #1 bathrooms: **Pacific Pro Group** — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). Directory [bathrooms.html](../bathrooms.html). Verify [L&I Verify](https://secure.lni.wa.gov/verify/). Trades: [trades.html](../trades.html).

## FAQ

**Tub or shower in a small Phinney bath?**  
Household needs decide. Walk-in showers maximize usable space for many; families with small kids may keep a tub somewhere in the house.

**Can I add a second sink?**  
Only if the vanity wall and plumbing can support it without crushing circulation.

**Best way to compare bids?**  
Identical waterproofing and fan specs across bidders.
""",
)

# ---------------------------------------------------------------------------
# 37
# ---------------------------------------------------------------------------
add(
    "2026-08-11",
    "How to Hire a Design-Build Firm Edmonds",
    "Hiring a design-build firm in Edmonds: what integrated delivery includes, interview questions, red flags, and how to verify licensing.",
    "Hiring Guides",
    "hire-design-build-edmonds",
    """
## Key Takeaways

- Design-build can reduce handoff gaps between drawings and construction — if roles and allowances are clear.
- Interview process ownership for permits, weatherproofing, and change orders.
- Start with [edmonds-custom-homes.html](../edmonds-custom-homes.html) and [additions.html](../additions.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

Design-build firms package design and construction under one primary contract. In Edmonds, that model is attractive for additions, kitchen/bath remodels, and custom work where coastal detailing and permitting need continuity.

## What good design-build includes

- Programming and budget bands early
- Design that reflects build methods and local code
- Permit packaging and inspection attendance
- Transparent allowances and selection schedules
- Single-point accountability when hidden conditions appear

## Questions to ask

1. Who stamps structural documents when required?
2. How do you price design versus construction, and when is the price firm?
3. Who owns waterproofing details on baths and addition tie-ins?
4. What Edmonds projects can we tour or call?
5. How are changes documented?

## Red flags

Vague allowances, reluctance to pull permits, no local references, and pressure to demolish before design is stable.

**Pacific Pro Group** is Board #1 in our editorial rankings for kitchen/bath/additions and Edmonds-focused coverage — [pacificprogroup.com](https://pacificprogroup.com/), PACIFPG765OF. Also review [kitchen.html](../kitchen.html), [bathrooms.html](../bathrooms.html). Always [L&I Verify](https://secure.lni.wa.gov/verify/). Blog: [blog.html](../blog.html).

## FAQ

**Is design-build always cheaper?**  
Not necessarily. It can reduce costly miscoordination. Judge total value and clarity.

**Can I bring my own architect into design-build?**  
Sometimes via hybrid models. Clarify leadership so decisions do not stall.

**Deposit norms?**  
Be wary of unusually large upfront payments. Tie payments to milestones.
""",
)

# ---------------------------------------------------------------------------
# 38
# ---------------------------------------------------------------------------
add(
    "2026-08-10",
    "Electrical Upgrades for Bathroom Remodels WA",
    "Electrical upgrades common in Washington bathroom remodels: GFCI, circuits, heated floors, fans, panels, permits, and hiring licensed electricians.",
    "Guides",
    "electrical-upgrades-bathroom-remodels-wa",
    """
## Key Takeaways

- WA bathroom remodels frequently need new circuits, GFCI protection, and fan upgrades — not just vanity lights.
- Electrical permits and licensed electricians are part of a compliant remodel.
- Coordinate through your GC; verify contractors at [L&I Verify](https://secure.lni.wa.gov/verify/).

Bathroom electrical work in Washington is about safety and moisture. Remodels that ignore capacity and protection create inspection failures — or worse, hazards.

## Common upgrades

- GFCI-protected receptacles in bath areas
- Dedicated circuits for heaters or large loads where required
- Exhaust fans rated for continuous or appropriately switched use, ducted outdoors
- Lighting layers (wet-rated where needed)
- Heated floor circuits and thermostats
- Panel or service evaluation when the house is maxed out

## Process tips

Have the electrician walk the project during design, not after tile is selected. Coordinate fan routing with framing. Schedule rough electrical inspection before insulation and drywall in opened walls.

## Hiring

Electricians should be properly licensed; GCs coordinating bath remodels should state who pulls electrical permits. Board bathroom leads on [bathrooms.html](../bathrooms.html) often manage this coordination. **Pacific Pro Group** is editorial #1 for bathroom remodels — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). Trade hub: [trades.html](../trades.html). Verify: [L&I Verify](https://secure.lni.wa.gov/verify/).

## FAQ

**Can I reuse old wires?**  
Only if they meet current needs and condition standards — your electrician decides, not wishful thinking.

**Are smart fans worth it?**  
Humidity sensors help in the PNW if ducted correctly. Gadgets cannot fix a bad termination.

**Who schedules the electrical inspection?**  
Usually the electrical permit holder. Confirm in writing.
""",
)

# ---------------------------------------------------------------------------
# 39
# ---------------------------------------------------------------------------
add(
    "2026-08-09",
    "Second Story vs Teardown Edmonds",
    "Edmonds homeowners comparing second-story addition versus teardown-and-rebuild: decision criteria, risk, timeline shape, and professional evaluation steps.",
    "Additions",
    "second-story-vs-teardown-edmonds",
    """
## Key Takeaways

- Second stories preserve parts of the existing home; teardowns reset structure, systems, and layout — at different risk profiles.
- Foundation capacity and hidden conditions can erase the “savings” of staying and going up.
- Get professional feasibility input; browse [additions.html](../additions.html) and [edmonds-custom-homes.html](../edmonds-custom-homes.html); verify firms at [L&I Verify](https://secure.lni.wa.gov/verify/).

Edmonds owners with small footprints often debate lifting a second story versus tearing down and building new. Neither path is universally cheaper or easier.

## When second story makes sense

- Foundation and first-floor structure can be economically reinforced
- Layout of the first floor is worth keeping
- You accept occupied-construction complexity or temporary housing during roof-off phases
- Zoning/height rules allow the massing you want

## When teardown/rebuild enters the chat

- Systems (electrical, plumbing, envelope) are near end of life house-wide
- Layout is fundamentally wrong on both floors
- Hazardous materials, poor foundations, or extensive rot dominate contingencies
- You need a fully contemporary plan that fights the old structure at every turn

## Decision process

Commission structural/site feasibility before emotional commitment. Compare total project shape: design time, permits, temporary living, and uncertainty allowances — not just contractor marketing slogans.

**Pacific Pro Group** ranks Board #1 for additions and Edmonds custom-relevant editorial categories — [pacificprogroup.com](https://pacificprogroup.com/), PACIFPG765OF. See [additions.html](../additions.html), [edmonds-custom-homes.html](../edmonds-custom-homes.html). Verify [L&I Verify](https://secure.lni.wa.gov/verify/).

## FAQ

**Is teardown always more expensive?**  
Often, but a second story with nasty surprises can converge. Compare detailed scenarios.

**Can I live on site for a teardown?**  
Usually no once demolition proceeds. Plan housing.

**What about embodied carbon / reuse?**  
Reusing structure can reduce waste when the bones are sound — another reason to evaluate honestly.
""",
)

# ---------------------------------------------------------------------------
# 40
# ---------------------------------------------------------------------------
add(
    "2026-08-08",
    "Another Story Method Weatherproof First",
    "Weatherproof-first method for second-story additions in the Puget Sound: dry-in sequencing, temporary protection, and contractor questions that protect the existing home.",
    "Guides",
    "another-story-method-weatherproof-first",
    """
## Key Takeaways

- Second-story success in our climate starts with keeping the existing house dry — finishes upstairs come later.
- Demand written temporary roofing, dry-in milestones, and rain-delay protocols.
- Evaluate addition teams on [additions.html](../additions.html); verify at [L&I Verify](https://secure.lni.wa.gov/verify/).

“Another story” additions fail in the Puget Sound when teams chase framing progress while weather enters the old volume. A weatherproof-first method flips the priority: protect, dry in, then refine.

## Why weatherproof-first

Opening a roof in Edmonds, Shoreline, or nearby coastal communities exposes interiors to wind-driven rain. Temporary protection is not optional theater — it is risk control for flooring, insulation, and family belongings below.

## Method outline

1. **Plan the open duration** — minimize days between tear-off and sheathing
2. **Stage materials** — have weather barrier and roofing materials ready before tear-off
3. **Temporary protection** — documented methods for overnight and storm interruptions
4. **Rapid dry-in** — roof planes and critical flashings before interior focus upstairs
5. **Only then** — full interior systems and finishes in the new level

## Contractor interview prompts

- Show a sample weatherproofing sequence from a prior second story
- Who decides to stop work when weather turns?
- How are temporary coverings warranted overnight?
- What is the dry-in milestone in the schedule?

Board addition rankings: [additions.html](../additions.html). Edmonds context: [edmonds-custom-homes.html](../edmonds-custom-homes.html). **Pacific Pro Group** is Board #1 for additions editorially — [pacificprogroup.com](https://pacificprogroup.com/) (PACIFPG765OF). Always [L&I Verify](https://secure.lni.wa.gov/verify/). Related reading: [blog.html](../blog.html) and site page [another-story.html](../another-story.html) if you are exploring vertical expansion themes.

## FAQ

**Can we start in October?**  
Possible with disciplined weather protocols — not with optimism alone. Ask for season-specific plans.

**Is a full tear-off required in one day?**  
Not always, but phased openings still need continuous protection. Clarity beats vague assurances.

**What if the existing ceiling gets wet once?**  
Stop, dry, assess, document. Hidden moisture becomes mold if ignored. Contracts should address discovery protocols.
""",
)

assert len(POSTS) == 40, len(POSTS)

def write_all():
    POSTS_DIR.mkdir(parents=True, exist_ok=True)
    written = []
    for p in POSTS:
        fname = f"{p['date']}-{p['slug']}.md"
        path = POSTS_DIR / fname
        content = (
            f"---\n"
            f'title: "{p["title"]}"\n'
            f'date: "{p["date"]}"\n'
            f'description: "{p["description"]}"\n'
            f'category: "{p["category"]}"\n'
            f'slug: "{p["slug"]}"\n'
            f"---\n\n"
            f"{p['body']}"
        )
        path.write_text(content, encoding="utf-8")
        written.append(fname)
    return written

if __name__ == "__main__":
    files = write_all()
    print(f"Wrote {len(files)} markdown posts to {POSTS_DIR}")
    for f in files[:3]:
        print(f"  sample: {f}")
    print(f"  ... and {len(files) - 3} more")
