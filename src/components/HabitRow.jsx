import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Checkmark } from './Checkmark';

export function HabitRow({ habit, checked, onToggle, onEdit }) {
  const { theme, S } = useTheme();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ ...S.habitRow, background: hovered ? theme.hover : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggle}
    >
      <div style={{ ...S.checkbox, background: checked ? theme.accent : 'transparent' }}>
        {checked && <Checkmark color={theme.accentText} />}
      </div>
      <span style={{
        ...S.habitText,
        textDecoration: checked ? 'line-through' : 'none',
        color: checked ? theme.textMuted : theme.text
      }}>
        {habit.text}
      </span>
      {onEdit && (
        <button
          style={{ ...S.tab, fontSize: 12, color: theme.textFaintest, opacity: hovered ? 1 : 0, marginLeft: 16 }}
          onClick={(ev) => { ev.stopPropagation(); onEdit(habit); }}
          aria-label={`Edit ${habit.text}`}
          tabIndex={-1}
        >
          Edit
        </button>
      )}
      {habit.durationMinutes && (
        <span style={S.habitDuration}>{habit.durationMinutes} min</span>
      )}
    </div>
  );
}
