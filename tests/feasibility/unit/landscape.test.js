/* Unit tests for assets/js/build-here-landscape.js with the public services replaced by a local stand-in.
   node tests/unit/landscape.test.js
   No network: every request the module makes is answered by fakeFetch() below. */
"use strict";
var t = require("./_t.js");
globalThis.BuildHereGeom = require("../../../assets/feasibility/build-here-geom.js");
var G = globalThis.BuildHereGeom;

/* A 60 ft x 120 ft lot in Snohomish County, with the house on it and a neighbor's roof next door. */
var LAT = 47.82, LON = -122.2;
var fr = G.frame(LAT, LON);
function ll(x, y) { return fr.inv(x, y); }
function rect(x0, y0, x1, y1) { return [ll(x0, y0), ll(x1, y0), ll(x1, y1), ll(x0, y1), ll(x0, y0)]; }
var LOT = [rect(-30, -60, 30, 60)];
var HOUSE = rect(-20, -10, 20, 20);          // 40 x 30 = 1,200 sf, holds the address point
var SHED = rect(-25, 40, -13, 52);           // 12 x 12 = 144 sf, on the lot
var NEIGHBOR = rect(45, -10, 85, 20);        // next door, off the lot
var SLIVER = rect(29, -58, 31.5, -50);       // the neighbor's parking pad, 1 ft of it over the line (about 8 sf)

var calls = [];
function res(body) { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(body); } }); }
function way(tags, ring) { return { type: "way", tags: tags, geometry: ring.map(function (p) { return { lon: p[0], lat: p[1] }; }) }; }
var OSM = {
  elements: [
    way({ building: "house" }, HOUSE),
    way({ building: "shed" }, SHED),
    way({ building: "yes" }, NEIGHBOR),
    way({ highway: "residential", name: "Maple Ave" }, [ll(-200, -85), ll(200, -85)]),
    way({ highway: "service", service: "alley" }, [ll(-200, 72), ll(200, 72)]),
    way({ highway: "service", service: "driveway" }, [ll(0, -85), ll(0, -12)]),
    way({ highway: "footway", footway: "sidewalk" }, [ll(-200, -66), ll(200, -66)]),
    way({ highway: "footway" }, [ll(-200, -70), ll(200, -70)]),
    { type: "node", lon: ll(18, 45)[0], lat: ll(18, 45)[1], tags: { natural: "tree" } },
    { type: "node", lon: ll(0, 0)[0], lat: ll(0, 0)[1], tags: { amenity: "bench" } }
  ]
};
var mode = { roof: "neighbor", osm: "ok", parking: false };
function fakeFetch(url, opt) {
  calls.push({ url: String(url), body: opt && opt.body ? String(opt.body) : "" });
  var u = String(url);
  if (/roofprints/.test(u)) return res({ features: mode.roof === "neighbor" ? [{ geometry: { rings: [NEIGHBOR] } }] : mode.roof === "house" ? [{ geometry: { rings: [HOUSE] } }, { geometry: { rings: [NEIGHBOR] } }] : [] });
  if (/MSBFP2/.test(u)) return res({ features: [] });
  if (/overpass/.test(u)) {
    if (mode.osm !== "ok") return Promise.resolve({ ok: false, status: 504, json: function () { return Promise.resolve({}); } });
    var o = { elements: OSM.elements.slice() };
    if (mode.parking) o.elements.push(way({ amenity: "parking" }, SLIVER));
    return res(o);
  }
  if (/getSamples/.test(u)) {
    // A plane that falls 6 ft across the lot's 120 ft depth (5%), toward the street on the south side.
    var q = decodeURIComponent((opt.body.match(/geometry=([^&]*)/) || [])[1] || "{}");
    var pts = JSON.parse(q).points || [];
    return res({ samples: pts.map(function (p, i) { var xy = fr.fwd(p); return { locationId: i, value: String((100 + xy[1] * 0.05) / 3.28084), resolution: 1 }; }) });
  }
  return res({ features: [] });
}
globalThis.fetch = fakeFetch;
var L = require("../../../assets/feasibility/build-here-landscape.js");

function study() { return { rings: LOT, lon: LON, lat: LAT, county: "Snohomish County", stateAbbr: "WA", juris: "sno-uninc", lot: 7200, lotSrc: "County assessor", address: "123 Maple Ave" }; }
function row(r, key) { return r.rows.filter(function (x) { return x.key === key; })[0]; }

(async function () {
  /* ---- parsing OpenStreetMap ---- */
  var p = L._osmParse(OSM);
  t.ok("three buildings are read from OpenStreetMap", p.buildings.length === 3, p.buildings.length);
  t.ok("a named street is context, not a driveway", p.streets.filter(function (s) { return s.kind === "street" && s.name === "Maple Ave"; }).length === 1);
  t.ok("a tagged alley is kept as an alley and is not counted as this lot's driveway", p.streets.filter(function (s) { return s.kind === "alley"; }).length === 1 && p.drives.length === 1);
  t.ok("only a tagged sidewalk is drawn as a sidewalk", p.sidewalks.length === 1, p.sidewalks.length);
  t.ok("a mapped tree is kept, a bench is not", p.trees.length === 1, p.trees.length);
  t.ok("an empty answer parses to empty lists", L._osmParse(null).buildings.length === 0 && L._osmParse({}).trees.length === 0);

  /* ---- a county layer with only the neighbor's roof does not hide the house ---- */
  var r = await L.analyze(study());
  t.ok("the study finishes", r.ok === true, r.notes);
  var house = row(r, "house");
  t.ok("the house comes from the next source when the county layer has only the neighbor's roof", house && house.sf != null && t.near(house.sf, 1200, 60), house);
  t.ok("the source named on the house row is the one that was used", /OpenStreetMap/.test(house.src), house.src);
  t.ok("the shed is listed apart from the house", (row(r, "garage") && row(r, "garage").sf != null) || (row(r, "otherbld") && row(r, "otherbld").sf != null));
  var g = r.geo;
  t.ok("geometry is returned for the site plan", !!g && !!g.lot && g.lot[0].length === 5);
  t.ok("the lot outline is in feet around the lot centre", t.near(G.area(g.lot), 7200, 8), g && G.area(g.lot));
  var roles = g.buildings.map(function (b) { return b.role; }).sort().join(",");
  t.ok("each outline has a role: house, accessory, neighbor", /house/.test(roles) && /neighbor/.test(roles) && /(other|garage)/.test(roles), roles);
  var gh = g.buildings.filter(function (b) { return b.role === "house"; })[0];
  t.ok("the house outline carries its full and on-lot areas", gh && t.near(gh.sf, 1200, 12) && t.near(gh.sfOnLot, 1200, 60), gh && [gh.sf, gh.sfOnLot]);
  t.ok("a neighbor's outline has no on-lot area (not 0)", g.buildings.filter(function (b) { return b.role === "neighbor"; })[0].sfOnLot === null);
  t.ok("streets, sidewalk and tree are passed through", g.streets.length === 2 && g.sidewalks.length === 1 && g.trees.length === 1, [g.streets.length, g.sidewalks.length, g.trees.length]);
  t.ok("the street keeps its name", g.streets.some(function (s) { return s.name === "Maple Ave" && s.kind === "street"; }));
  t.ok("the driveway centerline is passed with its assumed width", g.driveLines.length === 1 && g.driveLines[0].widthFt === 10);
  t.ok("the address point is in the frame", g.point && t.near(g.point[0], 0, 0.5) && t.near(g.point[1], 0, 0.5), g.point);
  t.ok("a context elevation grid is returned", g.dem && g.dem.nx > 3 && g.dem.ny > 3 && g.dem.vals.length === g.dem.nx * g.dem.ny, g.dem && [g.dem.nx, g.dem.ny]);
  t.ok("the context grid reaches past the lot lines", g.dem.x0 <= -69 && g.dem.y0 <= -99 && g.dem.x0 + (g.dem.nx - 1) * g.dem.step >= 69, g.dem && [g.dem.x0, g.dem.y0, g.dem.step]);
  t.ok("the context grid is at most 484 points", g.dem.vals.length <= 484, g.dem.vals.length);
  t.ok("elevations are feet", t.near(g.dem.vals[0], 100 + g.dem.y0 * 0.05, 0.05), g.dem.vals[0]);
  t.ok("the slope grid moves to the geometry and off the slope record", !!g.demFine && r.slope && r.slope.grid === undefined);
  t.ok("slope is still measured", r.slope && r.slope.ok && t.near(r.slope.fallPct, 5, 0.6), r.slope && r.slope.fallPct);
  t.ok("the roof layer is asked for the outline only", calls.some(function (c) { return /roofprints/.test(c.url) && /outFields=OBJECTID/.test(c.url + c.body); }) && !calls.some(function (c) { return /roofprints/.test(c.url) && /outFields=%2A/.test(c.url + c.body); }));
  t.ok("OpenStreetMap is asked once", calls.filter(function (c) { return /overpass/.test(c.url); }).length === 1);
  t.ok("the request asks for streets and trees with the buildings", /natural%3Dtree/.test(calls.filter(function (c) { return /overpass/.test(c.url); })[0].body) && /way%5Bhighway%5D/.test(calls.filter(function (c) { return /overpass/.test(c.url); })[0].body));
  var drive = row(r, "drive");
  t.ok("a mapped driveway centerline is an estimate, at least 10 sf", drive && drive.est === true && drive.sf >= 10, drive);

  /* ---- the county layer is used when it has the house ---- */
  mode.roof = "house";
  var r2 = await L.analyze(study());
  t.ok("the county layer is used when it has a building on the lot", /Snohomish County roof outlines/.test(row(r2, "house").src), row(r2, "house").src);
  t.ok("its neighbor is still drawn as a neighbor", r2.geo.buildings.filter(function (b) { return b.role === "neighbor"; }).length === 1);

  /* ---- no source has a building: say so, never 0 ---- */
  mode.roof = "none"; mode.osm = "down";
  var r3 = await L.analyze(study());
  var h3 = row(r3, "house");
  t.ok("no outline on the lot is unavailable, not 0 sf", h3 && h3.sf === null, h3);
  t.ok("the driveway is unavailable when OpenStreetMap is down, not 0 sf", row(r3, "drive").sf === null);
  t.ok("open area is not computed from a zero house", row(r3, "land").sf === null);
  t.ok("the site plan still gets the lot", !!r3.geo && !!r3.geo.lot && r3.geo.streets.length === 0);

  /* ---- a sliver of the neighbor's paving is not this lot's driveway ---- */
  mode.roof = "house"; mode.osm = "ok"; mode.parking = true;
  var saved = OSM.elements;
  OSM.elements = saved.filter(function (e) { return !(e.tags && e.tags.service === "driveway"); });
  var r4 = await L.analyze(study());
  var d4 = row(r4, "drive");
  t.ok("under 15 sf of mapped paving inside the lot lines is left blank, not printed as 0 sf", d4 && d4.sf === null && /sliver/.test(d4.src), d4);
  OSM.elements = saved; mode.parking = false;

  /* ---- the address point decides which building is the house ---- */
  var bigShop = rect(-28, 25, 28, 58);        // 56 x 33 = 1,848 sf, larger than the house
  OSM.elements = [way({ building: "house" }, HOUSE), way({ building: "yes" }, bigShop)];
  mode.roof = "none";
  var r5 = await L.analyze(study());
  var h5 = r5.geo.buildings.filter(function (b) { return b.role === "house"; })[0];
  t.ok("the building at the address point is the house even when a shop is larger", h5 && t.near(h5.sf, 1200, 12), h5 && h5.sf);
  OSM.elements = saved;

  /* ---- parcel stage ---- */
  var have = study();
  t.ok("no parcel search runs when the county lookup gave an outline", (await L.resolveParcel(have)) === null);
  var none = { lon: LON, lat: LAT, county: "Snohomish County", stateAbbr: "WA", state: "Washington", address: "123 Maple Ave" };
  var before = calls.length;
  var info = await L.resolveParcel(none);
  t.ok("a failed parcel search reports what it tried", info && info.tried && info.found === false && info.sources.length >= 1, info);
  t.ok("the parcel search asked a parcel layer", calls.length > before);
  var again = await L.resolveParcel(none);
  t.ok("the parcel search is not repeated for the same study", again === info);
  t.ok("no owner fields are kept on the study", Object.keys(none).every(function (k) { return !/owner|taxpayer|mail/i.test(k); }));
  var r6 = await L.analyze(none);
  t.ok("without an outline the study reports point mode and gives no lot geometry", r6.mode === "point" && r6.geo && r6.geo.lot === null);

  /* ---- report page ---- */
  var html = L.renderHTML(r, study());
  t.ok("the report page renders", /House footprint/.test(html));
  t.ok("no TOW or BOW label anywhere", !/\bTOW\b|\bBOW\b/.test(html));
  var slopeDown = { ok: true, rows: r.rows, slope: { ok: false, note: "the elevation service did not answer" }, notes: [], sources: [], survey: null, mode: "lot" };
  var full = L.renderHTML(slopeDown, study()), trimmed = L.renderHTML(slopeDown, study(), { hideLinkOnly: true });
  t.ok("the recorder link stays by default", /snoco\.org\/RecordedDocuments/.test(full));
  t.ok("hideLinkOnly drops the recorder link and keeps the sentence", !/snoco\.org\/RecordedDocuments/.test(trimmed) && /county recorder/.test(trimmed));
  t.ok("hideLinkOnly drops the lidar portal hint", /lidarportal/.test(full) === true ? !/lidarportal/.test(trimmed) : true);
  t.done();
})().catch(function (e) { console.log("FAIL  test crashed: " + (e && e.stack || e)); process.exit(1); });
