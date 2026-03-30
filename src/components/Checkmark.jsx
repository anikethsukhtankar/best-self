export function Checkmark({ color = '#fff' }) {
  return (
    <svg viewBox="0 0 10 10" style={{ width: 12, height: 12, stroke: color, strokeWidth: 2, fill: 'none' }}>
      <path d="M2 5 L4 7 L8 3" />
    </svg>
  );
}
