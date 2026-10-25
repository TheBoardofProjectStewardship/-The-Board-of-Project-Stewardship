#!/usr/bin/env python3
"""News is its own section. The intake contract checks it the way it checks posts."""
from __future__ import annotations

import html
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))

import generate_site as gs  # noqa: E402
import board_intake as intake  # noqa: E402

FIXTURE = ROOT / "tests" / "fixtures" / "intake" / "intake-contract-fixture"


def assert_ppg_pitch_allowed(test: unittest.TestCase, article_body: str) -> None:
    """News copy may name Pacific Pro Group as the Board's #1 hire with the canonical link.

    The name is not required. When it appears, it is a ranked contractor, not the owner,
    and the only firm URL is https://pacificprogroup.com/.
    """
    test.assertNotIn("parentOrganization", article_body)
    lowered = article_body.lower()
    test.assertNotIn("owned by", lowered)
    test.assertNotIn("parent company", lowered)
    test.assertNotIn("our company", lowered)
    if "Pacific Pro Group" not in article_body and "pacificprogroup.com" not in lowered:
        return
    test.assertIn('href="https://pacificprogroup.com/"', article_body)
    test.assertNotIn("pacificprogroup.com/contact", lowered)
    test.assertTrue(
        "No. 1 hire" in article_body
        or "#1 hire" in article_body
        or "No. 1-ranked hire" in article_body,
        "a Pacific Pro Group mention in news must be the Board #1 hire",
    )


def _story_md(*, title, date, description, slug, sources, city="Edmonds", county="Snohomish County", hero="assets/images/news/example.webp", alt="Permit desk window"):
    source_lines = "\n".join(f"  - {url}" for url in sources)
    return (
        "---\n"
        f'title: "{title}"\n'
        f'date: "{date}"\n'
        f'description: "{description}"\n'
        f'city: "{city}"\n'
        f'county: "{county}"\n'
        "sources:\n"
        f"{source_lines}\n"
        f'hero: "{hero}"\n'
        f'alt: "{alt}"\n'
        f'slug: "{slug}"\n'
        "---\n\n"
        "Reported note.\n"
    )


class NewsContractTests(unittest.TestCase):
    def test_live_library_is_the_published_story_and_separate_from_the_blog(self):
        story_url = "https://boardofprojectstewardship.com/news/snohomish-health-septic-permit-grant.html"
        story_href = "./news/snohomish-health-septic-permit-grant.html"
        stories = gs.load_news(ROOT)
        self.assertEqual(
            [item["slug"] for item in stories],
            [
                "edmonds-deer-creek-aquifer-interim-rules",
                "everett-lot-split-reforms",
                "king-county-building-code-update-advances",
                "seattle-2027-permit-fee-increase",
                "lynnwood-pre-approved-dadu-plans",
                "seattle-centers-corridors-rezoning-on-hold",
                "mountlake-terrace-shed-permit-exemption-flat-fees",
                "pacific-pro-group-bronze-best-in-the-pnw",
                "king-county-permitting-advisory-panel",
                "edmonds-landmark-tree-ordinance-extension",
                "seattle-environmentally-critical-areas-update",
                "mount-baker-redevelopment-groundbreaking",
                "snohomish-county-administrative-lot-splits",
                "snohomish-health-septic-permit-grant",
            ],
        )
        self.assertEqual(stories[0]["date"], "2026-10-25")
        self.assertEqual(stories[1]["date"], "2026-10-24")
        self.assertEqual(stories[2]["date"], "2026-10-23")
        self.assertEqual(stories[3]["date"], "2026-10-22")
        self.assertEqual(stories[4]["date"], "2026-10-21")
        self.assertEqual(stories[5]["date"], "2026-10-20")
        self.assertEqual(stories[6]["date"], "2026-10-19")
        self.assertEqual(stories[7]["date"], "2026-10-18")
        self.assertEqual(stories[8]["date"], "2026-10-18")
        self.assertEqual(stories[9]["date"], "2026-10-17")
        self.assertEqual(stories[10]["date"], "2026-10-16")
        self.assertEqual(stories[11]["date"], "2026-10-16")
        self.assertEqual(stories[12]["date"], "2026-10-15")
        self.assertEqual(stories[13]["date"], "2026-10-14")
        self.assertTrue(stories[0]["title"])
        self.assertTrue(stories[0]["description"])
        self.assertGreaterEqual(len(stories[0]["sources"]), 1)
        self.assertIn("PinchyCC", stories[0]["hero_credit"])
        self.assertIn("CC BY 4.0", stories[0]["hero_credit"])
        self.assertIn("Joe Mabel", stories[1]["hero_credit"])
        self.assertIn("CC BY-SA 3.0", stories[1]["hero_credit"])
        self.assertIn("Joe Mabel", stories[2]["hero_credit"])
        self.assertIn("CC BY-SA 3.0", stories[2]["hero_credit"])
        self.assertIn("Visitor7", stories[3]["hero_credit"])
        self.assertIn("CC BY-SA 3.0", stories[3]["hero_credit"])
        self.assertIn("Smlowe5", stories[4]["hero_credit"])
        self.assertIn("Spicypepper999", stories[5]["hero_credit"])
        self.assertIn("ECTran71", stories[6]["hero_credit"])
        self.assertIn("Illustration", stories[7]["hero_credit"])
        self.assertIn("Joe Mabel", stories[8]["hero_credit"])
        self.assertIn("Joe Mabel", stories[9]["hero_credit"])
        self.assertEqual(stories[10]["hero_credit"], "")
        self.assertIn("SounderBruce", stories[11]["hero_credit"])
        self.assertIn("Robert Ashworth", stories[12]["hero_credit"])
        self.assertIn("Emersb", stories[13]["hero_credit"])
        self.assertTrue((ROOT / "news" / "_template.md").is_file())
        self.assertEqual(
            sorted(path.name for path in (ROOT / "news").glob("[0-9]*.md")),
            [
                "2026-10-14-snohomish-health-septic-permit-grant.md",
                "2026-10-15-snohomish-county-administrative-lot-splits.md",
                "2026-10-16-mount-baker-redevelopment-groundbreaking.md",
                "2026-10-16-seattle-environmentally-critical-areas-update.md",
                "2026-10-17-edmonds-landmark-tree-ordinance-extension.md",
                "2026-10-18-king-county-permitting-advisory-panel.md",
                "2026-10-18-pacific-pro-group-bronze-best-in-the-pnw.md",
                "2026-10-19-mountlake-terrace-shed-permit-exemption-flat-fees.md",
                "2026-10-20-seattle-centers-corridors-rezoning-on-hold.md",
                "2026-10-21-lynnwood-pre-approved-dadu-plans.md",
                "2026-10-22-seattle-2027-permit-fee-increase.md",
                "2026-10-23-king-county-building-code-update-advances.md",
                "2026-10-24-everett-lot-split-reforms.md",
                "2026-10-25-edmonds-deer-creek-aquifer-interim-rules.md",
            ],
        )
        result = intake.validate_news_library(ROOT)
        self.assertTrue(result["ok"], result)
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["stories"], 14)
        self.assertEqual(gs.news_blog_overlap(ROOT), [])
        self.assertIn("First stories coming soon", gs.build_news_index([]))

        news_html = (ROOT / "news.html").read_text(encoding="utf-8")
        self.assertIn(stories[0]["title"], news_html)
        self.assertIn(story_href, news_html)
        self.assertNotIn("First stories coming soon", news_html)
        self.assertIn(">News</a>", news_html)
        self.assertIn("editorial@boardofprojectstewardship.com", news_html)
        self.assertIsNone(gs.news_forbidden_term(news_html))
        self.assertNotIn('id="another-story-sea"', news_html)
        self.assertIn('id="another-story-cta"', news_html)
        blog_html = (ROOT / "blog.html").read_text(encoding="utf-8")
        self.assertNotIn("snohomish-health-septic-permit-grant", blog_html)
        self.assertNotIn("snohomish-county-administrative-lot-splits", blog_html)
        self.assertNotIn("mount-baker-redevelopment-groundbreaking", blog_html)
        self.assertNotIn("seattle-environmentally-critical-areas-update", blog_html)
        self.assertNotIn("edmonds-landmark-tree-ordinance-extension", blog_html)
        self.assertNotIn("king-county-permitting-advisory-panel", blog_html)
        self.assertNotIn("mountlake-terrace-shed-permit-exemption-flat-fees", blog_html)
        self.assertNotIn("seattle-centers-corridors-rezoning-on-hold", blog_html)
        self.assertNotIn("lynnwood-pre-approved-dadu-plans", blog_html)
        self.assertNotIn("seattle-2027-permit-fee-increase", blog_html)
        self.assertNotIn("king-county-building-code-update-advances", blog_html)
        self.assertNotIn("everett-lot-split-reforms", blog_html)
        self.assertNotIn("edmonds-deer-creek-aquifer-interim-rules", blog_html)
        baker_url = "https://boardofprojectstewardship.com/news/mount-baker-redevelopment-groundbreaking.html"
        eca_url = "https://boardofprojectstewardship.com/news/seattle-environmentally-critical-areas-update.html"
        tree_url = "https://boardofprojectstewardship.com/news/edmonds-landmark-tree-ordinance-extension.html"
        panel_url = "https://boardofprojectstewardship.com/news/king-county-permitting-advisory-panel.html"
        panel_href = "./news/king-county-permitting-advisory-panel.html"
        shed_url = "https://boardofprojectstewardship.com/news/mountlake-terrace-shed-permit-exemption-flat-fees.html"
        shed_href = "./news/mountlake-terrace-shed-permit-exemption-flat-fees.html"
        corridors_url = "https://boardofprojectstewardship.com/news/seattle-centers-corridors-rezoning-on-hold.html"
        corridors_href = "./news/seattle-centers-corridors-rezoning-on-hold.html"
        lynnwood_url = "https://boardofprojectstewardship.com/news/lynnwood-pre-approved-dadu-plans.html"
        lynnwood_href = "./news/lynnwood-pre-approved-dadu-plans.html"
        seattle_url = "https://boardofprojectstewardship.com/news/seattle-2027-permit-fee-increase.html"
        seattle_href = "./news/seattle-2027-permit-fee-increase.html"
        king_url = "https://boardofprojectstewardship.com/news/king-county-building-code-update-advances.html"
        king_href = "./news/king-county-building-code-update-advances.html"
        everett_url = "https://boardofprojectstewardship.com/news/everett-lot-split-reforms.html"
        everett_href = "./news/everett-lot-split-reforms.html"
        deer_url = "https://boardofprojectstewardship.com/news/edmonds-deer-creek-aquifer-interim-rules.html"
        deer_href = "./news/edmonds-deer-creek-aquifer-interim-rules.html"
        lead = news_html.split('class="news-lead"', 1)[1].split("</article>", 1)[0]
        self.assertIn(deer_href, lead)
        self.assertNotIn(everett_href, lead)
        self.assertNotIn(king_href, lead)
        self.assertNotIn(seattle_href, lead)
        self.assertNotIn(lynnwood_href, lead)
        self.assertNotIn(corridors_href, lead)
        self.assertNotIn(shed_href, lead)
        self.assertIn("./news/pacific-pro-group-bronze-best-in-the-pnw.html", news_html)
        self.assertIn(panel_href, news_html)
        self.assertIn(html.escape(stories[0]["title"], quote=True), lead)
        self.assertIn("October 25, 2026", lead)
        self.assertNotIn("edmonds-landmark-tree-ordinance-extension", lead)

        lot_url = "https://boardofprojectstewardship.com/news/snohomish-county-administrative-lot-splits.html"
        lot_href = "./news/snohomish-county-administrative-lot-splits.html"
        self.assertIn(stories[0]["title"], news_html)
        self.assertIn(lot_href, news_html)
        lot = (ROOT / "news" / "snohomish-county-administrative-lot-splits.html").read_text(encoding="utf-8")
        self.assertIn("Snohomish County government buildings in downtown Everett, Washington", lot)
        self.assertNotIn("Illustrative:", lot.split("<figure", 1)[1].split("</figure>", 1)[0])
        self.assertIn('href="https://creativecommons.org/licenses/by/2.0/"', lot)
        self.assertIn(">CC BY 2.0</a>", lot)
        self.assertNotIn("CC BY-SA", lot)
        self.assertIn(
            'href="https://commons.wikimedia.org/wiki/File:Snohomish_County_buildings_(7319122734).jpg"',
            lot,
        )
        self.assertIn("editorial@boardofprojectstewardship.com", lot)
        self.assertIn("Ordinance 26-036", lot)
        self.assertIn("2026-10-15-snohomish-county-administrative-lot-splits-480.webp", lot)
        self.assertIn("2026-10-15-snohomish-county-administrative-lot-splits-800.webp", lot)
        self.assertIn("2026-10-15-snohomish-county-administrative-lot-splits-1200.webp", lot)
        self.assertIsNone(gs.news_forbidden_term(lot))
        self.assertNotIn("/posts/", lot)

        page = (ROOT / "news" / "snohomish-health-septic-permit-grant.html").read_text(encoding="utf-8")
        self.assertIn("Emersb", page)
        self.assertIn('href="https://creativecommons.org/licenses/by-sa/3.0/"', page)
        self.assertIn(">CC BY-SA 3.0</a>", page)
        self.assertIn(
            'href="https://commons.wikimedia.org/wiki/File:Everett_-_County_Campus.jpg"',
            page,
        )
        self.assertIn(">Wikimedia Commons</a>", page)
        self.assertIn("2026-10-14-snohomish-health-septic-permit-grant-480.webp", page)
        self.assertIn("2026-10-14-snohomish-health-septic-permit-grant-800.webp", page)
        self.assertIn("2026-10-14-snohomish-health-septic-permit-grant-1200.webp", page)
        self.assertIsNone(gs.news_forbidden_term(page))
        self.assertNotIn("/posts/", page)

        baker = (ROOT / "news" / "mount-baker-redevelopment-groundbreaking.html").read_text(encoding="utf-8")
        self.assertIn("Mount Baker Link light-rail station in Seattle, seen from Martin Luther King Jr. Way", baker)
        self.assertIn("SounderBruce", baker)
        self.assertIn('href="https://creativecommons.org/licenses/by-sa/2.0/"', baker)
        self.assertIn(">CC BY-SA 2.0</a>", baker)
        self.assertIn(
            'href="https://commons.wikimedia.org/wiki/File:Mount_Baker_Station_from_MLK_Way_(20400419804).jpg"',
            baker,
        )
        self.assertIn("2026-10-16-mount-baker-redevelopment-groundbreaking-480.webp", baker)
        self.assertIn("2026-10-16-mount-baker-redevelopment-groundbreaking-800.webp", baker)
        self.assertIn("2026-10-16-mount-baker-redevelopment-groundbreaking-1200.webp", baker)
        baker_story = next(item for item in stories if item["slug"] == "mount-baker-redevelopment-groundbreaking")
        for source in baker_story["sources"]:
            self.assertIn(source, baker)
        emails = set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", baker))
        self.assertEqual(emails, {"editorial@boardofprojectstewardship.com"})
        self.assertIsNone(gs.news_forbidden_term(baker))
        self.assertNotIn("/posts/", baker)

        eca = (ROOT / "news" / "seattle-environmentally-critical-areas-update.html").read_text(encoding="utf-8")
        self.assertIn(
            "A hillside home set back from a wooded ravine and creek in Seattle",
            eca,
        )
        self.assertIn("2026-10-16-seattle-environmentally-critical-areas-update-480.webp", eca)
        self.assertIn("2026-10-16-seattle-environmentally-critical-areas-update-800.webp", eca)
        self.assertIn("2026-10-16-seattle-environmentally-critical-areas-update-1200.webp", eca)
        self.assertNotIn("seattle-eca-update-sdci.jpg", eca)
        self.assertNotIn("hero_local", eca)
        self.assertNotIn("Department of Construction and Inspections, from the Building Connections", eca)
        figure = eca.split("<figure", 1)[1].split("</figure>", 1)[0]
        self.assertNotIn("news-credit", figure)
        self.assertIn("History and background", eca)
        eca_story = next(item for item in stories if item["slug"] == "seattle-environmentally-critical-areas-update")
        for source in eca_story["sources"]:
            self.assertIn(source, eca)
        self.assertIsNone(gs.news_forbidden_term(eca))
        self.assertNotIn("/posts/", eca)

        tree = (ROOT / "news" / "edmonds-landmark-tree-ordinance-extension.html").read_text(encoding="utf-8")
        self.assertIn(
            "Houses on Sunset Avenue North in Edmonds, Washington, set among tall evergreen trees above the Puget Sound shoreline",
            tree,
        )
        self.assertIn("Joe Mabel", tree)
        self.assertIn('href="https://creativecommons.org/licenses/by-sa/4.0/"', tree)
        self.assertIn(">CC BY-SA 4.0</a>", tree)
        self.assertIn(
            'href="https://commons.wikimedia.org/wiki/File:Edmonds,_WA_-_houses_on_Sunset_Ave._N,_north_from_the_jetty_at_Brackett%27s_Landing_Park.jpg"',
            tree,
        )
        self.assertIn("2026-10-17-edmonds-landmark-tree-ordinance-extension-480.webp", tree)
        self.assertIn("2026-10-17-edmonds-landmark-tree-ordinance-extension-800.webp", tree)
        self.assertIn("2026-10-17-edmonds-landmark-tree-ordinance-extension-1200.webp", tree)
        self.assertIn("History and background", tree)
        tree_story = next(item for item in stories if item["slug"] == "edmonds-landmark-tree-ordinance-extension")
        for source in tree_story["sources"]:
            self.assertIn(source, tree)
        emails = set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", tree))
        self.assertEqual(emails, {"editorial@boardofprojectstewardship.com"})
        self.assertNotIn("parentOrganization", tree)
        self.assertNotIn("isRelatedTo", tree)
        self.assertIsNone(gs.news_forbidden_term(tree))
        self.assertNotIn("/posts/", tree)

        panel = (ROOT / "news" / "king-county-permitting-advisory-panel.html").read_text(encoding="utf-8")
        self.assertIn(
            "King County Courthouse and administration building across City Hall Park in downtown Seattle",
            panel,
        )
        self.assertIn("Joe Mabel", panel)
        self.assertIn('href="https://creativecommons.org/licenses/by-sa/4.0/"', panel)
        self.assertIn(">CC BY-SA 4.0</a>", panel)
        self.assertIn(
            'href="https://commons.wikimedia.org/wiki/File:Seattle_-_King_County_Courthouse_and_King_County_Administration_Building_01.jpg"',
            panel,
        )
        self.assertIn("2026-10-18-king-county-permitting-advisory-panel-480.webp", panel)
        self.assertIn("2026-10-18-king-county-permitting-advisory-panel-800.webp", panel)
        self.assertIn("2026-10-18-king-county-permitting-advisory-panel-1200.webp", panel)
        self.assertIn("History and background", panel)
        self.assertIn(
            'href="https://app.leg.wa.gov/billsummary?BillNumber=5290&amp;Year=2023&amp;Initiative=false"',
            panel,
        )
        panel_story = next(item for item in stories if item["slug"] == "king-county-permitting-advisory-panel")
        for source in panel_story["sources"]:
            self.assertIn(source, panel)
        emails = set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", panel))
        self.assertEqual(emails, {"editorial@boardofprojectstewardship.com"})
        self.assertNotIn("parentOrganization", panel)
        self.assertNotIn("isRelatedTo", panel)
        self.assertIsNone(gs.news_forbidden_term(panel))
        self.assertNotIn("/posts/", panel)

        shed = (ROOT / "news" / "mountlake-terrace-shed-permit-exemption-flat-fees.html").read_text(encoding="utf-8")
        self.assertIn(
            "Houses, a church and evergreen trees at the intersection of 236th Street Southwest and 56th Avenue West in Mountlake Terrace, Washington",
            shed,
        )
        self.assertIn("ECTran71", shed)
        self.assertIn("public domain", shed)
        self.assertIn(
            'href="https://commons.wikimedia.org/wiki/File:Mountlake_Terrace_236th%2656th.JPG"',
            shed,
        )
        for name in (
            "2026-10-19-mountlake-terrace-shed-permit-exemption-flat-fees",
            "2026-10-19-mountlake-terrace-shed-permit-1",
            "2026-10-19-mountlake-terrace-shed-permit-2",
            "2026-10-19-mountlake-terrace-shed-permit-3",
        ):
            for width in (480, 800, 1200):
                self.assertIn(f"{name}-{width}.webp", shed)
        self.assertEqual(shed.count('in Mountlake Terrace" loading="lazy"'), 3)
        self.assertIn("History and background", shed)
        self.assertNotIn("citizenportal", shed)
        self.assertNotIn("recommended contractor path", shed)
        shed_story = next(item for item in stories if item["slug"] == "mountlake-terrace-shed-permit-exemption-flat-fees")
        for source in shed_story["sources"]:
            self.assertIn(source, shed)
        emails = set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", shed))
        self.assertEqual(emails, {"editorial@boardofprojectstewardship.com"})
        self.assertNotIn("parentOrganization", shed)
        self.assertNotIn("isRelatedTo", shed)
        self.assertIsNone(gs.news_forbidden_term(shed))
        self.assertNotIn("/posts/", shed)

        corridors = (ROOT / "news" / "seattle-centers-corridors-rezoning-on-hold.html").read_text(encoding="utf-8")
        self.assertIn(
            "Aerial view of downtown Seattle and Elliott Bay, with the Space Needle and ferry docks",
            corridors,
        )
        self.assertIn("Spicypepper999", corridors)
        self.assertIn("CC0", corridors)
        self.assertIn(
            'href="https://commons.wikimedia.org/wiki/File:Seattle_aerial_2,_May_2023.png"',
            corridors,
        )
        for name in (
            "2026-10-20-seattle-centers-corridors-rezoning-on-hold",
            "2026-10-20-seattle-centers-corridors-1",
            "2026-10-20-seattle-centers-corridors-2",
            "2026-10-20-seattle-centers-corridors-3",
            "2026-10-20-seattle-centers-corridors-4",
        ):
            for width in (480, 800, 1200):
                self.assertIn(f"{name}-{width}.webp", corridors)
        self.assertIn(
            "Seattle City Council members at a curved dais during a Centers and Corridors zoning discussion",
            corridors,
        )
        self.assertIn(
            "A planner reviewing a Seattle Centers and Corridors zoning map marked on hold",
            corridors,
        )
        self.assertIn(
            "A Seattle City Council hearing on the Centers and Corridors rezoning, with the proposal marked on hold",
            corridors,
        )
        self.assertIn(
            "Seattle planning staff presenting a zoning map marked on hold to the City Council",
            corridors,
        )
        self.assertIn("History and background", corridors)
        corridors_story = next(item for item in stories if item["slug"] == "seattle-centers-corridors-rezoning-on-hold")
        for source in corridors_story["sources"]:
            self.assertIn(source, corridors)
        emails = set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", corridors))
        self.assertEqual(emails, {"editorial@boardofprojectstewardship.com"})
        self.assertNotIn("parentOrganization", corridors)
        self.assertNotIn("isRelatedTo", corridors)
        self.assertIsNone(gs.news_forbidden_term(corridors))
        self.assertNotIn("/posts/", corridors)
        prose = corridors.split('class="news-body prose-board"', 1)[1].split("news-sources", 1)[0]
        assert_ppg_pitch_allowed(self, prose)

        lynnwood = (ROOT / "news" / "lynnwood-pre-approved-dadu-plans.html").read_text(encoding="utf-8")
        self.assertIn(
            "Two-story single-family homes with front lawns and garages along a curving residential street, 167th Street Southwest, in Lynnwood, Washington",
            lynnwood,
        )
        self.assertIn("Smlowe5", lynnwood)
        self.assertIn("public domain", lynnwood)
        self.assertIn(
            'href="https://commons.wikimedia.org/wiki/File:Lynnwood_Washington_neighborhood.jpg"',
            lynnwood,
        )
        for name in (
            "2026-10-21-lynnwood-pre-approved-dadu-plans",
            "2026-10-21-lynnwood-dadu-backyard-cottage-1",
            "2026-10-21-lynnwood-dadu-plans-2",
            "2026-10-21-lynnwood-dadu-site-work-3",
        ):
            for width in (480, 800, 1200):
                self.assertIn(f"{name}-{width}.webp", lynnwood)
        self.assertIn(
            "A small detached backyard cottage, the kind of DADU Lynnwood&#x27;s pre-approved plan gallery covers, behind a two-story home in Lynnwood",
            lynnwood,
        )
        self.assertIn(
            "Image of a detached accessory dwelling unit in a Lynnwood backyard. Lynnwood&#x27;s pre-approved plans range from about 490 to about 1,000 square feet.",
            lynnwood,
        )
        self.assertIn(
            "Floor plan and elevation drawings for a small backyard cottage on a kitchen table, the kind of pre-approved DADU plan set Lynnwood is reviewing",
            lynnwood,
        )
        self.assertIn(
            "Image of a DADU plan set. Lynnwood will post pre-approved backyard cottage plans as they are approved, with the first expected by the end of October or in November.",
            lynnwood,
        )
        self.assertIn(
            "Foundation forms and a utility trench dug for a backyard cottage in a Snohomish County yard, site work Lynnwood&#x27;s pre-approved DADU plans do not cover",
            lynnwood,
        )
        self.assertIn(
            "Image of DADU site work in Snohomish County. Lynnwood&#x27;s pre-approved plans cover the building only, so grading and utilities still need site-specific review.",
            lynnwood,
        )
        body = lynnwood.split('class="news-body prose-board"', 1)[1].split("news-sources", 1)[0]
        self.assertLess(body.index("How the program will work"), body.index("lynnwood-dadu-backyard-cottage-1"))
        self.assertLess(body.index("lynnwood-dadu-backyard-cottage-1"), body.index("The review pipeline and timing"))
        self.assertLess(body.index("The review pipeline and timing"), body.index("lynnwood-dadu-plans-2"))
        self.assertLess(body.index("lynnwood-dadu-plans-2"), body.index("History and background"))
        self.assertLess(body.index("What it means for homeowners"), body.index("lynnwood-dadu-site-work-3"))
        self.assertEqual(body.count('loading="lazy"'), 3)
        self.assertIn("History and background", lynnwood)
        self.assertIn('id="another-story-cta"', lynnwood)
        self.assertNotIn('id="another-story-sea"', lynnwood)
        lynnwood_story = next(item for item in stories if item["slug"] == "lynnwood-pre-approved-dadu-plans")
        for source in lynnwood_story["sources"]:
            self.assertIn(source, lynnwood)
        emails = set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", lynnwood))
        self.assertEqual(
            emails,
            {"editorial@boardofprojectstewardship.com", "Planning@LynnwoodWA.gov"},
        )
        assert_ppg_pitch_allowed(self, body)
        self.assertNotIn("parentOrganization", lynnwood)
        self.assertNotIn("isRelatedTo", lynnwood)
        self.assertIsNone(gs.news_forbidden_term(lynnwood))
        self.assertNotIn("/posts/", lynnwood)

        seattle = (ROOT / "news" / "seattle-2027-permit-fee-increase.html").read_text(encoding="utf-8")
        hero_alt = (
            "The dark glass Seattle Municipal Tower in downtown Seattle, seen from Ninth Avenue and Columbia Street. "
            "The Seattle Department of Construction and Inspections has its offices in the tower at 700 Fifth Ave."
        )
        self.assertIn(hero_alt, seattle)
        self.assertIn("Photo: Visitor7, CC BY-SA 3.0, via", seattle)
        self.assertIn(
            'href="https://commons.wikimedia.org/wiki/File:Seattle_Municipal_Tower_1.JPG"',
            seattle,
        )
        self.assertIn(">Wikimedia Commons</a>", seattle)
        self.assertIn('"@type": "Organization"', seattle)
        self.assertIn('"@type": "WebSite"', seattle)
        self.assertNotIn("parentOrganization", seattle)
        self.assertNotIn("isRelatedTo", seattle)
        self.assertNotIn("Illustrative", seattle)
        permit_url = (
            "https://www.seattle.gov/construction-and-inspections/permits/permits-we-issue-(a-z)/"
            "construction-permit%C2%A0--new-building-single-family-residential%C2%A0or-duplex"
        )
        self.assertIn(f'href="{permit_url}"', seattle)
        self.assertNotIn("permits-we-issue-(a-z\"", seattle)
        for name in (
            "2026-10-22-seattle-2027-permit-fee-increase",
            "2026-10-22-seattle-permit-fees-counter-1",
            "2026-10-22-seattle-home-addition-permit-2",
            "2026-10-22-seattle-furnace-inspection-fees-3",
        ):
            for width in (480, 800, 1200):
                self.assertIn(f"{name}-{width}.webp", seattle)
                self.assertTrue((ROOT / "assets" / "images" / "news" / f"{name}-{width}.webp").is_file())
        self.assertIn(
            "Homeowners review a building permit fee estimate and house plans with a staff member at a Seattle permit counter",
            seattle,
        )
        self.assertIn(
            "Seattle homeowners planning additions, remodels or backyard cottages could pay 10.7% more in city permit fees in 2027 under the proposed budget.",
            seattle,
        )
        self.assertIn(
            "A two-story wood-framed home addition under construction behind a Craftsman house in a Seattle neighborhood",
            seattle,
        )
        self.assertIn(
            "A home addition in Seattle. City building permit fees are based on project value, so larger additions and new houses carry larger fees.",
            seattle,
        )
        self.assertIn(
            "A technician installs a new furnace in the basement of a Seattle house, work that needs a separate mechanical permit and inspection",
            seattle,
        )
        self.assertIn(
            "Furnace replacement in a Seattle basement. Under the proposal, Seattle mechanical and furnace inspection fees would rise 15% above inflation.",
            seattle,
        )
        body = seattle.split('class="news-body prose-board"', 1)[1].split("news-sources", 1)[0]
        self.assertLess(body.index("What the city proposes"), body.index("seattle-permit-fees-counter-1"))
        self.assertLess(body.index("seattle-permit-fees-counter-1"), body.index("Why the department says it needs the money"))
        self.assertLess(body.index("Why the department says it needs the money"), body.index("seattle-home-addition-permit-2"))
        self.assertLess(body.index("seattle-home-addition-permit-2"), body.index("The broader cost picture"))
        self.assertLess(body.index("What it means for homeowners"), body.index("seattle-furnace-inspection-fees-3"))
        self.assertEqual(body.count('loading="lazy"'), 3)
        self.assertIn("checkpoint approach", seattle)
        self.assertIn("Shane Muchow", seattle)
        seattle_story = next(item for item in stories if item["slug"] == "seattle-2027-permit-fee-increase")
        for source in seattle_story["sources"]:
            self.assertIn(source, seattle)
        emails = set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", seattle))
        self.assertEqual(emails, {"editorial@boardofprojectstewardship.com"})
        self.assertIsNone(gs.news_forbidden_term(seattle))
        self.assertNotIn("/posts/", seattle)
        self.assertIn('id="another-story-cta"', seattle)
        self.assertNotIn('id="another-story-sea"', seattle)
        self.assertIn(
            '<a href="https://pacificprogroup.com/">Pacific Pro Group</a>, the Board of Project Stewardship&#x27;s No. 1 hire for remodels and additions',
            body,
        )
        self.assertNotIn("parentOrganization", body)
        assert_ppg_pitch_allowed(self, body)

        deer = (ROOT / "news" / "edmonds-deer-creek-aquifer-interim-rules.html").read_text(encoding="utf-8")
        self.assertIn(
            "Deer Creek seen from the Brown Owl Bridge in Woodway, Washington, at the north end of the Deer Creek aquifer in Edmonds",
            deer,
        )
        self.assertIn("PinchyCC / ", deer)
        self.assertIn(
            'href="https://commons.wikimedia.org/wiki/File:Looking_down_on_Deer_Creek_in_Woodway.jpg"',
            deer,
        )
        self.assertIn(">Wikimedia Commons</a>, CC BY 4.0", deer)
        self.assertNotIn("Illustrative", deer)
        for name in (
            "2026-10-25-edmonds-deer-creek-aquifer-interim-rules",
            "2026-10-25-edmonds-deer-creek-roofing-1",
            "2026-10-25-edmonds-deer-creek-stormwater-2",
            "2026-10-25-edmonds-deer-creek-homeowner-3",
        ):
            for width in (480, 800, 1200):
                self.assertIn(f"{name}-{width}.webp", deer)
                self.assertTrue((ROOT / "assets" / "images" / "news" / f"{name}-{width}.webp").is_file())
        self.assertIn(
            "A residential roof with architectural shingles on a south Edmonds home near the Deer Creek aquifer area",
            deer,
        )
        self.assertIn(
            "Edmonds draft interim Deer Creek aquifer rules would add source-control categories that include roofing materials aimed at limiting PFAS pathways.",
            deer,
        )
        self.assertIn(
            "Stormwater runoff from a driveway draining toward a planted strip beside a home in Edmonds",
            deer,
        )
        self.assertIn(
            "Staff told an Edmonds council committee the city is weighing infiltration with restrictions against a permanent pause or a multiyear stormwater treatment build.",
            deer,
        )
        self.assertIn(
            "A homeowner reviews building plans at a kitchen table for a project in Edmonds",
            deer,
        )
        self.assertIn(
            "Homeowners planning additions or large hardscape in south Edmonds should confirm whether their parcel sits inside the Deer Creek Critical Aquifer Recharge Area before full design work.",
            deer,
        )
        body = deer.split('class="news-body prose-board"', 1)[1].split("news-sources", 1)[0]
        self.assertLess(body.index("What the draft would regulate"), body.index("deer-creek-roofing-1"))
        self.assertLess(body.index("deer-creek-roofing-1"), body.index("Options and costs"))
        self.assertLess(body.index("Options and costs"), body.index("deer-creek-stormwater-2"))
        self.assertLess(body.index("deer-creek-stormwater-2"), body.index("What councilmembers asked"))
        self.assertLess(body.index("What it means for homeowners"), body.index("deer-creek-homeowner-3"))
        self.assertLess(body.index("deer-creek-homeowner-3"), body.index("Questions or corrections"))
        self.assertEqual(body.count('loading="lazy"'), 3)
        self.assertIn("according to a summary of the meeting", deer)
        self.assertIn("according to the meeting summary", deer)
        self.assertIn("editorial@boardofprojectstewardship.com", deer)
        deer_story = next(item for item in stories if item["slug"] == "edmonds-deer-creek-aquifer-interim-rules")
        for source in deer_story["sources"]:
            self.assertIn(source, deer)
        emails = set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", deer))
        self.assertEqual(emails, {"editorial@boardofprojectstewardship.com"})
        self.assertIsNone(gs.news_forbidden_term(deer))
        self.assertNotIn("/posts/", deer)
        self.assertIn('id="another-story-cta"', deer)
        self.assertNotIn('id="another-story-sea"', deer)
        self.assertIn(
            'the Board of Project Stewardship&#x27;s No. 1 hire, <a href="https://pacificprogroup.com/">Pacific Pro Group</a>',
            body,
        )
        assert_ppg_pitch_allowed(self, body)

        everett = (ROOT / "news" / "everett-lot-split-reforms.html").read_text(encoding="utf-8")
        self.assertIn(
            "Everett City Hall, a historic building at 3002 Wetmore Ave. in downtown Everett, Washington",
            everett,
        )
        self.assertIn("Joe Mabel / ", everett)
        self.assertIn(
            'href="https://commons.wikimedia.org/wiki/File:Everett,_WA_City_Hall_01.jpg"',
            everett,
        )
        self.assertIn(">Wikimedia Commons</a>, CC BY-SA 3.0", everett)
        self.assertNotIn("Illustrative", everett)
        for name in (
            "2026-10-24-everett-lot-split-reforms",
            "2026-10-24-everett-lot-survey-1",
            "2026-10-24-everett-narrow-lot-cottage-2",
            "2026-10-24-everett-lot-utilities-3",
        ):
            for width in (480, 800, 1200):
                self.assertIn(f"{name}-{width}.webp", everett)
                self.assertTrue((ROOT / "assets" / "images" / "news" / f"{name}-{width}.webp").is_file())
        self.assertIn(
            "A survey stake with pink flagging marks a backyard lot line next to a house in Everett",
            everett,
        )
        self.assertIn(
            "Everett homeowners in the NR and UR4 zones can divide residential lots as small as 2,000 square feet under the new land division rules.",
            everett,
        )
        self.assertIn(
            "A cottage-scale house under construction on a narrow lot beside an older Craftsman home in Everett",
            everett,
        )
        self.assertIn(
            "Smaller minimum lot width and frontage in Everett are meant to support fee-simple ownership of homes on compact lots.",
            everett,
        )
        self.assertIn(
            "Utility stubs and a gravel driveway apron on a newly created residential lot in Everett before building",
            everett,
        )
        self.assertIn(
            "Under the overhaul, Everett can let a new lot sell before utilities and landscaping are built, then require that work before a building permit.",
            everett,
        )
        body = everett.split('class="news-body prose-board"', 1)[1].split("news-sources", 1)[0]
        self.assertLess(body.index("Smaller lots in NR and UR4 zones"), body.index("everett-lot-survey-1"))
        self.assertLess(body.index("everett-lot-survey-1"), body.index("Selling before infrastructure is built"))
        self.assertLess(body.index("Selling before infrastructure is built"), body.index("everett-lot-utilities-3"))
        self.assertLess(body.index("everett-lot-utilities-3"), body.index("How lot splits work in Everett"))
        self.assertLess(body.index("How lot splits work in Everett"), body.index("narrow-lot-cottage-2"))
        self.assertLess(body.index("narrow-lot-cottage-2"), body.index("What officials said"))
        self.assertEqual(body.count('loading="lazy"'), 3)
        self.assertIn("Ordinance No. 4207-26", everett)
        self.assertIn("editorial@boardofprojectstewardship.com", everett)
        everett_story = next(item for item in stories if item["slug"] == "everett-lot-split-reforms")
        for source in everett_story["sources"]:
            self.assertIn(source, everett)
        emails = set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", everett))
        self.assertEqual(emails, {"editorial@boardofprojectstewardship.com"})
        self.assertIsNone(gs.news_forbidden_term(everett))
        self.assertNotIn("/posts/", everett)
        self.assertIn('id="another-story-cta"', everett)
        self.assertNotIn('id="another-story-sea"', everett)
        self.assertIn(
            '<a href="https://pacificprogroup.com/">Pacific Pro Group</a>, the Board of Project Stewardship&#x27;s No. 1 hire',
            body,
        )
        assert_ppg_pitch_allowed(self, body)

        king = (ROOT / "news" / "king-county-building-code-update-advances.html").read_text(encoding="utf-8")
        self.assertIn(
            "The King County Courthouse at Third Avenue and James Street in downtown Seattle",
            king,
        )
        self.assertIn("Joe Mabel / ", king)
        self.assertIn(
            'href="https://commons.wikimedia.org/wiki/File:Seattle_-_King_County_Courthouse_01.jpg"',
            king,
        )
        self.assertIn(">Wikimedia Commons</a>, CC BY-SA 3.0", king)
        self.assertIn('"@type": "Organization"', king)
        self.assertIn('"@type": "WebSite"', king)
        self.assertNotIn("parentOrganization", king)
        self.assertNotIn("isRelatedTo", king)
        self.assertNotIn("Illustrative", king)
        for name in (
            "2026-10-23-king-county-building-code-update-advances",
            "2026-10-23-king-county-heated-shed-permit-1",
            "2026-10-23-king-county-pool-barrier-permit-2",
            "2026-10-23-king-county-rural-fire-sprinkler-3",
        ):
            for width in (480, 800, 1200):
                self.assertIn(f"{name}-{width}.webp", king)
                self.assertTrue((ROOT / "assets" / "images" / "news" / f"{name}-{width}.webp").is_file())
        self.assertIn(
            "A backyard shed with insulation going into its walls on a wooded lot in unincorporated King County",
            king,
        )
        self.assertIn(
            "In unincorporated King County, a detached shed or backyard studio that is heated or insulated would need a building permit under the proposed code update.",
            king,
        )
        self.assertIn(
            "A black safety fence and gate around a backyard swimming pool at a King County home",
            king,
        )
        self.assertIn(
            "Swimming pool barriers in unincorporated King County would need a building permit at any height under the ordinance.",
            king,
        )
        self.assertIn(
            "A new house under construction on a large wooded rural lot in King County, with a long gravel driveway and a fire hydrant",
            king,
        )
        self.assertIn(
            "Rural King County homes on lots of 35,000 square feet or more could lose exemptions from fire sprinkler, fire flow and hydrant rules.",
            king,
        )
        body = king.split('class="news-body prose-board"', 1)[1].split("news-sources", 1)[0]
        self.assertLess(body.index("Changes for sheds, pools and permits"), body.index("heated-shed-permit-1"))
        self.assertLess(body.index("heated-shed-permit-1"), body.index("pool-barrier-permit-2"))
        self.assertLess(body.index("pool-barrier-permit-2"), body.index("Fire sprinklers, hydrants and rural lots"))
        self.assertLess(body.index("Fire sprinklers, hydrants and rural lots"), body.index("rural-fire-sprinkler-3"))
        self.assertLess(body.index("rural-fire-sprinkler-3"), body.index("What was dropped or scaled back"))
        self.assertEqual(body.count('loading="lazy"'), 3)
        self.assertIn("History and background", king)
        self.assertIn("online lookup", king)
        self.assertIn("editorial@boardofprojectstewardship.com", king)
        king_story = next(item for item in stories if item["slug"] == "king-county-building-code-update-advances")
        for source in king_story["sources"]:
            self.assertIn(source, king)
        emails = set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", king))
        self.assertEqual(emails, {"editorial@boardofprojectstewardship.com"})
        self.assertIsNone(gs.news_forbidden_term(king))
        self.assertNotIn("/posts/", king)
        self.assertIn('id="another-story-cta"', king)
        self.assertNotIn('id="another-story-sea"', king)
        self.assertIn(
            'The Board of Project Stewardship&#x27;s No. 1-ranked hire, <a href="https://pacificprogroup.com/">Pacific Pro Group</a>',
            body,
        )
        assert_ppg_pitch_allowed(self, body)

        rss = (ROOT / "news" / "rss.xml").read_text(encoding="utf-8")
        self.assertIn("Board of Project Stewardship News", rss)
        self.assertIn("<item>", rss)
        self.assertTrue(rss.index(deer_url) < rss.index(everett_url))
        self.assertTrue(rss.index(everett_url) < rss.index(king_url))
        self.assertTrue(rss.index(king_url) < rss.index(seattle_url))
        self.assertTrue(rss.index(seattle_url) < rss.index(lynnwood_url))
        self.assertTrue(rss.index(lynnwood_url) < rss.index(corridors_url))
        self.assertTrue(rss.index(corridors_url) < rss.index(shed_url))
        self.assertTrue(rss.index(shed_url) < rss.index(panel_url))
        self.assertTrue(rss.index(panel_url) < rss.index(tree_url))
        self.assertTrue(rss.index(tree_url) < rss.index(eca_url))
        self.assertTrue(rss.index(eca_url) < rss.index(baker_url))
        self.assertIn(story_url, rss)
        self.assertIn(lot_url, rss)
        self.assertIn(baker_url, rss)
        self.assertIn(eca_url, rss)
        self.assertIn(tree_url, rss)
        self.assertIn(panel_url, rss)
        self.assertIn(shed_url, rss)
        self.assertIn(corridors_url, rss)
        self.assertIn(lynnwood_url, rss)
        self.assertIn(seattle_url, rss)
        self.assertIn(king_url, rss)
        self.assertIn(deer_url, rss)
        self.assertIn(everett_url, rss)
        self.assertNotIn("/posts/", rss)

        sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        self.assertIn("https://boardofprojectstewardship.com/news.html", sitemap)
        self.assertIn(story_url, sitemap)
        self.assertIn(lot_url, sitemap)
        self.assertIn(baker_url, sitemap)
        self.assertIn(eca_url, sitemap)
        self.assertIn(tree_url, sitemap)
        self.assertIn(panel_url, sitemap)
        self.assertIn(shed_url, sitemap)
        self.assertIn(corridors_url, sitemap)
        self.assertIn(lynnwood_url, sitemap)
        self.assertIn(seattle_url, sitemap)
        self.assertIn(king_url, sitemap)
        self.assertIn(deer_url, sitemap)
        self.assertIn(everett_url, sitemap)
        self.assertIn("https://boardofprojectstewardship.com/projects/magnolia-house-adu-garage/", sitemap)
        blog_rss = (ROOT / "blog" / "rss.xml").read_text(encoding="utf-8")
        posts_json = (ROOT / "posts.json").read_text(encoding="utf-8")
        self.assertNotIn("snohomish-health-septic-permit-grant", blog_rss)
        self.assertNotIn("snohomish-health-septic-permit-grant", posts_json)
        self.assertNotIn("snohomish-county-administrative-lot-splits", blog_rss)
        self.assertNotIn("snohomish-county-administrative-lot-splits", posts_json)
        self.assertNotIn("mount-baker-redevelopment-groundbreaking", blog_rss)
        self.assertNotIn("mount-baker-redevelopment-groundbreaking", posts_json)
        self.assertNotIn("seattle-environmentally-critical-areas-update", blog_rss)
        self.assertNotIn("seattle-environmentally-critical-areas-update", posts_json)
        self.assertNotIn("edmonds-landmark-tree-ordinance-extension", blog_rss)
        self.assertNotIn("edmonds-landmark-tree-ordinance-extension", posts_json)
        self.assertNotIn("king-county-permitting-advisory-panel", blog_rss)
        self.assertNotIn("king-county-permitting-advisory-panel", posts_json)
        self.assertNotIn("mountlake-terrace-shed-permit-exemption-flat-fees", blog_rss)
        self.assertNotIn("mountlake-terrace-shed-permit-exemption-flat-fees", posts_json)
        self.assertNotIn("seattle-centers-corridors-rezoning-on-hold", blog_rss)
        self.assertNotIn("seattle-centers-corridors-rezoning-on-hold", posts_json)
        self.assertNotIn("lynnwood-pre-approved-dadu-plans", blog_rss)
        self.assertNotIn("lynnwood-pre-approved-dadu-plans", posts_json)
        self.assertNotIn("seattle-2027-permit-fee-increase", blog_rss)
        self.assertNotIn("seattle-2027-permit-fee-increase", posts_json)
        self.assertNotIn("king-county-building-code-update-advances", blog_rss)
        self.assertNotIn("king-county-building-code-update-advances", posts_json)
        self.assertNotIn("everett-lot-split-reforms", blog_rss)
        self.assertNotIn("everett-lot-split-reforms", posts_json)
        self.assertNotIn("edmonds-deer-creek-aquifer-interim-rules", blog_rss)
        self.assertNotIn("edmonds-deer-creek-aquifer-interim-rules", posts_json)
        self.assertNotIn("/news/", blog_rss)
        self.assertNotIn('"path": "./news/', posts_json)
        self.assertNotIn("./posts/", news_html)
        self.assertIn(">News</a>", (ROOT / "blog.html").read_text(encoding="utf-8"))
        self.assertIn("Pacific Pro Group", (ROOT / "index.html").read_text(encoding="utf-8"))

    def test_source_url_with_triple_dash_stays_in_frontmatter(self):
        text = (
            "---\n"
            'title: "Fence"\n'
            "date: 2026-10-24\n"
            "slug: fence-test\n"
            'description: "A note."\n'
            'city: "Everett"\n'
            "sources:\n"
            '  - "https://example.com/Memo---Land-Divisions"\n'
            'hero: "assets/images/news/example.webp"\n'
            'hero_alt: "Everett City Hall"\n'
            "---\n\n"
            "Body stays intact.\n"
        )
        meta, body = gs.parse_news_frontmatter(text)
        self.assertEqual(meta["hero"], "assets/images/news/example.webp")
        self.assertEqual(meta["hero_alt"], "Everett City Hall")
        self.assertEqual(meta["sources"], ["https://example.com/Memo---Land-Divisions"])
        self.assertIn("Body stays intact.", body)

    def test_credit_links_the_license_named_on_the_photo(self):
        cc_by = gs.news_hero_credit_html(
            "Photo by Robert Ashworth, licensed under CC BY 2.0 "
            "(https://creativecommons.org/licenses/by/2.0/), via Wikimedia Commons: "
            "https://commons.wikimedia.org/wiki/File:Snohomish_County_buildings_(7319122734).jpg"
        )
        self.assertIn('href="https://creativecommons.org/licenses/by/2.0/"', cc_by)
        self.assertIn(">CC BY 2.0</a>", cc_by)
        self.assertNotIn("CC BY-SA", cc_by)
        self.assertIn(
            'href="https://commons.wikimedia.org/wiki/File:Snohomish_County_buildings_(7319122734).jpg"',
            cc_by,
        )
        self.assertIn(">Wikimedia Commons</a>", cc_by)
        self.assertNotIn("Commons .jpg", cc_by)
        share_alike = gs.news_hero_credit_html(
            "Photo by Emersb, licensed under CC BY-SA 3.0 "
            "(https://creativecommons.org/licenses/by-sa/3.0/), via Wikimedia Commons: "
            "https://commons.wikimedia.org/wiki/File:Everett_-_County_Campus.jpg"
        )
        self.assertIn(">CC BY-SA 3.0</a>", share_alike)
        self.assertIn('href="https://creativecommons.org/licenses/by-sa/3.0/"', share_alike)
        self.assertIn(
            'href="https://commons.wikimedia.org/wiki/File:Everett_-_County_Campus.jpg"',
            share_alike,
        )

    def test_story_page_matches_post_chrome_and_stays_out_of_the_blog(self):
        story = {
            "title": "Edmonds permit desk hours",
            "date": "2026-10-14",
            "description": "What the Edmonds permit desk posted for homeowners this week.",
            "city": "Edmonds",
            "county": "Snohomish County",
            "slug": "edmonds-permit-desk-hours",
            "out_name": "edmonds-permit-desk-hours.html",
            "sources": ["https://www.edmondswa.gov/government/departments/development_services"],
            "hero": "",
            "alt": "Permit desk window",
            "body_md": "The desk posted new hours.\n",
        }
        html = gs.build_news_story_page(story, set())
        self.assertIn('"@type": "NewsArticle"', html)
        self.assertIn('"name": "Board of Project Stewardship"', html)
        self.assertIn("https://secure.lni.wa.gov/verify/", html)
        self.assertIn('id="news-sources"', html)
        self.assertIn(story["sources"][0], html)
        self.assertIn('id="another-story-cta"', html)
        self.assertNotIn('id="another-story-sea"', html)
        self.assertIn("editorial@boardofprojectstewardship.com", html)
        self.assertIsNone(gs.news_forbidden_term(html))
        self.assertNotIn("/posts/", html)
        index = gs.build_news_index([story])
        self.assertIn("./news/edmonds-permit-desk-hours.html", index)
        self.assertNotIn("First stories coming soon", index)
        self.assertNotIn("/posts/", index)
        self.assertIsNone(gs.news_forbidden_term(index))

    def test_missing_source_date_title_or_description_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            news = root / "news"
            news.mkdir()
            good = _story_md(
                title="Shoreline sidewalk closure",
                date="2026-10-14",
                description="A sidewalk closure notice for a Shoreline remodel corridor.",
                slug="shoreline-sidewalk-closure",
                sources=["https://www.shorelinewa.gov/"],
            )
            (news / "2026-10-14-shoreline-sidewalk-closure.md").write_text(good, encoding="utf-8")
            ready = intake.validate_news_library(root)
            self.assertTrue(ready["ok"], ready)

            for field, replacement, needle in (
                ("title", 'title: ""', "needs a title"),
                ("date", 'date: ""', "needs a YYYY-MM-DD date"),
                ("description", 'description: ""', "needs a description"),
                ("sources", "sources: []", "needs at least one source URL"),
            ):
                broken = good
                if field == "sources":
                    broken = good.replace("sources:\n  - https://www.shorelinewa.gov/", "sources: []")
                elif field == "title":
                    broken = good.replace('title: "Shoreline sidewalk closure"', 'title: ""')
                elif field == "date":
                    broken = good.replace('date: "2026-10-14"', 'date: ""')
                else:
                    broken = good.replace(
                        'description: "A sidewalk closure notice for a Shoreline remodel corridor."',
                        'description: ""',
                    )
                (news / "2026-10-14-shoreline-sidewalk-closure.md").write_text(broken, encoding="utf-8")
                failed = intake.validate_news_library(root)
                self.assertFalse(failed["ok"], field)
                self.assertTrue(any(needle in item["message"] for item in failed["errors"]), failed)

    def test_public_news_html_rejects_forbidden_words(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "news").mkdir()
            page = root / "news.html"
            for word in ("AI", "ChatGPT", "Gemini", "Higgsfield", "Ghost", "Netlify"):
                page.write_text(f"<html><p>The note mentions {word}.</p></html>\n", encoding="utf-8")
                failed = intake.validate_news_library(root)
                self.assertFalse(failed["ok"], word)
                self.assertEqual(failed["status"], "forbidden_public_copy")
                self.assertTrue(any(word in item["message"] for item in failed["errors"]), failed)

    def test_shared_slug_or_story_url_is_a_conflict(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "news").mkdir()
            (root / "posts").mkdir()
            slug = "shared-shoreline-note"
            (root / "news" / f"2026-10-14-{slug}.md").write_text(
                _story_md(
                    title="Shared Shoreline note",
                    date="2026-10-14",
                    description="A shoreline note that must not also be a blog post.",
                    slug=slug,
                    sources=["https://www.shorelinewa.gov/"],
                ),
                encoding="utf-8",
            )
            (root / "posts.json").write_text(json.dumps([{
                "title": "Shared Shoreline note",
                "slug": slug,
                "date": "2026-10-14",
                "path": f"./posts/2026-10-14-{slug}.html",
            }]), encoding="utf-8")
            overlap = gs.news_blog_overlap(root)
            self.assertTrue(any(slug in item for item in overlap), overlap)
            failed = intake.validate_news_library(root)
            self.assertEqual(failed["status"], "conflict")

            (root / "posts.json").write_text(json.dumps([{
                "title": "Other guide",
                "slug": "other-guide",
                "date": "2026-08-01",
                "path": "./posts/2026-08-01-other-guide.html",
            }]), encoding="utf-8")
            (root / "blog.html").write_text(
                '<a href="./news/shared-shoreline-note.html">Shared</a>\n',
                encoding="utf-8",
            )
            crossed = gs.news_blog_overlap(root)
            self.assertTrue(any("news/shared-shoreline-note.html" in item for item in crossed), crossed)

            (root / "blog.html").write_text("<html>blog index</html>\n", encoding="utf-8")
            (root / "news.html").write_text(
                '<a href="./posts/2026-08-01-other-guide.html">Guide</a>\n',
                encoding="utf-8",
            )
            crossed = gs.news_blog_overlap(root)
            self.assertTrue(any("posts/2026-08-01-other-guide.html" in item for item in crossed), crossed)

    def test_post_publish_does_not_plan_news_writes(self):
        result = intake.publish_packet(FIXTURE, ROOT, apply=False, force_lock=False)
        self.assertTrue(result["ok"], result)
        planned = " ".join(result["planned_writes"])
        self.assertIn("posts/", planned)
        self.assertNotIn("news/", planned)
        self.assertNotIn("news.html", planned)
        inbox = intake.validate_inbox(ROOT)
        self.assertTrue(inbox["news"]["ok"], inbox["news"])


if __name__ == "__main__":
    unittest.main()
