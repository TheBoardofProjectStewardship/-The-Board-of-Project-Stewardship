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
                "mount-baker-redevelopment-groundbreaking",
                "snohomish-county-administrative-lot-splits",
                "snohomish-health-septic-permit-grant",
            ],
        )
        self.assertEqual(stories[0]["date"], "2026-10-16")
        self.assertEqual(stories[1]["date"], "2026-10-15")
        self.assertEqual(stories[2]["date"], "2026-10-14")
        self.assertTrue(stories[0]["title"])
        self.assertTrue(stories[0]["description"])
        self.assertGreaterEqual(len(stories[0]["sources"]), 1)
        self.assertIn("SounderBruce", stories[0]["hero_credit"])
        self.assertIn("Robert Ashworth", stories[1]["hero_credit"])
        self.assertIn("Emersb", stories[2]["hero_credit"])
        self.assertTrue((ROOT / "news" / "_template.md").is_file())
        self.assertEqual(
            sorted(path.name for path in (ROOT / "news").glob("[0-9]*.md")),
            [
                "2026-10-14-snohomish-health-septic-permit-grant.md",
                "2026-10-15-snohomish-county-administrative-lot-splits.md",
                "2026-10-16-mount-baker-redevelopment-groundbreaking.md",
            ],
        )
        result = intake.validate_news_library(ROOT)
        self.assertTrue(result["ok"], result)
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["stories"], 3)
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
        baker_url = "https://boardofprojectstewardship.com/news/mount-baker-redevelopment-groundbreaking.html"
        baker_href = "./news/mount-baker-redevelopment-groundbreaking.html"
        lead = news_html.split('class="news-lead"', 1)[1].split("</article>", 1)[0]
        self.assertIn(baker_href, lead)
        self.assertIn(stories[0]["title"], lead)

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
        for source in stories[0]["sources"]:
            self.assertIn(source, baker)
        emails = set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", baker))
        self.assertEqual(emails, {"editorial@boardofprojectstewardship.com"})
        self.assertIsNone(gs.news_forbidden_term(baker))
        self.assertNotIn("/posts/", baker)

        rss = (ROOT / "news" / "rss.xml").read_text(encoding="utf-8")
        self.assertIn("Board of Project Stewardship News", rss)
        self.assertIn("<item>", rss)
        self.assertIn(story_url, rss)
        self.assertIn(lot_url, rss)
        self.assertIn(baker_url, rss)
        self.assertNotIn("/posts/", rss)

        sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        self.assertIn("https://boardofprojectstewardship.com/news.html", sitemap)
        self.assertIn(story_url, sitemap)
        self.assertIn(lot_url, sitemap)
        self.assertIn(baker_url, sitemap)
        blog_rss = (ROOT / "blog" / "rss.xml").read_text(encoding="utf-8")
        posts_json = (ROOT / "posts.json").read_text(encoding="utf-8")
        self.assertNotIn("snohomish-health-septic-permit-grant", blog_rss)
        self.assertNotIn("snohomish-health-septic-permit-grant", posts_json)
        self.assertNotIn("snohomish-county-administrative-lot-splits", blog_rss)
        self.assertNotIn("snohomish-county-administrative-lot-splits", posts_json)
        self.assertNotIn("mount-baker-redevelopment-groundbreaking", blog_rss)
        self.assertNotIn("mount-baker-redevelopment-groundbreaking", posts_json)
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
