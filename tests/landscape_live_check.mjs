// Live check of the site coverage / landscape module against public services.
// Usage: node tests/landscape_live_check.mjs   (network required, no keys)
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const L = require("../assets/js/build-here-landscape.js");
const KC = "https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/2/query";
async function parcels(where) {
  const u = KC + "?" + new URLSearchParams({ where, outFields: "PIN,ADDR_FULL,LOTSQFT", returnGeometry: "true", outSR: "4326", f: "json" });
  return (await (await fetch(u)).json()).features;
}
const cases = [
  { label: "2317 W Ruffner St", where: "PIN='2770600432'" },
  { label: "9543 Interlake Ave N (unit lot)", where: "PIN='4310701405'" },
  { label: "9541 Interlake Ave N (unit lot)", where: "PIN='4310701404'" },
  { label: "9541 C Interlake (unit lot)", where: "PIN='4310701403'" },
  { label: "9541 B/D Interlake (unit lot)", where: "PIN='4310701402'" },
  { label: "9541-9543 Interlake parent plat (4 lots)", where: "PIN LIKE '431070140%'", merge: true }
];
const results = [];
for (const c of cases) {
  const f = await parcels(c.where);
  const rings = c.merge ? f.flatMap(x => x.geometry.rings) : f[0].geometry.rings;
  const lot = f.reduce((t, x) => t + (x.attributes.LOTSQFT || 0), 0);
  const s = { rings, lot, lotSrc: "King County Assessor (LOTSQFT)", juris: "seattle", county: "King County", parcel: c.merge ? "" : f[0].attributes.PIN };
  const r = await L.analyze(s);
  const row = { case: c.label };
  r.rows.forEach(x => { row[x.key] = x.sf == null ? "n/a" : `${x.sf} (${x.pct}%) [${x.conf}]`; });
  if (r.slope && r.slope.ok) row.slope = `avg ${r.slope.mean}% med ${r.slope.median}% p95 ${r.slope.p95}% max ${r.slope.max}% elev ${r.slope.elevMin}-${r.slope.elevMax} ft, >=40%: ${r.slope.pct40}%`;
  else row.slope = "n/a " + (r.slope && r.slope.note);
  row.eca = r.steep ? (r.steep.mapped ? `ECA steep mapped ${r.steep.sf} sf` : "no ECA steep") : "n/a";
  row.plat = r.survey ? r.survey.plat : "";
  row.sources = r.sources.map(x => (x.ok ? "OK " : "FAIL ") + x.name).join("; ");
  results.push(row);
  console.log(JSON.stringify(row, null, 1));
}
// HTML render smoke test
const html = L.renderHTML({ rows: [], notes: [], slope: { ok: false, note: "x" }, sources: [] }, {});
if (!/Slope is unavailable/.test(html)) { console.error("render failed"); process.exit(1); }
