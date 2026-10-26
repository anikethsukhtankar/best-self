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
  const messy = migrateHabit({ id: 'm', text: 'c', recurrence: { type: 'daily' }, stages: [{ from: 'nope' }, { from: '2026-01-02', text: 'b', recurrence: { type: 'daily' } }, { from: '2026-01-01', text: 'a', recurrence: { type: 'daily' } }, { from: '2026-01-02', text: 'c', recurrence: { type: 'daily' } }] });
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

test('rest lengths: a week, two weeks, a month (clamped to its last day), or open', async () => {
  const { restUntil } = await import('../src/utils/habits.js');
  assert.equal(restUntil('2026-10-26', 'week'), '2026-11-02');
  assert.equal(restUntil('2026-10-26', 'fortnight'), '2026-11-09');
  assert.equal(restUntil('2026-01-31', 'month'), '2026-02-28');
  assert.equal(restUntil('2026-12-15', 'month'), '2027-01-15');
  assert.equal(restUntil('2026-10-26', 'open'), null);
});

test('a step always starts a new stage, even when only the words grow', async () => {
  const { changeHabit, migrateHabit } = await import('../src/utils/habits.js');
  const read = migrateHabit({ id: 'r', text: 'Read 5 pages', recurrence: { type: 'daily' }, createdAt: '2026-09-01T00:00:00.000Z', next: 'Read 15 pages', growth: { snoozeUntil: 'soon' } });
  assert.equal(read.next, 'Read 15 pages');
  assert.equal(read.growth, undefined);
  assert.equal(changeHabit(read, { text: 'Read 15 pages' }, '2026-10-27').stages.length, 1);
  assert.equal(changeHabit(read, { text: 'Read 15 pages' }, '2026-10-27', { step: true }).stages.length, 2);
});

test('restoring an archived habit keeps the archived days out of the record', async () => {
  const { restoreHabit, migrateHabit, getDayCompletion } = await import('../src/utils/habits.js');
  const h = migrateHabit({ id: 'h', text: 'h', recurrence: { type: 'daily' }, createdAt: '2026-09-01T08:00:00.000Z' });
  const other = migrateHabit({ id: 'o', text: 'o', recurrence: { type: 'daily' }, createdAt: '2026-09-01T08:00:00.000Z' });
  const archived = { ...h, archivedAt: '2026-09-10T12:00:00.000Z' };
  const back = restoreHabit(archived, '2026-10-01');
  assert.equal(back.archivedAt, undefined);
  // A day while it was archived: only the other habit was due, and it was kept.
  assert.deepEqual(getDayCompletion([back, other], { '2026-09-20': { o: true } }, new Date(2026, 8, 20)), { completed: 1, total: 1, percentage: 1 });
  // Before the archive and from today it is due again.
  assert.equal(getDayCompletion([back, other], {}, new Date(2026, 8, 5)).total, 2);
  assert.equal(getDayCompletion([back, other], {}, new Date(2026, 9, 1)).total, 2);
  // Archived and restored the same day: nothing to rest.
  assert.deepEqual(restoreHabit({ ...h, archivedAt: '2026-10-01T09:00:00.000Z' }, '2026-10-01').stages, h.stages);
});

test('an edit made by an older build (fields only) is kept, never thrown away', async () => {
  const { migrateHabit } = await import('../src/utils/habits.js');
  const h = migrateHabit({ id: 'h', text: 'Run 20 min', durationMinutes: 20, recurrence: { type: 'daily' }, createdAt: '2026-09-01T08:00:00.000Z' });
  // The old build renamed it: the latest stage takes the new name.
  assert.equal(migrateHabit({ ...h, text: 'Run, 20 min' }, {}, '2026-10-26').stages.at(-1).text, 'Run, 20 min');
  // The old build changed its minutes: a stage from today, the days before untouched.
  const grown = migrateHabit({ ...h, text: 'Run 25 min', durationMinutes: 25 }, {}, '2026-10-26');
  assert.deepEqual(grown.stages.map((s) => [s.from, s.durationMinutes]), [['2026-09-01', 20], ['2026-10-26', 25]]);
  // Unchanged data, a pending step for tomorrow, and a rest are all left alone.
  assert.deepEqual(migrateHabit(h, {}, '2026-10-26'), h);
});

test('a rest that has ended stays in the record when the habit is changed later', async () => {
  const { restHabit, resumeHabit, changeHabit, migrateHabit, stageAt, isResting } = await import('../src/utils/habits.js');
  const h = migrateHabit({ id: 'h', text: 'Walk 10 min', durationMinutes: 10, recurrence: { type: 'daily' }, createdAt: '2026-09-01T00:00:00.000Z' });
  const rested = restHabit(h, '2026-09-10', '2026-09-17');
  const edited = changeHabit(rested, { text: 'Walk 15 min', durationMinutes: 15 }, '2026-09-20');
  assert.equal(isResting(edited, '2026-09-12'), true);
  assert.equal(stageAt(edited, '2026-09-18').text, 'Walk 10 min');
  assert.equal(stageAt(edited, '2026-09-20').text, 'Walk 15 min');
  // Resting again after an ended rest starts a new rest; the first one keeps its dates.
  const again = restHabit(rested, '2026-09-25', '2026-10-02');
  assert.equal(isResting(again, '2026-09-12'), true);
  assert.equal(isResting(again, '2026-09-20'), false);
  assert.equal(isResting(again, '2026-09-26'), true);
  // Rested and brought back on the day a new stage began: that stage comes back, not the old one.
  const stepped = changeHabit(h, { text: 'Walk 20 min', durationMinutes: 20 }, '2026-09-10');
  const undone = resumeHabit(restHabit(stepped, '2026-09-10'), '2026-09-10');
  assert.deepEqual(undone.stages, stepped.stages);
  assert.equal(undone.text, stepped.text);
});

test('an older build edit after a rest is kept; minutes typed as text survive every load', async () => {
  const { migrateHabit, stageAt } = await import('../src/utils/habits.js');
  const run = (from, extra = {}) => ({ from, text: 'Run 20 min', durationMinutes: 20, recurrence: { type: 'specific_days', days: [1, 3, 5] }, ...extra });
  const ended = { id: 'r', text: 'Run (outdoors)', durationMinutes: 30, recurrence: { type: 'daily' }, stages: [run('2026-06-01'), run('2026-09-01', { rest: true, until: '2026-09-08' })] };
  const out = migrateHabit(ended, {}, '2026-10-26');
  assert.equal(stageAt(out, '2026-09-20').text, 'Run 20 min');
  assert.equal(stageAt(out, '2026-10-26').text, 'Run (outdoors)');
  assert.equal(out.durationMinutes, 30);
  assert.deepEqual(migrateHabit(out, {}, '2026-10-27'), out);
  // While a rest is still in force, the edit waits in the rest for the habit's return.
  const resting = { ...ended, stages: [run('2026-06-01'), run('2026-10-20', { rest: true })] };
  const waiting = migrateHabit(resting, {}, '2026-10-26');
  assert.equal(waiting.stages.length, 2);
  assert.equal(waiting.stages[1].rest, true);
  assert.equal(waiting.stages[1].text, 'Run (outdoors)');
  const typed = migrateHabit({ id: 'b', text: 'b', durationMinutes: '15', recurrence: { type: 'daily' }, createdAt: '2026-09-01T00:00:00.000Z' });
  assert.equal(typed.durationMinutes, 15);
  assert.deepEqual(migrateHabit(typed), typed);
});

test('bringing a habit back the same day undoes the rest exactly, whatever it stood in for', async () => {
  const { restHabit, resumeHabit, changeHabit, migrateHabit, isHabitScheduledForDay, isResting, stageAt } = await import('../src/utils/habits.js');
  const today = '2026-10-26';
  const h = migrateHabit({ id: 'm', text: 'Meditate 10 min', durationMinutes: 10, recurrence: { type: 'daily' }, createdAt: '2026-08-01T00:00:00.000Z' });
  // Resting since last week: bring it back, rest it again for a week, bring it back again.
  const away = restHabit(h, '2026-10-20');
  const again = resumeHabit(restHabit(resumeHabit(away, today), today, '2026-11-02'), today);
  assert.equal(isResting(again, today), false);
  assert.equal(isHabitScheduledForDay(again, new Date(2026, 9, 26)), true);
  assert.equal(isResting(again, '2026-10-22'), true);
  // A step set for tomorrow, rested today and brought back today: the step still begins tomorrow.
  const stepped = changeHabit(h, { text: 'Meditate 15 min', durationMinutes: 15 }, '2026-10-27', { step: true });
  const undone = resumeHabit(restHabit(stepped, today), today);
  assert.deepEqual(undone.stages, stepped.stages);
  assert.equal(stageAt(undone, today).text, 'Meditate 10 min');
  // What a rest stood in for survives a save and a reload.
  const saved = migrateHabit(restHabit(stepped, today), {}, today);
  assert.deepEqual(resumeHabit(saved, today).stages, stepped.stages);
  assert.deepEqual(migrateHabit(saved, {}, today), saved);
});

test('stage numerals: a return from rest, unchanged or renamed, is the same stage', async () => {
  const { stageNumbers } = await import('../src/utils/habits.js');
  const st = (from, text, minutes, extra = {}) => ({ from, text, durationMinutes: minutes, recurrence: { type: 'daily' }, ...extra });
  assert.deepEqual(stageNumbers([
    st('2026-01-01', 'Meditate', 5),
    st('2026-03-01', 'Meditate', 10),
    st('2026-04-01', 'Meditate', 10, { rest: true }),
    st('2026-04-10', 'Meditate, eyes closed', 10),
    st('2026-06-01', 'Meditate, eyes closed', 12),
  ]), [1, 2, 0, 2, 3]);
  // Without a rest between them, new words are a step of their own.
  assert.deepEqual(stageNumbers([st('2026-01-01', 'Read', null), st('2026-02-01', 'Read a chapter', null)]), [1, 2]);
});
