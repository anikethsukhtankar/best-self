// One-off tasks are scoped to a day.
// - An open task belongs to its due date, or to the day it was created when it has none.
// - An open task from a past day is carried forward onto today, tagged with its original day.
// - A completed task stays on the day it was completed.
import { formatDateKey } from './date.js';

export const todoDayKey = (todo) => (todo.dueDate ? todo.dueDate.slice(0, 10) : formatDateKey(todo.createdAt));

export const getTodosForDay = (todos, date, today = new Date()) => {
  const dk = formatDateKey(date);
  const tk = formatDateKey(today);
  return todos
    .filter((t) => {
      if (t.completedAt) return formatDateKey(t.completedAt) === dk;
      const day = todoDayKey(t);
      return day === dk || (dk === tk && day < tk);
    })
    .map((t) => ({ ...t, carriedFrom: !t.completedAt && todoDayKey(t) < dk ? todoDayKey(t) : null }));
};

// "Sep 8" style label for a date key, for the small muted tag on a task.
export const shortDate = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
