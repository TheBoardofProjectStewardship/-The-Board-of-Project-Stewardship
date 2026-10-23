/* Parcel facts card for the site-visit calculator. Requires parcel-lookup.js and house-size-lookup.js.
   Suggestion chips are the only control that changes critical-area, geotech, or survey.
   The lookup click prefills the editable existing-house size from the assessor index.
   It does not write est_sqft. Parcel facts are not stored in board.goodSteward.siteVisit.v1. */
(function () {
  const $ = s => document.querySelector(s), esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fmt = v => v == null ? '<em>unknown</em>' : esc(typeof v === 'number' ? v.toLocaleString() : v);
  const yn = v => v == null ? '<em>unknown</em>' : (v ? 'Yes (mapped)' : 'Not mapped');
  const btn = $('#parcel_lookup_btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const addr = $('#client_address').value.trim(); if (!addr) return;
    btn.disabled = true; btn.textContent = 'Looking up…';
    try {
    let r;
    try { r = await BOPSParcel.lookupParcel(addr); }
    catch (e) { r = { errors: [e.message || 'lookup failed'], flags: {}, links: {}, sources: [] }; }
    const rows = [['County', r.county], ['Parcel #', r.pin], ['Parcel address', r.parcelAddress], ['Lot sq ft', r.lotSqft == null ? null : r.lotSqft + (r.lotSqftDerived ? ' (≈ from acres)' : '')],
      ['Lot acres', r.lotAcres], ['Zoning', r.zoning], ['Zoning source', r.zoningSource], ['Building sq ft', r.bldgSqft], ['Year built', r.yearBuilt],
      ['Land value', r.landVal], ['Improvement value', r.imprVal], ['Total assessed', r.totalVal],
      ['FEMA flood (100-yr)', yn(r.flags && r.flags.flood) + (r.floodZone ? ' zone ' + esc(r.floodZone) : '')], ['Wetland', yn(r.flags && r.flags.wetland)],
      ['Steep slope', yn(r.flags && r.flags.steepSlope)], ['Landslide hazard', yn(r.flags && r.flags.landslide)]];
    $('#parcel_facts').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${/^(Yes|Not|<em>)/.test(v) ? v : fmt(v)}</dd>`).join('')
      + (r.errors && r.errors.length ? `<dt>Notes</dt><dd>${r.errors.map(esc).join('<br>')}</dd>` : '');
    const links = Object.entries(r.links || {}).filter(([, u]) => u).map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${k}</a>`);
    $('#parcel_sources').innerHTML = 'Sources: ' + links.concat((r.sources || []).map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener">[${i + 1}]</a>`)).join(' ');
    // Suggestions only: nothing changes until the user clicks a chip; each chip can be undone.
    const f = r.flags || {}, chips = [];
    if (f.flood || f.wetland || f.steepSlope || f.landslide) chips.push(['Suggest: critical areas = yes', () => { const el = document.querySelector('input[name="critical"][value="yes"]'); return el && setRadio(el); }]);
    if (f.steepSlope || f.landslide) chips.push(['Suggest: add geotech', () => setCb('cb_geotech')]);
    if (r.county) chips.push(['Suggest: add survey', () => setCb('cb_survey')]);
    const box = $('#parcel_chips'); box.innerHTML = '';
    chips.forEach(([label, apply]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.onclick = () => { const undo = apply(); if (!undo) return; b.textContent = 'Applied — undo'; b.onclick = () => { undo(); b.remove(); }; fire(); }; box.appendChild(b); });
    let house = null;
    try {
      if (r.pin && r.county && window.BOPSHouseSize) house = await BOPSHouseSize.lookupHouse(r.county, r.pin);
    } catch (e) { house = null; }
    applyHouse(house);
    $('#parcel_card').hidden = false;
    } finally { btn.disabled = false; btn.textContent = 'Look up parcel'; }
  });
  const addedSqft = document.getElementById('est_sqft');
  const existingSqft = document.getElementById('existing_sqft');
  if (addedSqft) addedSqft.addEventListener('input', refreshHouseSize);
  if (existingSqft) existingSqft.addEventListener('input', refreshHouseSize);
  refreshHouseSize();
  function setRadio(el) { const prev = document.querySelector(`input[name="${el.name}"]:checked`); if (prev === el) return null; el.checked = true; el.dispatchEvent(new Event('change', {bubbles:true}));
    return () => { el.checked = false; if (prev) prev.checked = true; (prev || el).dispatchEvent(new Event('change', {bubbles:true})); }; }
  function setCb(id) { const el = document.getElementById(id) || document.querySelector(`[name="${id}"]`); if (!el || el.checked) return null; el.checked = true;
    el.dispatchEvent(new Event('change', {bubbles:true})); return () => { el.checked = false; el.dispatchEvent(new Event('change', {bubbles:true})); }; }
  function fire() { /* existing page change handlers persist to localStorage board.goodSteward.siteVisit.v1; parcel facts are NOT stored */ }
  function sqftNum(el) {
    if (!el || String(el.value).trim() === '') return null;
    const n = Number(String(el.value).replace(/,/g, ''));
    return isFinite(n) ? n : null;
  }
  function refreshHouseSize() {
    const line = document.getElementById('house_size_total');
    if (!line) return;
    const existing = sqftNum(document.getElementById('existing_sqft'));
    const added = sqftNum(document.getElementById('est_sqft'));
    const fmt = n => n == null ? '—' : Math.round(n).toLocaleString('en-US');
    const total = (existing != null && added != null) ? existing + added : null;
    line.textContent = 'Existing ' + fmt(existing) + ' + added ' + fmt(added) + ' = ' + fmt(total) + ' sq ft total house size';
  }
  function applyHouse(house) {
    const input = document.getElementById('existing_sqft');
    const detail = document.getElementById('existing_detail');
    const confirm = document.getElementById('existing_confirm');
    if (input) input.value = '';
    if (detail) detail.textContent = '';
    if (confirm) { confirm.hidden = true; confirm.textContent = ''; }
    if (house) {
      if (input && house.sqft != null) input.value = Number(house.sqft).toLocaleString('en-US');
      const part = v => v == null ? 'unknown' : String(v);
      if (detail) detail.textContent = ' sq ft (assessor record), built ' + part(house.yearBuilt) + ', ' + part(house.bedrooms) + ' bedrooms, ' + part(house.stories) + ' stories';
      const notes = [];
      if (house.buildings > 1) notes.push(house.buildings + ' buildings on parcel — confirm');
      if (house.kind && house.kind !== 'res') notes.push('Non-residential assessor record (' + house.kind + ') — confirm');
      if (confirm && notes.length) { confirm.hidden = false; confirm.textContent = notes.join('. ') + '.'; }
    }
    if (input) input.dispatchEvent(new Event('input', { bubbles: true }));
    refreshHouseSize();
  }
})();
