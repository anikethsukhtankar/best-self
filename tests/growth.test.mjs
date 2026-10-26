import { test } from 'node:test';
import assert from 'node:assert/strict';
import { longer, lighter, growthOffer, todaysOffer, recentOccurrences, heldFor } from '../src/utils/growth.js';
import { formatDateKey, addDays } from '../src/utils/date.js';

const today = new Date(2026, 9, 26, 20);
const habit = (over = {}) => ({
  id: 'm', text: 'Meditate 10 min', timeBlock: 'morning', sortOrder: 0, durationMinutes: 10, recurrence: { type: 'daily' },
  stages: [{ from: '2026-09-01', text: 'Meditate 10 min', durationMinutes: 10, recurrence: { type: 'daily' } }], ...over,
});
// Done on each of the last `days` days except the listed misses (days ago, 1 = yesterday).
const record = (days, misses = [], todayDone = false) => {
  const c = {};
  for (let i = 1; i <= days; i++) if (!misses.includes(i)) c[formatDateKey(addDays(today, -i))] = { m: true };
  if (todayDone) c[formatDateKey(today)] = { m: true };
  return c;
};

test('the ladder: a step up is the next round number at least 10% longer', () => {
  assert.deepEqual([2, 10, 20, 45, 110, 120, 200].map(longer), [3, 12, 25, 50, 120, null, null]);
  assert.deepEqual([10, 30, 2].map(lighter), [5, 20, 1]);
});

test('held: three weeks in, missed at most once in the last twelve', () => {
  const offer = growthOffer(habit(), record(30, [5]), today);
  assert.equal(offer.kind, 'ready');
  assert.deepEqual(offer.proposal, { text: 'Meditate 12 min', durationMinutes: 12, recurrence: { type: 'daily' } });
  assert.equal(growthOffer(habit(), record(30, [5, 9]), today), null); // two misses: not yet
  // Too young: the stage began 15 days ago.
  const young = habit({ stages: [{ from: formatDateKey(addDays(today, -15)), text: 'Meditate 10 min', durationMinutes: 10, recurrence: { type: 'daily' } }] });
  assert.equal(growthOffer(young, record(30), today), null);
});

test('an unchecked today is open, not a miss; a checked today counts', () => {
  assert.equal(recentOccurrences(habit(), record(12), today, 12)[0].dateKey, formatDateKey(addDays(today, -1)));
  assert.equal(recentOccurrences(habit(), record(12, [], true), today, 12)[0].dateKey, formatDateKey(today));
});

test('a written next step wins; with no minutes and no next step there is nothing to offer', () => {
  const read = habit({ text: 'Read 5 pages', durationMinutes: null, next: 'Read 15 pages', stages: [{ from: '2026-09-01', text: 'Read 5 pages', durationMinutes: null, recurrence: { type: 'daily' } }] });
  assert.equal(growthOffer(read, record(30), today).proposal.text, 'Read 15 pages');
  assert.equal(growthOffer({ ...read, next: undefined }, record(30), today), null);
});

test('heavy: three or fewer of the last eight, offered a lighter step', () => {
  const offer = growthOffer(habit(), record(30, [1, 2, 3, 4, 5, 6]), today);
  assert.equal(offer.kind, 'heavy');
  assert.equal(offer.proposal.durationMinutes, 5);
  assert.equal(offer.proposal.text, 'Meditate 5 min');
});

test('snoozed, archived, resting, or already stepping up tomorrow: no offer', () => {
  const c = record(30);
  assert.equal(growthOffer(habit({ growth: { snoozeUntil: '2026-11-20' } }), c, today), null);
  assert.equal(growthOffer(habit({ archivedAt: '2026-10-01T00:00:00Z' }), c, today), null);
  const pending = habit();
  pending.stages = [...pending.stages, { from: '2026-10-27', text: 'Meditate 12 min', durationMinutes: 12, recurrence: { type: 'daily' } }];
  assert.equal(growthOffer(pending, c, today), null);
});

test('weekly habits need eight times, and the offer for today picks the readiest', () => {
  const tueThu = habit({ id: 'r', recurrence: { type: 'specific_days', days: [2, 4] }, stages: [{ from: '2026-08-01', text: 'Run 20 min', durationMinutes: 20, recurrence: { type: 'specific_days', days: [2, 4] } }] });
  const c = {};
  for (let i = 1; i <= 60; i++) { const d = addDays(today, -i); if ([2, 4].includes(d.getDay())) c[formatDateKey(d)] = { r: true }; }
  assert.equal(growthOffer(tueThu, c, today).kind, 'ready');
  const both = { ...c };
  for (const [dk, day] of Object.entries(record(30, [3]))) both[dk] = { ...both[dk], ...day };
  const best = todaysOffer([habit(), tueThu], both, today);
  assert.equal(best.habit.id, 'r');
});

test('held for, in words', () => {
  assert.deepEqual([10, 21, 45, 70, 400, 800].map(heldFor), ['10 days', 'three weeks', 'six weeks', 'two months', 'a year', 'two years']);
});

test('held for: back to the last double miss; and one step at a time', async () => {
  const { heldDays } = await import('../src/utils/growth.js');
  // Missed 5 days ago (weather) and 40 + 41 days ago (a break): held since 39 days ago.
  assert.equal(heldDays(habit(), record(55, [5, 40, 41]), today), 39);
  const stepped = habit();
  stepped.stages = [...stepped.stages, { from: '2026-10-22', text: 'Meditate 12 min', durationMinutes: 12, recurrence: { type: 'daily' } }];
  const other = habit({ id: 'o', stages: [{ from: '2026-08-01', text: 'Walk 20 min', durationMinutes: 20, recurrence: { type: 'daily' } }] });
  const c = record(60);
  for (const k of Object.keys(c)) c[k].o = true;
  assert.equal(todaysOffer([stepped, other], c, today), null);
  assert.equal(todaysOffer([other], c, today).habit.id, 'o');
});

test('two hours is the top of the ladder, and Today stays quiet after an answer', () => {
  const long = habit({ text: 'Ride 120 min', durationMinutes: 120, stages: [{ from: '2026-09-01', text: 'Ride 120 min', durationMinutes: 120, recurrence: { type: 'daily' } }] });
  assert.equal(growthOffer(long, record(30), today), null);
  assert.equal(growthOffer({ ...long, next: 'Ride a century' }, record(30), today).proposal.text, 'Ride a century');
  assert.equal(todaysOffer([habit()], record(30), today, { quietUntil: '2026-11-01' }), null);
  assert.equal(todaysOffer([habit()], record(30), today, { quietUntil: '2026-10-26' }).habit.id, 'm');
});
