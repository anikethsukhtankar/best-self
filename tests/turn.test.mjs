import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthDays, gridLayout } from '../src/utils/calendar.js';
import { dayKinds, monthRows, bridges, walls, projection, footprint, roman, chapterLine, monthChapter, LANE } from '../src/utils/turn.js';

const oct = new Date(2026, 9, 1);
const days = monthDays(oct); // Sun 27 Sep .. Sat 7 Nov
const today = new Date(2026, 9, 16, 10);
const at = (d) => days.findIndex((x) => x.getMonth() === 9 && x.getDate() === d);
const statusFor = (complete, rest = []) => days.map((day) => ({
  complete: day.getMonth() === 9 && complete.includes(day.getDate()),
  total: day.getMonth() === 9 && rest.includes(day.getDate()) ? 0 : 5,
}));

test('kinds: built, missed, rest, today, future and the neighbouring months', () => {
  const kinds = dayKinds(days, oct, statusFor([1, 2, 16], [4]), today);
  assert.equal(kinds[0], 'other');
  assert.equal(kinds[at(1)], 'complete');
  assert.equal(kinds[at(3)], 'missed');
  assert.equal(kinds[at(4)], 'rest');
  assert.equal(kinds[at(16)], 'today-complete');
  assert.equal(kinds[at(17)], 'future');
  assert.equal(dayKinds(days, oct, statusFor([]), today)[at(16)], 'today');
  assert.deepEqual(monthRows(kinds), { first: 0, count: 5 });
});

test('bridges span one unbuilt past day inside a week, never a week edge or the future', () => {
  // Oct 6 Tue, 7 Wed missed, 8 Thu: bridged. Oct 3 Sat / 4 Sun / 5 Mon: 4 is a week start, not bridged.
  const kinds = dayKinds(days, oct, statusFor([3, 5, 6, 8, 12, 14]), today);
  assert.deepEqual(bridges(kinds).map((i) => days[i].getDate()), [7, 13]);
  // Two missed days in a row are a real gap: no bridge.
  const gap = dayKinds(days, oct, statusFor([6, 9]), today);
  assert.deepEqual(bridges(gap), []);
  // Today and future days are not bridged even between built days.
  const ahead = dayKinds(days, oct, statusFor([15, 17]), today);
  assert.deepEqual(bridges(ahead), []);
});

test('walls: a run of days shares its walls, so only the ends show edges', () => {
  const kinds = dayKinds(days, oct, statusFor([5, 6, 8]), today);
  assert.deepEqual(walls(kinds, at(5)), { end: false, startEdge: true });
  assert.deepEqual(walls(kinds, at(6)), { end: true, startEdge: false });
  assert.deepEqual(walls(kinds, at(8)), { end: true, startEdge: true });
});

test('projection: the plan at e = 0, an elevation that fits its box at e = 1', () => {
  const L = gridLayout(215, 1);
  const pitch = L.x(1);
  const geo = { width: 215, height: 200, pitch, cellFrac: L.cell / pitch, top: L.y(0), rows: { first: 0, count: 5 } };
  const flat = projection(geo, 0);
  for (const [u, v] of [[0, 0], [3, 2], [6, 4]]) {
    const [x, y] = flat(u, v);
    assert.ok(Math.abs(x - L.x(u)) < 1e-9 && Math.abs(y - L.y(v)) < 1e-9);
  }
  const iso = projection(geo, 1);
  const corners = [[0, 0, 0], [7, 0, 0], [0, 5, 0], [7, 5, 0], [0, 0, 0.5], [7, 0, 0.5]].map(([u, v, z]) => iso(u - 0.07, v, z));
  for (const [x, y] of corners) assert.ok(x >= 0 && x <= 215 && y >= 0 && y <= 200, `${x},${y} outside`);
  // True isometric: the week runs down-right at 30 degrees.
  const [x0, y0] = iso(0, 0);
  const [x1, y1] = iso(1, 0);
  assert.ok(Math.abs(Math.atan2(y1 - y0, x1 - x0) * (180 / Math.PI) - 30) < 1e-6);
});

test('footprint: the plan cell when flat; a walkway when turned, days of a week touching', () => {
  const f = 27.296875 / 31.296875;
  assert.deepEqual(footprint(9, f, 0), { u0: 2, u1: 2 + f, v0: 1, v1: 1 + f });
  const a = footprint(9, f, 1);
  const b = footprint(10, f, 1);
  assert.ok(Math.abs(a.u1 - b.u0) < 1e-12);
  assert.ok(Math.abs(a.v1 - a.v0 - LANE) < 1e-12);
});

test('chapter: roman numeral and a line from the strongest block; thin months are quiet', () => {
  assert.equal(roman(9), 'IX');
  assert.equal(roman(12), 'XII');
  assert.equal(chapterLine({ morning: 0.9, evening: 0.5 }, 0.8), 'in which the mornings held');
  assert.equal(chapterLine({ morning: 0.2, evening: 0.6 }, 0.5), 'in which the nights were kept');
  assert.equal(chapterLine({ morning: 0.1 }, 0.1), 'in which the days were quiet');
  assert.equal(chapterLine({}, null), 'not yet written');

  const habits = [
    { id: 'a', text: 'a', timeBlock: 'morning', recurrence: { type: 'daily' }, sortOrder: 0 },
    { id: 'b', text: 'b', timeBlock: 'evening', recurrence: { type: 'daily' }, sortOrder: 0 },
  ];
  const completions = {};
  for (let d = 1; d <= 16; d++) completions[`2026-10-${String(d).padStart(2, '0')}`] = { a: true, b: d % 2 === 0 };
  const ch = monthChapter(habits, completions, 0.5, oct, today);
  assert.deepEqual(ch, { numeral: 'X', line: 'in which the mornings were kept' }); // October 2026: variant 1
  assert.equal(chapterLine({ morning: 1 }, 1, 2), 'in which the day began early');
  assert.equal(monthChapter(habits, {}, 0.5, new Date(2026, 11, 1), today).line, 'not yet written');
});
