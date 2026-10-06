import assert from 'node:assert/strict';
import { assessPlan, findRooms, parseFeet, scaleMismatch } from '../assets/js/floor-plan-check.js';

function walls(pairs) {
  return pairs.map(([x1, y1, x2, y2], i) => ({ id: 'w' + i, x1, y1, x2, y2 }));
}

const cottage = walls([
  [0, 0, 32, 0], [32, 0, 32, 24], [32, 24, 0, 24], [0, 24, 0, 0],
  [20, 0, 20, 24], [20, 12, 32, 12], [0, 14, 8, 14], [8, 14, 8, 24],
]);
const greatroom = walls([
  [0, 0, 30, 0], [30, 0, 30, 20], [30, 20, 0, 20], [0, 20, 0, 0],
  [22, 12, 30, 12], [22, 12, 22, 14],
]);
const adu = walls([
  [0, 0, 20, 0], [20, 0, 20, 24], [20, 24, 0, 24], [0, 24, 0, 0],
  [0, 14, 20, 14], [12, 14, 12, 24],
]);

assert.equal(parseFeet("12'-0\""), 12);
assert.equal(parseFeet('12\u2032-0\u2033'), 12);
assert.equal(parseFeet("12'-6\""), 12.5);
assert.equal(parseFeet("9'"), 9);
assert.equal(parseFeet('12-6'), 12.5);
assert.equal(parseFeet('12.5'), 12.5);
assert.equal(parseFeet('9 ft'), 9);
assert.equal(parseFeet(''), null);
assert.equal(parseFeet('nope'), null);

assert.equal(scaleMismatch(12, 9), true);
assert.equal(scaleMismatch(12, 12), false);
assert.equal(scaleMismatch(12, 12.2), false);
assert.equal(scaleMismatch(12, 11.5), true);

const mismatch = assessPlan({ labeledText: "12'-0\"", measuredText: '9', ceilingFeet: 9, walls: cottage });
assert.equal(mismatch.status, 'warnings');
assert.equal(mismatch.mismatch, true);
assert.ok(mismatch.items.some((i) => i.code === 'scale-mismatch' && i.text.includes('12') && i.text.includes('9')));
assert.ok(mismatch.items.some((i) => i.code === 'ceiling' && i.level === 'pass'));
assert.ok(mismatch.items.some((i) => i.code === 'rooms-ok' && i.level === 'pass'));
assert.ok(!mismatch.rooms.some((r) => r.warning), JSON.stringify(mismatch.rooms));

const ok = assessPlan({ labeledText: '32', measuredText: '32', ceilingFeet: 9, walls: cottage });
assert.equal(ok.status, 'passed');
assert.equal(ok.mismatch, false);
assert.ok(ok.rooms.length >= 3);

for (const sample of [greatroom, adu]) {
  const result = assessPlan({ labeledText: '12', measuredText: '12', ceilingFeet: 8, walls: sample });
  assert.equal(result.status, 'passed', JSON.stringify(result));
  assert.ok(result.rooms.length >= 1);
}

const tall = assessPlan({ labeledText: '12', measuredText: '12', ceilingFeet: 16, walls: cottage });
assert.equal(tall.status, 'warnings');
assert.ok(tall.items.some((i) => i.code === 'ceiling' && i.level === 'warn'));

const huge = walls([[0, 0, 50, 0], [50, 0, 50, 40], [50, 40, 0, 40], [0, 40, 0, 0]]);
const big = assessPlan({ labeledText: '50', measuredText: '50', ceilingFeet: 9, walls: huge });
assert.equal(big.status, 'warnings');
assert.ok(big.items.some((i) => i.code === 'room-size'));

const box = findRooms(walls([[0, 0, 12, 0], [12, 0, 12, 10], [12, 10, 0, 10], [0, 10, 0, 0]]));
assert.equal(box.rooms.length, 1);
assert.equal(box.rooms[0].warning, null);

const open = assessPlan({ labeledText: '10', measuredText: '10', ceilingFeet: 9, walls: [] });
assert.equal(open.status, 'passed');
assert.ok(open.items.some((i) => i.code === 'rooms-none'));

const missing = assessPlan({ labeledText: '', measuredText: '', ceilingFeet: 9, walls: cottage });
assert.equal(missing.status, 'incomplete');
assert.equal(missing.mismatch, false);

console.log('ok');
