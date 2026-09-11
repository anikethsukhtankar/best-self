import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { yearGrid } from '../utils/insights';

const CELL = 12;
const GAP = 2;
const DAY_LABELS = ['', 'M', '', 'W', '', 'F', ''];

// Twelve months of days, Sunday to Saturday, in four inks: none, below threshold, partial, met.
export function YearGrid({ habits, completions, threshold, today = new Date() }) {
  const { theme, S } = useTheme();
  const [tip, setTip] = useState(null);
  const scroller = useRef(null);
  const columns = useMemo(() => yearGrid(habits, completions, threshold, today), [habits, completions, threshold, today]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [columns]);

  const ink = (level) => ({
    future: 'transparent', none: theme.gridEmpty, low: theme.gridLow, mid: theme.gridMid, high: theme.gridHigh,
  })[level];
  const width = columns.length * (CELL + GAP) - GAP;

  return (
    <div style={S.gridContainer}>
      <div style={S.sectionLabel}>Consistency · 12 months</div>
      <div ref={scroller} style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ width: width + 28, position: 'relative' }}>
          <div style={{ display: 'flex', marginLeft: 28, height: 16, position: 'relative' }}>
            {columns.map((col, i) => col.monthLabel ? (
              <span key={i} style={{ ...S.gridMonthLabel, position: 'absolute', left: i * (CELL + GAP) }}>{col.monthLabel}</span>
            ) : null)}
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, width: 28 }}>
              {DAY_LABELS.map((l, i) => <div key={i} style={{ ...S.gridDayLabel, height: CELL }}>{l}</div>)}
            </div>
            <div style={{ display: 'flex', gap: GAP }} onMouseLeave={() => setTip(null)}>
              {columns.map((col, ci) => (
                <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                  {col.cells.map((cell) => (
                    <div
                      key={cell.dateKey}
                      title={cell.level === 'future' ? '' : `${cell.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${cell.total ? `${Math.round(cell.percentage * 100)}% (${cell.completed}/${cell.total})` : 'nothing scheduled'}`}
                      onMouseEnter={() => cell.level !== 'future' && setTip(cell)}
                      style={{ width: CELL, height: CELL, background: ink(cell.level), border: cell.level === 'future' ? `1px solid ${theme.gridEmpty}` : 'none', boxSizing: 'border-box' }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, minHeight: 18 }}>
        <span style={{ fontSize: 12, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
          {tip ? `${tip.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${tip.total ? `${Math.round(tip.percentage * 100)}% (${tip.completed}/${tip.total})` : 'nothing scheduled'}` : ''}
        </span>
        <div style={{ ...S.gridLegend, marginTop: 0 }}>
          {[['none', 'rest'], ['low', 'under'], ['mid', 'partial'], ['high', 'met']].map(([lvl, label]) => (
            <span key={lvl} style={S.gridLegendItem}><i style={{ ...S.gridLegendBox, borderRadius: 0, background: ink(lvl), display: 'inline-block' }} />{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
