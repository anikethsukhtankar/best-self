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

// Seed habits
export const SEED_HABITS = [
  createHabit('Drink a glass of water on waking', 'morning', { type: 'daily' }, 1, 0),
  createHabit('Morning ride: easy Zone 2 spin', 'morning', { type: 'specific_days', days: [1, 3, 5] }, 20, 1),
  createHabit('Morning ride: Zone 2 or structured cycling', 'morning', { type: 'specific_days', days: [2, 4] }, 35, 2),
  createHabit('Morning ride: long cycling session', 'morning', { type: 'specific_days', days: [6] }, 50, 3),
  createHabit('Morning ride: short, easy spin', 'morning', { type: 'specific_days', days: [0] }, 15, 4),
  createHabit('Waking Up meditation', 'morning', { type: 'daily' }, 10, 5),
  createHabit('Review time-blocked schedule', 'morning', { type: 'daily' }, 2, 6),
  createHabit('Push day: chest, shoulders, triceps', 'afternoon', { type: 'specific_days', days: [1] }, 45, 0),
  createHabit('Pull day: back, biceps, rear delts', 'afternoon', { type: 'specific_days', days: [3] }, 45, 1),
  createHabit('Leg day: squats, RDLs, lunges', 'afternoon', { type: 'specific_days', days: [5] }, 45, 2),
  createHabit("Barry's HIIT class or a hike", 'afternoon', { type: 'specific_days', days: [0] }, 50, 3),
  createHabit('Read 15 pages of a career book', 'postwork', { type: 'specific_days', days: [1, 6] }, 15, 0),
  createHabit('Career deep work: system design', 'postwork', { type: 'specific_days', days: [2] }, 45, 1),
  createHabit("Update brag doc", 'postwork', { type: 'specific_days', days: [3] }, 10, 2),
  createHabit('Side project or tech writing', 'postwork', { type: 'specific_days', days: [4] }, 45, 3),
  createHabit('Weekly career review', 'postwork', { type: 'specific_days', days: [5] }, 20, 4),
  createHabit('Weekly planning', 'postwork', { type: 'specific_days', days: [0] }, 15, 5),
  createHabit('Recovery: yoga or Therabody', 'evening', { type: 'daily' }, 18, 0),
  createHabit('Shutdown ritual', 'evening', { type: 'daily' }, 5, 1),
  createHabit('No caffeine after 12 PM', 'evening', { type: 'daily' }, null, 2),
  createHabit('Lights out by bedtime', 'evening', { type: 'daily' }, null, 3),
];

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
