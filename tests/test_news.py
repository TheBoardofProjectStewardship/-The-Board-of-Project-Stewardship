#!/usr/bin/env python3
"""News is its own section. The intake contract checks it the way it checks posts."""
from __future__ import annotations

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
        self.assertEqual(stories[0]["date"], "2026-10-19")
        self.assertEqual(stories[1]["date"], "2026-10-18")
        self.assertEqual(stories[2]["date"], "2026-10-18")
        self.assertEqual(stories[3]["date"], "2026-10-17")
        self.assertEqual(stories[4]["date"], "2026-10-16")
        self.assertEqual(stories[5]["date"], "2026-10-16")
        self.assertEqual(stories[6]["date"], "2026-10-15")
        self.assertEqual(stories[7]["date"], "2026-10-14")
        self.assertTrue(stories[0]["title"])
        self.assertTrue(stories[0]["description"])
        self.assertGreaterEqual(len(stories[0]["sources"]), 1)
        self.assertIn("ECTran71", stories[0]["hero_credit"])
        self.assertIn("Illustration", stories[1]["hero_credit"])
        self.assertIn("Joe Mabel", stories[2]["hero_credit"])
        self.assertIn("Joe Mabel", stories[3]["hero_credit"])
        self.assertEqual(stories[4]["hero_credit"], "")
        self.assertIn("SounderBruce", stories[5]["hero_credit"])
        self.assertIn("Robert Ashworth", stories[6]["hero_credit"])
        self.assertIn("Emersb", stories[7]["hero_credit"])
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
            ],
        )
        result = intake.validate_news_library(ROOT)
        self.assertTrue(result["ok"], result)
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["stories"], 8)
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
        baker_url = "https://boardofprojectstewardship.com/news/mount-baker-redevelopment-groundbreaking.html"
        eca_url = "https://boardofprojectstewardship.com/news/seattle-environmentally-critical-areas-update.html"
        tree_url = "https://boardofprojectstewardship.com/news/edmonds-landmark-tree-ordinance-extension.html"
        panel_url = "https://boardofprojectstewardship.com/news/king-county-permitting-advisory-panel.html"
        panel_href = "./news/king-county-permitting-advisory-panel.html"
        shed_url = "https://boardofprojectstewardship.com/news/mountlake-terrace-shed-permit-exemption-flat-fees.html"
        shed_href = "./news/mountlake-terrace-shed-permit-exemption-flat-fees.html"
        lead = news_html.split('class="news-lead"', 1)[1].split("</article>", 1)[0]
        self.assertIn(shed_href, lead)
        self.assertIn("./news/pacific-pro-group-bronze-best-in-the-pnw.html", news_html)
        self.assertIn(panel_href, news_html)
        self.assertIn(stories[0]["title"], lead)
        self.assertIn("October 19, 2026", lead)
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
            "Illustrative: a hillside home set back from a wooded ravine and creek in Seattle",
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

        rss = (ROOT / "news" / "rss.xml").read_text(encoding="utf-8")
        self.assertIn("Board of Project Stewardship News", rss)
        self.assertIn("<item>", rss)
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
        self.assertNotIn("/news/", blog_rss)
        self.assertNotIn('"path": "./news/', posts_json)
        self.assertNotIn("./posts/", news_html)
        self.assertIn(">News</a>", (ROOT / "blog.html").read_text(encoding="utf-8"))
        self.assertIn("Pacific Pro Group", (ROOT / "index.html").read_text(encoding="utf-8"))

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
