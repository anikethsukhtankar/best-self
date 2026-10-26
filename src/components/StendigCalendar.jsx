import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { DAY_LETTERS, MONTH_NAMES } from '../utils/constants';
import { isSameDay, formatDateKey, formatDate } from '../utils/date';
import { getDayCompletion } from '../utils/habits';
import { monthDays, gridLayout, dayMarks, LETTER_SIZE, NUMERAL_SIZE } from '../utils/calendar';
import { dayKinds, isBuilt, monthRows, bridges, walls, projection, footprint, easeOut, monthChapter, BLOCK_HEIGHT } from '../utils/turn';

const TURN_MS = 250;
const HOLD_MS = 350; // pressed longer than this, the month name is held: letting go settles it
const CAPTION = 44; // room under the elevation for the chapter caption

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const pts = (list) => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

// The month as a Stendig grid: weekday letters, six weeks of numerals, a circle on the selected
// day and an X through every completed one. Drawn as one SVG in CSS pixels, sized to its column.
// Press the month name and it turns: the plan tips into an isometric elevation of the month,
// complete days standing as blocks. Tap to turn and tap again to settle, or hold to look.
export function StendigCalendar({ selectedDate, onSelect, habits, completions, threshold, chapters }) {
  const { theme, S } = useTheme();
  const uid = useId().replace(/:/g, '');
  const [viewMonth, setViewMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const [width, setWidth] = useState(0);
  const [turn, setTurn] = useState(0); // 0 flat plan, 1 elevation, between while turning
  const [goal, setGoal] = useState(0);
  const box = useRef(null);
  const anim = useRef({ raf: 0, value: 0, pressedAt: null });
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

  useEffect(() => () => cancelAnimationFrame(anim.current.raf), []);

  const turnTo = (target) => {
    const a = anim.current;
    cancelAnimationFrame(a.raf);
    setGoal(target);
    if (reducedMotion()) {
      a.value = target;
      setTurn(target);
      return;
    }
    const from = a.value;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / TURN_MS);
      a.value = from + (target - from) * easeOut(p);
      setTurn(a.value);
      if (p < 1) a.raf = requestAnimationFrame(step);
    };
    a.raf = requestAnimationFrame(step);
  };

  // Escape settles a turned month.
  useEffect(() => {
    if (!goal) return undefined;
    const onKey = (ev) => { if (ev.key === 'Escape') turnTo(0); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onPressStart = (ev) => {
    if (ev.button !== undefined && ev.button !== 0) return;
    if (goal) { anim.current.pressedAt = null; turnTo(0); return; }
    anim.current.pressedAt = performance.now();
    turnTo(1);
  };
  const onPressEnd = () => {
    const at = anim.current.pressedAt;
    anim.current.pressedAt = null;
    if (at !== null && performance.now() - at > HOLD_MS) turnTo(0);
  };
  const onKey = (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    turnTo(goal ? 0 : 1);
  };

  // Keyed on the date, not the clock, so the 60 frames of a turn reuse one computation.
  const todayKey = formatDateKey(today);
  const status = useMemo(() => {
    const now = new Date();
    return days.map((day) => {
      const c = getDayCompletion(habits, completions, day);
      return { ...c, complete: c.total > 0 && c.percentage >= threshold && day <= now };
    });
  }, [days, habits, completions, threshold, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const kinds = useMemo(() => dayKinds(days, viewMonth, status, new Date()), [days, viewMonth, status]);
  const chapter = useMemo(() => {
    const own = chapters?.[`${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, '0')}`];
    const given = monthChapter(habits, completions, threshold, viewMonth, new Date());
    return own ? { ...given, line: own } : given;
  }, [habits, completions, threshold, viewMonth, chapters]);

  const L = width > 0 ? gridLayout(width, window.devicePixelRatio || 1) : null;
  const shift = (delta) => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1));
  const monthLabel = `${MONTH_NAMES[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;

  return (
    <div style={S.stendigCalendar}>
      <div style={S.stendigHeader}>
        <span style={S.stendigNavArrow} onClick={() => shift(-1)}>‹</span>
        <span
          role="button"
          tabIndex={0}
          style={{ ...S.stendigMonth, cursor: 'pointer', touchAction: 'manipulation', outlineOffset: 6 }}
          aria-pressed={goal === 1}
          aria-label={`${monthLabel}. ${goal ? 'Showing the month as an elevation; press to settle' : 'Press to turn the month into an elevation'}`}
          onPointerDown={onPressStart}
          onPointerUp={onPressEnd}
          onPointerCancel={onPressEnd}
          onKeyDown={onKey}
          onContextMenu={(ev) => ev.preventDefault()}
        >
          {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </span>
        <span style={S.stendigNavArrow} onClick={() => shift(1)}>›</span>
      </div>
      <div ref={box}>
        {L && (turn === 0
          ? <Plan L={L} width={width} days={days} viewMonth={viewMonth} selectedDate={selectedDate} today={today} status={status} theme={theme} onSelect={onSelect} />
          : <Elevation L={L} uid={uid} e={turn} days={days} kinds={kinds} status={status} chapter={chapter} theme={theme}
              onSelect={(day) => { onSelect(day); turnTo(0); }} width={width} />)}
      </div>
    </div>
  );
}

function Plan({ L, width, days, viewMonth, selectedDate, today, status, theme, onSelect }) {
  return (
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
        const isComplete = status[i].complete;
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
  );
}

// The month stood up. Everything is drawn back to front (by u + v), so nearer blocks cover farther
// ones; walls facing another built day are left out so a run of days reads as one ridge.
function Elevation({ L, uid, e, days, kinds, status, chapter, theme, onSelect, width }) {
  const pitch = L.x(1);
  const cellFrac = L.cell / pitch;
  const rows = monthRows(kinds);
  const proj = projection({ width, height: L.height - CAPTION * e, pitch, cellFrac, top: L.y(0), rows }, e);
  const bridged = new Set(bridges(kinds));
  const hatchU = `hu-${uid}`;
  const hatchV = `hv-${uid}`;
  const fadeMarks = Math.max(0, 1 - e / 0.35);
  const order = days.map((_, i) => i).filter((i) => kinds[i] !== 'other')
    .sort((a, b) => (a % 7) + Math.floor(a / 7) - ((b % 7) + Math.floor(b / 7)) || a - b);

  const ground = [];
  const solids = [];
  const hits = [];
  for (const i of order) {
    const kind = kinds[i];
    const { u0, u1, v0, v1 } = footprint(i, cellFrac, e);
    const row = Math.floor(i / 7);
    const tip = `${formatDate(days[i], 'weekdayMonthDay')}${status[i].total ? ` · ${Math.round(status[i].percentage * 100)}% (${status[i].completed}/${status[i].total})` : ''}`;
    if (!isBuilt(kind)) {
      const base = [proj(u0, v0), proj(u1, v0), proj(u1, v1), proj(u0, v1)];
      const ink = kind === 'today' ? theme.accent : kind === 'future' ? theme.textFaintest : theme.textFaint;
      ground[kind === 'today' ? 'push' : 'unshift'](<polygon key={`g${i}`} points={pts(base)} fill="none" stroke={ink} strokeWidth={1} strokeDasharray={kind === 'future' ? '1 2' : undefined} opacity={Math.min(1, e / 0.5)} />);
      hits.push({ i, poly: base, tip });
      if (bridged.has(i)) {
        const vm = row + cellFrac / 2;
        const left = footprint(i - 1, cellFrac, e).u1;
        const right = footprint(i + 1, cellFrac, e).u0;
        solids.push(<line key={`b${i}`} x1={proj(left, vm, BLOCK_HEIGHT)[0]} y1={proj(left, vm, BLOCK_HEIGHT)[1]} x2={proj(right, vm, BLOCK_HEIGHT)[0]} y2={proj(right, vm, BLOCK_HEIGHT)[1]} stroke={theme.accent} strokeWidth={1} />);
      }
      if (kind === 'today') {
        const [tx, ty] = proj((u0 + u1) / 2, (v0 + v1) / 2);
        solids.push(<circle key={`t${i}`} cx={tx} cy={ty} r={2.5} fill={theme.accent} opacity={e} />);
      }
      continue;
    }
    const top = [proj(u0, v0, BLOCK_HEIGHT), proj(u1, v0, BLOCK_HEIGHT), proj(u1, v1, BLOCK_HEIGHT), proj(u0, v1, BLOCK_HEIGHT)];
    const lines = [];
    const w = walls(kinds, i);
    if (w.end) {
      const face = [proj(u1, v0), proj(u1, v1), proj(u1, v1, BLOCK_HEIGHT), proj(u1, v0, BLOCK_HEIGHT)];
      solids.push(<polygon key={`wu${i}`} points={pts(face)} fill={`url(#${hatchU})`} />);
      lines.push([face[0], face[1]], [face[0], face[3]]);
    }
    const front = [proj(u0, v1), proj(u1, v1), proj(u1, v1, BLOCK_HEIGHT), proj(u0, v1, BLOCK_HEIGHT)];
    solids.push(<polygon key={`wv${i}`} points={pts(front)} fill={`url(#${hatchV})`} />);
    lines.push([front[0], front[1]]);
    if (w.startEdge) lines.push([front[0], front[3]]);
    if (w.end) lines.push([front[1], front[2]]);
    lines.forEach(([[x1, y1], [x2, y2]], k) => solids.push(<line key={`l${i}-${k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.accent} strokeWidth={1} strokeLinecap="square" />));
    solids.push(<polygon key={`top${i}`} points={pts(top)} fill={theme.accent} stroke={theme.accent} strokeWidth={0.75} strokeLinejoin="round" />);
    if (kind === 'today-complete') {
      const [tx, ty] = proj((u0 + u1) / 2, (v0 + v1) / 2, BLOCK_HEIGHT);
      solids.push(<circle key={`t${i}`} cx={tx} cy={ty} r={2.5} fill={theme.bg} opacity={e} />);
    }
    hits.push({ i, poly: top, tip });
  }

  return (
    <svg width="100%" height={L.height} style={{ display: 'block', overflow: 'visible' }} role="img" aria-label={`Chapter ${chapter.numeral}, ${chapter.line}`}>
      <defs>
        <pattern id={hatchU} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
          <rect width="4" height="4" fill={theme.bg} />
          <line x1="0" y1="0" x2="0" y2="4" stroke={theme.accent} strokeWidth="1" />
        </pattern>
        <pattern id={hatchV} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(-45)">
          <rect width="4" height="4" fill={theme.bg} />
          <line x1="0" y1="0" x2="0" y2="4" stroke={theme.accent} strokeWidth="1" />
        </pattern>
      </defs>
      {fadeMarks > 0 && days.map((day, i) => {
        if (kinds[i] === 'other') return null;
        const { u0, u1, v0, v1 } = footprint(i, cellFrac, e);
        const [x, y] = proj((u0 + u1) / 2, (v0 + v1) / 2);
        return <text key={`n${i}`} x={x} y={y + 5} textAnchor="middle" fill={theme.text} opacity={fadeMarks} style={{ fontSize: NUMERAL_SIZE, fontWeight: 300 }}>{day.getDate()}</text>;
      })}
      {ground}
      {solids}
      {hits.map(({ i, poly, tip }) => (
        <polygon key={`h${i}`} points={pts(poly)} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onSelect(days[i])}>
          <title>{tip}</title>
        </polygon>
      ))}
      <g opacity={Math.max(0, (e - 0.5) * 2)}>
        <text x={width / 2} y={L.height - 26} textAnchor="middle" fill={theme.textMuted} style={{ fontSize: 11, letterSpacing: '0.2em' }}>
          CHAPTER {chapter.numeral}
        </text>
        <text x={width / 2} y={L.height - 6} textAnchor="middle" fill={theme.textMuted} style={{ fontSize: 13, fontWeight: 300 }}>
          {chapter.line}
        </text>
      </g>
    </svg>
  );
}
