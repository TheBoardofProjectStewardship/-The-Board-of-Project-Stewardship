// Nationwide live check: Census geocode -> landscape module (no county record passed in,
// so the statewide registry / auto-discovery / Microsoft footprints paths are exercised).
// Usage: node tests/landscape_national_check.mjs ["address" ...]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const L = require("../assets/js/build-here-landscape.js");
const list = process.argv.slice(2).length ? process.argv.slice(2) : [
  "3612 Bryant Ave S, Minneapolis, MN 55409",
  "1254 Fairmount Ave, St Paul, MN 55105",
  "4513 Browndale Ave, Edina, MN 55424",
  "1720 E 5th St, Duluth, MN 55812",
  "1101 7th Ave SW, Rochester, MN 55902"
];
async function geocode(a) {
  const u = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?" + new URLSearchParams({ address: a, benchmark: "Public_AR_Current", vintage: "Current_Current", layers: "States,Counties,Incorporated Places", format: "json" });
  const m = (await (await fetch(u)).json()).result.addressMatches[0];
  if (!m) return null;
  const g = m.geographies, st = g.States[0];
  return { matched: m.matchedAddress, lon: m.coordinates.x, lat: m.coordinates.y, county: g.Counties[0].NAME, stateAbbr: st.STUSAB, stateName: st.NAME, juris: st.STUSAB === "WA" ? "other" : "outside", sources: [] };
}
for (const a of list) {
  await new Promise(r => setTimeout(r, 8000)); // be polite to Overpass
  const t = Date.now();
  const s = await geocode(a);
  if (!s) { console.log(JSON.stringify({ address: a, error: "no census match" })); continue; }
  const r = await L.analyze(s);
  const row = { address: s.matched, county: s.county, mode: r.mode, parcel: r.parcelSrc || "none", secs: Math.round((Date.now() - t) / 1000) };
  r.rows.forEach(x => { row[x.key] = x.sf == null ? "n/a" : `${x.sf}${x.pct != null ? " (" + x.pct + "%)" : ""} [${x.conf}]`; });
  row.houseSrc = (r.rows.find(x => x.key === "house") || {}).src;
  row.slope = r.slope && r.slope.ok ? `avg ${r.slope.mean}% p95 ${r.slope.p95}% fall ${r.slope.elevMax - r.slope.elevMin} ft, 40%+: ${r.slope.pct40}%` : "n/a " + (r.slope && r.slope.note);
  row.notes = r.notes.join(" | ");
  row.matchedBy = r.matchedBy || ""; row.warn = r.warn || "";
  row.flag = (r.flags || [])[0] || "";
  row.fails = r.sources.filter(x => !x.ok).map(x => x.name + ": " + x.note).join("; ");
  console.log(JSON.stringify(row, null, 1));
}
