import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleState } from '../src/utils/sample.js';
import { sanitizeData } from '../src/utils/habits.js';
import { growthOffer } from '../src/utils/growth.js';
import { recordYears } from '../src/utils/almanac.js';
import { currentStreak } from '../src/utils/insights.js';

const today = new Date(2026, 9, 26, 10);

test('the sample year is valid, stable for a day, and ready to look around', () => {
  const a = sampleState(today);
  assert.deepEqual(a, sampleState(today));
  assert.deepEqual(sanitizeData(a).habits.map((h) => h.stages.length), a.habits.map((h) => h.stages.length));
  assert.deepEqual(recordYears(a.habits, a.completions, today), [2025, 2026]);
  // Meditation has held its latest stage; once today's checks are done it is offered a next step.
  const sit = a.habits.find((h) => h.id === 's-sit');
  const done = { ...a.completions, '2026-10-26': { ...a.completions['2026-10-26'], 's-sit': true } };
  assert.equal(growthOffer(sit, done, today).kind, 'ready');
  // Stretching has been heavy lately.
  assert.equal(growthOffer(a.habits.find((h) => h.id === 's-stretch'), a.completions, today).kind, 'heavy');
  // Today is under way: morning done, the rest still to do.
  assert.ok(Object.keys(a.completions['2026-10-26']).every((id) => a.habits.find((h) => h.id === id).timeBlock === 'morning'));
  assert.ok(currentStreak(a.habits, a.completions, 0.8, today) >= 0);
});

test('the sample offers meditation first, in words', async () => {
  const { todaysOffer, describeStep } = await import('../src/utils/growth.js');
  const a = sampleState(today);
  const done = { ...a.completions, '2026-10-26': Object.fromEntries(a.habits.map((h) => [h.id, true])) };
  const best = todaysOffer(a.habits, done, today);
  assert.equal(best.habit.id, 's-sit');
  assert.equal(describeStep(best.habit, best.offer.proposal), 'Meditate 15 min');
  assert.equal(describeStep({ text: 'Plan', durationMinutes: 5 }, { text: 'Plan', durationMinutes: 7 }), '7 min');
});
