import { useMemo, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useWidth } from '../hooks/useWidth';
import { useDay } from '../hooks/useDay';
import { MONTH_NAMES } from '../utils/constants';
import { parseDateKey, formatDate } from '../utils/date';
import { recordYears, recordStart, monthPlate, chapterFor, yearEvents } from '../utils/almanac';

const monthDay = (dk) => formatDate(parseDateKey(dk));

// One small month, printed: an X for a kept day, a single stroke for a begun one, a paper dot for
// every other past day, nothing for days to come. The traveller stands on today.
function Plate({ cells, cell, theme, onHover }) {
  const rows = Math.max(...cells.map((c) => c.row)) + 1;
  const inset = Math.max(3, cell * 0.24);
  return (
    <svg width={cell * 7} height={cell * rows} style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => onHover(null)}>
      {cells.map((c) => {
        const x = c.col * cell;
        const y = c.row * cell;
        const mid = [x + cell / 2, y + cell / 2];
        const tip = `${monthDay(c.dateKey)}${c.total ? ` · ${c.completed} of ${c.total}` : ''}`;
        return (
          <g key={c.dateKey} onMouseEnter={() => onHover(c.kind === 'future' ? null : tip)}>
            <rect x={x} y={y} width={cell} height={cell} fill="transparent" />
            {c.kind === 'kept' && <path d={`M${x + inset} ${y + inset}L${x + cell - inset} ${y + cell - inset}M${x + inset} ${y + cell - inset}L${x + cell - inset} ${y + inset}`} stroke={theme.accent} strokeWidth={1} />}
            {c.kind === 'begun' && <path d={`M${x + inset} ${y + cell - inset}L${x + cell - inset} ${y + inset}`} stroke={theme.accent} strokeWidth={1} />}
            {c.kind === 'blank' && !c.today && <rect x={mid[0] - 0.5} y={mid[1] - 0.5} width={1} height={1} fill={theme.textFaint} />}
            {c.today && <circle cx={mid[0]} cy={mid[1]} r={c.kind === 'kept' ? 2 : 1.75} fill={c.kind === 'kept' ? theme.bg : theme.accent} stroke={c.kind === 'kept' ? theme.accent : 'none'} />}
          </g>
        );
      })}
    </svg>
  );
}

// A chapter line you can rewrite in your own words. Enter keeps them, Escape lets them go;
// an emptied line goes back to the one the month was given.
function ChapterLine({ chapter, theme, onChange }) {
  const [draft, setDraft] = useState(null);
  const style = { fontSize: 12, fontWeight: 300, lineHeight: 1.5, color: theme.textSecondary };
  if (draft !== null) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={80}
        aria-label={`Chapter ${chapter.numeral}, in your own words`}
        style={{ ...style, width: '100%', border: 'none', borderBottom: `1px solid ${theme.border}`, outline: 'none', background: 'transparent', fontFamily: 'inherit', padding: '2px 0', color: theme.text }}
        onChange={(ev) => setDraft(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') { onChange(chapter.key, draft.trim()); setDraft(null); }
          if (ev.key === 'Escape') { ev.stopPropagation(); setDraft(null); }
        }}
        onBlur={() => { onChange(chapter.key, draft.trim()); setDraft(null); }}
      />
    );
  }
  return (
    <button
      style={{ ...style, border: 'none', background: 'none', padding: 0, textAlign: 'left', fontFamily: 'inherit', cursor: 'text' }}
      title="Write this chapter in your own words"
      onClick={() => setDraft(chapter.own ? chapter.line : '')}
    >
      {chapter.line}
    </button>
  );
}

// Insights: the year as a printed plate, with its chapters, the steps taken and the rests.
export function Almanac({ habits, completions, threshold, chapters, onChapter, today: now }) {
  const today = useDay(now);
  const { theme, S } = useTheme();
  const years = useMemo(() => recordYears(habits, completions, today), [habits, completions, today]);
  const [year, setYear] = useState(today.getFullYear());
  const [tip, setTip] = useState(null);
  const [ref, width] = useWidth(600);
  const columns = width >= 520 ? 4 : 2;
  const gap = width >= 520 ? 32 : 24;
  const cell = Math.floor((((width - gap * (columns - 1)) / columns) / 7) * 4) / 4;
  const months = useMemo(() => Array.from({ length: 12 }, (_, m) => ({
    m,
    cells: monthPlate(habits, completions, threshold, year, m, today),
    chapter: chapterFor(chapters, habits, completions, threshold, year, m, today),
  })), [habits, completions, threshold, year, chapters, today]);
  const events = useMemo(() => yearEvents(habits, year), [habits, year]);
  const start = useMemo(() => recordStart(habits, completions), [habits, completions]);
  const arrow = (enabled) => ({ ...S.stendigNavArrow, fontSize: 28, visibility: enabled ? 'visible' : 'hidden', border: 'none', background: 'none', fontFamily: 'inherit' });
  const turnable = years.length > 1;
  const listRow = { display: 'flex', gap: 16, alignItems: 'baseline', padding: '10px 0', borderTop: `1px solid ${theme.borderLight}`, fontSize: 14, fontWeight: 300, color: theme.text };
  const when = { fontSize: 12, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', width: 56, flexShrink: 0 };

  return (
    <div ref={ref} style={{ marginBottom: 80 }}>
      <div style={S.sectionLabel}>Almanac</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        {turnable && <button style={arrow(years.indexOf(year) > 0)} onClick={() => setYear(year - 1)} aria-label="Previous year">‹</button>}
        <span style={{ fontSize: width >= 520 ? 96 : 64, fontWeight: 100, lineHeight: 0.8, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: theme.text }}>{year}</span>
        {turnable && <button style={arrow(year < today.getFullYear())} onClick={() => setYear(year + 1)} aria-label="Next year">›</button>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', minHeight: 18 }}>{tip || ''}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, ${cell * 7}px)`, columnGap: gap, rowGap: 40, justifyContent: 'space-between' }}>
        {months.map(({ m, cells, chapter }) => {
          // Months before the record began, and months to come, are only their names.
          const before = start !== null && cells[cells.length - 1].dateKey < start;
          const future = new Date(year, m, 1) > today;
          return (
            <div key={m}>
              <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: before || future ? theme.textFaintest : theme.textMuted, marginBottom: 10 }}>
                {MONTH_NAMES[m]}
              </div>
              {!before && !future && cell > 0 && <Plate cells={cells} cell={cell} theme={theme} onHover={setTip} />}
              {!before && !future && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.15em', color: theme.textMuted, flexShrink: 0 }}>{chapter.numeral}</span>
                  <ChapterLine chapter={chapter} theme={theme} onChange={onChapter} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(events.steps.length > 0 || events.rests.length > 0) && (
        <div style={{ marginTop: 56 }}>
          {events.steps.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div style={S.sectionLabel}>Steps taken</div>
              {events.steps.map((e) => (
                <div key={`${e.from}${e.after}`} style={listRow}>
                  <span style={when}>{monthDay(e.from)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ color: theme.textMuted }}>{e.before}</span>
                    <span style={{ color: theme.textFaint, margin: '0 10px' }}>→</span>
                    {e.after}
                    {e.lighter && <span style={{ color: theme.textMuted, fontSize: 12, marginLeft: 10 }}>a lighter step</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
          {events.rests.length > 0 && (
            <div>
              <div style={S.sectionLabel}>Rests</div>
              {events.rests.map((e) => (
                <div key={`${e.from}${e.text}`} style={listRow}>
                  <span style={when}>{monthDay(e.from)}</span>
                  <span>{e.text}<span style={{ color: theme.textMuted, fontSize: 12, marginLeft: 10 }}>{e.until ? `until ${monthDay(e.until)}` : 'resting'}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
