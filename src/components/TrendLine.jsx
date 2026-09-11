import { useMemo, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { rollingAverage } from '../utils/insights';

const W = 600;
const H = 140;
const PAD = 6;

// Monotone cubic interpolation, so the curve never overshoots the data.
function smoothPath(points) {
  if (points.length < 2) return points.length ? `M${points[0][0]},${points[0][1]}` : '';
  const n = points.length;
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1][0] - points[i][0]);
    dy.push(points[i + 1][1] - points[i][1]);
    m.push(dy[i] / dx[i]);
  }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const x0 = points[i][0], y0 = points[i][1], x1 = points[i + 1][0], y1 = points[i + 1][1];
    const h = x1 - x0;
    d += ` C${x0 + h / 3},${y0 + (t[i] * h) / 3} ${x1 - h / 3},${y1 - (t[i + 1] * h) / 3} ${x1},${y1}`;
  }
  return d;
}

// Rolling average of daily completion over the last 90 days. No axes, no grid: just the line.
export function TrendLine({ habits, completions, today = new Date() }) {
  const { theme, S } = useTheme();
  const [window, setWindow] = useState(7);
  const [hover, setHover] = useState(null);
  const series = useMemo(() => rollingAverage(habits, completions, { days: 90, window, today }), [habits, completions, window, today]);
  const hasData = series.some((p) => p.value !== null);

  const x = (i) => PAD + (i / (series.length - 1)) * (W - 2 * PAD);
  const y = (v) => H - PAD - v * (H - 2 * PAD);
  // Break the line where there is no data.
  const runs = [];
  let run = [];
  series.forEach((p, i) => {
    if (p.value === null) { if (run.length) runs.push(run); run = []; }
    else run.push([x(i), y(p.value)]);
  });
  if (run.length) runs.push(run);

  const onMove = (ev) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const i = Math.round(((ev.clientX - rect.left) / rect.width) * (series.length - 1));
    setHover(Math.max(0, Math.min(series.length - 1, i)));
  };
  const h = hover !== null ? series[hover] : null;
  const label = (dk) => { const [yy, mm, dd] = dk.split('-').map(Number); return new Date(yy, mm - 1, dd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };

  return (
    <div style={S.trendContainer}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div style={{ ...S.sectionLabel, marginBottom: 0 }}>Trend · 90 days</div>
        <span style={{ fontSize: 12, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
          {h && h.value !== null ? `${label(h.dateKey)} · ${Math.round(h.value * 100)}%` : ''}
        </span>
      </div>
      {hasData ? (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          {runs.map((pts, i) => (
            <path key={i} d={smoothPath(pts)} fill="none" stroke={theme.accent} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {h && h.value !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={PAD} y2={H - PAD} stroke={theme.border} strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <circle cx={x(hover)} cy={y(h.value)} r="3" fill={theme.accent} vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
      ) : (
        <p style={S.settingsNote}>The line appears once a few days have been checked off.</p>
      )}
      <div style={S.trendToggles}>
        {[7, 30].map((w) => (
          <button key={w} style={{ ...S.trendToggle, color: window === w ? theme.text : theme.textMuted, textDecoration: window === w ? 'underline' : 'none', textUnderlineOffset: 4 }} onClick={() => setWindow(w)}>
            {w} days
          </button>
        ))}
      </div>
    </div>
  );
}
