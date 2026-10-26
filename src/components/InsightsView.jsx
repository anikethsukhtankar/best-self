import { useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';
import { currentStreak, bestStreak, weekPercent } from '../utils/insights';
import { YearGrid } from './YearGrid';
import { TrendLine } from './TrendLine';
import { HabitStairs } from './Staircase';

// Stats Row: three thin numbers
export function StatsRow({ habits, completions, threshold }) {
  const { theme, S } = useTheme();
  const stats = useMemo(() => {
    const today = new Date();
    const week = weekPercent(habits, completions, today);
    return {
      current: currentStreak(habits, completions, threshold, today),
      best: bestStreak(habits, completions, threshold, today),
      week: week === null ? null : Math.round(week * 100),
    };
  }, [habits, completions, threshold]);
  const big = { fontSize: 'clamp(44px, 12vw, 72px)', fontWeight: 100, lineHeight: 1, color: theme.text, fontVariantNumeric: 'tabular-nums' };
  const cells = [[stats.current, 'Day streak'], [stats.best, 'Best streak'], [stats.week === null ? '–' : `${stats.week}%`, 'This week']];

  return (
    <div style={{ ...S.statsRow, justifyContent: 'space-between', gap: 24, marginBottom: 72, flexWrap: 'nowrap' }}>
      {cells.map(([value, label]) => (
        <div key={label} style={{ flex: 1 }}>
          <div style={big}>{value}</div>
          <div style={{ ...S.statLabel, marginTop: 12 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// Insights, top to bottom: three thin numbers, the year, the trend, then each habit's staircase.
export function InsightsView({ habits, completions, threshold, blockOrder }) {
  const { S } = useTheme();
  return (
    <>
      {Object.keys(completions).length === 0 && (
        <p style={{ ...S.settingsNote, marginTop: 0, marginBottom: 40 }}>Insights fill in as you check things off.</p>
      )}
      <StatsRow habits={habits} completions={completions} threshold={threshold} />
      <YearGrid habits={habits} completions={completions} threshold={threshold} />
      <TrendLine habits={habits} completions={completions} />
      <HabitStairs habits={habits} completions={completions} threshold={threshold} blockOrder={blockOrder} />
    </>
  );
}
