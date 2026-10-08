// The month grid as geometry: which 42 days it shows and where each mark sits, in CSS pixels.
// The flat Stendig view draws from this, and The Turn will project the same cells.

export const GRID_GAP = 4;
export const LETTER_SIZE = 11;
export const NUMERAL_SIZE = 16;

// A line of Instrument Sans (ascent 0.97 em, descent 0.25 em). The browser rounds each to whole
// device pixels, so an 11px line is 14px tall at 1x and 13.5px at 2x.
const line = (size, dpr) => {
  const ascent = Math.round(size * dpr * 0.97) / dpr;
  return { ascent, height: ascent + Math.round(size * dpr * 0.25) / dpr };
};

// Six Sunday-first weeks that cover the month.
export const monthDays = (viewMonth) => {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  return Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1 - first.getDay()));
};

// Seven square columns across `width` with a 4px gap, weekday letters on top with 16px below.
// The browser laid the old CSS grid out in 1/64ths of a device pixel and painted boxes snapped to
// whole device pixels; the SVG follows the same rules so it lands on the pixels the grid did.
export const gridLayout = (width, dpr = 1) => {
  const unit = (v) => Math.floor(v * dpr * 64) / (dpr * 64);
  const snap = (v) => Math.round(v * dpr) / dpr;
  const cell = Math.ceil(((width - 6 * GRID_GAP) / 7) * dpr * 64) / (dpr * 64);
  const pitch = cell + GRID_GAP;
  const letters = line(LETTER_SIZE, dpr);
  const top = letters.height + 16 + GRID_GAP;
  return {
    cell,
    height: top + 6 * cell + 5 * GRID_GAP,
    letterBaseline: letters.ascent,
    numeral: line(NUMERAL_SIZE, dpr),
    x: (col) => col * pitch,
    y: (row) => top + row * pitch,
    unit,
    snap,
  };
};

// One day's marks: where the numeral is centred, the disc behind a selected day, and the X
// through a completed one (two bars, 60% of a cell by 1.5px, crossed at 45° about `cx, cy`).
export const dayMarks = (layout, col, row) => {
  const { cell, unit, snap } = layout;
  const x = layout.x(col);
  const y = layout.y(row);
  const x0 = snap(x);
  const y0 = snap(y);
  const w = snap(x + cell) - x0;
  const h = snap(y + cell) - y0;
  const bar = unit(cell * 0.6);
  return {
    cell: { x, y, width: cell, height: cell },
    // The numeral's line box is centred in the cell; `y` is its baseline.
    numeral: { x: x + cell / 2, y: snap(y + unit((cell - layout.numeral.height) / 2) + layout.numeral.ascent) },
    // A circle's border radius, shrunk to fit the snapped box the way CSS shrinks radii.
    disc: { x: x0, y: y0, width: w, height: h, rx: Math.min(cell / 2, w / 2, h / 2) },
    strike: {
      cx: snap(x + unit(cell / 2)),
      cy: snap(y + unit(cell / 2)),
      bar: { x: -bar / 2, y: -0.75, width: snap(bar), height: snap(1.5) },
    },
  };
};
