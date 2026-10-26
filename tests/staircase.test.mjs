import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staircase, stageLevels } from '../src/utils/staircase.js';
import { formatDateKey, addDays } from '../src/utils/date.js';

const today = new Date(2026, 9, 26, 12); // a Monday
const st = (from, minutes, extra = {}) => ({ from, text: `Meditate ${minutes} min`, durationMinutes: minutes, recurrence: { type: 'daily' }, ...extra });

test('levels: up when a stage asks more, level when it asks less or rests', () => {
  assert.deepEqual(stageLevels([st('2026-01-01', 2), st('2026-03-01', 5), st('2026-05-01', 3), st('2026-06-01', 3, { rest: true }), st('2026-07-01', 10)]), [0, 1, 1, 1, 2]);
  assert.deepEqual(stageLevels([st('2026-01-01', 10), { ...st('2026-02-01', 10), text: 'Meditate, eyes closed' }]), [0, 1]);
});

test('weeks of stone: solid when kept, hatched when begun, nothing when missed or resting', () => {
  const habit = { id: 'm', text: 'Meditate 5 min', stages: [st('2026-09-27', 2), st('2026-10-11', 5), st('2026-10-18', 5, { rest: true, until: '2026-10-25' })] };
  const c = {};
  for (let i = 0; i < 7; i++) c[formatDateKey(addDays(new Date(2026, 8, 27), i))] = { m: true }; // week of Sep 27: all 7
  for (let i = 0; i < 3; i++) c[formatDateKey(addDays(new Date(2026, 9, 11), i))] = { m: true }; // week of Oct 11: 3 of 7
  const s = staircase(habit, c, 0.8, today);
  const byStart = Object.fromEntries(s.columns.map((col) => [col.start, col]));
  assert.equal(byStart['2026-09-27'].ink, 'solid');
  assert.equal(byStart['2026-10-04'].ink, null);
  assert.equal(byStart['2026-10-11'].ink, 'hatch');
  assert.equal(byStart['2026-10-11'].level, 1);
  assert.equal(byStart['2026-10-18'].rest, true);
  // A young habit still gets eight weeks of paper, the weeks before it began left blank.
  assert.equal(s.columns.length, 8);
  assert.equal(s.columns[0].before, true);
  assert.equal(s.times, 10);
  assert.equal(s.maxLevel, 1);
});

test('years of history turn into months, and a habit with nothing yet is new', () => {
  const old = { id: 'o', text: 'o', stages: [{ from: '2023-01-01', text: 'o', durationMinutes: null, recurrence: { type: 'daily' } }] };
  const s = staircase(old, {}, 0.8, today);
  assert.equal(s.monthly, true);
  assert.equal(s.columns[0].start, '2023-01-01');
  assert.equal(s.rooted, 'new');
});
