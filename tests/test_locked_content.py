"""Locked homepage copy stays byte-identical."""
from __future__ import annotations

import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class LockedContentTests(unittest.TestCase):
    def test_manifest_matches_homepage_and_generator(self):
        subprocess.check_call(["python3", "scripts/check_locked_content.py"], cwd=ROOT)


if __name__ == "__main__":
    unittest.main()
