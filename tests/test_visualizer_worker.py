"""Worker policy tests run under Node so the existing unittest suite covers them."""
from __future__ import annotations

import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class VisualizerWorkerTests(unittest.TestCase):
    def test_policy_suite(self):
        node = shutil.which("node")
        self.assertIsNotNone(node, "node is required to test the worker")
        subprocess.check_call(
            [node, "--test", "worker/test/policy.test.js", "worker/test/api.test.js"],
            cwd=ROOT,
        )


if __name__ == "__main__":
    unittest.main()
