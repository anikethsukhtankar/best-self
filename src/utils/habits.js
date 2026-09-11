// Habit-related utility functions
import { formatDateKey } from './date.js';
import { DAY_NAMES, DEFAULT_STATE } from './constants.js';

export const isHabitScheduledForDay = (habit, date) => {
  if (habit.archivedAt) return false;
  const dow = new Date(date).getDay();
  return habit.recurrence.type === 'daily' || (habit.recurrence.days?.includes(dow) ?? false);
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

// Normalise imported or synced data: right shapes, defaults filled in. Text is left as typed;
// React escapes it on render, so stripping characters would only mangle habit names.
export const sanitizeData = (data) => {
  const src = data && typeof data === 'object' ? data : {};
  const list = (arr) => (Array.isArray(arr) ? arr.filter((x) => x && typeof x.id === 'string' && typeof x.text === 'string') : []);
  return {
    ...src,
    habits: list(src.habits),
    todos: list(src.todos),
    completions: src.completions && typeof src.completions === 'object' ? src.completions : {},
    settings: { ...DEFAULT_STATE.settings, ...(src.settings || {}) },
  };
};

// Human label for a habit's recurrence, e.g. 'Every day' or 'Mon · Wed · Fri'.
export const describeRecurrence = (habit) => {
  if (!habit.recurrence || habit.recurrence.type !== 'specific_days') return 'Every day';
  const days = [...(habit.recurrence.days || [])].sort((a, b) => a - b);
  if (days.length === 7) return 'Every day';
  return days.map((d) => DAY_NAMES[d]).join(' · ');
};
