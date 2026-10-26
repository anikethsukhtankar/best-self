import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Checkmark } from './Checkmark';

function TodoRow({ todo, tag, onToggle, onDelete }) {
  const { theme, S } = useTheme();
  const [hovered, setHovered] = useState(false);
  const checked = !!todo.completedAt;

  return (
    <div
      style={{ ...S.habitRow, background: hovered ? theme.hover : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{ ...S.checkbox, background: checked ? theme.accent : 'transparent' }}
        onClick={() => onToggle(todo.id)}
      >
        {checked && <Checkmark color={theme.accentText} />}
      </div>
      <span style={{
        ...S.habitText,
        textDecoration: checked ? 'line-through' : 'none',
        color: checked ? theme.textMuted : theme.text
      }}>
        {todo.text}
      </span>
      {tag && (
        <span style={{ fontSize: 12, color: theme.textFaint, marginLeft: 16, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{tag}</span>
      )}
      <span
        style={{ fontSize: 14, color: theme.textFaintest, cursor: 'pointer', padding: '0 8px', opacity: hovered ? 1 : 0 }}
        onClick={(ev) => { ev.stopPropagation(); onDelete(todo.id); }}
      >
        ×
      </span>
    </div>
  );
}

// The day's one-off tasks and the line to add one. Enter adds, Escape clears.
export function TaskList({ todos, tagFor, onToggle, onDelete, onAdd, compact }) {
  const { theme, S } = useTheme();
  const [text, setText] = useState('');
  return (
    <div style={compact ? { marginTop: 32, paddingTop: 24, borderTop: `1px solid ${theme.border}` } : S.todoSection}>
      <div style={S.sectionLabel}>Tasks</div>
      {todos.map((todo) => (
        <TodoRow key={todo.id} todo={todo} tag={tagFor(todo)} onToggle={onToggle} onDelete={onDelete} />
      ))}
      <input
        type="text"
        style={compact ? { ...S.todoInput, fontSize: 16 } : S.todoInput}
        placeholder="Add a task..."
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' && text.trim()) {
            onAdd(text.trim());
            setText('');
          }
          if (ev.key === 'Escape') {
            ev.preventDefault();
            setText('');
            ev.target.blur();
          }
        }}
      />
    </div>
  );
}
