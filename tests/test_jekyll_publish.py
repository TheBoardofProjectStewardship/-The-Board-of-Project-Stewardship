"""Runtime fetches must survive the GitHub Pages Jekyll build."""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_checker():
    path = ROOT / "scripts" / "check_jekyll_publish.py"
    spec = importlib.util.spec_from_file_location("check_jekyll_publish", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


class JekyllPublishTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_checker()
        text = (ROOT / "_config.yml").read_text(encoding="utf-8")
        cls.excludes, cls.includes = cls.mod.load_jekyll_lists(text)

    def test_runtime_fetches_and_stamp_are_published(self):
        paths = {rel for _src, rel in self.mod.runtime_paths()}
        self.assertIn("assets/data/house-size", paths)
        self.assertIn("search-index.json", paths)
        self.assertIn("posts.json", paths)
        self.assertNotIn("data/house-size", paths)
        self.assertEqual(self.mod.check(ROOT), [])

    def test_exclude_prefix_matches_jekyll_3_9(self):
        published = self.mod.published
        excludes = ["pages", "data", "posts/*.md"]
        self.assertFalse(published("pages-build-stamp.txt", excludes, []))
        self.assertTrue(published("pages-build-stamp.txt", excludes, ["pages-build-stamp.txt"]))
        self.assertFalse(published("data/house-size/king/277.json", excludes, []))
        self.assertTrue(published("assets/data/house-size/king/277.json", excludes, []))
        self.assertFalse(published("posts/example.md", excludes, []))
        self.assertTrue(published("posts.json", excludes, []))
        self.assertIn("pages-build-stamp.txt", self.includes)
        self.assertTrue(published("pages-build-stamp.txt", self.excludes, self.includes))
        self.assertFalse(published("data/build-here/jurisdictions.json", self.excludes, self.includes))
        self.assertTrue(
            published("assets/data/house-size/king/277.json", self.excludes, self.includes)
        )


if __name__ == "__main__":
    unittest.main()
