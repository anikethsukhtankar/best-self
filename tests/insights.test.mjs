import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentStreak, bestStreak, weekPercent, habitBreakdown, rollingAverage, yearGrid } from '../src/utils/insights.js';

const a = { id: 'a', text: 'water', timeBlock: 'morning', recurrence: { type: 'daily' }, sortOrder: 0 };
const b = { id: 'b', text: 'read', timeBlock: 'evening', recurrence: { type: 'daily' }, sortOrder: 1 };
const habits = [a, b];
const today = new Date(2026, 8, 10); // Thursday
const key = (d) => `2026-09-${String(d).padStart(2, '0')}`;
const full = { a: true, b: true };
const half = { a: true };

test('an unfinished today does not break a streak, a complete today extends it', () => {
  const completions = { [key(7)]: full, [key(8)]: full, [key(9)]: full };
  assert.equal(currentStreak(habits, completions, 0.8, today), 3);
  assert.equal(currentStreak(habits, { ...completions, [key(10)]: full }, 0.8, today), 4);
  assert.equal(currentStreak(habits, { [key(7)]: full, [key(9)]: full }, 0.8, today), 1);
});

test('best streak is the longest run, and an unfinished today does not end it', () => {
  const completions = { [key(1)]: full, [key(2)]: full, [key(3)]: full, [key(4)]: half, [key(8)]: full, [key(9)]: full };
  assert.equal(bestStreak(habits, completions, 0.8, today), 3);
});

test('week percent is completed over scheduled since Sunday', () => {
  // Sun 6 .. Thu 10 = 5 days x 2 habits = 10 scheduled
  const completions = { [key(6)]: full, [key(7)]: half, [key(8)]: full, [key(9)]: {}, [key(10)]: half };
  assert.equal(weekPercent(habits, completions, today), 0.6);
  assert.equal(weekPercent([], {}, today), null);
});

test('habit breakdown sorts worst first and counts a streak of scheduled occurrences', () => {
  const completions = { [key(8)]: full, [key(9)]: { a: true }, [key(10)]: { a: true } };
  const rows = habitBreakdown(habits, completions, 3, today);
  assert.deepEqual(rows.map((r) => r.habit.id), ['b', 'a']);
  assert.equal(rows[1].rate, 1);
  assert.equal(rows[1].streak, 3);
  assert.equal(rows[0].streak, 0);
  assert.equal(rows[0].rate, 1 / 3);
});

test('rolling average uses a trailing window and skips days with nothing scheduled', () => {
  const completions = { [key(9)]: full, [key(10)]: half };
  const series = rollingAverage(habits, completions, { days: 3, window: 2, today });
  assert.equal(series.length, 3);
  assert.equal(series[2].dateKey, key(10));
  assert.equal(series[2].value, 0.75); // (1 + 0.5) / 2
  assert.equal(series[0].value, 0);    // two empty days = 0 each
  const restDays = rollingAverage([{ ...a, recurrence: { type: 'specific_days', days: [4] } }], { [key(10)]: { a: true } }, { days: 2, window: 7, today });
  assert.equal(restDays[1].value, 1);
});

test('year grid ends with this week and levels the days', () => {
  const completions = { [key(9)]: full, [key(8)]: half, [key(7)]: {} };
  const cols = yearGrid(habits, completions, 0.8, today, 4);
  assert.equal(cols.length, 4);
  const week = cols[3].cells;
  assert.equal(week[0].dateKey, key(6));
  assert.equal(week[3].level, 'high');   // Wed 9
  assert.equal(week[2].level, 'mid');    // Tue 8
  assert.equal(week[1].level, 'low');    // Mon 7
  assert.equal(week[5].level, 'future'); // Fri 11
});
