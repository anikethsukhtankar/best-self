// The almanac: a year of the record as a printed plate. Twelve small months where a kept day is an
// X and a begun day a single stroke, each with its chapter line, then the steps taken and the
// rests of that year. Pure, no React.
import { formatDateKey } from './date.js';
import { getDayCompletion, stagesOf, describeRecurrence } from './habits.js';
import { monthChapter } from './turn.js';
import { stageLevels } from './staircase.js';

// Where the record begins: the first check, or the first dated stage if that came earlier.
export const recordStart = (habits, completions) => {
  let first = null;
  for (const [dk, day] of Object.entries(completions)) {
    if (day && Object.values(day).some(Boolean) && (!first || dk < first)) first = dk;
  }
  for (const h of habits) for (const st of stagesOf(h)) if (st.from !== '0000-01-01' && (!first || st.from < first)) first = st.from;
  return first;
};

// The years the record spans, to this year.
export const recordYears = (habits, completions, today = new Date()) => {
  const start = recordStart(habits, completions);
  const first = Math.min(today.getFullYear(), start ? Number(start.slice(0, 4)) : today.getFullYear());
  return Array.from({ length: today.getFullYear() - first + 1 }, (_, i) => first + i);
};

// One month's days in a Sunday-first grid: kept (met the threshold), begun (something checked),
// blank (a past day, nothing done or nothing due) or future; `today` marks the traveller's day.
export const monthPlate = (habits, completions, threshold, year, month, today = new Date()) => {
  const todayKey = formatDateKey(today);
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d);
    const dateKey = formatDateKey(date);
    const slot = first.getDay() + d - 1;
    let kind = 'future';
    let c = null;
    if (dateKey <= todayKey) {
      c = getDayCompletion(habits, completions, date);
      kind = c.total > 0 && c.percentage >= threshold ? 'kept' : c.completed > 0 ? 'begun' : 'blank';
    }
    cells.push({ dateKey, day: d, col: slot % 7, row: Math.floor(slot / 7), kind, today: dateKey === todayKey, completed: c?.completed ?? 0, total: c?.total ?? 0 });
  }
  return cells;
};

// The chapter for a month: the person's own words when they wrote some, otherwise The Turn's line.
export const chapterFor = (chapters, habits, completions, threshold, year, month, today = new Date()) => {
  const key = `${year}-${String(month + 1).padStart(2, '0')}`;
  const generated = monthChapter(habits, completions, threshold, new Date(year, month, 1), today);
  const own = typeof chapters?.[key] === 'string' && chapters[key].trim() ? chapters[key] : null;
  return { key, numeral: generated.numeral, line: own ?? generated.line, own: Boolean(own) };
};

// A stage in a few words: its name, and its minutes and days when the name does not say them.
const terms = (st) => [st.text, st.durationMinutes && !st.text.includes(`${st.durationMinutes} min`) ? `${st.durationMinutes} min` : null, st.recurrence.type === 'daily' ? null : describeRecurrence(st)].filter(Boolean).join(' · ');

// The year's steps (a habit grew, or took a lighter step) and rests, oldest first.
export const yearEvents = (habits, year) => {
  const steps = [];
  const rests = [];
  for (const h of habits) {
    const stages = stagesOf(h);
    const levels = stageLevels(stages);
    let prev = null;
    stages.forEach((st, i) => {
      if (st.from.slice(0, 4) === String(year)) {
        if (st.rest) rests.push({ text: prev?.text ?? h.text, from: st.from, until: st.until || null });
        else if (prev && i > 0 && stages[i - 1].rest && st.text === prev.text && st.durationMinutes === prev.durationMinutes && JSON.stringify(st.recurrence) === JSON.stringify(prev.recurrence)) {
          // came back from a rest unchanged: not a step
        } else if (prev) {
          const lighter = levels[i] === levels[stages.indexOf(prev)];
          steps.push({ from: st.from, before: terms(prev), after: terms(st), lighter });
        }
      }
      if (!st.rest) prev = st;
    });
  }
  const byDate = (a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0);
  return { steps: steps.sort(byDate), rests: rests.sort(byDate) };
};
