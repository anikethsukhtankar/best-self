// Storage and time block constants
export const STORAGE_KEY = 'best-self-state';
export const TIME_BLOCKS = ['morning', 'prework', 'afternoon', 'postwork', 'evening'];
export const TIME_BLOCK_LABELS = {
  morning: 'Morning',
  prework: 'Pre-Work',
  afternoon: 'Afternoon',
  postwork: 'Post-Work',
  evening: 'Evening'
};
export const TIME_BLOCK_HOURS = {
  morning: { start: 6, end: 9 },
  prework: { start: 9, end: 12 },
  afternoon: { start: 12, end: 17 },
  postwork: { start: 17, end: 20 },
  evening: { start: 20, end: 23 }
};

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Generate unique ID
export const generateId = () =>
  Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

// Create habit helper
export const createHabit = (text, timeBlock, recurrence, durationMinutes, sortOrder) => ({
  id: generateId(),
  text,
  timeBlock,
  recurrence,
  durationMinutes,
  createdAt: new Date().toISOString(),
  sortOrder
});

// Seed habits: the core list a fresh start begins with. Mornings, cycling, push, pull and legs take
// turns; after work, a walk and study (an hour early in the week, two late in it); evenings, meditate,
// read, water and diet. Sunday is a rest day. Minutes only where the habit names them.
const MON_TO_SAT = { type: 'specific_days', days: [1, 2, 3, 4, 5, 6] };
const on = (...days) => ({ type: 'specific_days', days });
export const seedHabits = () => [
  createHabit('Cycling', 'morning', on(1, 3, 5), null, 0),
  createHabit('Push Day', 'morning', on(2), null, 1),
  createHabit('Pull Day', 'morning', on(4), null, 2),
  createHabit('Leg Day', 'morning', on(6), null, 3),
  createHabit('Rest Day', 'morning', on(0), null, 4),
  createHabit('5K Walk', 'postwork', MON_TO_SAT, null, 0),
  createHabit('Study 1 Hour', 'postwork', on(1, 2, 3), 60, 1),
  createHabit('Study 2 Hours', 'postwork', on(4, 5, 6), 120, 2),
  createHabit('Meditate', 'evening', MON_TO_SAT, null, 0),
  createHabit('Read 30 min', 'evening', MON_TO_SAT, 30, 1),
  createHabit('Drink 3L Water', 'evening', MON_TO_SAT, null, 2),
  createHabit('Healthy Diet', 'evening', MON_TO_SAT, null, 3),
];
export const SEED_HABITS = seedHabits();

// Default state
export const DEFAULT_STATE = {
  habits: SEED_HABITS,
  todos: [],
  completions: {},
  settings: {
    completionThreshold: 0.8,
    timeBlockLabels: { ...TIME_BLOCK_LABELS },
    timeBlockOrder: [...TIME_BLOCKS],
    timeBlockHours: { ...TIME_BLOCK_HOURS },
    darkMode: false
  }
};
