import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordYears, monthPlate, chapterFor, yearEvents } from '../src/utils/almanac.js';

const today = new Date(2026, 9, 26, 12);
const habit = {
  id: 'm', text: 'Meditate 10 min', timeBlock: 'morning', recurrence: { type: 'daily' }, durationMinutes: 10,
  stages: [
    { from: '2025-11-03', text: 'Meditate 2 min', durationMinutes: 2, recurrence: { type: 'daily' } },
    { from: '2026-05-10', text: 'Meditate 5 min', durationMinutes: 5, recurrence: { type: 'daily' } },
    { from: '2026-06-01', text: 'Meditate 5 min', durationMinutes: 5, recurrence: { type: 'daily' }, rest: true, until: '2026-06-08' },
    { from: '2026-06-08', text: 'Meditate 5 min', durationMinutes: 5, recurrence: { type: 'daily' } },
    { from: '2026-08-02', text: 'Meditate 3 min', durationMinutes: 3, recurrence: { type: 'daily' } },
  ],
};

test('years run from the first check or stage to this year', () => {
  assert.deepEqual(recordYears([habit], {}, today), [2025, 2026]);
  assert.deepEqual(recordYears([], { '2024-12-31': { x: true } }, today), [2024, 2025, 2026]);
});

test('the plate: kept days, begun days, blank and future, and the traveller on today', () => {
  const c = { '2026-10-01': { m: true }, '2026-10-26': { m: true } };
  const two = { ...habit, stages: [...habit.stages] };
  const other = { id: 'w', text: 'w', recurrence: { type: 'daily' }, stages: [{ from: '2026-01-01', text: 'w', durationMinutes: null, recurrence: { type: 'daily' } }] };
  const cells = monthPlate([two, other], c, 0.8, 2026, 9, today);
  assert.equal(cells.length, 31);
  assert.deepEqual([cells[0].col, cells[0].row], [4, 0]); // Oct 1 2026 is a Thursday
  assert.equal(cells[0].kind, 'begun');
  assert.equal(cells[1].kind, 'blank');
  assert.equal(cells[25].today, true);
  assert.equal(cells[26].kind, 'future');
  assert.equal(monthPlate([two], c, 0.8, 2026, 9, today)[0].kind, 'kept');
});

test('chapters: your own words win; otherwise the line from The Turn', () => {
  assert.equal(chapterFor({ '2026-10': 'in which I moved to Lisbon' }, [habit], {}, 0.8, 2026, 9, today).line, 'in which I moved to Lisbon');
  const gen = chapterFor({}, [habit], {}, 0.8, 2026, 9, today);
  assert.deepEqual([gen.numeral, gen.own], ['X', false]);
});

test("the year's steps and rests; coming back from a rest is not a step", () => {
  const { steps, rests } = yearEvents([habit], 2026);
  assert.deepEqual(steps.map((s) => [s.from, s.before, s.after, s.lighter]), [
    ['2026-05-10', 'Meditate 2 min', 'Meditate 5 min', false],
    ['2026-08-02', 'Meditate 5 min', 'Meditate 3 min', true],
  ]);
  assert.deepEqual(rests, [{ text: 'Meditate 5 min', from: '2026-06-01', until: '2026-06-08' }]);
});
