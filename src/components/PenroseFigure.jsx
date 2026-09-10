import { SEGMENTS, VIEWBOX, visibleSegments } from '../utils/penrose';

// Replaces the progress bar. Each stroke draws in over 200ms (see .penrose-seg in index.css).
export function PenroseFigure({ completed, total, complete, width = 96, color = '#000' }) {
  const visible = visibleSegments(completed, total, complete);
  const height = Math.round((width * 260) / 320);

  return (
    <svg
      viewBox={VIEWBOX}
      width={width}
      height={height}
      role="img"
      aria-label={`${completed} of ${total} habits${complete ? ', day complete' : ''}`}
      style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}
    >
      {SEGMENTS.map(([[x1, y1], [x2, y2]], i) => (
        <line
          key={i}
          className="penrose-seg"
          x1={x1} y1={y1} x2={x2} y2={y2}
          pathLength="1"
          stroke={color}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          strokeDasharray="1"
          strokeDashoffset={visible.has(i) ? 0 : 1}
        />
      ))}
    </svg>
  );
}
