/* Parcel facts card for the site-visit calculator. Requires parcel-lookup.js first.
   Read-only: nothing on the form changes until a suggestion chip is clicked.
   Parcel facts are not written to board.goodSteward.siteVisit.v1. */
(function () {
  const $ = s => document.querySelector(s), esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fmt = v => v == null ? '<em>unknown</em>' : esc(typeof v === 'number' ? v.toLocaleString() : v);
  const yn = v => v == null ? '<em>unknown</em>' : (v ? 'Yes (mapped)' : 'Not mapped');
  const btn = $('#parcel_lookup_btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const addr = $('#client_address').value.trim(); if (!addr) return;
    btn.disabled = true; btn.textContent = 'Looking up…';
    let r;
    try { r = await BOPSParcel.lookupParcel(addr); }
    catch (e) { r = { errors: [e.message || 'lookup failed'], flags: {}, links: {}, sources: [] }; }
    finally { btn.disabled = false; btn.textContent = 'Look up parcel'; }
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
    $('#parcel_card').hidden = false;
  });
  function setRadio(el) { const prev = document.querySelector(`input[name="${el.name}"]:checked`); if (prev === el) return null; el.checked = true; el.dispatchEvent(new Event('change', {bubbles:true}));
    return () => { el.checked = false; if (prev) prev.checked = true; (prev || el).dispatchEvent(new Event('change', {bubbles:true})); }; }
  function setCb(id) { const el = document.getElementById(id) || document.querySelector(`[name="${id}"]`); if (!el || el.checked) return null; el.checked = true;
    el.dispatchEvent(new Event('change', {bubbles:true})); return () => { el.checked = false; el.dispatchEvent(new Event('change', {bubbles:true})); }; }
  function fire() { /* existing page change handlers persist to localStorage board.goodSteward.siteVisit.v1; parcel facts are NOT stored */ }
})();
