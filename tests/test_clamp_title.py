#!/usr/bin/env python3
"""Document titles keep the city and the full headline."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import generate_site as gs  # noqa: E402


class ClampTitleTests(unittest.TestCase):
    def test_short_title_keeps_the_board_suffix(self):
        title = "Search | Board of Project Stewardship"
        self.assertEqual(gs.clamp_title(title), title)

    def test_suffix_is_dropped_before_any_headline_word(self):
        headline = "Siding Replacement Bellevue WA — When the City Requires a Permit"
        full = f"{headline} | Board of Project Stewardship"
        self.assertGreater(len(full), 60)
        self.assertEqual(gs.clamp_title(full), headline)
        self.assertIn("Bellevue WA", gs.clamp_title(full))

    def test_long_headline_is_not_cut(self):
        headline = (
            "Heat Pump Installation Bothell, WA — Mechanical Permit, "
            "L&I Electrical Permit & Where the Outdoor Unit Can Go"
        )
        got = gs.clamp_title(f"{headline} | Board of Project Stewardship")
        self.assertEqual(got, headline)
        self.assertIn("Bothell, WA", got)

    def test_news_headline_stays_whole(self):
        headline = "King County names advisory panel to speed up permits for homes and businesses"
        got = gs.clamp_title(f"{headline} | Board of Project Stewardship")
        self.assertEqual(got, headline)


if __name__ == "__main__":
    unittest.main()
