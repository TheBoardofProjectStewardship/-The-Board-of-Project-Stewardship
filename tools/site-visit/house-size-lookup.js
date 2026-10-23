/* Client lookup against prebuilt shards served from the same origin.
   Returns null if the parcel is not in the index. Never fabricates values.
   Record shape: [sqft, yearBuilt, bedrooms, stories, kind, buildings?] */
(function (root) {
  async function lookupHouse(county, pin, base) {
    base = base || '/assets/data/house-size';
    const name = String(county || '').toLowerCase();
    const c = name.indexOf('king') === 0 ? 'king' : 'snoh';
    let id = String(pin || '').replace(/\D/g, '');
    if (!id) return null;
    if (c === 'king') id = id.padStart(10, '0');
    const pre = id.slice(0, c === 'king' ? 3 : 4);
    const r = await fetch(base + '/' + c + '/' + pre + '.json');
    if (!r.ok) return null;
    const v = (await r.json())[id];
    if (!v) return null;
    const sqft = v[0], yearBuilt = v[1], bedrooms = v[2], stories = v[3], kind = v[4], buildings = v[5];
    return {
      sqft: sqft == null ? null : sqft,
      yearBuilt: yearBuilt == null ? null : yearBuilt,
      bedrooms: bedrooms == null ? null : bedrooms,
      stories: stories == null ? null : stories,
      kind: kind,
      buildings: buildings || 1,
      source: c === 'king' ? 'King County Assessor (EXTR_ResBldg)' : 'Snohomish County Assessor (Improvement Records)'
    };
  }
  const api = { lookupHouse: lookupHouse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BOPSHouseSize = api;
})(typeof window !== 'undefined' ? window : globalThis);
