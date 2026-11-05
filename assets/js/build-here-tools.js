/* Build Here 3D: interactive tool media (Pascal video chapters, CivilCraft hotspots)
   and the CivilCraft hand-off seeded from the lot (localStorage "bh3dSeed"). */
const $ = (id) => document.getElementById(id);
let seed = null;
try { seed = JSON.parse(localStorage.getItem('bh3dSeed') || 'null'); } catch (e) {}
seed = seed || {};
const ring = seed.ring || [[0, 0], [50, 0], [50, 100], [0, 100], [0, 0]];
const sb = seed.setbacks || {};
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// Pascal chapters
const v = $('b3-pv');
const notes = { 2: 'A whole site, terrain and trees, in the browser.', 10: 'Rooms and a pool drawn as walls and slabs.', 30: 'Every wall, window and door is an object you can edit.', 60: 'Zones sit on levels, so you can stack floors like the massing boxes above.', 90: 'The site sits in the real world: your lot outline can go here.', 120: 'Ask the building a question and it answers from the model.' };
document.querySelectorAll('#b3-chaps button').forEach((b) => b.onclick = () => {
  document.querySelectorAll('#b3-chaps button').forEach((x) => x.classList.toggle('on', x === b));
  v.currentTime = +b.dataset.t; v.play().catch(() => {});
  $('b3-chap-note').textContent = notes[b.dataset.t] || '';
});
// CivilCraft hotspots
document.querySelectorAll('.b3-pin').forEach((p) => p.onclick = () => {
  document.querySelectorAll('.b3-pin').forEach((x) => x.classList.toggle('on', x === p));
  $('b3-hot-note').textContent = p.dataset.note;
});

// Civil tab (works alongside the existing mass/pascal tabs)
const tabs = { mass: 'b3-mass', pascal: 'b3-pascal', civil: 'b3-civil' };
function show(m) {
  for (const k in tabs) { $(tabs[k]).hidden = k !== m; const t = $('b3-tab-' + k); t.classList.toggle('b3-off', k !== m); t.setAttribute('aria-selected', k === m); }
  if (m === 'civil') $('b3-civil-brief').value = civilBrief();
}
$('b3-tab-civil').onclick = () => show('civil');
// keep the civil panel hidden when the original tabs are used
['mass', 'pascal'].forEach((k) => $('b3-tab-' + k).addEventListener('click', () => { $('b3-civil').hidden = true; $('b3-tab-civil').classList.add('b3-off'); $('b3-tab-civil').setAttribute('aria-selected', false); }));
document.querySelectorAll('[data-try]').forEach((b) => b.onclick = () => {
  const m = b.dataset.try;
  if (m === 'pascal') $('b3-tab-pascal').click(); else show('civil');
  $('b3-tab-mass').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function envelope() {
  // inset the bounding box by setbacks (front = south edge y=min, rear = north)
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  const n = (x, d) => typeof x === 'number' ? x : d;
  const x0 = Math.min(...xs) + n(sb.side, 5), x1 = Math.max(...xs) - n(sb.side, 5);
  const y0 = Math.min(...ys) + n(sb.front, 20), y1 = Math.max(...ys) - n(sb.rear, 25);
  return x1 > x0 && y1 > y0 ? [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] : [];
}
function civilBrief() {
  const n = (x) => typeof x === 'number' ? x + ' ft' : 'verify';
  return (seed.address ? seed.address + '\n' : 'Sample lot (no report loaded)\n') +
    (seed.zone ? 'Zone ' + seed.zone + '. ' : '') + (seed.lot ? 'Lot ' + fmt(seed.lot) + ' sf. ' : '') +
    'Setbacks: front ' + n(sb.front) + ', side ' + n(sb.side) + ', rear ' + n(sb.rear) + '.' + (seed.height ? ' Height limit ' + seed.height + ' ft.' : '') +
    '\nIn CivilCraft: open the CSV (columns P,N,E,Z,D, feet). Points named LOT are the lot corners; ENV are the buildable envelope corners. Use Pad (G G) on the ENV corners to grade a building pad, and Alignment (A A) from the street side for a driveway.' +
    '\nElevations are a flat 100 ft placeholder. Replace with survey points before using slope, cut or fill numbers.';
}
$('b3-civil-csv').onclick = () => {
  const rows = ['P,N,E,Z,D']; let i = 1;
  ring.slice(0, -1).forEach((p) => rows.push([i++, p[1].toFixed(2), p[0].toFixed(2), '100.00', 'LOT'].join(',')));
  envelope().forEach((p) => rows.push([i++, p[1].toFixed(2), p[0].toFixed(2), '100.00', 'ENV'].join(',')));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows.join('\n') + '\n'], { type: 'text/csv' }));
  a.download = 'lot-points' + (seed.address ? '-' + seed.address.split(',')[0].replace(/[^a-z0-9]+/gi, '-').toLowerCase() : '') + '.csv';
  a.click();
};
