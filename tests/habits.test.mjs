import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHabitScheduledForDay, getDayCompletion, isDayComplete, describeRecurrence } from '../src/utils/habits.js';

const daily = { id: 'w', text: 'water', timeBlock: 'morning', recurrence: { type: 'daily' }, sortOrder: 0 };
const tueThu = { id: 'r', text: 'ride', timeBlock: 'morning', recurrence: { type: 'specific_days', days: [2, 4] }, sortOrder: 1 };
const archived = { ...daily, id: 'x', archivedAt: '2026-09-01T00:00:00.000Z' };
const thu = new Date(2026, 8, 10);
const wed = new Date(2026, 8, 9);

test('recurrence: daily every day, specific days only on their days, archived never', () => {
  assert.equal(isHabitScheduledForDay(daily, wed), true);
  assert.equal(isHabitScheduledForDay(tueThu, thu), true);
  assert.equal(isHabitScheduledForDay(tueThu, wed), false);
  assert.equal(isHabitScheduledForDay(archived, thu), false);
});

test('day completion counts only scheduled habits and compares against the threshold', () => {
  const completions = { '2026-09-10': { w: true } };
  assert.deepEqual(getDayCompletion([daily, tueThu, archived], completions, thu), { completed: 1, total: 2, percentage: 0.5 });
  assert.equal(isDayComplete([daily, tueThu], completions, thu, 0.5), true);
  assert.equal(isDayComplete([daily, tueThu], completions, thu, 0.8), false);
  assert.deepEqual(getDayCompletion([tueThu], {}, wed), { completed: 0, total: 0, percentage: 0 });
});

test('recurrence labels read naturally', () => {
  assert.equal(describeRecurrence(daily), 'Every day');
  assert.equal(describeRecurrence(tueThu), 'Tue · Thu');
  assert.equal(describeRecurrence({ recurrence: { type: 'specific_days', days: [0, 1, 2, 3, 4, 5, 6] } }), 'Every day');
});
