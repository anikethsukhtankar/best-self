// Visual harness: renders the Insights components with 60 days of synthetic data.
// Build with `npm run visual`, then open dist-visual/tests/visual/insights.html (add ?dark=1 for dark mode).
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '../../src/hooks/ThemeProvider';
import { StatsRow, HabitBreakdown } from '../../src/App';
import { YearGrid } from '../../src/components/YearGrid';
import { TrendLine } from '../../src/components/TrendLine';
import { SEED_HABITS } from '../../src/utils/constants';
import { formatDateKey, addDays } from '../../src/utils/date';
import { isHabitScheduledForDay } from '../../src/utils/habits';
import '../../src/index.css';

const today = new Date();
const habits = SEED_HABITS.slice(0, 12);
const completions = {};
let seed = 7;
const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
for (let i = 200; i >= 0; i--) {
  const d = addDays(today, -i);
  const dk = formatDateKey(d);
  const mood = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(i / 9)) + (i < 20 ? 0.2 : 0);
  const day = {};
  habits.forEach((h) => { if (isHabitScheduledForDay(h, d) && rand() < mood) day[h.id] = true; });
  if (i % 17 === 0) continue; // a rest day now and then
  completions[dk] = day;
}
const dark = new URLSearchParams(location.search).get('dark') === '1';

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider darkMode={dark}>
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 24px 80px', background: dark ? '#0a0a0a' : '#fff', color: dark ? '#fff' : '#000' }}>
      <StatsRow habits={habits} completions={completions} threshold={0.8} />
      <YearGrid habits={habits} completions={completions} threshold={0.8} />
      <TrendLine habits={habits} completions={completions} />
      <HabitBreakdown habits={habits} completions={completions} />
    </div>
  </ThemeProvider>
);
