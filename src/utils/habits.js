// Habit-related utility functions
import { formatDateKey, parseDateKey, addDays } from './date.js';
import { DAY_NAMES, DEFAULT_STATE } from './constants.js';

// A habit is a ledger of dated stages: [{ from: 'YYYY-MM-DD', text, durationMinutes, recurrence,
// rest?, until? }], oldest first. The last one is the habit as it is now, and the habit's own
// text, durationMinutes and recurrence mirror it, so older code and old exports still read right.
// A past day is always judged by the stage that was in force on that day, so growing a habit
// (or resting it) never rewrites the days already lived. Habits saved before stages existed
// behave as one stage that has always been in force.
export const stagesOf = (habit) => (Array.isArray(habit.stages) && habit.stages.length
  ? habit.stages
  : [{ from: '0000-01-01', text: habit.text, durationMinutes: habit.durationMinutes ?? null, recurrence: habit.recurrence || { type: 'daily' } }]);

export const stageAt = (habit, dateKey) => {
  const stages = stagesOf(habit);
  let at = -1;
  for (let i = 0; i < stages.length && stages[i].from <= dateKey; i++) at = i;
  if (at < 0) return null; // before the habit began
  const stage = stages[at];
  // A rest with an end date resumes by itself, as the habit written on the rest.
  if (stage.rest && stage.until && stage.until <= dateKey) {
    return { from: stage.until, text: stage.text, durationMinutes: stage.durationMinutes, recurrence: stage.recurrence };
  }
  return stage;
};

export const isHabitScheduledForDay = (habit, date) => {
  const dk = formatDateKey(date);
  if (habit.archivedAt && dk >= formatDateKey(habit.archivedAt)) return false;
  const stage = stageAt(habit, dk);
  if (!stage || stage.rest) return false;
  const dow = new Date(date).getDay();
  return stage.recurrence.type === 'daily' || (stage.recurrence.days?.includes(dow) ?? false);
};

export const getHabitsForDay = (habits, date) =>
  habits.filter(h => isHabitScheduledForDay(h, date));

export const getDayCompletion = (habits, completions, date) => {
  const dk = formatDateKey(date);
  const dayHabits = getHabitsForDay(habits, date);
  if (dayHabits.length === 0) return { completed: 0, total: 0, percentage: 0 };
  const dc = completions[dk] || {};
  const completed = dayHabits.filter(h => dc[h.id]).length;
  return { completed, total: dayHabits.length, percentage: completed / dayHabits.length };
};

export const isDayComplete = (habits, completions, date, threshold) =>
  getDayCompletion(habits, completions, date).percentage >= threshold;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const validRecurrence = (r) => r && (r.type === 'daily' || (r.type === 'specific_days' && Array.isArray(r.days)))
  ? (r.type === 'daily' ? { type: 'daily' } : { type: 'specific_days', days: r.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) })
  : { type: 'daily' };
const fieldsOf = (x) => ({ text: x.text, durationMinutes: x.durationMinutes ?? null, recurrence: x.recurrence });

// Give every habit a valid ledger of stages. A habit saved before stages existed begins on the
// day it was created, or on the first day it was checked if that came earlier, so days before it
// existed stop counting it as missed. Pure and idempotent.
export const migrateHabit = (habit, completions = {}) => {
  const recurrence = validRecurrence(habit.recurrence);
  const base = { ...habit, recurrence, timeBlock: typeof habit.timeBlock === 'string' ? habit.timeBlock : 'morning', sortOrder: Number.isFinite(habit.sortOrder) ? habit.sortOrder : 0 };
  const clean = (Array.isArray(habit.stages) ? habit.stages : [])
    .filter((st) => st && DATE_KEY.test(st.from))
    .map((st) => {
      const out = { from: st.from, text: typeof st.text === 'string' ? st.text : base.text, durationMinutes: Number.isFinite(st.durationMinutes) ? st.durationMinutes : null, recurrence: validRecurrence(st.recurrence) };
      if (st.rest) {
        out.rest = true;
        if (typeof st.until === 'string' && DATE_KEY.test(st.until) && st.until > st.from) out.until = st.until;
      }
      return out;
    })
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  const stages = clean.filter((st, i) => i === clean.length - 1 || clean[i + 1].from !== st.from); // same day: the later wins
  if (stages.length === 0) {
    let begin = DATE_KEY.test(formatDateKey(habit.createdAt || '')) ? formatDateKey(habit.createdAt) : null;
    for (const [dk, day] of Object.entries(completions)) if (day && day[habit.id] && DATE_KEY.test(dk) && (!begin || dk < begin)) begin = dk;
    stages.push({ from: begin || '0000-01-01', ...fieldsOf(base) });
  }
  const out = { ...base, ...fieldsOf(stages[stages.length - 1]), stages };
  if (typeof out.next !== 'string' || !out.next.trim()) delete out.next;
  const snooze = habit.growth?.snoozeUntil;
  if (typeof snooze === 'string' && DATE_KEY.test(snooze)) out.growth = { snoozeUntil: snooze };
  else delete out.growth;
  return out;
};

// Normalise imported, synced or stored data: right shapes, defaults filled in, every habit with a
// valid ledger of stages. Text is left as typed; React escapes it on render, so stripping
// characters would only mangle habit names.
export const sanitizeData = (data) => {
  const src = data && typeof data === 'object' ? data : {};
  const list = (arr) => (Array.isArray(arr) ? arr.filter((x) => x && typeof x.id === 'string' && typeof x.text === 'string') : []);
  const completions = src.completions && typeof src.completions === 'object' ? src.completions : {};
  return {
    ...src,
    habits: list(src.habits).map((h) => migrateHabit(h, completions)),
    todos: list(src.todos),
    completions,
    settings: { ...DEFAULT_STATE.settings, ...(src.settings || {}) },
  };
};

// The habit as it should be from `fromKey` on. A change made on the day its stage began (or a
// rename alone) edits that stage in place; anything else starts a new stage, so the days before
// keep the habit they actually had. The habit's own fields always mirror the latest stage.
// `step: true` always starts a new stage: growth is never a rename of the stage before it.
export const changeHabit = (habit, fields, fromKey, { step = false } = {}) => {
  const stages = [...stagesOf(habit)];
  const last = stages[stages.length - 1];
  const next = { text: fields.text ?? last.text, durationMinutes: fields.durationMinutes === undefined ? last.durationMinutes : fields.durationMinutes, recurrence: fields.recurrence ?? last.recurrence };
  const renameOnly = next.durationMinutes === last.durationMinutes && JSON.stringify(next.recurrence) === JSON.stringify(last.recurrence);
  // Editing a resting habit edits the habit it will come back as; it does not end the rest.
  if (last.from >= fromKey || (renameOnly && !step) || last.rest) stages[stages.length - 1] = { ...last, ...next };
  else stages.push({ from: fromKey, ...next });
  const extra = { ...fields };
  delete extra.text; delete extra.durationMinutes; delete extra.recurrence;
  return { ...habit, ...extra, ...next, stages };
};

// Rest a habit from `fromKey` until `untilKey` (exclusive), or until it is resumed when there is
// no end. Resting days are not scheduled: they neither break nor extend anything.
export const restHabit = (habit, fromKey, untilKey = null) => {
  const stages = stagesOf(habit).filter((st) => st.from < fromKey);
  const last = stagesOf(habit)[stagesOf(habit).length - 1];
  const rest = { from: fromKey, ...fieldsOf(last), rest: true };
  if (untilKey && untilKey > fromKey) rest.until = untilKey;
  return { ...habit, stages: [...stages, rest] };
};

export const resumeHabit = (habit, fromKey) => {
  const stages = [...stagesOf(habit)];
  const last = stages[stages.length - 1];
  if (!last.rest) return habit;
  if (last.from >= fromKey) stages.pop(); // rested and resumed the same day: as if it never rested
  else stages.push({ from: fromKey, ...fieldsOf(last) });
  return { ...habit, stages };
};

// When a rest that begins on `fromKey` ends: a week, two weeks, the same date next month (or its
// last day), or open-ended until the person brings the habit back.
export const REST_CHOICES = [['week', 'A week'], ['fortnight', 'Two weeks'], ['month', 'A month'], ['open', 'Until I return']];
export const restUntil = (fromKey, choice) => {
  const from = parseDateKey(fromKey);
  if (choice === 'week') return formatDateKey(addDays(from, 7));
  if (choice === 'fortnight') return formatDateKey(addDays(from, 14));
  if (choice === 'month') {
    const last = new Date(from.getFullYear(), from.getMonth() + 2, 0).getDate();
    return formatDateKey(new Date(from.getFullYear(), from.getMonth() + 1, Math.min(from.getDate(), last)));
  }
  return null;
};

// Is the habit resting on this day (a rest stage in force)?
export const isResting = (habit, dateKey) => Boolean(stageAt(habit, dateKey)?.rest);

// Human label for a habit's recurrence, e.g. 'Every day' or 'Mon · Wed · Fri'.
export const describeRecurrence = (habit) => {
  if (!habit.recurrence || habit.recurrence.type !== 'specific_days') return 'Every day';
  const days = [...(habit.recurrence.days || [])].sort((a, b) => a - b);
  if (days.length === 7) return 'Every day';
  return days.map((d) => DAY_NAMES[d]).join(' · ');
};
