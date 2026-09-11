// Server-side smoke render of the Insights components: no browser needed.
// Build: npx vite build --ssr tests/visual/ssr.jsx --outDir dist-ssr   Run: node dist-ssr/ssr.js
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '../../src/hooks/ThemeProvider';
import { StatsRow, HabitBreakdown } from '../../src/App';
import { YearGrid } from '../../src/components/YearGrid';
import { TrendLine } from '../../src/components/TrendLine';
import { SEED_HABITS } from '../../src/utils/constants';
import { formatDateKey, addDays } from '../../src/utils/date';
import { isHabitScheduledForDay } from '../../src/utils/habits';

const today = new Date(2026, 8, 10);
const habits = SEED_HABITS.slice(0, 12);
const completions = {};
let seed = 7;
const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
for (let i = 200; i >= 0; i--) {
  const d = addDays(today, -i);
  const mood = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(i / 9)) + (i < 20 ? 0.2 : 0);
  const day = {};
  habits.forEach((h) => { if (isHabitScheduledForDay(h, d) && rand() < mood) day[h.id] = true; });
  if (i % 17 === 0) continue;
  completions[formatDateKey(d)] = day;
}

const html = renderToStaticMarkup(
  <ThemeProvider darkMode={false}>
    <StatsRow habits={habits} completions={completions} threshold={0.8} />
    <YearGrid habits={habits} completions={completions} threshold={0.8} today={today} />
    <TrendLine habits={habits} completions={completions} today={today} />
    <HabitBreakdown habits={habits} completions={completions} />
  </ThemeProvider>
);
const count = (re) => (html.match(re) || []).length;
const report = {
  bytes: html.length,
  gridCells: count(/title="[^"]*(nothing scheduled|%)/g),
  monthLabels: count(/position:absolute;left:\d+px">[A-Z][a-z]{2}</g),
  trendPaths: count(/<path d="M[^"]*C/g),
  breakdownRows: count(/-day streak|no current streak|not scheduled/g),
  statLabels: ['Day streak', 'Best streak', 'This week'].map((l) => html.includes(l)),
};
console.log(JSON.stringify(report));
if (report.gridCells < 300 || report.trendPaths < 1 || report.breakdownRows < 5 || report.statLabels.includes(false)) { throw new Error('SMOKE FAILED: ' + JSON.stringify(report)); }
console.log('smoke ok');
