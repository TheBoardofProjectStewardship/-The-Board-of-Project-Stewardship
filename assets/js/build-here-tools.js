/* Build Here feasibility tools: Pascal video chapters, CivilCraft hotspots,
   CutSheet RX chapters, lot-seeded Pascal / CivilCraft / CSRX briefs. Works on
   build-here.html (report) and build-here-3d.html. Seed from localStorage "bh3dSeed". */
(function (global) {
  const $ = (id, root) => (root || document).getElementById(id) || document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const NOTES = {
    2: 'A whole site, terrain and trees, in the browser.',
    10: 'Rooms and a pool drawn as walls and slabs.',
    30: 'Every wall, window and door is an object you can edit.',
    60: 'Zones sit on levels, so you can stack floors like the massing boxes.',
    90: 'The site sits in the real world: your lot outline can go here.',
    120: 'Ask the building a question and it answers from the model.'
  };
  const CSRX_NOTES = {
    0: 'Draw the field (or lot) corners on satellite. Double-click the last corner to close the polygon - same outline idea as the parcel ring in this study.',
    3: 'Downloading lidar, then an elevation heatmap fills the polygon from USGS 3DEP. This study already uses that lidar family for lot slope.',
    5: 'Drainage toggle: flow arrows and blue ponding show where water stands. Useful before stormwater review on an addition or new house.',
    6: 'Draw a tile or profile line for a cut/fill graph across the field - companion to CivilCraft pad grading on survey points.',
    8: 'View 3D and start rain: pond area and volume metrics for a design storm. Planning aid only, not an engineered drainage report.'
  };

  function readSeed() {
    let seed = null;
    try { seed = JSON.parse(localStorage.getItem('bh3dSeed') || 'null'); } catch (e) {}
    return seed || {};
  }

  function envelope(ring, sb) {
    const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
    const n = (x, d) => typeof x === 'number' ? x : d;
    const x0 = Math.min(...xs) + n(sb.side, 5), x1 = Math.max(...xs) - n(sb.side, 5);
    const y0 = Math.min(...ys) + n(sb.front, 20), y1 = Math.max(...ys) - n(sb.rear, 25);
    return x1 > x0 && y1 > y0 ? [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] : [];
  }

  function civilBrief(seed) {
    const sb = seed.setbacks || {};
    const ring = seed.ring || [];
    const n = (x) => typeof x === 'number' ? x + ' ft' : 'verify';
    return (seed.address ? seed.address + '\n' : 'Sample lot (no report loaded)\n') +
      (seed.zone ? 'Zone ' + seed.zone + '. ' : '') + (seed.lot ? 'Lot ' + fmt(seed.lot) + ' sf. ' : '') +
      'Setbacks: front ' + n(sb.front) + ', side ' + n(sb.side) + ', rear ' + n(sb.rear) + '.' +
      (seed.height ? ' Height limit ' + seed.height + ' ft.' : '') +
      '\nIn CivilCraft: open the CSV (columns P,N,E,Z,D, feet). Points named LOT are the lot corners; ENV are the buildable envelope corners. Use Pad (G G) on the ENV corners to grade a building pad, and Alignment (A A) from the street side for a driveway.' +
      '\nElevations are a flat 100 ft placeholder. Replace with survey points before using slope, cut or fill numbers.';
  }

  function csrxBrief(seed) {
    const lat = (seed.lat != null && isFinite(seed.lat)) ? Number(seed.lat).toFixed(6) : '';
    const lon = (seed.lon != null && isFinite(seed.lon)) ? Number(seed.lon).toFixed(6) : '';
    const addr = seed.address || 'this lot';
    return 'CutSheet RX on ' + addr + '.' +
      (lat && lon ? ('\nGo To search: paste "' + lat + ', ' + lon + '" or the street address.') : '\nGo To search: paste the street address.') +
      (seed.lot ? '\nLot about ' + fmt(seed.lot) + ' sf.' : '') +
      (seed.zone ? ' Zone ' + seed.zone + '.' : '') +
      '\nSuggested flow on this lot: (1) Draw field area on the parcel (2) wait for lidar heatmap (3) toggle Drainage for flow and ponding (4) draw a profile/tile line for cut/fill (5) View 3D and Start rain.' +
      '\nUSGS 3DEP lidar powers both this study\'s lot slope and CutSheet RX. Planning aid only - not a survey or engineered stormwater design.';
  }

  function pascalBrief(seed) {
    const sb = seed.setbacks || {};
    const n = (x) => typeof x === 'number' ? x + ' ft' : 'verify';
    const ring = seed.ring || [[0, 0], [50, 0], [50, 100], [0, 100], [0, 0]];
    return 'Model a residential lot' + (seed.address ? ' at ' + seed.address : '') +
      '. Lot outline in feet (x east, y north): ' + JSON.stringify(ring) + '.' +
      (seed.lot ? ' Lot area ' + fmt(seed.lot) + ' sf.' : '') +
      (seed.zone ? ' Zone ' + seed.zone + '.' : '') +
      ' Setbacks: front ' + n(sb.front) + ', side ' + n(sb.side) + ', rear ' + n(sb.rear) + '.' +
      (seed.height ? ' Height limit ' + seed.height + ' ft.' : '') +
      (seed.coverage ? ' Lot coverage cap ' + fmt(seed.coverage) + ' sf.' : '') +
      '\nPlace a single-family house inside the setbacks with walls, a slab, a roof, doors and windows.';
  }

  function downloadCsv(seed) {
    const ring = seed.ring || [[0, 0], [50, 0], [50, 100], [0, 100], [0, 0]];
    const sb = seed.setbacks || {};
    const rows = ['P,N,E,Z,D'];
    let i = 1;
    ring.slice(0, -1).forEach((p) => rows.push([i++, p[1].toFixed(2), p[0].toFixed(2), '100.00', 'LOT'].join(',')));
    envelope(ring, sb).forEach((p) => rows.push([i++, p[1].toFixed(2), p[0].toFixed(2), '100.00', 'ENV'].join(',')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n') + '\n'], { type: 'text/csv' }));
    a.download = 'lot-points' + (seed.address ? '-' + seed.address.split(',')[0].replace(/[^a-z0-9]+/gi, '-').toLowerCase() : '') + '.csv';
    a.click();
  }

  function fillBriefs(root, seed) {
    const pb = root.querySelector('#bh-pascal-brief, #b3-prompt');
    if (pb) pb.value = pascalBrief(seed);
    const cb = root.querySelector('#bh-civil-brief, #b3-civil-brief');
    if (cb) cb.value = civilBrief(seed);
    const xb = root.querySelector('#bh-csrx-brief');
    if (xb) xb.value = csrxBrief(seed);
  }

  function bindMedia(root) {
    const v = root.querySelector('#b3-pv, #bh-pv');
    root.querySelectorAll('#b3-chaps button, #bh-chaps button').forEach((b) => {
      b.onclick = () => {
        root.querySelectorAll('#b3-chaps button, #bh-chaps button').forEach((x) => x.classList.toggle('on', x === b));
        if (v) { v.currentTime = +b.dataset.t; v.play().catch(() => {}); }
        const note = root.querySelector('#b3-chap-note, #bh-chap-note');
        if (note) note.textContent = NOTES[b.dataset.t] || '';
      };
    });
    const cv = root.querySelector('#bh-cv');
    root.querySelectorAll('#bh-csrx-chaps button').forEach((b) => {
      b.onclick = () => {
        root.querySelectorAll('#bh-csrx-chaps button').forEach((x) => x.classList.toggle('on', x === b));
        if (cv) { cv.currentTime = +b.dataset.t; cv.play().catch(() => {}); }
        const note = root.querySelector('#bh-csrx-note');
        if (note) note.textContent = CSRX_NOTES[b.dataset.t] || '';
      };
    });
    root.querySelectorAll('.b3-pin, .bh-pin').forEach((p) => {
      p.onclick = () => {
        root.querySelectorAll('.b3-pin, .bh-pin').forEach((x) => x.classList.toggle('on', x === p));
        const note = root.querySelector('#b3-hot-note, #bh-hot-note');
        if (note) note.textContent = p.dataset.note;
      };
    });
  }

  function bindActions(root, seed) {
    root.querySelectorAll('[data-bh-copy="pascal"]').forEach((btn) => {
      btn.onclick = () => {
        const ta = root.querySelector('#bh-pascal-brief, #b3-prompt');
        if (ta && navigator.clipboard) navigator.clipboard.writeText(ta.value).then(() => { btn.textContent = 'Copied'; });
      };
    });
    root.querySelectorAll('[data-bh-copy="csrx"]').forEach((btn) => {
      btn.onclick = () => {
        const ta = root.querySelector('#bh-csrx-brief');
        if (ta && navigator.clipboard) navigator.clipboard.writeText(ta.value).then(() => { btn.textContent = 'Copied'; });
      };
    });
    root.querySelectorAll('[data-bh-csv], #b3-civil-csv').forEach((btn) => {
      btn.onclick = () => downloadCsv(seed);
    });
    root.querySelectorAll('[data-try]').forEach((b) => {
      b.onclick = () => {
        const m = b.dataset.try;
        const target = m === 'pascal'
          ? root.querySelector('#bh-study-pascal, #b3-pascal, #b3-tab-pascal')
          : m === 'csrx'
            ? root.querySelector('#bh-study-csrx')
            : root.querySelector('#bh-study-civil, #b3-civil, #b3-tab-civil');
        if (m === 'pascal' && $('b3-tab-pascal')) $('b3-tab-pascal').click();
        if (m === 'civil' && $('b3-tab-civil')) $('b3-tab-civil').click();
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (m === 'csrx') {
          const ta = root.querySelector('#bh-csrx-brief');
          if (ta) ta.focus();
        }
      };
    });
  }

  /** 3D page tabs (mass / pascal / civil) when those elements exist. */
  function bind3dTabs() {
    const tabs = { mass: 'b3-mass', pascal: 'b3-pascal', civil: 'b3-civil' };
    if (!$('b3-tab-civil') || !$('b3-mass')) return;
    function show(m) {
      for (const k in tabs) {
        const el = $(tabs[k]); if (!el) continue;
        el.hidden = k !== m;
        const t = $('b3-tab-' + k); if (!t) continue;
        t.classList.toggle('b3-off', k !== m);
        t.setAttribute('aria-selected', String(k === m));
      }
      if (m === 'civil') {
        const seed = readSeed();
        const ta = $('b3-civil-brief');
        if (ta) ta.value = civilBrief(seed);
      }
      if (m === 'pascal') {
        const seed = readSeed();
        const ta = $('b3-prompt');
        if (ta && !ta.value) ta.value = pascalBrief(seed);
      }
    }
    $('b3-tab-civil').onclick = () => show('civil');
    ['mass', 'pascal'].forEach((k) => {
      const t = $('b3-tab-' + k);
      if (t) t.addEventListener('click', () => {
        // leave mass/pascal handlers in build-here-3d.js; just hide civil
        const c = $('b3-civil'); if (c) c.hidden = true;
        const ct = $('b3-tab-civil');
        if (ct) { ct.classList.add('b3-off'); ct.setAttribute('aria-selected', 'false'); }
      });
    });
  }

  function init(root) {
    root = root || document;
    const seed = readSeed();
    fillBriefs(root, seed);
    bindMedia(root);
    bindActions(root, seed);
    bind3dTabs();
  }

  global.BuildHereTools = {
    init: init,
    readSeed: readSeed,
    pascalBrief: pascalBrief,
    civilBrief: civilBrief,
    csrxBrief: csrxBrief,
    downloadCsv: downloadCsv
  };

  // Auto-init on 3D page (static markup). Report page calls init after render.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { if (document.getElementById('b3-media') || document.getElementById('b3-pv')) init(document); });
  } else if (document.getElementById('b3-media') || document.getElementById('b3-pv')) {
    init(document);
  }
})(typeof window !== 'undefined' ? window : globalThis);
