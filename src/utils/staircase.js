// A habit's whole life as a staircase: time runs left to right in weekly columns, the tread rises
// one step each time the habit grew, and stone is laid only in weeks it was practised. A lighter
// step is a landing, not a drop: the path only climbs or walks on. Pure, no React.
import { formatDateKey, addDays, getWeekStart, parseDateKey } from './date.js';
import { stagesOf, isHabitScheduledForDay } from './habits.js';

const MIN_WEEKS = 8;

const days = (st) => (st.recurrence.type === 'daily' ? 7 : st.recurrence.days.length);

// Each stage's level: up one when it asks more (more minutes, more days, or new words with the
// same terms), level when it asks less or rests.
export const stageLevels = (stages) => {
  const levels = [];
  let level = 0;
  let prev = null;
  for (const st of stages) {
    if (!st.rest && prev) {
      const more = (st.durationMinutes ?? 0) > (prev.durationMinutes ?? 0)
        || days(st) > days(prev)
        || ((st.durationMinutes ?? 0) === (prev.durationMinutes ?? 0) && days(st) === days(prev) && st.text !== prev.text);
      if (more) level++;
    }
    levels.push(level);
    if (!st.rest) prev = st;
  }
  return levels;
};

// How rooted a habit is, from its days in force (rest days are not in force), oldest first, each
// { dateKey, scheduled, kept }. It becomes second nature the first day the trailing 66 days in force
// held at 80% or more with at least eight times due (66 days is the median time to automaticity
// found by Lally et al., 2010), and stays so: a step up or a bad month never uproots what was
// built. Taking root once three weeks in force hold a week's worth of practice; new before that.
const WINDOW = 66;
export const rootFrom = (inForce) => {
  let scheduled = 0;
  let kept = 0;
  let ever = 0;
  for (let i = 0; i < inForce.length; i++) {
    const d = inForce[i];
    scheduled += d.scheduled ? 1 : 0;
    kept += d.kept ? 1 : 0;
    ever += d.kept ? 1 : 0;
    if (i >= WINDOW) {
      const out = inForce[i - WINDOW];
      scheduled -= out.scheduled ? 1 : 0;
      kept -= out.kept ? 1 : 0;
    }
    if (i >= WINDOW - 1 && scheduled >= 8 && kept / scheduled >= 0.8) return { word: 'second nature', since: d.dateKey };
  }
  return { word: inForce.length >= 21 && ever >= 7 ? 'taking root' : 'new', since: null };
};

// Where the habit's record begins: its first stage, or its first check if the stage has always
// been there, or eight weeks ago for a habit with no history at all.
const beginning = (habit, completions, today) => {
  const first = stagesOf(habit)[0].from;
  if (first !== '0000-01-01') return parseDateKey(first);
  let earliest = null;
  for (const [dk, day] of Object.entries(completions)) if (day?.[habit.id] && (!earliest || dk < earliest)) earliest = dk;
  return earliest ? parseDateKey(earliest) : addDays(today, -7 * (MIN_WEEKS - 1));
};

// Columns are weeks (months beyond two years); each has its scheduled and done counts, its ink
// (solid when it met the threshold, hatch when begun, none otherwise), its level and whether the
// habit was resting. Treads are runs of columns at one level.
export const staircase = (habit, completions, threshold, today = new Date()) => {
  const stages = stagesOf(habit);
  const levels = stageLevels(stages);
  const todayKey = formatDateKey(today);
  const stageIndexAt = (dk) => {
    let at = -1;
    for (let i = 0; i < stages.length && stages[i].from <= dk; i++) at = i;
    return at;
  };
  const end = getWeekStart(today);
  let start = getWeekStart(beginning(habit, completions, today));
  const weeks = Math.round((end - start) / (7 * 864e5)) + 1;
  if (weeks < MIN_WEEKS) start = addDays(end, -7 * (MIN_WEEKS - 1));
  const monthly = weeks > 104;

  const columns = [];
  const inForce = [];
  let cursor = monthly ? new Date(start.getFullYear(), start.getMonth(), 1) : start;
  const archivedKey = habit.archivedAt ? formatDateKey(habit.archivedAt) : null;
  while (cursor <= today) {
    const next = monthly ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) : addDays(cursor, 7);
    let scheduled = 0;
    let done = 0;
    let lastIdx = -1;
    let rest = false;
    for (let d = new Date(cursor); d < next && formatDateKey(d) <= todayKey; d = addDays(d, 1)) {
      const dk = formatDateKey(d);
      if (archivedKey && dk >= archivedKey) break;
      const idx = stageIndexAt(dk);
      if (idx < 0) continue;
      lastIdx = idx;
      if (stages[idx].rest && !(stages[idx].until && stages[idx].until <= dk)) { rest = true; continue; }
      const due = isHabitScheduledForDay(habit, d);
      const kept = Boolean(completions[dk]?.[habit.id]);
      if (dk === todayKey && !kept) continue; // today is still open
      inForce.push({ dateKey: dk, scheduled: due, kept: due && kept });
      if (!due) continue;
      scheduled++;
      if (kept) done++;
    }
    const rate = scheduled ? done / scheduled : null;
    columns.push({
      start: formatDateKey(cursor),
      scheduled,
      done,
      ink: rate === null || done === 0 ? null : rate >= threshold ? 'solid' : 'hatch',
      level: lastIdx < 0 ? 0 : levels[lastIdx],
      stage: lastIdx < 0 ? null : stages[lastIdx],
      rest: rest && scheduled === 0,
      before: lastIdx < 0,
    });
    cursor = next;
  }

  const treads = [];
  columns.forEach((c, i) => {
    const last = treads[treads.length - 1];
    if (last && last.level === c.level && last.rest === c.rest && last.before === c.before) last.to = i;
    else treads.push({ from: i, to: i, level: c.level, rest: c.rest, before: c.before });
  });

  let times = 0;
  for (const day of Object.values(completions)) if (day?.[habit.id]) times++;
  const root = rootFrom(inForce);
  return { columns, treads, monthly, maxLevel: Math.max(0, ...levels), times, rooted: root.word, rootedSince: root.since };
};

// A habit's life in numbers that only grow: times kept, minutes given (each kept day counts the
// minutes of the stage it was kept under), when it began, and each stage with its own record.
export const lifetime = (habit, completions, today = new Date()) => {
  const todayKey = formatDateKey(today);
  const stages = stagesOf(habit);
  const first = stages[0].from !== '0000-01-01' ? stages[0].from : null;
  let times = 0;
  let minutes = 0;
  let earliest = null;
  const perStage = stages.map(() => ({ kept: 0, due: 0 }));
  const stageIndexAt = (dk) => {
    let at = -1;
    for (let i = 0; i < stages.length && stages[i].from <= dk; i++) at = i;
    return at;
  };
  for (const [dk, day] of Object.entries(completions)) {
    if (!day?.[habit.id] || dk > todayKey) continue;
    times++;
    if (!earliest || dk < earliest) earliest = dk;
    const i = stageIndexAt(dk);
    if (i >= 0) { minutes += stages[i].durationMinutes || 0; perStage[i].kept++; }
  }
  // Times each stage was due, up to today (an unchecked today is still open).
  const start = first || earliest;
  if (start) {
    const archivedKey = habit.archivedAt ? formatDateKey(habit.archivedAt) : null;
    for (let d = parseDateKey(start); formatDateKey(d) <= todayKey; d = addDays(d, 1)) {
      const dk = formatDateKey(d);
      if (archivedKey && dk >= archivedKey) break;
      if (!isHabitScheduledForDay(habit, d)) continue;
      if (dk === todayKey && !completions[dk]?.[habit.id]) continue;
      const i = stageIndexAt(dk);
      if (i >= 0) perStage[i].due++;
    }
  }
  return { times, minutes, since: first && earliest ? (first < earliest ? first : earliest) : first || earliest, stages: stages.map((st, i) => ({ ...st, ...perStage[i] })) };
};
