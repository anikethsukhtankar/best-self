// Habit-related utility functions
import { formatDateKey } from './date';

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

// Sanitize string to prevent XSS
export const sanitize = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>]/g, '');
};

// Sanitize imported data
export const sanitizeData = (data) => {
  return {
    ...data,
    habits: (data.habits || []).map(h => ({
      ...h,
      text: sanitize(h.text),
      id: sanitize(h.id),
      timeBlock: sanitize(h.timeBlock)
    })),
    todos: (data.todos || []).map(t => ({
      ...t,
      text: sanitize(t.text),
      id: sanitize(t.id)
    }))
  };
};
