// A sample year to look around: fourteen months of a practice that grew. Deterministic for a given
// day (a seeded generator), so it looks the same each visit. Never stored. Pure, no React.
import { formatDateKey, addDays } from './date.js';
import { isHabitScheduledForDay, stageAt } from './habits.js';
import { DEFAULT_STATE } from './constants.js';

// mulberry32: small, fast, seeded.
const prng = (seed) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const daily = { type: 'daily' };
const on = (...days) => ({ type: 'specific_days', days });

export const sampleState = (today = new Date(), { darkMode = false } = {}) => {
  const start = new Date(today.getFullYear(), today.getMonth() - 13, 1);
  const at = (days) => formatDateKey(addDays(start, days));
  const total = Math.round((today - start) / 864e5);
  const ago = (days) => formatDateKey(addDays(today, -days));
  const stage = (from, text, durationMinutes, recurrence, extra = {}) => ({ from, text, durationMinutes, recurrence, ...extra });

  const habits = [
    { id: 's-water', timeBlock: 'morning', sortOrder: 0, stages: [stage(at(0), 'Drink a glass of water on waking', null, daily)] },
    { id: 's-sit', timeBlock: 'morning', sortOrder: 1, stages: [
      stage(at(0), 'Meditate 2 min', 2, daily),
      stage(at(84), 'Meditate 5 min', 5, daily),
      stage(at(196), 'Meditate 10 min', 10, daily),
      stage(ago(44), 'Meditate 12 min', 12, daily),
    ] },
    { id: 's-move', timeBlock: 'morning', sortOrder: 2, stages: [
      stage(at(10), 'Walk 15 min', 15, daily),
      stage(at(120), 'Run 20 min', 20, on(1, 3, 5)),
      stage(at(260), 'Run 25 min', 25, on(1, 3, 5, 6)),
    ] },
    { id: 's-plan', timeBlock: 'prework', sortOrder: 0, stages: [stage(at(30), 'Plan the day on paper', 5, on(1, 2, 3, 4, 5))] },
    { id: 's-stretch', timeBlock: 'afternoon', sortOrder: 0, stages: [stage(at(150), 'Stretch 10 min', 10, daily)] },
    { id: 's-call', timeBlock: 'postwork', sortOrder: 0, stages: [stage(at(20), 'Call someone you love', null, on(0))] },
    { id: 's-read', timeBlock: 'evening', sortOrder: 0, next: 'Read for 30 minutes', stages: [
      stage(at(5), 'Read 5 pages', null, daily),
      stage(at(150), 'Read 15 pages', null, daily),
      stage(at(300), 'Read 20 pages', null, daily),
    ] },
    { id: 's-write', timeBlock: 'evening', sortOrder: 1, stages: [
      stage(at(60), 'Write three lines', null, daily),
      stage(at(225), 'Write three lines', null, daily, { rest: true, until: at(239) }),
    ] },
    { id: 's-lights', timeBlock: 'evening', sortOrder: 2, stages: [stage(at(0), 'Lights out by 11', null, daily)] },
  ].map((h) => {
    const now = h.stages[h.stages.length - 1];
    return { ...h, text: now.text, durationMinutes: now.durationMinutes, recurrence: now.recurrence, createdAt: `${h.stages[0].from}T07:00:00.000Z` };
  });

  // Each habit's chance of being kept grows with practice; stretching has been heavy lately;
  // a cold in month four and a fortnight of travel in month eight are weather.
  const rand = prng(Number(formatDateKey(today).replace(/-/g, '')));
  const completions = {};
  const todayKey = formatDateKey(today);
  for (let i = 0; i <= total; i++) {
    const date = addDays(start, i);
    const dk = formatDateKey(date);
    if (dk > todayKey) break;
    const sick = i >= 100 && i < 106;
    const away = i >= 225 && i < 239;
    const day = {};
    for (const h of habits) {
      if (!isHabitScheduledForDay(h, date)) continue;
      const st = stageAt(h, dk);
      const age = (date - new Date(`${h.stages[0].from}T00:00:00`)) / 864e5;
      let p = Math.min(0.96, 0.62 + age / 400);
      if (h.id === 's-stretch' && total - i < 21) p = 0.3;
      if (h.id === 's-sit' && st.text === 'Meditate 12 min') p = 0.97;
      if (sick) p *= 0.25;
      if (away && h.timeBlock !== 'morning') p *= 0.4;
      if (dk === todayKey) p = h.timeBlock === 'morning' ? 1 : 0; // the day is under way
      if (rand() < p) day[h.id] = true;
    }
    if (Object.keys(day).length) completions[dk] = day;
  }
  // Meditation has held its latest stage, so it is ready for a next step once today is done. The
  // other growing habits each slipped twice lately, so meditation is the one offered.
  for (let i = 1; i <= 44; i++) completions[ago(i)] = { ...completions[ago(i)], 's-sit': true };
  for (const id of ['s-plan', 's-read', 's-move']) {
    const h = habits.find((x) => x.id === id);
    let seen = 0;
    for (let i = 1; i < 40 && seen < 5; i++) {
      const d = addDays(today, -i);
      if (!isHabitScheduledForDay(h, d)) continue;
      seen++;
      if ((seen === 2 || seen === 5) && completions[ago(i)]) delete completions[ago(i)][id];
    }
  }

  const month = (back) => { const d = new Date(today.getFullYear(), today.getMonth() - back, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const chapters = { [month(5)]: 'in which we went to the sea', [month(10)]: 'in which I learned to run' };

  const todos = [
    { id: 's-t1', text: 'Book the dentist', createdAt: `${ago(2)}T09:00:00.000Z` },
    { id: 's-t2', text: 'Return the library books', createdAt: `${todayKey}T08:30:00.000Z` },
  ];

  return { habits, todos, completions, chapters, settings: { ...DEFAULT_STATE.settings, darkMode } };
};
