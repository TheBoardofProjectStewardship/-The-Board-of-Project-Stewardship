#!/usr/bin/env python3
"""Run every browser scenario against this tree and check what each one found.

    python3 tests/e2e/run_all.py            # all scenarios
    python3 tests/e2e/run_all.py wp king    # only the named ones

Each scenario opens the real page in headless Chrome and answers every outside service itself
(US Census, county and city map servers, USGS, OpenStreetMap, Esri, Google, the three.js CDN), so the
run needs no network and never sends a real address anywhere. The stand-in answers are small made-up
lots whose correct result is known, which is what makes the numbers checkable.

Needs: Python 3.9 or newer with Playwright, and a Chrome or Chromium that Playwright can start.
Takes about six minutes. Exit code 1 if any check fails.
"""
import ast
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
failures = []


def check(name, ok, detail=""):
    print(("  ok    " if ok else "  FAIL  ") + name + ("" if ok or detail == "" else "   [" + str(detail)[:300] + "]"))
    if not ok:
        failures.append(name)


def last_dict(text):
    """The last {...} printed by a scenario, as JSON or as a Python literal."""
    start = text.rfind("\n{")
    start = 0 if text.startswith("{") and start < 0 else start + 1
    blob = text[start:text.rfind("}") + 1]
    try:
        return json.loads(blob)
    except ValueError:
        return ast.literal_eval(blob)


def run(script, port, out=None, extra=()):
    args = [sys.executable, "-I", str(HERE / script), str(REPO)]
    if out is not None:
        args.append(str(out))
    if port:
        args.append(str(port))
    done = subprocess.run(args + list(extra), capture_output=True, text=True, timeout=420)
    if done.returncode != 0:
        print(done.stdout[-1500:], done.stderr[-1500:])
    return done.returncode, done.stdout


def s_interact(tmp):
    rc, out = run("interact_pw.py", 8765)
    check("the repository's own interaction script passes", rc == 0)


def s_edmonds(tmp):
    rc, out = run("scn_edmonds.py", 8771, tmp / "edmonds")
    check("ran", rc == 0)
    check("the house roof is counted once, clipped to the lot (2,000 sf)", "House footprint (on this lot) = 2,000 sf" in out)
    check("coverage room is the true 960 sf", "[READY] Addition :: 960 sf coverage room" in out)
    m = re.search(r"overlay desktop: (\{.*\})", out)
    o = json.loads(m.group(1)) if m else {}
    check("the parcel outline is drawn where the parcel is in the photo", bool(o) and o.get("lotInPhotoPx") == o.get("outlineDrawnPx"), o)
    check("no page errors", "page errors: []" in out)


def s_king(tmp):
    rc, out = run("scn_king.py", 8772, tmp / "king")
    check("ran", rc == 0)
    b1 = out[out.find("=== B1"):out.find("=== B2")]
    check("B1: the lot nearest the address point is used, not the first one returned", "parcel: 2222222222" in b1, b1[:300])
    check("B1: a location match is flagged on the first screen", "warn: ['" in b1 or 'warn: ["' in b1, b1[:600])
    check("B2: the city zoning map drives the math", "zone: NR3" in out[out.find("=== B2"):out.find("=== B3")])
    b4 = out[out.find("=== B4"):out.find("=== B5")]
    check("B4: a city with no coded zones has no Ready build cards", "[PARTIAL] Addition :: Zoning not coded" in b4 and "[PARTIAL] ADU :: State-law floor only" in b4 and "[READY] Addition" not in b4)
    d = json.loads((tmp / "king" / "king.json").read_text()) if rc == 0 else {}
    b2 = d.get("B2", {})
    check("B2: a data file that is there fills the house size, with its source and date", (b2.get("existing") or "").startswith("1,400 sf") and "King County Assessor residential building extract" in b2["existing"] and b2.get("hint", "").startswith("From: King County Assessor") and all(c["state"] == "ready" for c in b2.get("cards", [{"state": ""}])), b2.get("existing"))
    for tag, shard, words, what in (("B5", "77", "was not found", "a data file that is not there"), ("B6", "88", "could not be read", "a web page sent in place of a data file"), ("B7", "99", "could not be loaded", "a request for the data file that fails")):
        r = d.get(tag, {})
        cards = {c["title"]: c["state"] for c in r.get("cards", [])}
        check("%s: %s leaves the house size out, and the study is whole" % (tag, what), r.get("existing") == "Not entered" and r.get("pages") == b2.get("pages") and len(cards) == 5 and cards.get("Remodel") == "partial" and cards.get("ADU") == "ready", [r.get("existing"), r.get("pages"), cards])
        said = "The data file for this parcel (kc-resbldg/%s.json) %s. Living area, year built and stories were not filled in from it." % (shard, words)
        check("%s: the page says why in plain words, with no status code or parser message" % tag, any(t.endswith(said) for t in r.get("tried", [])) and "could not be loaded, so this box was not filled in" in r.get("hint", "") and r.get("raw") == [], [r.get("tried"), r.get("hint"), r.get("raw")])
    check("B5 to B7: a data file that is not there is asked for once", [d.get("fileRequests", {}).get(k) for k in ("77", "88", "99")] == [1, 1, 1], d.get("fileRequests"))
    b8, b9, other = d.get("B8", {}), d.get("B9", {}), d.get("otherHost", [])
    check("B8: a data host that does not let this site read its files: the browser keeps the answer, the house size is left out, the study is whole",
          b8.get("existing") == "Not entered" and b8.get("pages") == b2.get("pages") and any("(kc-resbldg/44.json) could not be loaded. " in t for t in b8.get("tried", [])) and b8.get("raw") == [] and other[:1] == [["/files/kc-resbldg/44.json", 200, "no header"]], [b8.get("existing"), b8.get("tried"), other])
    check("B9: the same host once it sends the header: the figure is read from it", (b9.get("existing") or "").startswith("2,700 sf") and other[1:] == [["/files/kc-resbldg/44.json", 200, "header sent"]] and d.get("fileRequestsOnThisSiteInB8B9") == {}, [b9.get("existing"), other])
    check("no page errors", "page errors: []" in out)


def s_print(tmp):
    rc, out = run("scn_print.py", 8773, tmp / "print")
    d = json.loads((tmp / "print" / "print.json").read_text()) if rc == 0 else {}
    check("ran", rc == 0)
    check("a page that only loads the stylesheet still prints its own content", d.get("hostPrint", {}).get("heading") == "visible" and d["hostPrint"]["button"] == "visible" and d["hostPrint"]["tdPrefix"] == "none", d.get("hostPrint"))
    check("the browser's own Print command prepares the study", d.get("beforeprintFiredByPdf") == 1 and 8 <= d.get("toolPrintPagesViaBrowserCommand", 0) <= 14, d.get("toolPrintPagesViaBrowserCommand"))
    check("the print copy has every study page, no form and no duplicate ids", d.get("printHost", {}).get("pages") == 10 and d["printHost"]["hasEditForm"] is False and d["printHost"]["duplicateIds"] == 0, d.get("printHost"))


def s_homeprint(tmp):
    rc, out = run("scn_homeprint.py", 8775, tmp / "homeprint")
    check("ran", rc == 0)
    check("the option cards are on the printed copy", "'cardsInCopy': 5" in out and "'firstCardOpacityAtPrint': '1'" in out, out[-200:])


def s_xss(tmp):
    rc, out = run("scn_xss.py", 8776)
    check("ran", rc == 0)
    check("markup in a map-service attribute is shown as text", "'scriptRan': False" in out and "'injectedImgTags': 0" in out, out[-200:])


def s_slow(tmp):
    rc, out = run("scn_slow.py", 8777)
    d = last_dict(out) if rc == 0 else {}
    check("ran", rc == 0)
    check("a busy OpenStreetMap server does not hold the study", d.get("secondsToStudy", 99) < 8 and d.get("cards") == 5, d)
    check("only the two public Overpass servers are asked", sorted(d.get("overpassHostsAsked", [])) == ["overpass-api.de", "overpass.kumi.systems"], d.get("overpassHostsAsked"))


def s_privacy(tmp):
    rc, out = run("scn_privacy.py", 8778)
    d = last_dict(out) if rc == 0 else {}
    check("ran", rc == 0)
    check("an address in the page link is taken out of the link", "address" not in d.get("urlAfterDeepLink", "address"), d.get("urlAfterDeepLink"))
    check("Google is called only after the visitor asks for the map, and with the point", d.get("googleRequestsAfterReadingTheStudy") == [] and len(d.get("googleRequestsAfterAskingForTheMap", [])) == 1 and "q=47.81" in d["googleRequestsAfterAskingForTheMap"][0], d.get("googleRequestsAfterAskingForTheMap"))
    check("nothing is left in local storage", d.get("seedInLocalStorage") is False)


def s_config(tmp):
    rc, out = run("scn_config.py", 8779)
    d = last_dict(out) if rc == 0 else {}
    check("ran", rc == 0)
    check("the data files come from the configured address", d.get("shardFetchedFrom") == ["data.example.com"], d.get("shardFetchedFrom"))
    check("the configured brand is on the study and the saved file", d.get("footerBrand") == ["Pacific Pro Group"] and d.get("downloadHeader") == "Pacific Pro Group")
    check("this site's rankings links are gone when switched off", d.get("rankingsCta") is False and d.get("massingLink") is False and d.get("siteLinksInStudy") == [])


def s_sno_street(tmp):
    rc, out = run("scn_sno_street.py", 8780)
    d = last_dict(out) if rc == 0 else {}
    check("ran", rc == 0)
    check("a same-number address on another street is not used", str(d.get("parcelUsed", "")).startswith("HERE-121-SUNSET"), d.get("parcelUsed"))
    check("the location match is said on the first screen", len(d.get("warningOnFirstScreen", [])) == 1)


def s_geometry(tmp):
    rc, out = run("scn_geometry.py", 8781, tmp / "geometry")
    d = json.loads((tmp / "geometry" / "geometry.json").read_text()) if rc == 0 else {}
    check("ran", rc == 0)
    check("corner lot: one front, one street side, one side, one rear", d.get("G1", {}).get("edges") == {"front": 1, "street": 1, "side": 1, "rear": 1}, d.get("G1", {}).get("edges"))
    check("corner lot: the envelope is 30 x 70 ft", "2,100 sf" in str(d.get("G1", {}).get("envelope")), d.get("G1", {}).get("envelope"))
    check("two-ring parcel: the lot is drawn, not the sliver", "2,800 sf" in str(d.get("G2", {}).get("envelope")), d.get("G2", {}).get("envelope"))
    check("the setback figures are in a text key", any("Front" in x for x in d.get("G1", {}).get("key", [])))
    check("no page errors", d.get("pageErrors") == [])


def s_services(tmp):
    rc, out = run("scn_services.py", 8783, tmp / "services")
    d = json.loads((tmp / "services" / "services.json").read_text()) if rc == 0 else {}
    check("ran", rc == 0)
    s1 = d.get("S1", {})
    check("S1: with a relay, the browser never calls the Census and loads no script from it", "geocoding.geo.census.gov" not in s1.get("hosts", ["geocoding.geo.census.gov"]) and s1.get("scriptTagsToCensus") == 0)
    check("S1: OpenStreetMap off means no request to it, and the Google map page is gone", not any("overpass" in h for h in s1.get("hosts", ["overpass"])) and s1.get("mapPage") is False)
    check("S1: lot area from a mapped outline is Medium and shows the record acreage", "Medium" in str(s1.get("lotRow")) and "0.23 acres" in str(s1.get("lotRow")), s1.get("lotRow"))
    check("S1: a permit row shows no row id and no project name", s1.get("projectNameShown") is False and s1.get("rowIdShownAsPermit") is False, s1.get("permitRow"))
    s2 = d.get("S2", {})
    check("S2: a neighbor's parcel, recording and permit numbers are not printed", s2.get("neighborPinPrinted") is False and s2.get("recordingNumberPrinted") is False and s2.get("permitNumberPrinted") is False and len(s2.get("neighborFlag", [])) == 1, s2)
    s3 = d.get("S3", {})
    check("S3: the oldest year built is shown and raises the old-materials flag", str(s3.get("yearBuilt", "")).startswith("1925") and "2015" in s3["yearBuilt"] and len(s3.get("asbestosFlag", [])) == 1, s3.get("yearBuilt"))
    check("S3: a figure summed from two building records says so", "sum of 2 building records" in str(s3.get("existing")), s3.get("existing"))
    s4 = d.get("S4", {})
    for typed in ("-5000", "0.25 acres", "12 000"):
        row = s4.get(typed, {})
        check("S4: %r is not read as a lot size" % typed, bool(row.get("fieldError")) and row.get("ariaInvalid") == "true" and "-" not in str(row.get("coverageCap", "")), row)
    check("S4: '5,000 sf' is read as 5000", s4.get("5,000 sf", {}).get("fieldError") in ("", None) and "5,000 sf" in str(s4.get("5,000 sf", {}).get("lotRow")), s4.get("5,000 sf"))
    check("S5: a relay that is down falls back to the browser", str(d.get("S5", {}).get("status", "")).startswith("Found") and d["S5"]["censusFromBrowser"] is True, d.get("S5"))
    check("S5b: with the fallback off, the visitor is told the lookup did not finish", "did not finish" in str(d.get("S5b", {}).get("status")) and d["S5b"]["esriCalled"] is False, d.get("S5b"))
    check("no page errors", d.get("pageErrors") == [] and s1.get("pageErrors") == [])


def s_resilience(tmp):
    rc, out = run("scn_resilience.py", 8789, tmp / "resilience")
    d = json.loads((tmp / "resilience" / "resilience.json").read_text()) if rc == 0 else {}
    check("ran", rc == 0)
    check("R1: a failed county photo is replaced by World Imagery, with its credit", d.get("R1", {}).get("img", {}).get("host") == "services.arcgisonline.com" and d["R1"]["img"]["loaded"] is True and "Esri World Imagery" in str(d["R1"].get("caption")), d.get("R1"))
    check("R2: with no photo at all, the parcel diagram is shown and the page says why", d.get("R2", {}).get("img") is None and d["R2"]["diagram"] is True and "did not load" in str(d["R2"].get("note")), d.get("R2"))
    check("R3: Download says what was saved", str(d.get("R3", {}).get("status", "")).startswith("Saved feasibility-study-"), d.get("R3"))
    check("R4: the sample study does not answer on another host", d.get("R4", {}).get("host") == "widget.example" and d["R4"]["cards"] == 0, d.get("R4"))
    check("R5: focus survives removing a typed number", d.get("R5", {}).get("focusOn") == "bh-man-kind" and "Removed" in d["R5"]["note"], d.get("R5"))
    check("R6: card titles are one level under their heading, and the edit link moves focus", any(h.startswith("H4: ") for h in d.get("R6", {}).get("headings", [])) and d["R6"]["afterEditLink"]["focus"] == "bh-step2", d.get("R6", {}).get("headings"))
    check("R7: Copy reports a failure and shows the text", d.get("R7", {}).get("textShown") is True, d.get("R7"))
    check("no page errors", d.get("pageErrors") == [])


def s_3d(tmp):
    rc, out = run("scn_3d.py", 8795, tmp / "sketch")
    d = json.loads((tmp / "sketch" / "sketch.json").read_text()) if rc == 0 else {}
    check("ran (with a stand-in for three.js)", rc == 0)
    rows = d.get("T1", {}).get("rows", {})
    check("T1: the stand-in house box is not judged against the setbacks", rows.get("Inside setbacks") == "No box has been placed yet" and "Existing house box" in rows, rows)
    check("T2: a box whose corners are inside an L-shaped envelope but whose wall is not is caught", "past the envelope" in str(d.get("T2", {}).get("rows")), d.get("T2"))
    check("T3: a box can be moved by typing, and the number boxes have names", "inside" in str(d.get("T3", {}).get("atCenter")) and "past" in str(d["T3"].get("after15ftEast")) and all(d["T3"]["inputLabels"]), d.get("T3"))
    check("T4: an idle scene is not redrawn", d.get("T4", {}).get("rendersInIdle700ms") == 0, d.get("T4"))
    check("T5 and T6: no WebGL, or no 3D library, gets a message", "WebGL" in str(d.get("T5", {}).get("info")) and "did not load" in str(d.get("T6", {}).get("info")))


def s_wp(tmp):
    rc, out = run("scn_wp.py", 0, tmp / "wp")
    d = json.loads((tmp / "wp" / "wp.json").read_text()) if rc == 0 else {}
    check("ran", rc == 0)
    w1, w2, w3, w4, w5 = (d.get(k, {}) for k in ("W1", "W2", "W3", "W4", "W5"))
    check("W1: one name is added to window, and no tool id is in the page document", w1.get("addedToWindow") == ["PPGBuildHere"] and w1.get("toolGlobals") == [] and w1.get("idsInPageDocument") == 0, w1)
    check("W2: theme rules do not reach the input, the button or the cards", w2.get("input", {}).get("border") == "1px rgb(138, 148, 160)" and w2["input"]["width"] > 300 and w2["button"]["background"] == "rgb(15, 76, 129)" and w2["card"]["display"] == "block" and w2["hiddenSection"]["display"] == "none", w2.get("input"))
    check("W2: the tool is 16px on a 10px-root theme, with no inherited letter spacing or capitals", w2.get("wrapper", {}).get("fontSize") == "16px" and w2["card"]["letterSpacing"] == "normal" and w2["card"]["textTransform"] == "none")
    check("W3: a lookup through the site's relay draws five cards, and the browser never calls the Census", len(w3.get("cards", [])) == 5 and w3.get("censusCalledFromBrowser") is False and json.loads(w3.get("relayBody") or "{}").get("address") == "100 First St, Seattle, WA 98103")
    check("W3: data comes from the uploads folder, and the brand and call to action are the site's", w3.get("dataPaths") == ["/wp-content/uploads/ppg-build-here/kc-resbldg/44.json"] and w3.get("footBrand") == "Pacific Pro Group" and w3["cta"][1] == ["Request a consultation -> https://ppg.example/contact/"], w3.get("cta"))
    check("W3: the theme's own elements are unchanged", w3.get("themeUnchanged") is True)
    check("W4: the layout follows the tool's width, not the screen's", w4.get("wide", {}).get("colsTemplate") == 2 and w4["column420onDesktop"]["colsTemplate"] == 1 and w4["column420onDesktop"]["tdDisplay"] == "block", w4.get("column420onDesktop"))
    check("W4: nothing of the tool is wider than a 390px phone", w4.get("phone390", {}).get("widest", 1) <= 0 and w4.get("phoneToolRightEdge", 999) <= 390, w4.get("phone390"))
    check("W5: the saved file carries the site's brand and none of the source site's", w5.get("brandHeader") is True and w5.get("contactLine") is True and w5.get("boardNameInFile") is False and w5.get("boardDomainInFile") is False)
    pr = w5.get("print") or {}
    check("W5: print works from inside the shadow root", pr.get("hasShadow") is True and pr.get("pages") == 10 and pr.get("cardOpacity") == "1" and pr.get("themeHeadingDisplay") == "none" and pr.get("buttons") == 0 and 8 <= w5.get("printPages", 0) <= 16 and w5.get("printHostRemoved") is True, pr)
    check("W6: the edit link works inside the shadow root, and a second shortcode stays empty and takes no room", d.get("W6", {}).get("editLink", {}).get("focus") == "bh-step2" and d["W6"]["secondShortcode"]["shadow"] is False and d["W6"]["secondShortcode"]["text"] == "" and d["W6"]["secondShortcode"]["height"] == 0, d.get("W6"))
    check("W7: a closed relay falls back to the browser, and a rate limit is reported", d.get("W7", {}).get("cards") == 5 and d["W7"]["censusCalledFromBrowser"] is True and "too many lookups" in d["W7"]["tooMany"], d.get("W7"))
    w8 = d.get("W8", {})
    check("W8: dark cards, a pale brand color (dark button text) and the email form", w8.get("card", {}).get("background") == "rgb(20, 20, 20)" and w8["button"]["color"] == "rgb(17, 24, 39)" and w8["lead"][0] is False, w8.get("vars"))
    w9 = d.get("W9", {})
    check("W9: settings that carry markup or script links do nothing", w9.get("scriptRan") is None and w9.get("imagesFromSettings") == 0 and w9.get("brandShownAsText") is True and w9.get("scriptSchemeLinks") == 0 and w9.get("savedFileHasLiveMarkup") is False, w9)
    w10 = d.get("W10", {})
    check("W10: the page below the tool does not move when the script runs, from a 320px phone to a desktop", len(w10) == 6 and all(-2 <= r["moved"] <= 24 for r in w10.values()), {k: r.get("moved") for k, r in w10.items()})
    check("W10: the reserve is not much taller than the tool it holds", all(-24 <= r["spare"] <= 130 for r in w10.values()), {k: r.get("spare") for k, r in w10.items()})
    w11 = d.get("W11", {})
    check("W11: in a layout that is only as wide as its content the tool keeps a phone's width, not zero", len(w11) == 3 and all(280 <= r["toolWidth"] <= 320 and r["buttonWidth"] > 100 and r["toolHeight"] < 1200 for r in w11.values()), w11)
    w12 = d.get("W12", {})
    for label, words, asked in (("the folder was never uploaded", "was not found", ["/wp-content/uploads/ppg-build-here/kc-resbldg/44.json"]), ("a web page sent with status 200", "could not be read", ["/wp-content/uploads/ppg-build-here/kc-resbldg/44.json"]),
                                ("a data address on a host that cannot be read", "could not be loaded", ["files.example/ppg/kc-resbldg/44.json"])):
        r = w12.get(label, {})
        said = "The data file for this parcel (kc-resbldg/44.json) %s. Living area, year built and stories were not filled in from it." % words
        check("W12: %s: the study is whole and the house size is left out" % label, r.get("cards") == 5 and r.get("pages") == 11 and r.get("existing") == "Not entered" and r.get("status", "").startswith("Found 100 FIRST ST"), [r.get("status"), r.get("cards"), r.get("pages"), r.get("existing")])
        check("W12: %s: the reason is in plain words, asked for once, with no script error" % label, any(t.endswith(said) for t in r.get("tried", [])) and "could not be loaded, so this box was not filled in" in r.get("hint", "") and r.get("raw") == [] and r.get("dataRequests") == asked and r.get("pageErrors") == [], [r.get("tried"), r.get("hint"), r.get("raw"), r.get("dataRequests"), r.get("pageErrors")])
    check("no page errors", d.get("pageErrors") == [] and w9.get("pageErrors") == [])


SCENARIOS = [("interact", s_interact), ("edmonds", s_edmonds), ("king", s_king), ("sno_street", s_sno_street), ("geometry", s_geometry), ("services", s_services),
             ("resilience", s_resilience), ("print", s_print), ("homeprint", s_homeprint), ("xss", s_xss), ("slow", s_slow), ("privacy", s_privacy), ("config", s_config),
             ("3d", s_3d), ("wp", s_wp)]


def main():
    want = set(sys.argv[1:])
    with tempfile.TemporaryDirectory(prefix="bh-e2e-") as tmp:
        for name, fn in SCENARIOS:
            if want and name not in want:
                continue
            print(name)
            try:
                fn(Path(tmp))
            except Exception as e:  # a scenario that crashed is a failed scenario, not a failed run
                check("scenario completed", False, repr(e))
    total = "%d check(s) failed: %s" % (len(failures), "; ".join(failures)) if failures else "all checks passed"
    print("\n" + total)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
