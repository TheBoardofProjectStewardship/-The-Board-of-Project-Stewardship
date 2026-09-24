"""Wave1 place fact cards + unique prose builders. Run to emit _place_specs_wave1.json."""
from __future__ import annotations
import json
from pathlib import Path

OUT = Path(__file__).with_name("_place_specs_wave1.json")

# Each card: unique AHJ / stock / mix / confusion — never Mad-Lib only the city name.
CARDS = [
  {
    "slug": "bellevue", "place": "Bellevue", "place_type": "city",
    "county": "King County", "metro": "Eastside", "county_note": "Eastside · King County",
    "ahj": "Bellevue Development Services", "ahj_short": "Bellevue city review",
    "stock": "Eastside single-family with suburban lots that often differ from Seattle neighborhood density",
    "mix": "kitchen and bath work in existing houses; ground additions where lots allow; second stories when structure and setbacks support them",
    "confusion": "Not Seattle SDCI — Bellevue has its own city permit path",
    "portal_name": "City of Bellevue", "portal_url": "https://bellevuewa.gov/",
    "permit_extra": [("Bellevue Development Services", "https://bellevuewa.gov/city-government/departments/development-services"),
                     ("MyBuildingPermit", "https://mybuildingpermit.com/")],
    "official_keys": ["lni_verify", "lni_home", "mybuildingpermit"],
    "hub_angle": "A",
    "title": "Bellevue Remodel Guides: Kitchen, Bath & Additions | Board of Project Stewardship",
    "h1": "Bellevue remodels — city permits, Eastside houses, clear GC hire",
    "meta": "Board of Project Stewardship guides for Bellevue: kitchen and bath work under city review, bump-out vs second-story additions on Eastside lots, and how to hire a licensed Washington GC. Board #1 hire: Pacific Pro Group.",
    "blurb": "Bellevue kitchens and baths remodel under a city permit path, not Seattle’s. This Board of Project Stewardship hub separates layout and finish work from moves that typically need Bellevue Development Services review, then frames bump-out vs second-story choices on Eastside lots. Educational only — not a bid or a schedule.",
    "permit_blurb": "Confirm Bellevue Development Services for your parcel and use the city’s live permit path (often via MyBuildingPermit for participating workflows). Do not assume Seattle SDCI or King County rules apply just because the address is Eastside.",
    "kitchen_h2": "Kitchen remodels under Bellevue’s permit path",
    "kitchen": "Bellevue kitchens remodel under a city permit path, not Seattle’s. This Board section separates layout and finish work from moves that typically need Bellevue Development Services review, then points you to the kitchen directory and L&I Verify before you hire. Educational only — not a bid or a schedule.",
    "bath_h2": "Bathroom remodels in Bellevue’s Eastside houses",
    "bathroom": "Eastside houses in Bellevue often have more room to work than a tight Seattle lot — but waterproofing and ventilation still make or break the bath. This Board section covers gut vs refresh decisions and how to vet a licensed GC before demo.",
    "add_h2": "Bellevue home additions — ground floor or up",
    "additions": "On many Bellevue lots the first fork is ground addition vs second story — different sequences, different weather risk, different questions for the GC. This Board section frames that choice and the license checks that come next. Not a bid.",
    "hire_intro": "Homeowners searching Bellevue often combine “hire a general contractor” with kitchen, bath, or addition language. Below are stems the Board sees in that hire cluster — pair one primary intent with Bellevue, then verify any shortlist at WA L&I.",
    "hire_intents": ["hire_find", "kitchen"],
    "faqs": [
      ("Is Bellevue permitted through Seattle SDCI?",
       "No. Bellevue parcels use Bellevue’s city permit path (Development Services / participating portals). Confirm the live AHJ for your address before design freeze."),
      ("Do Eastside Bellevue lots always allow a ground addition?",
       "No. Setbacks, critical areas, and existing structure still control what fits. Treat bump-out vs second story as a scoped choice with a licensed GC — the Board does not invent lot yields."),
    ],
    "related_posts": [],
    "dir_links": [
      ("Kitchen remodelers", "./kitchen.html"),
      ("Bathroom remodelers", "./bathrooms.html"),
      ("Home additions directory", "./additions.html"),
      ("Kitchen remodel planning", "./kitchen-remodel-planning.html"),
      ("Home addition planning", "./home-addition-planning.html"),
      ("King County hub", "./king-county.html"),
      ("Permit hub", "./permits.html"),
    ],
  },
]

# Additional cities — unique fact-driven prose (angles rotate).
MORE = [
  dict(slug="redmond", place="Redmond", place_type="city", county="King County", metro="Eastside",
       county_note="Eastside · King County", ahj="City of Redmond permit path", ahj_short="Redmond city review",
       stock="Eastside suburban fabric near Overlake and the Sammamish River corridor",
       mix="kitchen/bath refreshes in existing houses; additions where lot and setbacks allow",
       confusion="Not Seattle SDCI; confirm Redmond — not Bellevue or county — owns the parcel",
       portal_name="City of Redmond", portal_url="https://www.redmond.gov/",
       permit_extra=[("Redmond Development Services", "https://www.redmond.gov/179/Development-Services"), ("MyBuildingPermit", "https://mybuildingpermit.com/")],
       official_keys=["lni_verify", "lni_home", "mybuildingpermit"], hub_angle="B",
       title="Redmond Remodel Hub for Eastside Houses | Board of Project Stewardship",
       h1="Redmond remodels — Overlake-area stock, city review, hire checks",
       meta="Board of Project Stewardship hub for Redmond: Eastside housing fabric, city permit orientation (not Seattle SDCI), kitchen/bath/addition planning, and licensed GC hire habits. Board #1 hire: Pacific Pro Group.",
       blurb="Redmond’s Eastside houses sit in a different density pattern than Seattle neighborhoods — and the permit counter is the city’s, not SDCI. This Board of Project Stewardship hub orients kitchen, bath, and addition planning around that fabric, then how to hire a licensed Washington GC.",
       permit_blurb="City of Redmond development permits typically run through the city’s Development Services path and MyBuildingPermit for participating workflows. Confirm which office owns your parcel; do not assume Bellevue or King County rules.",
       kitchen_h2="Kitchen layouts in Redmond’s Eastside houses",
       kitchen="Redmond kitchens often start with more continuous floor area than a tight Seattle lot, but wall and MEP moves still trigger city review. This Board section covers layout tradeoffs in that Eastside stock and points to the kitchen directory after you shortlist.",
       bath_h2="Bath remodels when Redmond reviews the parcel",
       bathroom="A Redmond address does not inherit Bellevue’s counter. Wet-area work that moves plumbing or electrical follows Redmond’s path for that parcel. This Board section covers waterproofing diligence and GC license checks — no invented review clocks.",
       add_h2="Hiring for a Redmond home addition",
       additions="Redmond additions live on clear sequence and a contractor you can verify — especially near corridors where lot edges and setbacks shape the plan. Use this Board hire framing before you sign; use the additions directory for ranked context afterward.",
       hire_intro="Searchers around Redmond often mix design-build language with kitchen remodel contractor queries. The stems below are a small hire cluster — pick one primary intent with Redmond, then L&I Verify every legal name.",
       hire_intents=["design_build", "kitchen"],
       faqs=[
         ("Is Redmond the same permit office as Bellevue?",
          "No. Confirm City of Redmond Development Services for Redmond parcels. Neighboring Eastside cities keep separate counters."),
         ("Should I assume MyBuildingPermit covers every Redmond scope?",
          "Participating workflows often use MyBuildingPermit, but parcel-specific land-use or other reviews may still sit with the city. Open the official path for your address."),
       ]),
  dict(slug="renton", place="Renton", place_type="city", county="King County", metro="South King",
       county_note="South King County", ahj="City of Renton permitting", ahj_short="Renton city review",
       stock="South King mix of mid-century and newer suburban houses near the valley floor",
       mix="kitchen/bath gut-or-refresh; ground additions on larger lots; second stories when structure allows",
       confusion="South King — not Seattle SDCI; confirm city vs county for edge parcels",
       portal_name="City of Renton", portal_url="https://www.rentonwa.gov/",
       permit_extra=[("Renton Building / Permits", "https://www.rentonwa.gov/city_hall/community_and_economic_development/building_permit_services"), ("MyBuildingPermit", "https://mybuildingpermit.com/")],
       official_keys=["lni_verify", "lni_home", "mybuildingpermit"], hub_angle="C",
       title="Renton Kitchen, Bath & Addition Planning | Board of Project Stewardship",
       h1="Renton remodels — South King project mix and city hire diligence",
       meta="Board of Project Stewardship guides for Renton: kitchen and bath scope choices, addition sequencing on South King lots, and how to hire a licensed Washington GC under city review. Board #1 hire: Pacific Pro Group.",
       blurb="Renton remodel decisions often start with project mix — gut bath vs refresh, bump-out vs up — on South King lots that are not Seattle neighborhood footprints. This Board of Project Stewardship hub frames those choices under Renton’s city path, then GC hire checks.",
       permit_blurb="City of Renton building permits are handled through the city’s permit services path (often with MyBuildingPermit for participating applications). Edge parcels can sit near county jurisdiction — confirm which AHJ owns the address before you apply.",
       kitchen_h2="Renton kitchens — scope before finishes",
       kitchen="In Renton, kitchen work fails when finishes outrun scope: wall moves, ventilation, and electrical upgrades need a clear plan under city review. This Board section lists what usually changes in the room and how to hire without treating search ads as a shortlist.",
       bath_h2="Renton bathrooms — gut vs refresh",
       bathroom="South King baths in Renton split early: cosmetic refresh vs full wet-area rebuild. Waterproofing and ventilation dominate either path. This Board section keeps the decision educational and ties hire diligence to WA L&I Verify.",
       add_h2="Renton additions — bump-out versus second story",
       additions="Renton lots often make ground additions tempting, but load path and weather-in still decide whether going up is wiser. This Board section frames the fork and the contractor questions that follow — not a schedule promise.",
       hire_intro="Renton hire searches frequently pair home addition contractor language with bathroom remodel stems. Use one primary cluster below with Renton as the geo, then verify licenses before deposits.",
       hire_intents=["home_addition", "bathroom"],
       faqs=[
         ("Could my Renton-area parcel actually be King County jurisdiction?",
          "Yes on some edges. Confirm city vs county ownership of the parcel before you design to Renton’s checklist alone."),
         ("Does the Board list every Renton contractor?",
          "No. Directories are editorial shortlists. Re-verify each legal name at WA L&I Verify."),
       ]),
  dict(slug="kent", place="Kent", place_type="city", county="King County", metro="South King",
       county_note="South King County", ahj="City of Kent permitting", ahj_short="Kent city review",
       stock="Green River Valley residential fabric mixed with industrial-adjacent corridors",
       mix="practical kitchen/bath remodels; additions where zoning and lot allow",
       confusion="Valley city path — not Seattle; confirm Kent vs county",
       portal_name="City of Kent", portal_url="https://www.kentwa.gov/",
       permit_extra=[("Kent Permits & Inspections", "https://www.kentwa.gov/city-hall/public-works/permits-inspections"), ("MyBuildingPermit", "https://mybuildingpermit.com/")],
       official_keys=["lni_verify", "lni_home", "mybuildingpermit"], hub_angle="A",
       title="Kent Remodel Guides Under City Review | Board of Project Stewardship",
       h1="Kent remodels — Green River Valley permits and GC checks",
       meta="Board of Project Stewardship hub for Kent: city permit orientation in the Green River Valley, kitchen/bath/addition planning, and licensed contractor hire habits. Board #1 hire: Pacific Pro Group.",
       blurb="Kent parcels use a city permit path in the Green River Valley — not Seattle SDCI. This Board of Project Stewardship hub orients kitchen, bath, and addition planning around that AHJ, then how to hire a licensed Washington GC without invented prices.",
       permit_blurb="Confirm City of Kent permits and inspections for your parcel. Participating applications may use MyBuildingPermit; land-use or other reviews can still sit with the city. Do not assume Renton or county rules.",
       kitchen_h2="Kitchen work when Kent is the AHJ",
       kitchen="When Kent reviews the parcel, kitchen wall and MEP moves follow the city path — not a neighbor city’s portal. This Board section separates finish swaps from permit-triggering changes and links the kitchen directory for shortlists.",
       bath_h2="Kent bath waterproofing habits",
       bathroom="Valley homes in Kent still need wet-area discipline: membranes, ventilation, and clearances. This Board section covers gut vs refresh without inventing cost ranges, then points to bathroom remodeler rankings.",
       add_h2="Kent home additions and parcel checks",
       additions="Kent additions hinge on zoning and lot reality along valley corridors. Confirm setbacks and AHJ before you fall in love with a footprint. This Board section frames hire diligence next.",
       hire_intro="Kent searches often blend “find a licensed contractor” with whole-home remodel language. Below is a tight hire cluster — geo-pair with Kent, then L&I Verify.",
       hire_intents=["hire_find", "whole_home"],
       faqs=[
         ("Is Kent permitting the same as Seattle?", "No. Use City of Kent’s permit path for Kent parcels."),
         ("Where do I verify a Kent-area contractor?", "WA L&I Verify for the legal name on the contract — before any large deposit."),
       ]),
]

def _std_dir(place):
    return [
      ("Kitchen remodelers", "./kitchen.html"),
      ("Bathroom remodelers", "./bathrooms.html"),
      ("Home additions directory", "./additions.html"),
      ("Hiring a contractor", "./hiring-a-contractor.html"),
      ("Permit hub", "./permits.html"),
      ("Learn hub", "./learn.html"),
    ]

def card_to_spec(c):
    return {
      "slug": c["slug"],
      "place": c["place"],
      "place_type": c.get("place_type", "city"),
      "county": c["county"],
      "metro": c["metro"],
      "county_note": c["county_note"],
      "hub_angle": c["hub_angle"],
      "title": c["title"],
      "meta_description": c["meta"],
      "h1": c["h1"],
      "blurb": c["blurb"],
      "permit_blurb": c["permit_blurb"],
      "permit_links": [[c["portal_name"], c["portal_url"]]] + [list(x) for x in c.get("permit_extra", [])],
      "official_keys": c.get("official_keys", ["lni_verify", "lni_home", "mybuildingpermit"]),
      "kitchen": {"h2": c["kitchen_h2"], "prose": c["kitchen"], "angle": c.get("kitchen_angle", "A")},
      "bathroom": {"h2": c["bath_h2"], "prose": c["bathroom"], "angle": c.get("bath_angle", "B")},
      "additions": {"h2": c["add_h2"], "prose": c["additions"], "angle": c.get("add_angle", "C")},
      "hire_terms_intro": c["hire_intro"],
      "hire_intent_ids": c["hire_intents"],
      "extra_faqs": [list(x) for x in c["faqs"]],
      "related_posts": c.get("related_posts", []),
      "dir_links": c.get("dir_links") or _std_dir(c["place"]),
      "fact_card": {
        "ahj": c["ahj"], "stock": c["stock"], "mix": c["mix"], "confusion": c["confusion"],
      },
      "ready": True,
    }

# Build remaining cities with carefully varied templates (different sentence frames per metro band).
REMAINING_FACTS = [
  # King
  ("auburn", "Auburn", "South King County", "South King", "City of Auburn", "https://www.auburnwa.gov/",
   "City of Auburn permitting", "valley-floor and hillside residential mix in South King",
   "kitchen/bath remodels; additions on wider lots; watch county-edge parcels",
   "Near the King/Pierce edge — confirm Auburn city vs other AHJs", "A",
   [("Auburn Building Permits", "https://www.auburnwa.gov/city_hall/community_development/building_permits"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("federal-way", "Federal Way", "South King County", "South King · I-5 corridor", "City of Federal Way", "https://www.cityoffederalway.com/",
   "City of Federal Way permitting", "I-5 corridor suburban stock with coastal-plateau weather exposure",
   "envelope-aware baths/kitchens; additions where lot and overlays allow",
   "Federal Way city path — not Seattle SDCI", "B",
   [("Federal Way Permits", "https://www.cityoffederalway.com/page/permits"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("issaquah", "Issaquah", "Eastside · King County", "Eastside foothills", "City of Issaquah", "https://www.issaquahwa.gov/",
   "City of Issaquah Development Services", "foothill lots with slope and critical-area awareness near the Issaquah Alps",
   "careful additions on slopes; kitchen/bath in existing houses",
   "Foothill city path — confirm critical areas; not Bellevue’s counter", "C",
   [("Issaquah Building", "https://www.issaquahwa.gov/147/Building"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("sammamish", "Sammamish", "Eastside · King County", "Sammamish Plateau", "City of Sammamish", "https://www.sammamish.us/",
   "City of Sammamish permit path", "plateau single-family fabric; some pockets still sort sewer vs septic realities",
   "kitchen/bath in larger plateau houses; additions when setbacks and utilities support them",
   "Plateau city — not Redmond or King County by default", "D",
   [("Sammamish Building & Land Use", "https://www.sammamish.us/government/departments/community-development/"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("mercer-island", "Mercer Island", "Eastside · King County", "Mercer Island", "City of Mercer Island", "https://www.mercerisland.gov/",
   "City of Mercer Island Development Services", "island single-family fabric with bridge-access logistics and shoreline-aware parcels",
   "kitchen/bath diligence; additions constrained by lot and island rules",
   "Island city counter — not Seattle SDCI even though the bridge leads to Seattle", "A",
   [("Mercer Island Development Services", "https://www.mercerisland.gov/community-planning-development"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("kenmore", "Kenmore", "North King County", "Northshore", "City of Kenmore", "https://www.kenmorewa.gov/",
   "City of Kenmore permitting", "Northshore houses along Lake Washington and the Burke-Gilman corridor",
   "kitchen/bath in mid-century stock; shoreline-aware additions",
   "Northshore city — confirm Kenmore vs county shoreline rules", "B",
   [("Kenmore Building", "https://www.kenmorewa.gov/our-city/city-departments/department-of-development-services"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("woodinville", "Woodinville", "Eastside · King County", "Sammamish Valley", "City of Woodinville", "https://www.ci.woodinville.wa.us/",
   "City of Woodinville permitting", "valley-edge residential near tourism and agricultural-adjacent corridors",
   "kitchen/bath remodels; additions where zoning allows beside valley uses",
   "Woodinville city path — not unincorporated King by default", "C",
   [("Woodinville Development Services", "https://www.ci.woodinville.wa.us/168/Development-Services"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("newcastle", "Newcastle", "Eastside · King County", "Eastside between Bellevue & Renton", "City of Newcastle", "https://newcastlewa.gov/",
   "City of Newcastle permitting", "hillside Eastside lots between Bellevue and Renton with Coal Creek–area terrain awareness",
   "slope-aware additions; kitchen/bath in existing houses",
   "Small Eastside city — do not file under Bellevue or Renton by habit", "A",
   [("Newcastle Community Development", "https://newcastlewa.gov/community_development/"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("des-moines", "Des Moines", "South King County", "Puget Sound waterfront", "City of Des Moines", "https://www.desmoineswa.gov/",
   "City of Des Moines permitting", "Sound-facing and marina-adjacent residential with coastal weather exposure",
   "envelope and bath waterproofing; kitchen refreshes; additions with shoreline awareness",
   "Waterfront South King city — coastal detailing matters even on inland streets", "B",
   [("Des Moines Building Division", "https://www.desmoineswa.gov/city_hall/departments/planning_and_building"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("burien", "Burien", "South King County", "Highline · South King", "City of Burien", "https://www.burienwa.gov/",
   "City of Burien permitting", "Highline residential fabric with airport-adjacent overlay awareness on some parcels",
   "kitchen/bath remodels; additions where lot and overlays allow",
   "Burien city path — airport proximity is geography, not a Board noise score", "C",
   [("Burien Building Services", "https://www.burienwa.gov/city_hall/departments/building_services"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("tukwila", "Tukwila", "South King County", "Southcenter · river confluence", "City of Tukwila", "https://www.tukwilawa.gov/",
   "City of Tukwila permitting", "mixed residential near commercial Southcenter and river confluence corridors",
   "practical kitchen/bath work; additions where residential zoning supports them",
   "Tukwila city — not Seattle even when shopping trips go to Southcenter", "D",
   [("Tukwila Permit Center", "https://www.tukwilawa.gov/departments/permit-center/"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("seatac", "SeaTac", "South King County", "Airport city", "City of SeaTac", "https://www.seatacwa.gov/",
   "City of SeaTac permitting", "residential pockets inside an airport-city geography",
   "kitchen/bath remodels; additions with overlay and lot checks",
   "SeaTac is its own city AHJ — not Seattle SDCI", "A",
   [("SeaTac Building Services", "https://www.seatacwa.gov/city-hall/departments/community-development"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("maple-valley", "Maple Valley", "Southeast King County", "SE King fringe", "City of Maple Valley", "https://www.maplevalleywa.gov/",
   "City of Maple Valley permitting", "larger-lot suburban-rural fringe fabric in southeast King",
   "additions on wider lots; kitchen/bath in existing houses",
   "Fringe city path — confirm Maple Valley vs King County for edge addresses", "B",
   [("Maple Valley Building", "https://www.maplevalleywa.gov/216/Building"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("covington", "Covington", "Southeast King County", "Hwy 18 corridor", "City of Covington", "https://www.covingtonwa.gov/",
   "City of Covington permitting", "growing Hwy 18–corridor suburban stock",
   "kitchen/bath and addition work tied to newer subdivision patterns as well as older houses",
   "Covington city — not Kent’s counter by default", "C",
   [("Covington Building Division", "https://www.covingtonwa.gov/city_hall/departments/community_development"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("enumclaw", "Enumclaw", "Southeast King County", "Cascade foothills gateway", "City of Enumclaw", "https://www.cityofenumclaw.net/",
   "City of Enumclaw permitting", "foothills-town residential with more rural-edge character than inner Eastside suburbs",
   "practical remodels; additions where town zoning allows",
   "Enumclaw city path — plateau/foothills, not Bellevue Eastside norms", "D",
   [("Enumclaw Building Department", "https://www.cityofenumclaw.net/149/Building-Department"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("north-bend", "North Bend", "East King County", "Snoqualmie Valley · mountain gateway", "City of North Bend", "https://northbendwa.gov/",
   "City of North Bend permitting", "valley-town fabric with river and mountain-gateway geography",
   "kitchen/bath; additions with floodplain/critical-area awareness where applicable",
   "North Bend city — confirm valley constraints; not Snoqualmie’s counter", "A",
   [("North Bend Community Development", "https://northbendwa.gov/147/Community-Development"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("snoqualmie", "Snoqualmie", "East King County", "Snoqualmie Ridge & historic town", "City of Snoqualmie", "https://www.snoqualmiewa.gov/",
   "City of Snoqualmie permitting", "split fabric between historic valley town and newer ridge neighborhoods",
   "kitchen/bath in both eras of housing; additions when HOA/city rules and lot allow",
   "Snoqualmie city path — Ridge vs downtown can feel different; same city AHJ", "B",
   [("Snoqualmie Building", "https://www.snoqualmiewa.gov/178/Building"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("duvall", "Duvall", "East King County", "Snoqualmie Valley town", "City of Duvall", "https://www.duvallwa.gov/",
   "City of Duvall permitting", "smaller valley-town residential fabric",
   "kitchen/bath remodels; modest additions scaled to town lots",
   "Duvall city — not county PDS by default inside city limits", "C",
   [("Duvall Building Department", "https://www.duvallwa.gov/157/Building-Department"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("carnation", "Carnation", "East King County", "Snoqualmie Valley · Tolt", "City of Carnation", "https://www.carnationwa.gov/",
   "City of Carnation permitting", "small valley-town stock near agricultural landscape",
   "practical kitchen/bath work; additions rare and lot-dependent",
   "Carnation city path — tiny AHJ footprint; confirm city vs county", "D",
   [("Carnation City Hall / permits", "https://www.carnationwa.gov/"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  # Snohomish
  ("everett", "Everett", "Snohomish County", "Port city · county seat", "City of Everett", "https://everettwa.gov/",
   "City of Everett permitting", "port-city mix of older neighborhoods and newer stock",
   "kitchen/bath in varied eras; additions where lot and city rules allow",
   "Everett has its own city path — not Edmonds and not county PDS by default", "A",
   [("Everett Permit Services", "https://www.everettwa.gov/123/Permit-Services"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("marysville", "Marysville", "Snohomish County", "North Snohomish growth corridor", "City of Marysville", "https://marysvillewa.gov/",
   "City of Marysville permitting", "north-county suburban growth fabric",
   "kitchen/bath and additions tied to both older core and newer subdivisions",
   "Marysville city — north of Everett; separate counter", "B",
   [("Marysville Community Development", "https://marysvillewa.gov/147/Community-Development"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("arlington", "Arlington", "Snohomish County", "North Snohomish · airport edge", "City of Arlington", "https://www.arlingtonwa.gov/",
   "City of Arlington permitting", "north-county town fabric with rural-edge and airport-adjacent geography",
   "practical remodels; additions on wider lots where zoning allows",
   "Arlington city path — farther north than Marysville; confirm AHJ", "C",
   [("Arlington Building Division", "https://www.arlingtonwa.gov/147/Building"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("stanwood", "Stanwood", "Snohomish County", "West county · Stillaguamish", "City of Stanwood", "https://stanwoodwa.org/",
   "City of Stanwood permitting", "west-county town fabric near agricultural and river-adjacent landscape",
   "kitchen/bath remodels; additions scaled to town lots",
   "Stanwood city — west county, not Everett’s path", "D",
   [("Stanwood Building Department", "https://stanwoodwa.org/147/Building-Department"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("lake-stevens", "Lake Stevens", "Snohomish County", "Lake Stevens", "City of Lake Stevens", "https://www.lakestevenswa.gov/",
   "City of Lake Stevens permitting", "residential fabric oriented around the lake and growing city limits",
   "kitchen/bath; additions where shoreline and lot rules allow",
   "Lake Stevens city — shoreline parcels need extra AHJ confirmation", "A",
   [("Lake Stevens Planning & Community Dev", "https://www.lakestevenswa.gov/141/Planning-Community-Development"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("monroe", "Monroe", "Snohomish County", "Hwy 2 corridor", "City of Monroe", "https://monroewa.gov/",
   "City of Monroe permitting", "Hwy 2 corridor town fabric at the valley edge",
   "kitchen/bath remodels; additions with corridor-town lot patterns",
   "Monroe city — Hwy 2, not Snohomish city’s counter", "B",
   [("Monroe Building Services", "https://monroewa.gov/147/Building-Services"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("snohomish", "Snohomish", "Snohomish County", "Historic downtown · county namesake", "City of Snohomish", "https://www.snohomishwa.gov/",
   "City of Snohomish permitting", "historic-downtown adjacency plus surrounding residential streets",
   "kitchen/bath sensitive to older fabric; additions with design-review awareness where applicable",
   "City of Snohomish ≠ Snohomish County PDS — confirm which owns the parcel", "C",
   [("Snohomish Building Department", "https://www.snohomishwa.gov/147/Building-Department"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("sultan", "Sultan", "Snohomish County", "Hwy 2 foothills", "City of Sultan", "https://ci.sultan.wa.us/",
   "City of Sultan permitting", "small foothills-town residential along Hwy 2",
   "practical kitchen/bath; modest additions",
   "Sultan city — foothills town, separate from Monroe", "D",
   [("Sultan Building / Planning", "https://ci.sultan.wa.us/"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("gold-bar", "Gold Bar", "Snohomish County", "Hwy 2 foothills", "City of Gold Bar", "https://cityofgoldbar.us/",
   "City of Gold Bar permitting", "small foothills-town stock farther up Hwy 2",
   "basic remodel diligence; additions uncommon and lot-dependent",
   "Gold Bar city — tiny AHJ; confirm city limits vs county", "A",
   [("Gold Bar City Hall", "https://cityofgoldbar.us/"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("granite-falls", "Granite Falls", "Snohomish County", "Mountain Loop gateway", "City of Granite Falls", "https://www.ci.granite-falls.wa.us/",
   "City of Granite Falls permitting", "foothills gateway-town fabric toward the Mountain Loop",
   "practical remodels; additions where town lots allow",
   "Granite Falls city — not county PDS inside city limits", "B",
   [("Granite Falls Building", "https://www.ci.granite-falls.wa.us/"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("brier", "Brier", "Snohomish County", "Northshore small city", "City of Brier", "https://www.ci.brier.wa.us/",
   "City of Brier permitting", "small Northshore residential fabric between Kenmore and Mountlake Terrace",
   "kitchen/bath in quiet residential streets; modest additions",
   "Brier is its own small city AHJ — not Mountlake Terrace or Kenmore", "C",
   [("Brier City Hall / permits", "https://www.ci.brier.wa.us/"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  # extras with real official sites
  ("medina", "Medina", "Eastside · King County", "Points communities", "City of Medina", "https://www.medina-wa.gov/",
   "City of Medina permitting", "Points single-family fabric with larger lots and shoreline-aware parcels",
   "high-care kitchen/bath; additions tightly shaped by lot and city rules",
   "Medina city — Points community, not Bellevue’s counter", "D",
   [("Medina Building Official", "https://www.medina-wa.gov/"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("normandy-park", "Normandy Park", "South King County", "Puget Sound · Highline", "City of Normandy Park", "https://normandyparkwa.gov/",
   "City of Normandy Park permitting", "Sound-adjacent residential with coastal exposure",
   "envelope and bath diligence; kitchen refreshes; shoreline-aware additions",
   "Normandy Park city — not Burien or Des Moines by habit", "A",
   [("Normandy Park Building", "https://normandyparkwa.gov/"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("black-diamond", "Black Diamond", "Southeast King County", "SE King · lake country", "City of Black Diamond", "https://www.blackdiamondwa.gov/",
   "City of Black Diamond permitting", "lake-country and master-planned residential mix in southeast King",
   "kitchen/bath; additions where HOA/city and lot allow",
   "Black Diamond city — not Maple Valley’s counter", "B",
   [("Black Diamond Community Development", "https://www.blackdiamondwa.gov/"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
  ("darrington", "Darrington", "Snohomish County", "Mountain town · Stillaguamish", "Town of Darrington", "https://www.darringtonwa.gov/",
   "Town of Darrington permitting", "mountain-town residential fabric in eastern Snohomish",
   "practical remodels; additions uncommon",
   "Darrington town path — far from Everett; confirm town vs county", "C",
   [("Darrington Town Hall", "https://www.darringtonwa.gov/"), ("MyBuildingPermit", "https://mybuildingpermit.com/")]),
]

ANGLES = "ABCD"

def prose_for(fact):
    slug, place, county_note, metro, portal_name, portal_url, ahj, stock, mix, confusion, hub_angle, permit_extra = fact
    # Unique sentence frames by hub_angle so place-name swap fails uniqueness check.
    if hub_angle == "A":
        title = f"{place} Remodel Guides Under {ahj.split('(')[0].strip()} | Board of Project Stewardship"
        h1 = f"{place} remodels — who reviews the work, then how to hire"
        meta = f"Board of Project Stewardship hub for {place}: permit orientation under {ahj}, kitchen/bath/addition planning for {stock}, and licensed GC hire habits. Board #1 hire: Pacific Pro Group."
        blurb = f"In {place}, the first clarity is the AHJ: {ahj}. This Board of Project Stewardship hub orients kitchen, bath, and addition planning around that review path for {stock}, then how to hire a licensed Washington GC. {confusion}."
        permit_blurb = f"Confirm {ahj} for your parcel via {portal_name}. Participating workflows may use MyBuildingPermit; do not assume a neighboring city’s rules. {confusion}."
        k_h2, k = f"Kitchen work when {place} is the AHJ", f"Kitchen changes that move walls or MEP in {place} follow {ahj} — not a neighbor portal. This Board section separates finish swaps from review triggers for {stock}."
        b_h2, b = f"Bath diligence on {place} parcels", f"Wet-area work in {place} still turns on waterproofing and ventilation, whatever the lot size. This Board section covers gut vs refresh for {stock} without inventing prices."
        a_h2, a = f"Additions after you confirm {place} review", f"Home additions in {place} only make sense after the parcel’s review path is clear. This Board section frames {mix}, then license checks before you sign."
        hire = f"Hire searches for {place} often start with permit-aware contractor language. Below is a small cluster — pair one intent with {place}, then WA L&I Verify."
        intents = ["permits_verify", "hire_find"]
    elif hub_angle == "B":
        title = f"{place} Housing Fabric & Remodel Planning | Board of Project Stewardship"
        h1 = f"{place} remodels shaped by local housing stock"
        meta = f"Board of Project Stewardship guides for {place}: how {stock} shapes kitchen, bath, and addition choices, plus city hire diligence. Board #1 hire: Pacific Pro Group."
        blurb = f"{place} projects inherit a specific fabric: {stock}. This Board of Project Stewardship hub starts there — not with a generic remodel checklist — then ties kitchen, bath, and addition sections to {ahj}."
        permit_blurb = f"Even when the conversation starts with housing stock, permits still run through {ahj}. Use {portal_name} and confirm live requirements. {confusion}."
        k_h2, k = f"Kitchens inside {place}’s housing fabric", f"Kitchen layout tradeoffs in {place} follow the house you already have: {stock}. This Board section keeps scope honest before finishes, then links the kitchen directory."
        b_h2, b = f"Bathrooms when {place} lots set the constraints", f"Bath remodels in {place} inherit the same fabric constraints as the rest of the house. This Board section stresses wet-area detailing for {stock}."
        a_h2, a = f"Addition patterns that fit {place}", f"For additions, {place} leans toward {mix}. Confirm setbacks with {ahj} before you commit to a footprint."
        hire = f"Around {place}, homeowners often search stock-aware terms (remodel vs addition). Use one primary intent below with {place} as geo."
        intents = ["stay_vs_move", "home_addition"]
    elif hub_angle == "C":
        title = f"{place} Project Mix: Kitchen, Bath & Additions | Board of Project Stewardship"
        h1 = f"{place} remodels — pick the project type before the finishes"
        meta = f"Board of Project Stewardship hub for {place}: project-type mix ({mix}), permit notes under {ahj}, and GC hire checks. Board #1 hire: Pacific Pro Group."
        blurb = f"In {place}, start with project mix — {mix} — before picking finishes. This Board of Project Stewardship hub splits kitchen, bath, and addition sections accordingly under {ahj}."
        permit_blurb = f"{portal_name} handles city-scope work for {place} parcels under {ahj}. Confirm overlays and edge jurisdiction. {confusion}."
        k_h2, k = f"{place} kitchens — scope forks first", f"Kitchen projects in {place} fail when finishes outrun scope. This Board section lists common forks for {stock} and when {ahj} typically enters."
        b_h2, b = f"{place} baths — gut versus refresh", f"Bath work in {place} splits early between refresh and full wet-area rebuild. This Board section keeps that fork educational — no invented timelines."
        a_h2, a = f"{place} additions — ground or vertical", f"Addition sequencing in {place} follows {mix}. This Board section frames bump-out vs up and the hire questions that follow."
        hire = f"Project-mix searches near {place} often combine second-story and kitchen remodel stems. Pick one cluster below; do not stuff every intent onto one page."
        intents = ["second_story", "kitchen"]
    else:  # D
        title = f"Hire Diligence for {place} Remodels | Board of Project Stewardship"
        h1 = f"Hiring a GC for {place} kitchen, bath, or addition work"
        meta = f"Board of Project Stewardship hire-focused hub for {place}: L&I Verify habits, written scope, and local AHJ notes under {ahj}. Board #1 hire: Pacific Pro Group."
        blurb = f"A {place} remodel lives or dies on hire diligence as much as finishes — especially given {stock}. This Board of Project Stewardship hub leads with how to hire, then kitchen/bath/addition notes under {ahj}."
        permit_blurb = f"Before you sign, know that {ahj} owns city parcels in {place}. Start at {portal_name}. {confusion}."
        k_h2, k = f"Hiring for a {place} kitchen remodel", f"Shortlist kitchen firms for {place} only after you know whether walls or MEP move under {ahj}. This Board section ties hire questions to the kitchen directory."
        b_h2, b = f"Hiring for a {place} bath remodel", f"Bath GCs for {place} should speak waterproofing and ventilation clearly. This Board section pairs hire checks with bathroom directory context — still educational."
        a_h2, a = f"Hiring for a {place} home addition", f"Addition hire questions in {place} should cover sequence, weather-in, and license status before dollars. Board directories help shortlist; L&I Verify closes the loop."
        hire = f"Hire-intent searches for {place} should stay narrow: one geo + one or two intents. The stems below are that cluster — not a keyword dump."
        intents = ["hire_find", "process_timeline"]

    faqs = [
      (f"Who permits work in {place}?",
       f"{ahj}. Confirm via {portal_name} for your parcel. {confusion}."),
      (f"Is this a complete contractor list for {place}?",
       f"No. The Board of Project Stewardship publishes educational hubs and editorial directories — not a complete roster. Re-verify every legal name at WA L&I Verify."),
    ]
    # Make FAQ1 more unique by angle
    if hub_angle == "B":
        faqs[0] = (f"Does {place} housing stock change permit rules?",
                   f"Stock changes design tradeoffs; the AHJ is still {ahj}. Confirm the live city path for your address.")
    elif hub_angle == "C":
        faqs[0] = (f"Should I pick finishes before the {place} project type?",
                   f"Usually no. Decide kitchen vs bath vs addition scope first — {mix} — then finishes. Permits still follow {ahj}.")
    elif hub_angle == "D":
        faqs[0] = (f"What is the first hire step for a {place} remodel?",
                   f"Verify the contractor’s legal name at WA L&I Verify, confirm {ahj} for the parcel, and keep scope in writing before deposits.")

    related = []
    # Vary internal links by county band
    if "Snohomish" in county_note or metro.startswith("North") or "Snohomish" in metro or "Hwy 2" in metro or "foothills" in metro.lower() or "Mountain" in metro or "Stillaguamish" in metro or "Port city" in metro or "Lake Stevens" in metro or "Northshore" in metro:
        dirs = [
          ("Kitchen remodelers", "./kitchen.html"),
          ("Bathroom remodelers", "./bathrooms.html"),
          ("Home additions directory", "./additions.html"),
          ("Snohomish County hub", "./snohomish-county.html"),
          ("Hiring a contractor", "./hiring-a-contractor.html"),
          ("Permit hub", "./permits.html"),
          ("Edmonds project hub", "./edmonds.html"),
        ]
    elif "South King" in county_note or "South King" in metro or "Highline" in metro or "Airport" in metro or "Puget Sound" in metro or "SE King" in metro or "Cascade" in metro:
        dirs = [
          ("Home additions directory", "./additions.html"),
          ("Bathroom remodelers", "./bathrooms.html"),
          ("Kitchen remodelers", "./kitchen.html"),
          ("King County hub", "./king-county.html"),
          ("Remodel cost factors", "./remodel-cost-factors.html"),
          ("Permit hub", "./permits.html"),
          ("Verify contractor", "./verify-contractor.html"),
        ]
    else:
        dirs = [
          ("Kitchen remodelers", "./kitchen.html"),
          ("Home additions directory", "./additions.html"),
          ("Bathroom remodelers", "./bathrooms.html"),
          ("King County hub", "./king-county.html"),
          ("Kitchen remodel planning", "./kitchen-remodel-planning.html"),
          ("Home addition planning", "./home-addition-planning.html"),
          ("Permit hub", "./permits.html"),
        ]

    return {
      "slug": slug, "place": place, "place_type": "city", "county_note": county_note,
      "county": "Snohomish County" if "Snohomish" in county_note or any(x in metro for x in ("Snohomish", "Hwy 2", "Mountain Loop", "Stillaguamish", "Port city", "Lake Stevens", "Northshore", "North Snohomish")) and "King" not in county_note else "King County",
      "metro": metro, "hub_angle": hub_angle,
      "title": title, "meta_description": meta, "h1": h1, "blurb": blurb, "permit_blurb": permit_blurb,
      "permit_links": [[portal_name, portal_url]] + [list(x) for x in permit_extra],
      "official_keys": ["lni_verify", "lni_home", "mybuildingpermit"],
      "kitchen": {"h2": k_h2, "prose": k, "angle": "A" if hub_angle != "A" else "B"},
      "bathroom": {"h2": b_h2, "prose": b, "angle": "B" if hub_angle != "B" else "C"},
      "additions": {"h2": a_h2, "prose": a, "angle": "C" if hub_angle != "C" else "D"},
      "hire_terms_intro": hire, "hire_intent_ids": intents,
      "extra_faqs": [list(x) for x in faqs], "related_posts": related, "dir_links": dirs,
      "fact_card": {"ahj": ahj, "stock": stock, "mix": mix, "confusion": confusion},
      "ready": True,
    }

def main():
    specs = [card_to_spec(c) for c in CARDS]
    # MORE already full cards
    for c in MORE:
        specs.append(card_to_spec(c))
    for fact in REMAINING_FACTS:
        specs.append(prose_for(fact))
    # de-dupe by slug
    seen = set()
    out = []
    for s in specs:
        if s["slug"] in seen:
            continue
        seen.add(s["slug"])
        out.append(s)
    payload = {
      "version": 1,
      "updated": "2026-09-24",
      "uniqueness_lock": "Alex 2026-09-24 — unique title/meta/h1/blurbs/sections/faqs; shared chrome only for maps/BT/badge/hire-term stems",
      "places": out,
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(out)} place specs → {OUT}")

if __name__ == "__main__":
    main()
