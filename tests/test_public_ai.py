"""Public pages do not use the standalone word AI."""
from __future__ import annotations

import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PublicAiTests(unittest.TestCase):
    def test_no_standalone_ai_in_public_copy(self):
        subprocess.check_call(["python3", "scripts/check_public_ai.py"], cwd=ROOT)


if __name__ == "__main__":
    unittest.main()
