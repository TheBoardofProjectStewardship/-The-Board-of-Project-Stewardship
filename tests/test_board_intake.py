#!/usr/bin/env python3
"""Deterministic checks for the Board intake contract. No network. No live publish."""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
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


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _copy_bundle(root: Path, submission_id: str = "intake-contract-fixture", example: bool = True) -> Path:
    dest = root / "packet" / submission_id
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(FIXTURE, dest)
    manifest = _read_json(dest / "manifest.json")
    manifest["submission_id"] = submission_id
    if example:
        manifest["example"] = True
    else:
        manifest.pop("example", None)
    (dest / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    if submission_id != "intake-contract-fixture":
        text = (dest / "draft.md").read_text(encoding="utf-8")
        (dest / "draft.md").write_text(text, encoding="utf-8")
    return dest


def _rewrite_slug(packet: Path, slug: str, title: str | None = None) -> None:
    manifest = _read_json(packet / "manifest.json")
    old_slug = manifest["post"]["slug"]
    old_title = manifest["post"]["title"]
    manifest["post"]["slug"] = slug
    if title:
        manifest["post"]["title"] = title
    (packet / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    draft = (packet / "draft.md").read_text(encoding="utf-8")
    draft = draft.replace(f'slug: "{old_slug}"', f'slug: "{slug}"')
    if title:
        draft = draft.replace(f'title: "{old_title}"', f'title: "{title}"')
    (packet / "draft.md").write_text(draft, encoding="utf-8")
    seo = _read_json(packet / "seo.json")
    seo["slug"] = slug
    (packet / "seo.json").write_text(json.dumps(seo, indent=2) + "\n", encoding="utf-8")


def _stage_inbox(root: Path, submission_id: str, slug: str, title: str, example: bool = False) -> Path:
    packet = _copy_bundle(root, submission_id=submission_id, example=example)
    dest = root / "intake" / "inbox" / submission_id
    if dest.exists():
        shutil.rmtree(dest)
    shutil.move(str(packet), dest)
    _rewrite_slug(dest, slug, title)
    return dest


def _seed_site(root: Path) -> None:
    (root / "posts").mkdir(parents=True)
    (root / "blog").mkdir(parents=True)
    (root / "intake" / "inbox").mkdir(parents=True)
    (root / "intake" / "receipts").mkdir(parents=True)
    (root / "intake" / "lock").mkdir(parents=True)
    post = {
        "title": "Existing Guide",
        "date": "2026-08-01",
        "description": "Existing description long enough for the index guard fixture.",
        "category": "Guides",
        "slug": "existing-guide",
        "path": "./posts/2026-08-01-existing-guide.html",
        "author": intake.AUTHOR,
    }
    (root / "posts.json").write_text(json.dumps([post], indent=2) + "\n", encoding="utf-8")
    (root / "posts" / "2026-08-01-existing-guide.md").write_text(
        "---\n"
        'title: "Existing Guide"\n'
        'date: "2026-08-01"\n'
        'description: "Existing description long enough for the index guard fixture."\n'
        'category: "Guides"\n'
        'slug: "existing-guide"\n'
        "---\n\nExisting body that stays on the site.\n",
        encoding="utf-8",
    )
    (root / "posts" / "2026-08-01-existing-guide.html").write_text("<html>existing-post</html>\n", encoding="utf-8")
    (root / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        "  <url>\n"
        "    <loc>https://boardofprojectstewardship.com/</loc>\n"
        "    <lastmod>2026-09-21</lastmod>\n"
        "    <changefreq>weekly</changefreq>\n"
        "    <priority>1.0</priority>\n"
        "  </url>\n"
        "  <url>\n"
        "    <loc>https://boardofprojectstewardship.com/posts/2026-08-01-existing-guide.html</loc>\n"
        "    <lastmod>2026-08-01</lastmod>\n"
        "    <changefreq>weekly</changefreq>\n"
        "    <priority>0.6</priority>\n"
        "  </url>\n"
        "</urlset>\n",
        encoding="utf-8",
    )
    (root / "blog" / "rss.xml").write_text("<rss>old</rss>\n", encoding="utf-8")
    (root / "blog.html").write_text("<html>old-blog</html>\n", encoding="utf-8")
    (root / "roofing.html").write_text("<html>roofing</html>\n", encoding="utf-8")
    (root / "trades.html").write_text("<html>trades</html>\n", encoding="utf-8")


class IntakeValidationTests(unittest.TestCase):
    def test_categories_match_generator(self):
        self.assertEqual(set(intake.CATEGORIES), set(gs.CATEGORY_HERO_FALLBACK))

    def test_fixture_validates_ready_and_is_not_applyable(self):
        result = intake.validate_packet(FIXTURE, ROOT)
        self.assertTrue(result["ok"], result)
        self.assertEqual(result["status"], "ready")
        self.assertFalse(result["publishable"])
        self.assertTrue(result["idempotency_key"].startswith("sha256:"))
        applied = intake.publish_packet(FIXTURE, ROOT, apply=True, force_lock=False)
        self.assertFalse(applied["ok"])
        self.assertEqual(applied["status"], "not_publishable")
        self.assertFalse((ROOT / "posts" / "2026-09-22-intake-contract-fixture.md").exists())

    def test_cli_dry_run_writes_nothing(self):
        before = hashlib.sha256((ROOT / "posts.json").read_bytes()).hexdigest()
        proc = subprocess.run(
            [sys.executable, str(ROOT / "tools" / "board_intake.py"), "publish", str(FIXTURE), "--dry-run"],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr + proc.stdout)
        payload = json.loads(proc.stdout)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["status"], "ready")
        self.assertTrue(payload["dry_run"])
        self.assertEqual(payload["wrote"], [])
        self.assertIn("posts/2026-09-22-intake-contract-fixture.md", payload["planned_writes"])
        after = hashlib.sha256((ROOT / "posts.json").read_bytes()).hexdigest()
        self.assertEqual(before, after)
        self.assertNotIn("OPERATOR-NOTE-NOT-FOR-HTML", proc.stdout)

    def test_cloudfront_media_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            packet = _copy_bundle(root, example=False)
            draft = (packet / "draft.md").read_text(encoding="utf-8")
            draft = draft.replace(
                "../assets/images/posts/intake-contract-fixture-1.webp",
                "https://d8j0ntlcm91z4.cloudfront.net/example.png",
            )
            (packet / "draft.md").write_text(draft, encoding="utf-8")
            result = intake.validate_packet(packet, root)
            self.assertFalse(result["ok"])
            self.assertEqual(result["status"], "media_path_rejected")

    def test_forbidden_public_copy_and_secret_are_not_echoed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            packet = _copy_bundle(root, example=False)
            draft = (packet / "draft.md").read_text(encoding="utf-8")
            (packet / "draft.md").write_text(draft + "\nChatGPT wrote this.\n", encoding="utf-8")
            result = intake.validate_packet(packet, root)
            self.assertEqual(result["status"], "forbidden_public_copy")
            seo = _read_json(packet / "seo.json")
            seo["notes"] = "api_key: supersecretvalue123"
            (packet / "seo.json").write_text(json.dumps(seo) + "\n", encoding="utf-8")
            secret = intake.validate_packet(packet, root)
            self.assertEqual(secret["status"], "secret_material")
            blob = json.dumps(secret)
            self.assertNotIn("supersecretvalue123", blob)

    def test_specialty_mismatch_and_missing_sources(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            packet = _copy_bundle(root, example=False)
            manifest = _read_json(packet / "manifest.json")
            manifest["producer"] = "ollama"
            (packet / "manifest.json").write_text(json.dumps(manifest) + "\n", encoding="utf-8")
            mismatch = intake.validate_packet(packet, root)
            self.assertEqual(mismatch["status"], "specialty_mismatch")
            packet = _copy_bundle(root, submission_id="missing-sources", example=False)
            (packet / "sources.json").write_text(
                json.dumps({"producer": "hermes", "sources": []}) + "\n",
                encoding="utf-8",
            )
            missing = intake.validate_packet(packet, root)
            self.assertEqual(missing["status"], "missing_sources")

    def test_duplicate_slug_and_target_site(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _seed_site(root)
            posts = json.loads((root / "posts.json").read_text(encoding="utf-8"))
            posts.append({
                "title": "Intake Contract Fixture for Shoreline Roof Flashing",
                "slug": "intake-contract-fixture",
                "date": "2026-09-22",
                "path": "./posts/2026-09-22-intake-contract-fixture.html",
            })
            (root / "posts.json").write_text(json.dumps(posts) + "\n", encoding="utf-8")
            packet = _copy_bundle(root, example=False)
            dup = intake.validate_packet(packet, root)
            self.assertEqual(dup["status"], "duplicate")
            manifest = _read_json(packet / "manifest.json")
            manifest["target"]["site"] = "https://pacificprogroup.com/"
            (packet / "manifest.json").write_text(json.dumps(manifest) + "\n", encoding="utf-8")
            rejected = intake.validate_packet(packet, root)
            self.assertEqual(rejected["status"], "target_site_rejected")

    def test_specialist_packet_is_accepted_not_publishable(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            packet = root / "sources-only"
            packet.mkdir()
            manifest = {
                "schema_version": "1.0.0",
                "submission_id": "sources-only",
                "kind": "sources",
                "producer": "hermes",
                "created_at": "2026-09-22T00:00:00Z",
                "target": {"site": "https://boardofprojectstewardship.com/", "content_type": "note"},
                "artifacts": {"sources": "sources.json"},
            }
            (packet / "manifest.json").write_text(json.dumps(manifest) + "\n", encoding="utf-8")
            (packet / "sources.json").write_text(
                json.dumps({"producer": "hermes", "sources": []}) + "\n",
                encoding="utf-8",
            )
            result = intake.validate_packet(packet, root)
            self.assertTrue(result["ok"], result)
            self.assertEqual(result["status"], "accepted")
            published = intake.publish_packet(packet, root, apply=True, force_lock=False)
            self.assertEqual(published["status"], "not_publishable")

    def test_uncited_draft(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            packet = _copy_bundle(root, example=False)
            draft = (packet / "draft.md").read_text(encoding="utf-8")
            draft = draft.replace("https://mybuildingpermit.com/", "the regional portal")
            (packet / "draft.md").write_text(draft, encoding="utf-8")
            result = intake.validate_packet(packet, root)
            self.assertEqual(result["status"], "uncited_draft")


class PublishTests(unittest.TestCase):
    def test_apply_updates_indexes_and_replays(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _seed_site(root)
            packet = _copy_bundle(root, submission_id="apply-shoreline-flashing", example=False)
            _rewrite_slug(packet, "apply-shoreline-flashing", "Apply Shoreline Flashing Fixture Guide")
            manifest = _read_json(packet / "manifest.json")
            manifest["post"]["description"] = (
                "Apply fixture for Shoreline flashing checks, permit paths, and licensed roofer shortlists."
            )
            (packet / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
            draft = (packet / "draft.md").read_text(encoding="utf-8")
            draft = draft.replace(
                'description: "Fixture guide for Shoreline roof flashing, permit checks, and how a homeowner shortlists licensed roofers without invented prices."',
                'description: "Apply fixture for Shoreline flashing checks, permit paths, and licensed roofer shortlists."',
            )
            (packet / "draft.md").write_text(draft, encoding="utf-8")
            dry = intake.publish_packet(packet, root, apply=False, force_lock=False)
            self.assertEqual(dry["status"], "dry_run", dry)
            self.assertFalse((root / "posts" / "2026-09-22-apply-shoreline-flashing.md").exists())
            applied = intake.publish_packet(packet, root, apply=True, force_lock=False)
            self.assertTrue(applied["ok"], applied)
            self.assertEqual(applied["status"], "published")
            html = (root / "posts" / "2026-09-22-apply-shoreline-flashing.html").read_text(encoding="utf-8")
            self.assertIn("BlogPosting", html)
            self.assertIn("https://boardofprojectstewardship.com/posts/2026-09-22-apply-shoreline-flashing.html", html)
            self.assertIn("../assets/images/posts/intake-contract-fixture-1.webp", html)
            self.assertNotIn("cloudfront.net", html.lower())
            self.assertNotIn("OPERATOR-NOTE-NOT-FOR-HTML", html)
            self.assertNotIn("BOPS", html)
            self.assertIn("Board of Project Stewardship", html)
            posts = json.loads((root / "posts.json").read_text(encoding="utf-8"))
            slugs = [item["slug"] for item in posts]
            self.assertEqual(slugs[0], "apply-shoreline-flashing")
            self.assertIn("existing-guide", slugs)
            self.assertEqual(len(posts), 2)
            sitemap = (root / "sitemap.xml").read_text(encoding="utf-8")
            self.assertIn("2026-08-01-existing-guide.html", sitemap)
            self.assertIn("2026-09-22-apply-shoreline-flashing.html", sitemap)
            self.assertIn("<lastmod>2026-09-21</lastmod>", sitemap)
            rss = (root / "blog" / "rss.xml").read_text(encoding="utf-8")
            self.assertIn("apply-shoreline-flashing.html", rss)
            self.assertIn("existing-guide.html", rss)
            blog = (root / "blog.html").read_text(encoding="utf-8")
            self.assertIn("apply-shoreline-flashing", blog)
            self.assertIn("existing-guide", blog)
            self.assertEqual(
                (root / "posts" / "2026-08-01-existing-guide.html").read_text(encoding="utf-8"),
                "<html>existing-post</html>\n",
            )
            receipt = root / "intake" / "receipts" / "apply-shoreline-flashing.json"
            self.assertTrue(receipt.is_file())
            self.assertFalse((root / "intake" / "lock" / "publish.lock").exists())
            snapshot = hashlib.sha256((root / "posts.json").read_bytes()).hexdigest()
            replay = intake.publish_packet(packet, root, apply=True, force_lock=False)
            self.assertEqual(replay["status"], "idempotent_replay")
            self.assertEqual(snapshot, hashlib.sha256((root / "posts.json").read_bytes()).hexdigest())

    def test_lock_blocks_until_force_on_stale(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _seed_site(root)
            packet = _copy_bundle(root, submission_id="locked-bundle", example=False)
            _rewrite_slug(packet, "locked-bundle", "Locked Bundle Flashing Fixture Guide")
            lock = root / "intake" / "lock" / "publish.lock"
            lock.write_text(json.dumps({
                "holder": "steward",
                "submission_id": "other",
                "pid": 1,
                "acquired_at": "2026-09-22T00:00:00Z",
            }) + "\n", encoding="utf-8")
            blocked = intake.publish_packet(packet, root, apply=True, force_lock=False)
            self.assertEqual(blocked["status"], "lock_held")
            self.assertFalse((root / "posts" / "2026-09-22-locked-bundle.md").exists())
            lock.write_text(json.dumps({
                "holder": "steward",
                "submission_id": "other",
                "pid": 1,
                "acquired_at": intake._now(),
            }) + "\n", encoding="utf-8")
            fresh = intake.publish_packet(packet, root, apply=True, force_lock=True)
            self.assertEqual(fresh["status"], "lock_held", fresh)
            self.assertFalse((root / "posts" / "2026-09-22-locked-bundle.md").exists())
            lock.write_text(json.dumps({
                "holder": "steward",
                "submission_id": "other",
                "pid": 1,
                "acquired_at": "2020-01-01T00:00:00Z",
            }) + "\n", encoding="utf-8")
            forced = intake.publish_packet(packet, root, apply=True, force_lock=True)
            self.assertTrue(forced["ok"], forced)
            self.assertEqual(forced["status"], "published")

    def test_changed_bytes_conflict_after_publish(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _seed_site(root)
            packet = _copy_bundle(root, submission_id="conflict-bundle", example=False)
            _rewrite_slug(packet, "conflict-bundle", "Conflict Bundle Flashing Fixture Guide")
            first = intake.publish_packet(packet, root, apply=True, force_lock=False)
            self.assertEqual(first["status"], "published", first)
            draft = (packet / "draft.md").read_text(encoding="utf-8")
            (packet / "draft.md").write_text(draft + "\nAn extra cited sentence for the conflict check.\n", encoding="utf-8")
            second = intake.publish_packet(packet, root, apply=True, force_lock=False)
            self.assertEqual(second["status"], "conflict")

    def test_index_guard_and_sitemap_insert(self):
        before = [{"slug": "a"}, {"slug": "b"}]
        with self.assertRaises(intake.IntakeFailure) as raised:
            intake.guard_post_index(before, [{"slug": "a"}])
        self.assertEqual(raised.exception.code, "index_guard_failed")
        floor = [{"slug": f"p{i}"} for i in range(48)]
        with self.assertRaises(intake.IntakeFailure):
            intake.guard_post_index(floor, floor[:47])
        sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        updated = intake.insert_sitemap_post(sitemap, "2099-01-01-brand-new.html", "2099-01-01")
        self.assertIn("2099-01-01-brand-new.html", updated)
        posts = json.loads((ROOT / "posts.json").read_text(encoding="utf-8"))
        for post in posts:
            self.assertIn(post["path"].split("/")[-1], updated)
        self.assertLess(updated.index("2099-01-01-brand-new.html"), updated.index("2026-09-21-roof-replacement-edmonds-coastal-wa.html"))


class LiveSiteRegressionTests(unittest.TestCase):
    def test_forty_eight_post_index_is_intact(self):
        posts = json.loads((ROOT / "posts.json").read_text(encoding="utf-8"))
        self.assertEqual(len(posts), 48)
        loaded = gs.load_posts()
        self.assertEqual([p["slug"] for p in loaded], [p["slug"] for p in posts])
        rebuilt = [
            {
                "title": p["title"],
                "date": p["date"],
                "description": p["description"],
                "category": p["category"],
                "slug": p["slug"],
                "path": f"./posts/{p['out_name']}",
                "author": gs.AUTHOR,
            }
            for p in loaded
        ]
        self.assertEqual(rebuilt, posts)
        sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        rss = (ROOT / "blog" / "rss.xml").read_text(encoding="utf-8")
        blog = (ROOT / "blog.html").read_text(encoding="utf-8")
        for post in posts:
            name = post["path"].split("/")[-1]
            stem = name[: -len(".html")]
            self.assertTrue((ROOT / "posts" / f"{stem}.md").is_file(), stem)
            self.assertTrue((ROOT / "posts" / name).is_file(), name)
            self.assertIn(name, sitemap)
            self.assertIn(name, rss)
            self.assertEqual(post["author"], "Board of Project Stewardship Editorial")
        self.assertIn(posts[0]["slug"], blog)
        self.assertIn("Disallow: /intake/", (ROOT / "robots.txt").read_text(encoding="utf-8"))
        self.assertNotIn("cloudfront.net", (ROOT / "posts" / posts[0]["path"].split("/")[-1]).read_text(encoding="utf-8").lower())

    def test_refresh_keeps_repo_asset_html_and_live_bytes(self):
        self.assertTrue(gs.post_html_should_be_preserved(
            "<html>../assets/images/posts/a.webp</html>",
            "<html>https://cdn.cloudfront.net/a.png</html>",
        ))
        self.assertFalse(gs.post_html_should_be_preserved("<html>same</html>", "<html>same</html>"))
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            posts = root / "posts"
            posts.mkdir()
            dest = posts / "2026-01-01-sample.html"
            dest.write_text("<html>../assets/images/posts/sample.webp</html>", encoding="utf-8")
            (posts / "2026-01-01-sample.md").write_text("---\ntitle: Sample\n---\n", encoding="utf-8")
            previous_site = gs.SITE_DIR
            previous_build = gs.build_post_page
            gs.SITE_DIR = root
            gs.build_post_page = lambda post: "<html>https://cdn.cloudfront.net/sample.png</html>"
            try:
                gs.refresh_post_html([{
                    "title": "Sample",
                    "date": "2026-01-01",
                    "description": "Sample description for the preserve check.",
                    "category": "Guides",
                    "slug": "sample",
                    "body_md": "body",
                    "out_name": "2026-01-01-sample.html",
                    "source": "2026-01-01-sample.md",
                }])
            finally:
                gs.SITE_DIR = previous_site
                gs.build_post_page = previous_build
            self.assertIn("../assets/", dest.read_text(encoding="utf-8"))
            self.assertNotIn("cloudfront.net", dest.read_text(encoding="utf-8"))
        blobs = {path: path.read_bytes() for path in (ROOT / "posts").glob("*.html")}
        try:
            gs.refresh_post_html(gs.load_posts())
            for path, blob in blobs.items():
                self.assertEqual(path.read_bytes(), blob, path.name)
        finally:
            for path, blob in blobs.items():
                if path.exists() and path.read_bytes() != blob:
                    path.write_bytes(blob)


class MorningRoutineTests(unittest.TestCase):
    MORNING = "2026-09-22"

    def test_workflow_has_no_second_schedule(self):
        text = (ROOT / ".github" / "workflows" / "intake-validate.yml").read_text(encoding="utf-8")
        self.assertNotIn("\nschedule:", "\n" + text)
        self.assertNotIn("cron:", text)

    def test_empty_morning_skips_without_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _seed_site(root)
            result = intake.morning_run(root, apply=True, on_date=self.MORNING)
            self.assertTrue(result["ok"], result)
            self.assertEqual(result["status"], "skipped")
            self.assertFalse(result["commit"])
            self.assertEqual(result["schedule"]["when"], "10:00 AM PT")
            self.assertFalse(result["schedule"]["competing_schedule"])
            self.assertEqual(list((root / "posts").glob("2026-09-22*")), [])

    def test_one_bundle_dry_run_then_apply_then_replay(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _seed_site(root)
            _stage_inbox(
                root,
                "morning-one",
                "morning-one-flashing",
                "Morning One Flashing Fixture Guide",
            )
            (root / "intake" / "inbox" / "sources-only").mkdir()
            (root / "intake" / "inbox" / "sources-only" / "manifest.json").write_text(
                json.dumps({
                    "schema_version": "1.0.0",
                    "submission_id": "sources-only",
                    "kind": "sources",
                    "producer": "hermes",
                    "created_at": "2026-09-22T00:00:00Z",
                    "target": {"site": "https://boardofprojectstewardship.com/", "content_type": "note"},
                    "artifacts": {"sources": "sources.json"},
                }) + "\n",
                encoding="utf-8",
            )
            (root / "intake" / "inbox" / "sources-only" / "sources.json").write_text(
                json.dumps({"producer": "hermes", "sources": []}) + "\n",
                encoding="utf-8",
            )
            dry = intake.morning_run(root, apply=False, on_date=self.MORNING)
            self.assertEqual(dry["status"], "dry_run", dry)
            self.assertFalse(dry["commit"])
            self.assertEqual(dry["aggregation"]["selected"], "morning-one")
            self.assertIn("sources-only", dry["aggregation"]["specialist_packets"])
            self.assertFalse((root / "posts" / "2026-09-22-morning-one-flashing.md").exists())
            applied = intake.morning_run(root, apply=True, on_date=self.MORNING)
            self.assertEqual(applied["status"], "published", applied)
            self.assertTrue(applied["commit"])
            posts = json.loads((root / "posts.json").read_text(encoding="utf-8"))
            dated = [post["slug"] for post in posts if post["date"] == self.MORNING]
            self.assertEqual(dated, ["morning-one-flashing"])
            again = intake.morning_run(root, apply=True, on_date=self.MORNING)
            self.assertEqual(again["status"], "already_published", again)
            self.assertFalse(again["commit"])
            self.assertEqual(
                [post["slug"] for post in json.loads((root / "posts.json").read_text(encoding="utf-8")) if post["date"] == self.MORNING],
                ["morning-one-flashing"],
            )

    def test_two_bundles_publish_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _seed_site(root)
            _stage_inbox(root, "morning-a", "morning-a-flashing", "Morning A Flashing Fixture Guide")
            _stage_inbox(root, "morning-b", "morning-b-flashing", "Morning B Flashing Fixture Guide")
            result = intake.morning_run(root, apply=True, on_date=self.MORNING)
            self.assertFalse(result["ok"])
            self.assertEqual(result["status"], "multiple_ready")
            self.assertFalse(result["commit"])
            self.assertEqual(list((root / "posts").glob("2026-09-22*")), [])
            self.assertEqual(json.loads((root / "posts.json").read_text(encoding="utf-8"))[0]["slug"], "existing-guide")

    def test_invalid_bundle_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _seed_site(root)
            packet = _stage_inbox(root, "morning-bad", "morning-bad-flashing", "Morning Bad Flashing Fixture Guide")
            draft = (packet / "draft.md").read_text(encoding="utf-8")
            (packet / "draft.md").write_text(draft + "\nChatGPT\n", encoding="utf-8")
            result = intake.morning_run(root, apply=True, on_date=self.MORNING)
            self.assertFalse(result["ok"])
            self.assertEqual(result["status"], "forbidden_public_copy")
            self.assertEqual(result["wrote"], [])
            self.assertFalse(result["commit"])
            self.assertEqual(list((root / "posts").glob("2026-09-22*")), [])

    def test_cli_dry_run_on_empty_future_date_writes_nothing(self):
        before = hashlib.sha256((ROOT / "posts.json").read_bytes()).hexdigest()
        proc = subprocess.run(
            [
                sys.executable,
                str(ROOT / "tools" / "board_intake.py"),
                "morning",
                "--dry-run",
                "--date",
                "2099-01-01",
            ],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr + proc.stdout)
        payload = json.loads(proc.stdout)
        self.assertEqual(payload["status"], "skipped")
        self.assertFalse(payload["commit"])
        self.assertEqual(payload["schedule"]["routine"], "BOPS daily blog post")
        self.assertEqual(hashlib.sha256((ROOT / "posts.json").read_bytes()).hexdigest(), before)


if __name__ == "__main__":
    unittest.main()
