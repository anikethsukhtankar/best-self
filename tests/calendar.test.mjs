import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthDays, gridLayout, dayMarks } from '../src/utils/calendar.js';

const key = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

test('month grid: six Sunday-first weeks around the month', () => {
  const oct = monthDays(new Date(2026, 9, 1));
  assert.equal(oct.length, 42);
  assert.equal(key(oct[0]), '2026-9-27');
  assert.equal(key(oct[4]), '2026-10-1');
  assert.equal(key(oct[41]), '2026-11-7');
  assert.ok(oct.every((d, i) => d.getDay() === i % 7));
  // A month that starts on a Sunday starts the grid
  assert.equal(key(monthDays(new Date(2026, 1, 1))[0]), '2026-2-1');
});

// Expected values are what Chrome produced for the CSS grid this replaces.
test('layout: cells and rows land where the CSS grid put them', () => {
  const desk = gridLayout(215, 1);
  assert.equal(desk.cell, 27.296875);
  assert.equal(desk.y(0), 34);
  assert.equal(desk.height, 217.78125);
  assert.equal(desk.x(6), 187.78125);

  const desk2x = gridLayout(215, 2);
  assert.equal(desk2x.cell, 27.2890625);
  assert.equal(desk2x.y(0), 33.5); // the 11px letters are a 13.5px line at 2x
  assert.equal(desk2x.height, 217.234375);

  assert.equal(gridLayout(327, 1).cell, 43.296875);
});

test('marks: numerals on whole pixels, disc fits its snapped cell, X bars snap to the device', () => {
  const m = dayMarks(gridLayout(215, 1), 0, 0);
  assert.equal(m.numeral.y, 54);
  assert.equal(m.numeral.x, 27.296875 / 2);
  assert.deepEqual(m.disc, { x: 0, y: 34, width: 27, height: 27, rx: 13.5 });
  assert.equal(m.strike.bar.height, 2);

  const m2 = dayMarks(gridLayout(215, 2), 3, 2);
  assert.equal(m2.strike.bar.height, 1.5);
  for (const v of [m2.disc.x, m2.disc.y, m2.strike.cx, m2.strike.cy, m2.numeral.y]) assert.equal((v * 2) % 1, 0);
});
