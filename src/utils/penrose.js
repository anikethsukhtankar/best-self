// The Impossible Figure: a Penrose triangle drawn as 12 hairline strokes.
// Pure geometry and assignment logic, no React.

const V = [[70, 262], [330, 262], [200, 37]]; // bottom-left, bottom-right, top (counter-clockwise)
const CX = 200;
const CY = 187;
const BAR = 19;      // bar width
const INRADIUS = 75; // inradius of the outer triangle

const inset = (k) => V.map(([x, y]) => [
  CX + ((INRADIUS - k * BAR) / INRADIUS) * (x - CX),
  CY + ((INRADIUS - k * BAR) / INRADIUS) * (y - CY),
]);

// Point where the ray p + t*d meets the line through a and b.
const hit = ([px, py], [dx, dy], [ax, ay], [bx, by]) => {
  const ex = bx - ax;
  const ey = by - ay;
  const t = ((ax - px) * ey - (ay - py) * ex) / (dx * ey - dy * ex);
  return [px + t * dx, py + t * dy];
};

export const VIEWBOX = '40 20 320 260';

// Twelve strokes: 6 outer half-edges, 3 edges of the hole, 3 internal edges (one per corner).
export const SEGMENTS = (() => {
  const hole = inset(2);
  const segs = [];
  for (let k = 0; k < 3; k++) {
    const a = V[k];
    const b = V[(k + 1) % 3];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    segs.push([a, m], [m, b]);
  }
  for (let k = 0; k < 3; k++) segs.push([hole[k], hole[(k + 1) % 3]]);
  for (let k = 0; k < 3; k++) {
    const prev = V[(k + 2) % 3];
    const cur = V[k];
    const next = V[(k + 1) % 3];
    segs.push([hole[k], hit(hole[k], [cur[0] - prev[0], cur[1] - prev[1]], cur, next)]);
  }
  return segs;
})();

// The internal edge at the bottom-left corner is the stroke that makes the figure impossible.
// It is reserved for the check that completes the day.
export const CORNER = 9;
export const DRAW_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11];

// Which strokes are visible for `completed` of `total` habits.
// Unchecked work is absent, not gray; while a habit remains at least one stroke stays missing.
export const visibleSegments = (completed, total, complete) => {
  const visible = new Set();
  if (!total) return visible;
  let k;
  if (completed >= total) k = DRAW_ORDER.length;
  else if (completed <= 0) k = 0;
  else k = Math.min(DRAW_ORDER.length - 1, Math.max(1, Math.round((DRAW_ORDER.length * completed) / total)));
  DRAW_ORDER.slice(0, k).forEach((i) => visible.add(i));
  if (complete) visible.add(CORNER);
  return visible;
};
