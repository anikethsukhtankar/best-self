// Louvers: the day numeral is a stack of paper slats, one per scheduled habit, morning at the
// top. A checked habit's slat lies flat and inks its band of the glyph; an unchecked slat
// stands edge-on and shows only its hinge line. The unchecked glyph is a drafting outline.
// With nothing scheduled the numeral is simply solid, as before.

// Where the digits' ink sits inside the line box (Instrument Sans at line-height .8).
const INK_TOP = 5;
const INK_BOTTOM = 95;

export function LouverNumeral({ value, slats, ink, faint, hinge, style, children }) {
  const n = slats.length;
  if (n === 0) {
    return <div style={style}>{value}{children}</div>;
  }

  const span = INK_BOTTOM - INK_TOP;
  const bands = slats.map((on, i) => ({
    on,
    top: INK_TOP + (span * i) / n,
    bottom: 100 - (INK_TOP + (span * (i + 1)) / n),
  }));
  const done = slats.filter(Boolean).length;

  return (
    <div style={{ ...style, perspective: 800 }} role="img" aria-label={`${value}, ${done} of ${n} habits done`}>
      <span aria-hidden="true" style={{ display: 'block', color: 'transparent', WebkitTextStroke: `0.75px ${faint}` }}>
        {value}
      </span>
      {bands.map((b, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="louver-slat"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'block',
            color: ink,
            clipPath: `inset(${b.top}% 0 ${b.bottom}% 0)`,
            transformOrigin: `50% ${b.top}%`,
            transform: b.on ? 'rotateX(0deg)' : 'rotateX(90deg)',
            backfaceVisibility: 'hidden',
          }}
        >
          {value}
        </span>
      ))}
      {bands.slice(1).map((b, i) => (
        <i
          key={`h${i}`}
          aria-hidden="true"
          style={{ position: 'absolute', left: '4%', right: '4%', top: `${b.top}%`, height: 1, background: hinge, pointerEvents: 'none' }}
        />
      ))}
      {children}
    </div>
  );
}
