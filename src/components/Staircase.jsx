import { useId, useMemo, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useWidth } from '../hooks/useWidth';
import { useDay } from '../hooks/useDay';
import { staircase } from '../utils/staircase';
import { habitBreakdown } from '../utils/insights';
import { formatDateKey, parseDateKey, formatDate } from '../utils/date';
import { isResting, stageAt } from '../utils/habits';
import { TIME_BLOCKS } from '../utils/constants';

// Row size: the lowest tread 16px above the ground line, 8px a step, at most 64px tall.
// Page size (a habit's own page): 32px, 18px a step, at most 160px.
const SIZES = { row: { base: 16, headroom: 9, step: 8, max: 64, depth: [5, 3] }, page: { base: 32, headroom: 14, step: 18, max: 160, depth: [8, 5] } };

const weekLabel = (start, monthly) => formatDate(parseDateKey(start), monthly ? 'monthYear' : 'monthDay');

// One habit's life: weekly columns of stone under a tread that rises with every step up.
export function Stair({ habit, s, onHover, size = 'row' }) {
  const { base: BASE, headroom: HEADROOM, step, max, depth: [dx, dy] } = SIZES[size];
  const { theme } = useTheme();
  const uid = useId().replace(/:/g, '');
  const [ref, width] = useWidth(600);
  const n = s.columns.length;
  const col = width / n;
  const gutter = col >= 5 ? 1 : 0;
  // Each step up rises one step; a habit with many steps compresses so the figure stays under max.
  const rise = s.maxLevel ? Math.min(step, (max - BASE - HEADROOM) / s.maxLevel) : 0;
  const H = BASE + HEADROOM + s.maxLevel * rise;
  const y = (level) => H - BASE - level * rise;
  const hatch = `st-${uid}`;
  const last = s.columns[n - 1];

  const profile = [];
  const depth = [];
  s.treads.forEach((t, k) => {
    if (t.before) return;
    const x0 = t.from * col;
    const x1 = (t.to + 1) * col;
    const ty = y(t.level);
    const prev = s.treads[k - 1];
    if (prev && !prev.before && prev.level !== t.level) profile.push(<line key={`r${k}`} x1={x0} x2={x0} y1={y(prev.level)} y2={ty} stroke={theme.accent} strokeWidth={1} />);
    profile.push(<line key={`t${k}`} x1={x0} x2={x1} y1={ty} y2={ty} stroke={theme.accent} strokeWidth={1} strokeDasharray={t.rest ? '2 3' : undefined} />);
    depth.push(<line key={`d${k}`} x1={x0 + dx} x2={Math.min(width, x1 + dx)} y1={ty - dy} y2={ty - dy} stroke={theme.textFaintest} strokeWidth={1} />);
  });

  return (
    <div ref={ref} style={{ position: 'relative' }} onMouseLeave={() => onHover(null)}>
      {width > 0 && (
        <svg width={width} height={H} style={{ display: 'block', overflow: 'visible' }} role="img" aria-label={`${habit.text}: ${s.times} times since it began, ${s.rooted}`}>
          <defs>
            <pattern id={hatch} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="4" stroke={theme.accent} strokeWidth="1" />
            </pattern>
          </defs>
          <line x1={0} x2={width} y1={H - 0.5} y2={H - 0.5} stroke={theme.border} strokeWidth={1} />
          {s.columns.map((c, i) => c.ink && (
            <rect key={i} x={i * col + gutter / 2} y={y(c.level)} width={Math.max(0.5, col - gutter)} height={H - y(c.level)} fill={c.ink === 'solid' ? theme.accent : `url(#${hatch})`} />
          ))}
          {depth}
          {profile}
          {last && !last.before && <circle cx={width - 3} cy={y(last.level) - 4} r={2.5} fill={theme.accent} />}
          {s.columns.map((c, i) => (
            <rect
              key={`h${i}`}
              x={i * col}
              y={0}
              width={col}
              height={H}
              fill="transparent"
              onMouseEnter={() => onHover(c.before ? null : `${s.monthly ? '' : 'Week of '}${weekLabel(c.start, s.monthly)} · ${c.rest ? 'resting' : c.scheduled ? `${c.done} of ${c.scheduled}` : 'not due'}${c.stage && !c.rest ? ` · ${c.stage.text}` : ''}`)}
            />
          ))}
        </svg>
      )}
    </div>
  );
}

// Insights: every active habit as the staircase it has climbed, in the order of the day.
export function HabitStairs({ habits, completions, threshold, blockOrder = TIME_BLOCKS, today: now, onOpen }) {
  const { theme, S } = useTheme();
  const [hover, setHover] = useState({});
  const today = useDay(now);
  const todayKey = formatDateKey(today);
  const rates = useMemo(() => Object.fromEntries(habitBreakdown(habits, completions, 30, today).map((r) => [r.habit.id, r.rate])), [habits, completions, today]);
  const rows = useMemo(() => habits
    .filter((h) => !h.archivedAt)
    .sort((a, b) => blockOrder.indexOf(a.timeBlock) - blockOrder.indexOf(b.timeBlock) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((habit) => ({ habit, s: staircase(habit, completions, threshold, today), stage: stageAt(habit, todayKey) })),
  [habits, completions, threshold, today, todayKey, blockOrder]);
  if (rows.length === 0) return null;

  return (
    <div style={S.breakdownSection}>
      <div style={S.sectionLabel}>Habits, as they grew</div>
      {rows.map(({ habit, s, stage }) => {
        const resting = isResting(habit, todayKey);
        const rate = rates[habit.id];
        return (
          <div key={habit.id} style={{ padding: '18px 0 20px', borderBottom: `1px solid ${theme.borderLight}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, marginBottom: 12, minHeight: 21 }}>
              <span style={{ fontSize: 14, color: theme.text, minWidth: 0 }}>
                {onOpen ? (
                  <button style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }} onClick={() => onOpen(habit.id)}>{stage?.text ?? habit.text}</button>
                ) : (stage?.text ?? habit.text)}
                <span style={{ fontSize: 12, color: theme.textMuted, marginLeft: 10 }}>{resting ? 'resting' : s.rooted}</span>
              </span>
              <span style={{ fontSize: 12, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0, textAlign: 'right' }}>
                {hover[habit.id] || `${s.times} ${s.times === 1 ? 'time' : 'times'}${rate === null || rate === undefined ? '' : ` · ${Math.round(rate * 100)}% lately`}`}
              </span>
            </div>
            <Stair habit={habit} s={s} onHover={(text) => setHover((h) => (h[habit.id] === text ? h : { ...h, [habit.id]: text }))} />
          </div>
        );
      })}
      <p style={{ ...S.settingsNote, fontSize: 12 }}>
        Each column is a week: solid when it held, hatched when begun. The tread rises with every step up; a lighter step is a landing.
      </p>
    </div>
  );
}
