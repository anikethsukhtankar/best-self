import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../hooks/useTheme';
import { DAY_LETTERS } from '../utils/constants';

// Add or edit a habit. Enter saves, Escape or the backdrop cancels. No <form>: handlers only.
export function HabitModal({ habit, labels, blockOrder, defaultBlock, onSave, onArchive, onClose }) {
  const { theme, S } = useTheme();
  const isEdit = Boolean(habit);
  const [text, setText] = useState(habit?.text || '');
  const [timeBlock, setTimeBlock] = useState(habit?.timeBlock || defaultBlock || blockOrder[0]);
  const [daily, setDaily] = useState(!habit || habit.recurrence?.type !== 'specific_days');
  const [days, setDays] = useState(habit?.recurrence?.days || []);
  const [duration, setDuration] = useState(habit?.durationMinutes ? String(habit.durationMinutes) : '');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (ev) => { if (ev.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const name = text.trim();
  const minutes = duration.trim() === '' ? null : Number(duration);
  const minutesOk = minutes === null || (Number.isInteger(minutes) && minutes >= 0 && minutes <= 1440);
  const valid = name.length > 0 && (daily || days.length > 0) && minutesOk;
  const error = !touched || valid ? null
    : !name ? 'Give the habit a name.'
    : !daily && days.length === 0 ? 'Pick at least one day.'
    : 'Duration is whole minutes, up to 1440.';

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onSave({
      text: name,
      timeBlock,
      recurrence: daily ? { type: 'daily' } : { type: 'specific_days', days: [...days].sort((a, b) => a - b) },
      durationMinutes: minutes || null,
    });
  };
  const toggleDay = (d) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  const pill = (selected) => ({ ...S.pill, ...(selected ? S.pillSelected : {}) });

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modal} onClick={(ev) => ev.stopPropagation()} role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit habit' : 'New habit'}>
        <button style={S.modalClose} onClick={onClose} aria-label="Close">×</button>
        <div style={S.modalTitle}>{isEdit ? 'Edit habit' : 'New habit'}</div>

        <input
          ref={inputRef}
          type="text"
          value={text}
          placeholder="Habit name"
          style={S.modalInput}
          onChange={(ev) => setText(ev.target.value)}
          onKeyDown={(ev) => { if (ev.key === 'Enter') submit(); }}
        />

        <label style={S.modalLabel}>Time block</label>
        <div style={S.pillGroup}>
          {blockOrder.map((b) => (
            <button key={b} style={pill(timeBlock === b)} onClick={() => setTimeBlock(b)}>{labels[b] || b}</button>
          ))}
        </div>

        <label style={S.modalLabel}>Repeat</label>
        <div style={S.pillGroup}>
          <button style={pill(daily)} onClick={() => setDaily(true)}>Every day</button>
          <button style={pill(!daily)} onClick={() => setDaily(false)}>Specific days</button>
        </div>
        {!daily && (
          <div style={S.pillGroup}>
            {DAY_LETTERS.map((l, d) => (
              <button key={d} style={{ ...pill(days.includes(d)), ...S.dayPill }} onClick={() => toggleDay(d)} aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]} aria-pressed={days.includes(d)}>{l}</button>
            ))}
          </div>
        )}

        <label style={S.modalLabel}>Duration</label>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
          <input
            type="text"
            inputMode="numeric"
            value={duration}
            placeholder="—"
            style={{ ...S.modalInput, width: 80, marginBottom: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            onChange={(ev) => setDuration(ev.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(ev) => { if (ev.key === 'Enter') submit(); }}
          />
          <span style={{ fontSize: 14, color: theme.textMuted }}>min</span>
        </div>

        {error && <p style={{ ...S.settingsNote, color: theme.text }}>{error}</p>}

        <button style={{ ...S.modalButton, opacity: valid || !touched ? 1 : 0.5 }} onClick={submit}>
          {isEdit ? 'Save' : 'Add habit'}
        </button>
        {isEdit && (
          <button style={S.archiveButton} onClick={() => onArchive(habit.id)}>
            Archive this habit
          </button>
        )}
      </div>
    </div>
  );
}
