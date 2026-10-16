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

test('sanitizeData normalises shape and keeps text as typed', async () => {
  const { sanitizeData } = await import('../src/utils/habits.js');
  const out = sanitizeData({ habits: [{ id: 'a', text: 'x < y' }, { nope: true }], todos: null, settings: { darkMode: true } });
  assert.equal(out.habits.length, 1);
  assert.equal(out.habits[0].text, 'x < y');
  assert.deepEqual(out.todos, []);
  assert.deepEqual(out.completions, {});
  assert.equal(out.settings.darkMode, true);
  assert.equal(out.settings.completionThreshold, 0.8);
});

test('stages: each day is judged by the stage in force that day', async () => {
  const { stageAt, isHabitScheduledForDay, changeHabit, migrateHabit } = await import('../src/utils/habits.js');
  const ride = migrateHabit({ id: 'r', text: 'Ride 20 min', timeBlock: 'morning', recurrence: { type: 'specific_days', days: [1, 3, 5] }, durationMinutes: 20, createdAt: '2026-09-01T08:00:00.000Z', sortOrder: 0 });
  assert.deepEqual(ride.stages.map((s) => s.from), ['2026-09-01']);
  // Before it began, it was not scheduled.
  assert.equal(isHabitScheduledForDay(ride, new Date(2026, 7, 31)), false);
  // Grow it from Sep 14: daily, 25 minutes. Mondays before keep the old schedule, Tuesdays before stay unscheduled.
  const grown = changeHabit(ride, { text: 'Ride 25 min', durationMinutes: 25, recurrence: { type: 'daily' } }, '2026-09-14');
  assert.equal(grown.stages.length, 2);
  assert.equal(grown.text, 'Ride 25 min');
  assert.equal(isHabitScheduledForDay(grown, new Date(2026, 8, 8)), false); // Tue Sep 8, old stage
  assert.equal(isHabitScheduledForDay(grown, new Date(2026, 8, 15)), true); // Tue Sep 15, new stage
  assert.equal(stageAt(grown, '2026-09-07').text, 'Ride 20 min');
  // A rename alone, or a change on the day the stage began, edits in place.
  assert.equal(changeHabit(grown, { text: 'Ride, 25 min' }, '2026-10-01').stages.length, 2);
  assert.equal(changeHabit(grown, { durationMinutes: 30 }, '2026-09-14').stages.length, 2);
  assert.equal(changeHabit(grown, { durationMinutes: 30 }, '2026-10-01').stages.length, 3);
});

test('stages: migration is idempotent and begins at the first check if that came first', async () => {
  const { migrateHabit } = await import('../src/utils/habits.js');
  const habit = { id: 'w', text: 'water', recurrence: { type: 'daily' }, createdAt: '2026-09-05T08:00:00.000Z' };
  const once = migrateHabit(habit, { '2026-09-02': { w: true }, '2026-09-03': { other: true } });
  assert.equal(once.stages[0].from, '2026-09-02');
  assert.deepEqual(migrateHabit(once, {}), once);
  // Broken stages are dropped, duplicates on one day keep the later entry, and fields mirror the last stage.
  const messy = migrateHabit({ id: 'm', text: 'm', recurrence: { type: 'daily' }, stages: [{ from: 'nope' }, { from: '2026-01-02', text: 'b', recurrence: { type: 'daily' } }, { from: '2026-01-01', text: 'a', recurrence: { type: 'daily' } }, { from: '2026-01-02', text: 'c', recurrence: { type: 'daily' } }] });
  assert.deepEqual(messy.stages.map((s) => s.text), ['a', 'c']);
  assert.equal(messy.text, 'c');
  // No date to begin from: it has always been there, as before.
  assert.equal(migrateHabit({ id: 'x', text: 'x' }).stages[0].from, '0000-01-01');
});

test('rest: resting days are unscheduled, and the habit comes back by itself or by hand', async () => {
  const { restHabit, resumeHabit, isHabitScheduledForDay, isResting, changeHabit, migrateHabit } = await import('../src/utils/habits.js');
  const h = migrateHabit({ id: 'h', text: 'h', recurrence: { type: 'daily' }, createdAt: '2026-09-01T00:00:00.000Z' });
  const resting = restHabit(h, '2026-09-10', '2026-09-17');
  assert.equal(isHabitScheduledForDay(resting, new Date(2026, 8, 9)), true);
  assert.equal(isResting(resting, '2026-09-12'), true);
  assert.equal(isHabitScheduledForDay(resting, new Date(2026, 8, 16)), false);
  assert.equal(isHabitScheduledForDay(resting, new Date(2026, 8, 17)), true);
  // Edits while resting apply when it returns and do not end the rest.
  const edited = changeHabit(resting, { text: 'h2' }, '2026-09-12');
  assert.equal(isResting(edited, '2026-09-12'), true);
  // Until it is resumed by hand.
  const open = restHabit(h, '2026-09-10');
  assert.equal(isHabitScheduledForDay(open, new Date(2027, 0, 1)), false);
  const back = resumeHabit(open, '2026-09-20');
  assert.equal(isHabitScheduledForDay(back, new Date(2026, 8, 19)), false);
  assert.equal(isHabitScheduledForDay(back, new Date(2026, 8, 20)), true);
  assert.deepEqual(resumeHabit(restHabit(h, '2026-09-10'), '2026-09-10').stages, h.stages);
});

test('archiving keeps the days before it as they were', () => {
  const arch = { ...daily, archivedAt: '2026-09-09T12:00:00.000Z' };
  assert.equal(isHabitScheduledForDay(arch, new Date(2026, 8, 8)), true);
  assert.equal(isHabitScheduledForDay(arch, new Date(2026, 8, 9)), false);
});
