import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { DAY_LETTERS, MONTH_NAMES } from '../utils/constants';
import { isSameDay } from '../utils/date';
import { getDayCompletion } from '../utils/habits';
import { monthDays, gridLayout, dayMarks, LETTER_SIZE, NUMERAL_SIZE } from '../utils/calendar';

// The month as a Stendig grid: weekday letters, six weeks of numerals, a circle on the selected
// day and an X through every completed one. Drawn as one SVG in CSS pixels, sized to its column.
export function StendigCalendar({ selectedDate, onSelect, habits, completions, threshold }) {
  const { theme, S } = useTheme();
  const [viewMonth, setViewMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const [width, setWidth] = useState(0);
  const box = useRef(null);
  const today = new Date();
  const days = useMemo(() => monthDays(viewMonth), [viewMonth]);

  // Lay out before the first paint, then again whenever the column changes width. Resizes
  // re-render after the observer returns, so the new height never lands inside its callback.
  useLayoutEffect(() => {
    const el = box.current;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const L = width > 0 ? gridLayout(width, window.devicePixelRatio || 1) : null;

  return (
    <div style={S.stendigCalendar}>
      <div style={S.stendigHeader}>
        <span style={S.stendigNavArrow} onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>‹</span>
        <span style={S.stendigMonth}>{MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}</span>
        <span style={S.stendigNavArrow} onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>›</span>
      </div>
      <div ref={box}>
        {L && (
          <svg width={width} height={L.height} style={{ display: 'block', overflow: 'visible' }}>
            {DAY_LETTERS.map((d, i) => (
              <text
                key={'h' + i}
                x={L.x(i) + L.cell / 2}
                y={L.letterBaseline}
                textAnchor="middle"
                fill={theme.textFaintest}
                style={{ fontSize: LETTER_SIZE, letterSpacing: '0.15em' }}
              >
                {d}
              </text>
            ))}
            {days.map((day, i) => {
              const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentDay = isSameDay(day, today);
              const { percentage, total } = getDayCompletion(habits, completions, day);
              const isComplete = total > 0 && percentage >= threshold && day <= today;
              const m = dayMarks(L, i % 7, Math.floor(i / 7));
              const ink = isSelected ? theme.accentText : isCurrentMonth ? theme.text : theme.textFaintest;

              return (
                <g key={i} onClick={() => onSelect(day)} style={{ cursor: 'pointer' }}>
                  <rect {...m.cell} fill="transparent" />
                  {isSelected && <rect {...m.disc} fill={theme.accent} />}
                  <text
                    {...m.numeral}
                    textAnchor="middle"
                    fill={ink}
                    style={{ fontSize: NUMERAL_SIZE, fontWeight: isCurrentDay ? 500 : 300 }}
                  >
                    {day.getDate()}
                  </text>
                  {isComplete && [45, -45].map((deg) => (
                    <rect
                      key={deg}
                      {...m.strike.bar}
                      transform={`translate(${m.strike.cx} ${m.strike.cy}) rotate(${deg})`}
                      fill={isSelected ? theme.accentText : theme.accent}
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
