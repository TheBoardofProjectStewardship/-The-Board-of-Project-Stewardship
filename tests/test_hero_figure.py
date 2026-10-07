"""Hero images must not be repeated as the first body figure."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import generate_site as gs


class HeroFigureTests(unittest.TestCase):
    def test_same_path_is_removed(self):
        html = (
            '<figure class="post-figure"><img src="../assets/images/posts/a.webp" alt="x"></figure>'
            "<p>keep</p>"
        )
        out = gs._strip_leading_hero_figure(html, "assets/images/posts/a.webp")
        self.assertNotIn("<figure", out)
        self.assertIn("keep", out)

    def test_different_path_stays(self):
        html = '<figure class="post-figure"><img src="../assets/images/posts/a.webp" alt="x"></figure>'
        out = gs._strip_leading_hero_figure(html, "assets/images/posts/b.webp")
        self.assertIn("<figure", out)

    def test_same_bytes_are_removed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            hero = root / "assets" / "images" / "posts"
            hero.mkdir(parents=True)
            (hero / "hero.webp").write_bytes(b"same-bytes")
            (hero / "body.webp").write_bytes(b"same-bytes")
            previous = gs.SITE_DIR
            gs.SITE_DIR = root
            try:
                html = '<figure class="post-figure"><img src="../assets/images/posts/body.webp" alt="x"></figure><p>keep</p>'
                out = gs._strip_leading_hero_figure(html, "assets/images/posts/hero.webp")
            finally:
                gs.SITE_DIR = previous
        self.assertNotIn("<figure", out)
        self.assertIn("keep", out)


if __name__ == "__main__":
    unittest.main()
