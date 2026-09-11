// Pure analytics over the completions data. No React, no DOM.
import { formatDateKey, addDays, getWeekStart } from './date.js';
import { getDayCompletion, isDayComplete, isHabitScheduledForDay } from './habits.js';

const dayDone = (habits, completions, threshold, d) => {
  const { total } = getDayCompletion(habits, completions, d);
  if (total === 0) return null; // nothing scheduled: neither breaks nor extends a streak
  return isDayComplete(habits, completions, d, threshold);
};

// Consecutive complete days ending today. An unfinished today does not break the streak,
// because the day is not over; it simply does not count yet.
export const currentStreak = (habits, completions, threshold, today = new Date(), lookback = 366) => {
  let streak = dayDone(habits, completions, threshold, today) === true ? 1 : 0;
  for (let i = 1; i < lookback; i++) {
    const done = dayDone(habits, completions, threshold, addDays(today, -i));
    if (done === null) continue;
    if (done) streak++;
    else break;
  }
  return streak;
};

export const bestStreak = (habits, completions, threshold, today = new Date(), lookback = 366) => {
  let best = 0;
  let run = 0;
  for (let i = lookback - 1; i >= 0; i--) {
    const done = dayDone(habits, completions, threshold, addDays(today, -i));
    if (done === null) continue;
    if (done) {
      run++;
      if (run > best) best = run;
    } else if (i !== 0) {
      run = 0; // an unfinished today does not end the run
    }
  }
  return best;
};

// Completed / scheduled from the start of this week through today.
export const weekPercent = (habits, completions, today = new Date()) => {
  const start = getWeekStart(today);
  let done = 0;
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    if (d > today) break;
    const c = getDayCompletion(habits, completions, d);
    done += c.completed;
    total += c.total;
  }
  return total ? done / total : null;
};

// Per-habit rate over the last `days`, worst first so what needs attention is at the top.
// The streak counts consecutive scheduled occurrences done, ignoring an unfinished today.
export const habitBreakdown = (habits, completions, days = 30, today = new Date()) => {
  const tk = formatDateKey(today);
  const rows = habits.filter((h) => !h.archivedAt).map((habit) => {
    let scheduled = 0;
    let done = 0;
    let streak = 0;
    let counting = true;
    for (let i = 0; i < days; i++) {
      const d = addDays(today, -i);
      if (!isHabitScheduledForDay(habit, d)) continue;
      const dk = formatDateKey(d);
      const hit = Boolean(completions[dk]?.[habit.id]);
      scheduled++;
      if (hit) done++;
      if (counting) {
        if (hit) streak++;
        else if (dk !== tk) counting = false;
      }
    }
    return { habit, scheduled, done, rate: scheduled ? done / scheduled : null, streak };
  });
  return rows.sort((a, b) => {
    if (a.rate === null && b.rate === null) return 0;
    if (a.rate === null) return 1;
    if (b.rate === null) return -1;
    return a.rate - b.rate || a.habit.text.localeCompare(b.habit.text);
  });
};

// Trailing-window mean of daily completion percentage for each of the last `days`.
// Days with nothing scheduled are left out of the window. Value is null until any data exists.
export const rollingAverage = (habits, completions, { days = 90, window = 7, today = new Date() } = {}) => {
  const daily = [];
  for (let i = days + window - 2; i >= 0; i--) {
    const d = addDays(today, -i);
    const c = getDayCompletion(habits, completions, d);
    daily.push({ dateKey: formatDateKey(d), pct: c.total ? c.percentage : null });
  }
  const out = [];
  for (let i = window - 1; i < daily.length; i++) {
    const slice = daily.slice(i - window + 1, i + 1).filter((x) => x.pct !== null);
    out.push({ dateKey: daily[i].dateKey, value: slice.length ? slice.reduce((s, x) => s + x.pct, 0) / slice.length : null });
  }
  return out;
};

// 52 weeks of days, Sunday to Saturday, ending with the current week. Levels drive the grid ink.
export const yearGrid = (habits, completions, threshold, today = new Date(), weeks = 52) => {
  const thisWeek = getWeekStart(today);
  const start = addDays(thisWeek, -7 * (weeks - 1));
  const columns = [];
  for (let w = 0; w < weeks; w++) {
    const cells = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const dateKey = formatDateKey(date);
      const c = getDayCompletion(habits, completions, date);
      let level;
      if (date > today) level = 'future';
      else if (c.total === 0) level = 'none';
      else if (c.percentage >= threshold) level = 'high';
      else if (c.percentage >= 0.5) level = 'mid';
      else level = 'low';
      cells.push({ dateKey, date, level, percentage: c.percentage, total: c.total, completed: c.completed });
    }
    const first = cells[0].date;
    const monthStartsHere = cells.some((cell) => cell.date.getDate() === 1) || w === 0;
    columns.push({ cells, monthLabel: monthStartsHere ? first.toLocaleDateString(undefined, { month: 'short' }) : null, month: first.getMonth() });
  }
  // Only label a month the first time it appears.
  let last = null;
  for (const col of columns) {
    const m = col.cells.find((c) => c.date.getDate() === 1)?.date.getMonth() ?? col.month;
    if (col.monthLabel && m === last) col.monthLabel = null;
    if (col.monthLabel) last = m;
  }
  return columns;
};
