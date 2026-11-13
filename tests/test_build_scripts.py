#!/usr/bin/env python3
"""The data builders: what the King County index holds, how it is published, and the data-hold check."""
import importlib.util
import io
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / (name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


KC = load("build_kc_resbldg_index")
HOLDS = load("check_data_holds")

ROWS = [
    {"Major": "123", "Minor": "45", "SqFtTotLiving": "1800", "YrBuilt": "1925", "Stories": "1.5", "SqFt1stFloor": "1100", "SqFtGarageAttached": "0", "SqFtGarageBasement": "240"},
    {"Major": "123", "Minor": "45", "SqFtTotLiving": "800", "YrBuilt": "2015", "Stories": "2", "SqFt1stFloor": "400", "SqFtGarageAttached": "0", "SqFtGarageBasement": "0"},
    {"Major": "987654", "Minor": "3210", "SqFtTotLiving": "2400", "YrBuilt": "1978", "Stories": "1", "SqFt1stFloor": "2400", "SqFtGarageAttached": "420", "SqFtGarageBasement": ""},
    {"Major": "987654", "Minor": "3211", "SqFtTotLiving": "0", "YrBuilt": "1990", "Stories": "1", "SqFt1stFloor": "900"},
    {"Major": "987654", "Minor": "3212", "SqFtTotLiving": "not a number"},
]


def zip_of(rows):
    buf = io.BytesIO()
    cols = ["Major", "Minor", "SqFtTotLiving", "YrBuilt", "Stories", "SqFt1stFloor", "SqFtGarageAttached", "SqFtGarageBasement"]
    text = ",".join(cols) + "\n" + "\n".join(",".join(str(r.get(c, "")) for c in cols) for r in rows) + "\n"
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("EXTR_ResBldg.csv", text)
    return buf.getvalue()


class KingCountyIndexTests(unittest.TestCase):
    def test_a_parcel_with_two_buildings_is_summed_and_says_so(self):
        shards, n = KC.aggregate(ROWS)
        self.assertEqual(n, 3)  # the zero and the unreadable living areas are left out, not stored as 0
        rec = shards["00"]["0001230045"]
        self.assertEqual(rec, [2600, 1925, 2, 1500, 240, 2])
        self.assertEqual(shards["98"]["9876543210"], [2400, 1978, 1.0, 2400, 420, 1])
        self.assertNotIn("9876543211", shards["98"])
        self.assertNotIn("9876543212", shards["98"])

    def test_a_failed_download_leaves_the_published_index_alone(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "kc-resbldg"
            KC.build(out, min_parcels=1, fetch=lambda: (zip_of(ROWS), "2026-10-14"))
            before = {p.name: p.read_text() for p in out.iterdir()}
            self.assertEqual(sorted(before), ["00.json", "98.json", "_meta.json"])
            shard = json.loads(before["00.json"])
            self.assertEqual(shard["srcDate"], "2026-10-14")
            self.assertEqual(shard["b"]["0001230045"][5], 2)

            def down():
                raise OSError("connection reset")

            with self.assertRaises(OSError):
                KC.build(out, min_parcels=1, fetch=down)
            self.assertEqual({p.name: p.read_text() for p in out.iterdir()}, before)
            # A truncated file that parses to almost nothing does not replace a full index either.
            with self.assertRaises(SystemExit):
                KC.build(out, min_parcels=1000, fetch=lambda: (zip_of(ROWS[:1]), ""))
            self.assertEqual({p.name: p.read_text() for p in out.iterdir()}, before)

    def test_a_new_index_replaces_the_old_one_whole(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "kc-resbldg"
            KC.build(out, min_parcels=1, fetch=lambda: (zip_of(ROWS), ""))
            KC.build(out, min_parcels=1, fetch=lambda: (zip_of(ROWS[2:3]), ""))
            self.assertEqual(sorted(p.name for p in out.iterdir()), ["98.json", "_meta.json"])  # shard 00 is gone with its parcels
            self.assertEqual([p.name for p in Path(tmp).iterdir()], ["kc-resbldg"])  # no .tmp or .old left behind
            meta = json.loads((out / "_meta.json").read_text())
            self.assertEqual(meta["fields"][5], "buildingRecords")
            self.assertEqual(meta["parcels"], 1)

    def test_the_page_reads_the_building_count_and_the_file_date(self):
        js = (ROOT / "assets/js/build-here.js").read_text(encoding="utf-8")
        self.assertIn("Number(rec[5])", js)
        self.assertIn("the sum of", js)
        self.assertIn("j.srcDate", js)
        self.assertNotIn('", as of " + j.asOf', js)


class DataHoldTests(unittest.TestCase):
    MANIFEST = ROOT / "data/build-here/data-holds.json"
    WORKFLOW = ROOT / ".github/workflows/house-size-index.yml"
    SNOH = "assets/data/house-size/snoh"

    def tree(self, tmp, files=(), clearance=None, holds=None):
        """This tree's manifest in an empty folder. `holds` replaces its entries. `clearance` is written on every entry."""
        root = Path(tmp)
        manifest = json.loads(self.MANIFEST.read_text(encoding="utf-8"))
        if holds is not None:
            manifest["holds"] = holds
        if clearance:
            for h in manifest["holds"]:
                h["clearance"] = clearance
        (root / "data/build-here").mkdir(parents=True)
        (root / "data/build-here/data-holds.json").write_text(json.dumps(manifest), encoding="utf-8")
        for rel in files:
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text("{}", encoding="utf-8")
        return root

    def test_this_tree_publishes_no_held_dataset(self):
        code, lines = HOLDS.check(ROOT)
        self.assertEqual(code, 0, lines)

    def test_a_held_dataset_fails_and_an_unverified_one_warns(self):
        with tempfile.TemporaryDirectory() as tmp:
            code, lines = HOLDS.check(self.tree(tmp, ["assets/data/sno-bldg/00.json"]))
            self.assertEqual(code, 1)
            self.assertTrue(any(l.startswith("::error::assets/data/sno-bldg") for l in lines), lines)
        # A dataset nobody has decided on yet: a warning on the run, and an error under --strict.
        undecided = [{"path": "assets/data/example", "status": "unverified", "reason": "Where these files come from is not recorded.", "clearance": ""}]
        with tempfile.TemporaryDirectory() as tmp:
            root = self.tree(tmp, ["assets/data/example/00.json"], holds=undecided)
            code, lines = HOLDS.check(root)
            self.assertEqual(code, 0)
            self.assertTrue(any(l.startswith("::warning::assets/data/example") for l in lines), lines)
            self.assertEqual(HOLDS.check(root, strict=True)[0], 1)
        with tempfile.TemporaryDirectory() as tmp:
            root = self.tree(tmp, ["assets/data/sno-bldg/00.json", "assets/data/house-size/snoh/00.json"], clearance="County records officer, 2026-12-01")
            self.assertEqual(HOLDS.check(root, strict=True)[0], 0)

    def test_the_snohomish_house_size_files_stay_published_by_owner_decision(self):
        """Review finding C4. The owner decided on 2026-11-13 to keep these files. The decision is on record,
        so the weekly run passes with no warning, with or without --strict."""
        holds = {h["path"]: h for h in json.loads(self.MANIFEST.read_text(encoding="utf-8"))["holds"]}
        self.assertIn("owner", holds[self.SNOH]["clearance"].lower())
        self.assertIn("2026-11-13", holds[self.SNOH]["clearance"])
        # The record says what was decided and does not claim more: nobody checked where the files come from.
        self.assertIn("did not check the source", holds[self.SNOH]["clearance"])
        with tempfile.TemporaryDirectory() as tmp:
            root = self.tree(tmp, [self.SNOH + "/00.json", self.SNOH + "/01.json"])
            for strict in (False, True):
                code, lines = HOLDS.check(root, strict=strict)
                self.assertEqual(code, 0, lines)
                self.assertFalse([l for l in lines if l.startswith(("::warning::", "::error::"))], lines)
                self.assertTrue(any(l.startswith("ok") and self.SNOH + ": 2 files, cleared (Site owner decision of 2026-11-13" in l for l in lines), lines)
        # The decision covers that folder only. The index built from the county improvement records stays held.
        self.assertEqual((holds["assets/data/sno-bldg"]["status"], holds["assets/data/sno-bldg"]["clearance"]), ("held", ""))

    def test_the_weekly_workflow_still_builds_and_publishes_the_whole_house_size_folder(self):
        wf = self.WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("run: python3 scripts/build_index.py --out assets/data/house-size\n", wf)
        self.assertIn("git add assets/data/house-size\n", wf)
        # No step takes the Snohomish files out again. The folder is named in a comment only.
        steps = [line for line in wf.splitlines() if not line.lstrip().startswith("#")]
        self.assertEqual([line for line in steps if "snoh" in line or "git rm" in line or "rm -r" in line], [])

    def test_the_weekly_workflow_runs_the_check_before_it_commits(self):
        wf = self.WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("python3 scripts/check_data_holds.py", wf)
        self.assertLess(wf.index("scripts/check_data_holds.py"), wf.index("git commit"))
        done = subprocess.run([sys.executable, str(ROOT / "scripts/check_data_holds.py")], capture_output=True, text=True)
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)


if __name__ == "__main__":
    unittest.main()
