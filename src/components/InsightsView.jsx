import { useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';
import { currentStreak, bestStreak, weekPercent, habitBreakdown } from '../utils/insights';
import { YearGrid } from './YearGrid';
import { TrendLine } from './TrendLine';

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

// Habit Breakdown: worst first, so what needs attention is at the top
export function HabitBreakdown({ habits, completions }) {
  const { theme, S } = useTheme();
  const rows = useMemo(() => habitBreakdown(habits, completions, 30, new Date()), [habits, completions]);
  if (rows.length === 0) return null;

  return (
    <div style={S.breakdownSection}>
      <div style={S.sectionLabel}>Habits · 30 days · worst first</div>
      {rows.map(({ habit, rate, streak, scheduled }) => (
        <div key={habit.id} style={{ padding: '14px 0', borderBottom: `1px solid ${theme.borderLight}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontSize: 14, color: theme.text }}>{habit.text}</span>
            <span style={{ fontSize: 13, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {rate === null ? '–' : `${Math.round(rate * 100)}%`}
            </span>
          </div>
          <div style={{ height: 2, background: theme.border, marginTop: 8 }}>
            <div style={{ height: '100%', width: `${Math.round((rate || 0) * 100)}%`, background: theme.accent }} />
          </div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 6 }}>
            {scheduled === 0 ? 'not scheduled in the last 30 days' : streak > 0 ? `${streak}-day streak` : 'no current streak'}
          </div>
        </div>
      ))}
    </div>
  );
}

// Insights, top to bottom: three thin numbers, the year, the trend, then each habit.
export function InsightsView({ habits, completions, threshold }) {
  const { S } = useTheme();
  return (
    <>
      {Object.keys(completions).length === 0 && (
        <p style={{ ...S.settingsNote, marginTop: 0, marginBottom: 40 }}>Insights fill in as you check things off.</p>
      )}
      <StatsRow habits={habits} completions={completions} threshold={threshold} />
      <YearGrid habits={habits} completions={completions} threshold={threshold} />
      <TrendLine habits={habits} completions={completions} />
      <HabitBreakdown habits={habits} completions={completions} />
    </>
  );
}
