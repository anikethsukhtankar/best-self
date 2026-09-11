import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { TIME_BLOCK_LABELS } from '../utils/constants';

// Rename and reorder the five fixed time blocks. Drag a row with the mouse, or use the arrows.
// Blocks cannot be added or removed; empty ones simply never render in the daily view.
export function TimeBlockEditor({ labels, order, onChange }) {
  const { theme, S } = useTheme();
  const [dragging, setDragging] = useState(null);

  const move = (from, to) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange({ labels, order: next });
  };
  const rename = (block, text) => onChange({ labels: { ...labels, [block]: text }, order });
  const arrow = (disabled) => ({ ...S.tab, fontSize: 14, color: disabled ? theme.textFaintest : theme.textMuted, cursor: disabled ? 'default' : 'pointer', padding: '0 6px' });

  return (
    <div>
      {order.map((block, i) => (
        <div
          key={block}
          draggable
          onDragStart={() => setDragging(i)}
          onDragOver={(ev) => { ev.preventDefault(); }}
          onDrop={() => { if (dragging !== null) move(dragging, i); setDragging(null); }}
          onDragEnd={() => setDragging(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0',
            borderTop: `1px solid ${theme.border}`, opacity: dragging === i ? 0.4 : 1, cursor: 'grab',
          }}
        >
          <span aria-hidden="true" style={{ color: theme.textFaintest, fontSize: 14, letterSpacing: -2, width: 16 }}>⋮⋮</span>
          <input
            type="text"
            value={labels[block] ?? TIME_BLOCK_LABELS[block]}
            placeholder={TIME_BLOCK_LABELS[block]}
            aria-label={`Name of block ${i + 1}`}
            onChange={(ev) => rename(block, ev.target.value)}
            onBlur={(ev) => { if (!ev.target.value.trim()) rename(block, TIME_BLOCK_LABELS[block]); }}
            style={{ ...S.modalInput, flex: 1, fontSize: 15, padding: '6px 0', marginBottom: 0, borderBottom: `1px solid ${theme.border}` }}
          />
          <button style={arrow(i === 0)} disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move up">↑</button>
          <button style={arrow(i === order.length - 1)} disabled={i === order.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down">↓</button>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${theme.border}` }} />
    </div>
  );
}
