#!/usr/bin/env python3
"""The WordPress plugin: its script is built from the source files and is current, it leaks no globals,
its version numbers agree, and its PHP lints and passes its checks when a PHP binary is present."""
import importlib.util
import re
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "wordpress" / "ppg-build-here"
BUNDLE = PLUGIN / "assets" / "js" / "ppg-build-here.js"
PHP = shutil.which("php")


def build_module():
    spec = importlib.util.spec_from_file_location("ppgbh_build", ROOT / "wordpress" / "build.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class PluginScriptTests(unittest.TestCase):
    def test_the_shipped_script_matches_the_source_files(self):
        # A fix made in assets/js/ must reach the plugin. If this fails, run: python3 wordpress/build.py
        self.assertEqual(build_module().render(), BUNDLE.read_text(encoding="utf-8"))

    def test_the_script_adds_one_global_and_keeps_the_modules_private(self):
        js = BUNDLE.read_text(encoding="utf-8")
        self.assertNotIn("window.BuildHere", js)
        self.assertNotIn("root.BuildHere", js)
        self.assertEqual(re.findall(r"\bwindow\.(PPG\w+)\s*=", js), ["PPGBuildHere"])
        self.assertNotIn("module.exports = api", js)
        self.assertIn('attachShadow({ mode: "open" })', js)

    def test_the_embed_stylesheet_does_not_depend_on_the_theme(self):
        js = BUNDLE.read_text(encoding="utf-8")
        css = js[js.index("var CSS = "):js.index("var TEMPLATE = ")]
        self.assertNotRegex(css, r"(?<![\w.(-])\d*\.?\d+rem\b")          # every rem is a multiple of the tool's own unit
        self.assertNotIn("#bh-home", css)                                # the source site's homepage include
        self.assertNotRegex(css, r"@media \((max|min)-width")            # layout follows the tool's width
        self.assertIn("@container ppgbh (max-width:699px)", css)
        self.assertIn(".ppgbh{all:initial;", css)                        # inherited theme styles stop at the wrapper
        # A size container has no width of its own. Without this the tool is 0px wide in a content-sized parent.
        self.assertRegex(css, r"\.ppgbh\{all:initial;[^}]*container-type:inline-size;[^}]*contain-intrinsic-inline-size:288px")

    def test_the_test_page_carries_the_markup_the_shortcode_prints(self):
        php = (PLUGIN / "includes" / "class-ppgbh-shortcode.php").read_text(encoding="utf-8")
        page = (ROOT / "wordpress" / "tests" / "theme-page.html").read_text(encoding="utf-8")
        for name in ("FRAME_STYLE", "HOST_STYLE", "HOST_STYLE_FORM"):
            self.assertRegex(php, r"const %s\s*=\s*'[^']+';" % name)
        self.assertIn('<div class="ppgbh-frame" style="__FRAME_STYLE__"><div class="ppgbh-host" style="__HOST_STYLE__" data-ppgbh="__CONFIG__"><p class="ppgbh-fallback" style="margin:0">', page)
        self.assertEqual(page.count("__HOST_STYLE__"), 2)   # the page also carries an extra copy, as a cache can leave one
        self.assertIn("'<div class=\"ppgbh-frame\" style=\"' . esc_attr( self::FRAME_STYLE ) . '\">'", php)
        self.assertIn("'<p class=\"ppgbh-fallback\" style=\"margin:0\">'", php)

    def test_the_markup_has_every_id_the_script_looks_up(self):
        html = (ROOT / "wordpress" / "src" / "widget.html").read_text(encoding="utf-8")
        main = (ROOT / "assets" / "js" / "build-here.js").read_text(encoding="utf-8")
        ids = set(re.findall(r'id="(bh-[a-z0-9-]+)"', html))
        made_by_script = {"bh-lead-copy", "bh-lead-text"}   # created at run time by the email form
        wanted = set(re.findall(r'\$\("(bh-[a-z0-9-]+)"\)', main)) - made_by_script
        self.assertEqual(sorted(wanted - ids), [])
        self.assertEqual(len(ids), len(re.findall(r'id="bh-[a-z0-9-]+"', html)))  # no id twice

    def test_the_privacy_notice_says_the_address_reaches_the_map_servers(self):
        loader = (ROOT / "wordpress" / "src" / "loader.js").read_text(encoding="utf-8")
        built = BUNDLE.read_text(encoding="utf-8")
        readme = (PLUGIN / "README.md").read_text(encoding="utf-8")
        needle = "The matched address and the location of the lot then go from your browser to county, city and state map servers."
        self.assertIn(needle, loader)
        self.assertIn(needle, built)
        self.assertIn("The county parcel lookup is a search by street address.", readme)
        for text in (loader, built, readme):
            self.assertNotIn("The location of the lot then goes from", text)

    def test_version_numbers_agree(self):
        php = (PLUGIN / "ppg-build-here.php").read_text(encoding="utf-8")
        header = re.search(r"^\s*\*\s*Version:\s*(\S+)", php, re.M).group(1)
        const = re.search(r"define\( 'PPGBH_VERSION', '([^']+)' \)", php).group(1)
        readme = (PLUGIN / "readme.txt").read_text(encoding="utf-8")
        stable = re.search(r"^Stable tag:\s*(\S+)", readme, re.M).group(1)
        self.assertEqual({header, const, stable}, {header})
        self.assertIn('var VERSION = "%s";' % header, BUNDLE.read_text(encoding="utf-8"))
        # The guides name the same version: the changelog has an entry for it, and the install step names its zip.
        self.assertIn("\n= %s =\n" % header, readme)
        guide = (PLUGIN / "README.md").read_text(encoding="utf-8")
        self.assertEqual(re.findall(r"ppg-build-here-\d+\.\d+\.\d+\.zip", guide), ["ppg-build-here-%s.zip" % header])
        self.assertIn("- **%s** (" % header, guide)

    def test_a_missing_data_file_is_handled_in_the_shipped_script(self):
        """The plugin's script is built from the page's own reader, so it says the same plain words."""
        bundle = BUNDLE.read_text(encoding="utf-8")
        self.assertIn('var WHY = { missing: "was not found", unreadable: "could not be read", error: "could not be loaded" };', bundle)
        self.assertIn('fetch(CFG.dataBase + file, { credentials: "omit", signal: ctl.signal })', bundle)
        self.assertNotIn('throw new Error("HTTP " + r.status);\n      return r.json();\n    }).then(function (j) {\n      var rec', bundle)
        guide = (PLUGIN / "README.md").read_text(encoding="utf-8")
        for words in ('"was not found"', '"could not be read"', '"could not be loaded"'):
            self.assertIn("the data file " + words, guide)


@unittest.skipUnless(PHP, "no php binary on this machine")
class PluginPhpTests(unittest.TestCase):
    def test_every_php_file_lints(self):
        for path in sorted(PLUGIN.rglob("*.php")):
            done = subprocess.run([PHP, "-l", str(path)], capture_output=True, text=True)
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr)

    def test_cleaning_escaping_and_the_address_route(self):
        done = subprocess.run([PHP, str(ROOT / "wordpress" / "tests" / "php-smoke.php")], capture_output=True, text=True)
        self.assertEqual(done.returncode, 0, done.stdout[-3000:] + done.stderr)
        self.assertIn("all checks passed", done.stdout)

    def test_no_php_file_can_be_run_directly(self):
        for path in sorted(PLUGIN.rglob("*.php")):
            text = path.read_text(encoding="utf-8")
            self.assertTrue("defined( 'ABSPATH' )" in text or "defined( 'WP_UNINSTALL_PLUGIN' )" in text, path.name)


if __name__ == "__main__":
    unittest.main()
