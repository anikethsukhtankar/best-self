import { useMemo, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useDay } from '../hooks/useDay';
import { Stair } from './Staircase';
import { staircase, lifetime } from '../utils/staircase';
import { stageAt, isResting, describeRecurrence } from '../utils/habits';
import { formatDateKey, formatDate, parseDateKey } from '../utils/date';
import { roman } from '../utils/turn';

const longDate = (dk) => formatDate(parseDateKey(dk), 'monthYear');
const terms = (st) => [st.text, st.durationMinutes && !st.text.includes(`${st.durationMinutes} min`) ? `${st.durationMinutes} min` : null, describeRecurrence(st)].filter(Boolean).join(' · ');

// One habit's whole life on a page: what it is now, the two numbers that only grow (times kept and
// hours given), how rooted it is, its staircase drawn large, and the stages it has climbed.
export function HabitPage({ habit, completions, threshold, labels, onBack, backLabel, onEdit, today: now }) {
  const { theme, S } = useTheme();
  const today = useDay(now);
  const todayKey = formatDateKey(today);
  const [tip, setTip] = useState(null);
  const s = useMemo(() => staircase(habit, completions, threshold, today), [habit, completions, threshold, today]);
  const life = useMemo(() => lifetime(habit, completions, today), [habit, completions, today]);
  const current = stageAt(habit, todayKey) || habit;
  const resting = !habit.archivedAt && isResting(habit, todayKey);
  const hours = life.minutes / 60;
  const hoursText = hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10;
  const state = habit.archivedAt ? `archived ${formatDate(new Date(habit.archivedAt), 'monthDay')}`
    : resting ? 'resting'
    : s.rooted === 'second nature' ? `second nature since ${longDate(s.rootedSince)}`
    : s.rooted;
  const big = { fontSize: 'clamp(56px, 14vw, 96px)', fontWeight: 100, lineHeight: 0.85, letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums' };
  let n = 0;

  return (
    <div className="fade-in">
      <button style={{ ...S.backLink, border: 'none', background: 'none', padding: 0, fontFamily: 'inherit' }} onClick={onBack}>‹ {backLabel}</button>
      <div style={{ ...S.sectionLabel, marginBottom: 12 }}>
        {labels[habit.timeBlock] || habit.timeBlock}{life.since ? ` · since ${longDate(life.since)}` : ''}
      </div>
      <h2 style={{ fontSize: 'clamp(26px, 6vw, 34px)', fontWeight: 300, lineHeight: 1.2, color: theme.text, margin: '0 0 10px' }}>{current.text}</h2>
      <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 48 }}>
        {[current.durationMinutes && !current.text.includes(`${current.durationMinutes} min`) ? `${current.durationMinutes} min` : null, describeRecurrence(current), state].filter(Boolean).join(' · ')}
      </div>

      <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap', marginBottom: 56 }}>
        <div>
          <div style={big}>{life.times}</div>
          <div style={{ ...S.statLabel, marginTop: 14 }}>{life.times === 1 ? 'Time kept' : 'Times kept'}</div>
        </div>
        {life.minutes > 0 && (
          <div>
            <div style={big}>{hoursText}</div>
            <div style={{ ...S.statLabel, marginTop: 14 }}>{hoursText === 1 ? 'Hour given' : 'Hours given'}</div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <Stair habit={habit} s={s} onHover={setTip} size="page" />
      </div>
      <div style={{ fontSize: 12, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', minHeight: 18, marginBottom: 48 }}>
        {tip || 'Each column is a week: solid when it held, hatched when begun. The tread rises with each step up.'}
      </div>

      <div style={S.sectionLabel}>Stages</div>
      {life.stages.map((st, i) => {
        const numeral = st.rest ? '' : roman(++n);
        const last = i === life.stages.length - 1;
        const future = st.from > todayKey;
        return (
          <div key={st.from} style={{ display: 'flex', gap: 16, alignItems: 'baseline', padding: '12px 0', borderTop: `1px solid ${theme.borderLight}`, color: last ? theme.text : theme.textMuted }}>
            <span style={{ width: 28, flexShrink: 0, fontSize: 12, letterSpacing: '0.15em' }}>{numeral}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 300 }}>
              {st.rest ? `Rest${st.until ? `, until ${formatDate(parseDateKey(st.until))}` : ''}` : terms(st)}
            </span>
            <span style={{ fontSize: 12, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0, textAlign: 'right' }}>
              {st.from === '0000-01-01' ? 'from the start' : future ? `from ${formatDate(parseDateKey(st.from))}` : `since ${formatDate(parseDateKey(st.from))}`}
              {!st.rest && st.due > 0 && <span style={{ display: 'block' }}>{st.kept} of {st.due}</span>}
            </span>
          </div>
        );
      })}

      {!habit.archivedAt && (
        <button style={{ ...S.modalButton, marginTop: 48, background: 'transparent', color: theme.text, border: `1px solid ${theme.accent}` }} onClick={() => onEdit(habit)}>
          Edit this habit
        </button>
      )}
    </div>
  );
}
