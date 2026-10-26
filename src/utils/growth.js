// When a habit is ready to grow, or feels heavy, and what its next step would be. Pure, no React.
// Nothing here changes a habit: it only offers. The person always chooses, and the past stays put.
import { formatDateKey, parseDateKey, addDays } from './date.js';
import { stageAt, stagesOf, isHabitScheduledForDay } from './habits.js';

// Round minutes to walk up and down. A step is the next rung at least 10% longer: 10 → 12,
// 20 → 25, 45 → 50. Small enough to feel easy, big enough to be growth.
export const LADDER = [1, 2, 3, 5, 7, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90, 105, 120];
export const longer = (m) => LADDER.find((v) => v >= m * 1.1) ?? Math.ceil((m * 1.15) / 5) * 5;
export const lighter = (m) => [...LADDER].reverse().find((v) => v <= m * 0.67) ?? 1;

// '10 min' in the name follows the minutes, so 'Meditate 10 min' becomes 'Meditate 12 min'.
const renamed = (text, from, to) => (from && text.includes(`${from} min`) ? text.replace(`${from} min`, `${to} min`) : text);

const daysPerWeek = (recurrence) => (recurrence.type === 'daily' ? 7 : recurrence.days.length);
const ageInDays = (fromKey, todayKey) => Math.round((parseDateKey(todayKey) - parseDateKey(fromKey)) / 864e5);

// The habit's recent scheduled days under its current stage, newest first. Today counts once it
// is checked; an unchecked today is still open, so it is left out rather than called a miss.
export const recentOccurrences = (habit, completions, today, max) => {
  const todayKey = formatDateKey(today);
  const stage = stageAt(habit, todayKey);
  const out = [];
  if (!stage) return out;
  for (let d = new Date(today), guard = 0; out.length < max && guard < 400; d = addDays(d, -1), guard++) {
    const dk = formatDateKey(d);
    if (dk < stage.from) break;
    if (!isHabitScheduledForDay(habit, d)) continue;
    const done = Boolean(completions[dk]?.[habit.id]);
    if (dk === todayKey && !done) continue;
    out.push({ dateKey: dk, done });
  }
  return out;
};

// How long it has held: back to the last time it was missed twice running (one miss is weather,
// two is a break), or to the day its stage began. In days.
export const heldDays = (habit, completions, today = new Date()) => {
  const todayKey = formatDateKey(today);
  const stage = stageAt(habit, todayKey);
  if (!stage || stage.rest) return 0;
  let since = todayKey;
  let missedLast = false;
  for (let d = new Date(today), guard = 0; guard < 730; d = addDays(d, -1), guard++) {
    const dk = formatDateKey(d);
    if (dk < stage.from) break;
    if (!isHabitScheduledForDay(habit, d)) continue;
    const done = Boolean(completions[dk]?.[habit.id]);
    if (dk === todayKey && !done) continue;
    if (!done && missedLast) break;
    if (done) since = dk;
    missedLast = !done;
  }
  return ageInDays(since, todayKey);
};

// { kind: 'ready' | 'heavy', proposal, evidence } or null.
// ready: the stage is three weeks old and the last N times it was due, it was missed at most once
//   (N = 12, or 8 for habits on fewer than three days a week).
// heavy: the stage is two weeks old and it was done three times or fewer in the last 8.
export const growthOffer = (habit, completions, today = new Date()) => {
  const todayKey = formatDateKey(today);
  if (habit.archivedAt) return null;
  if (habit.growth?.snoozeUntil && habit.growth.snoozeUntil > todayKey) return null;
  const stages = stagesOf(habit);
  if (stages[stages.length - 1].from > todayKey) return null; // a step is already set for tomorrow
  const stage = stageAt(habit, todayKey);
  if (!stage || stage.rest) return null;
  const age = stage.from === '0000-01-01' ? Infinity : ageInDays(stage.from, todayKey);
  const n = daysPerWeek(stage.recurrence) >= 3 ? 12 : 8;
  const recent = recentOccurrences(habit, completions, today, n);
  const done = recent.filter((o) => o.done).length;

  if (age >= 21 && recent.length >= n && done >= n - 1) {
    let proposal = null;
    if (habit.next) proposal = { text: habit.next, durationMinutes: stage.durationMinutes, recurrence: stage.recurrence };
    else if (stage.durationMinutes) {
      const minutes = longer(stage.durationMinutes);
      proposal = { text: renamed(stage.text, stage.durationMinutes, minutes), durationMinutes: minutes, recurrence: stage.recurrence };
    }
    if (proposal) return { kind: 'ready', proposal, evidence: { done, of: recent.length, sinceDays: heldDays(habit, completions, today) } };
  }

  const last8 = recent.slice(0, 8);
  const done8 = last8.filter((o) => o.done).length;
  if (age >= 14 && last8.length >= 8 && done8 <= 3) {
    const minutes = stage.durationMinutes && stage.durationMinutes > 1 ? lighter(stage.durationMinutes) : null;
    const proposal = minutes ? { text: renamed(stage.text, stage.durationMinutes, minutes), durationMinutes: minutes, recurrence: stage.recurrence } : null;
    return { kind: 'heavy', proposal, evidence: { done: done8, of: last8.length, sinceDays: age } };
  }
  return null;
};

// The one habit to offer a next step on Today: the readiest, longest-held one. Growth comes one
// step at a time, so nothing is offered within a week of any habit taking a step.
export const todaysOffer = (habits, completions, today = new Date()) => {
  const weekAgo = formatDateKey(addDays(today, -7));
  const recentStep = habits.some((h) => !h.archivedAt && stagesOf(h).some((st, i) => i > 0 && !st.rest && st.from > weekAgo));
  if (recentStep) return null;
  let best = null;
  for (const habit of habits) {
    const offer = growthOffer(habit, completions, today);
    if (offer?.kind !== 'ready') continue;
    const score = offer.evidence.done / offer.evidence.of + Math.min(offer.evidence.sinceDays, 365) / 3650;
    if (!best || score > best.score) best = { habit, offer, score };
  }
  return best;
};

// 'three weeks', 'a month', 'five months': how long a stage has held, in words.
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const heldFor = (days) => {
  if (days < 14) return `${days} days`;
  if (days < 60) return `${WORDS[Math.floor(days / 7)] || Math.floor(days / 7)} weeks`;
  if (days < 365) { const m = Math.floor(days / 30.44); return m === 1 ? 'a month' : `${WORDS[m] || m} months`; }
  const y = Math.floor(days / 365.25);
  return y === 1 ? 'a year' : `${WORDS[y] || y} years`;
};
