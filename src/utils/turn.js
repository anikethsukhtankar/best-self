// The Turn: the flat month grid turned into an isometric elevation of the days you built.
// Pure geometry and rules, no React. Grid units: one cell pitch; u runs along the week
// (columns), v down the weeks (rows), z up out of the page.
import { formatDateKey } from './date.js';
import { getHabitsForDay } from './habits.js';

export const BLOCK_HEIGHT = 0.5; // a complete day stands half a cell tall
export const LANE = 0.56; // and a week is a walkway this deep, with a street between weeks
const ISO_SQUASH = Math.tan(Math.PI / 6); // rotate 45°, squash by tan 30°: true isometric
const Z_SCALE = Math.sqrt(2 / 3); // a vertical unit, so blocks keep cube proportions

// What each of the 42 grid days is in the elevation, from its completion status
// ({ complete, total } per day). complete: met the threshold. missed: past, scheduled, not met.
// rest: past, nothing scheduled. today and future: as named. other: the neighbouring month's
// days, which are not drawn when the month is turned.
export const dayKinds = (days, viewMonth, status, today) => days.map((day, i) => {
  if (day.getMonth() !== viewMonth.getMonth()) return 'other';
  const isToday = formatDateKey(day) === formatDateKey(today);
  if (status[i].complete) return isToday ? 'today-complete' : 'complete';
  if (isToday) return 'today';
  if (day > today) return 'future';
  return status[i].total > 0 ? 'missed' : 'rest';
});

export const isBuilt = (kind) => kind === 'complete' || kind === 'today-complete';

// The rows that hold days of this month (a month spans four to six weeks of the grid).
export const monthRows = (kinds) => {
  const rows = [];
  for (let r = 0; r < 6; r++) if (kinds.slice(r * 7, r * 7 + 7).some((k) => k !== 'other')) rows.push(r);
  return { first: rows[0], count: rows.length };
};

// A single unbuilt day between two built days of the same week gets a bridge at block height,
// so the path never drops. Returns grid indices of the bridged days.
export const bridges = (kinds) => {
  const out = [];
  for (let i = 0; i < kinds.length; i++) {
    const col = i % 7;
    if (col === 0 || col === 6 || isBuilt(kinds[i]) || kinds[i] === 'other' || kinds[i] === 'future' || kinds[i] === 'today') continue;
    if (isBuilt(kinds[i - 1]) && isBuilt(kinds[i + 1])) out.push(i);
  }
  return out;
};

// Which faces of a built day show. Each week stands as its own walkway, so the front face (+v)
// always shows; the end face (+u) only where the run ends. Edges between days of one run are left
// out so a streak reads as one ridge.
export const walls = (kinds, i) => {
  const col = i % 7;
  const left = col > 0 && isBuilt(kinds[i - 1]);
  const right = col < 6 && isBuilt(kinds[i + 1]);
  return { end: !right, startEdge: !left };
};

const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - (1 - t) ** 3;

// A projection that is the flat plan at e = 0 and the isometric elevation at e = 1.
// Plan: (u, v) lands where the calendar draws it, `pitch` px per unit, rows starting at `top`.
// Elevation: turned 45° about the middle of the month, squashed to true isometric, scaled to
// fit `width` x `height` and centred there. In between, the grid turns and tips back.
export const projection = ({ width, height, pitch, cellFrac, top, rows }, e) => {
  const n = rows.count;
  // The middle of the month's cells, in grid units; also the middle of the slab once turned.
  const mu = (6 + cellFrac) / 2;
  const mv = rows.first + (n - 1 + cellFrac) / 2;
  const isoW = (7 + n) * Math.SQRT1_2;
  const isoH = (7 + n) * Math.SQRT1_2 * ISO_SQUASH + BLOCK_HEIGHT * Z_SCALE;
  const unit = Math.min((width * 0.9) / isoW, (height * 0.95) / isoH);
  const angle = (Math.PI / 4) * e;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const squash = lerp(1, ISO_SQUASH, e);
  const scale = lerp(pitch, unit, e);
  const cx = lerp(mu * pitch, width / 2, e);
  // Blocks rise above the slab, so its middle sits a little below the centre of the space.
  const cy = lerp(top + mv * pitch, height / 2 + (BLOCK_HEIGHT * Z_SCALE * unit) / 2, e);
  return (u, v, z = 0) => {
    const du = (u - mu) * scale;
    const dv = (v - mv) * scale;
    return [cx + du * cos - dv * sin, cy + (du * sin + dv * cos) * squash - z * Z_SCALE * scale * e];
  };
};

// The four ground corners of a day's footprint: the plan cell at e = 0; at e = 1 a stretch of its
// week's walkway, full length so neighbouring days meet, LANE deep and centred on the row.
export const footprint = (i, cellFrac, e) => {
  const col = i % 7;
  const row = Math.floor(i / 7);
  const grow = ((1 - cellFrac) / 2) * e;
  const thin = ((cellFrac - LANE) / 2) * e;
  return { u0: col - grow, u1: col + cellFrac + grow, v0: row + thin, v1: row + cellFrac - thin };
};

const ROMAN = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export const roman = (n) => {
  let out = '';
  let left = n;
  for (const [v, s] of ROMAN) while (left >= v) { out += s; left -= v; }
  return out;
};

// One quiet line for the month, from its strongest time block. A thin month is quiet, never failed.
const LINES = {
  morning: ['in which the mornings held', 'in which the mornings were kept', 'in which the day began early'],
  prework: ['in which the work began well', 'in which the desk was ready', 'in which the work was prepared for'],
  afternoon: ['in which the afternoons held', 'in which the afternoons were kept', 'in which the middle of the day held'],
  postwork: ['in which the evenings opened', 'in which the work was set down', 'in which the evenings were used well'],
  evening: ['in which the nights were kept', 'in which the evenings closed well', 'in which the days ended gently'],
};
// `variant` picks among a block's lines so consecutive months do not all say the same thing.
export const chapterLine = (rates, monthShare, variant = 0) => {
  if (monthShare === null) return 'not yet written';
  if (monthShare < 0.3) return 'in which the days were quiet';
  let best = null;
  for (const [block, rate] of Object.entries(rates)) if (rate !== null && (best === null || rate > rates[best])) best = block;
  const lines = best && LINES[best];
  return lines ? lines[variant % lines.length] : 'in which the days were kept';
};

// The month's chapter: its roman numeral and one line. Rates are per time block over the days of
// the month so far; the share is complete days over days that had anything scheduled.
export const monthChapter = (habits, completions, threshold, viewMonth, today = new Date()) => {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  const totals = {};
  let scheduledDays = 0;
  let completeDays = 0;
  for (let d = 1; d <= last; d++) {
    const date = new Date(year, month, d);
    if (date > today) break;
    const dayHabits = getHabitsForDay(habits, date);
    if (dayHabits.length === 0) continue;
    const done = completions[formatDateKey(date)] || {};
    let hit = 0;
    for (const h of dayHabits) {
      const t = (totals[h.timeBlock] ||= { done: 0, total: 0 });
      t.total++;
      if (done[h.id]) { t.done++; hit++; }
    }
    scheduledDays++;
    if (hit / dayHabits.length >= threshold) completeDays++;
  }
  const rates = Object.fromEntries(Object.entries(totals).map(([b, t]) => [b, t.total ? t.done / t.total : null]));
  const share = scheduledDays ? completeDays / scheduledDays : null;
  return { numeral: roman(month + 1), line: chapterLine(rates, share, month + year) };
};
