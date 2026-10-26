import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../hooks/useTheme';
import { DAY_LETTERS } from '../utils/constants';
import { formatDateKey } from '../utils/date';
import { stagesOf, isResting, describeRecurrence, REST_CHOICES } from '../utils/habits';
import { shortDate } from '../utils/todos';
import { roman } from '../utils/turn';

const sameRecurrence = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Add or edit a habit. Enter saves, Escape or the backdrop cancels. No <form>: handlers only.
// An existing habit shows the stages it has grown through. A change to its days or minutes
// starts a new stage from today, and the note under the fields says so before saving.
export function HabitModal({ habit, labels, blockOrder, defaultBlock, onSave, onArchive, onRest, onResume, onClose }) {
  const { theme, S } = useTheme();
  const isEdit = Boolean(habit);
  const [text, setText] = useState(habit?.text || '');
  const [timeBlock, setTimeBlock] = useState(habit?.timeBlock || defaultBlock || blockOrder[0]);
  const [daily, setDaily] = useState(!habit || habit.recurrence?.type !== 'specific_days');
  const [days, setDays] = useState(habit?.recurrence?.days || []);
  const [duration, setDuration] = useState(habit?.durationMinutes ? String(habit.durationMinutes) : '');
  const [touched, setTouched] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key !== 'Escape') return;
      if (restOpen) setRestOpen(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, restOpen]);

  const name = text.trim();
  const minutes = duration.trim() === '' ? null : Number(duration);
  const minutesOk = minutes === null || (Number.isInteger(minutes) && minutes >= 0 && minutes <= 1440);
  const valid = name.length > 0 && (daily || days.length > 0) && minutesOk;
  const error = !touched || valid ? null
    : !name ? 'Give the habit a name.'
    : !daily && days.length === 0 ? 'Pick at least one day.'
    : 'Duration is whole minutes, up to 1440.';
  const recurrence = daily ? { type: 'daily' } : { type: 'specific_days', days: [...days].sort((a, b) => a - b) };

  // Where this habit stands: its stages, whether it rests today, and what a save would do.
  const todayKey = formatDateKey(new Date());
  const stages = isEdit ? stagesOf(habit) : [];
  const current = stages[stages.length - 1];
  const steps = stages.filter((st) => !st.rest).length;
  const resting = isEdit && isResting(habit, todayKey);
  const startsStage = isEdit && !resting && current && current.from < todayKey && valid
    && ((minutes || null) !== (current.durationMinutes ?? null) || !sameRecurrence(recurrence, current.recurrence));

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onSave({ text: name, timeBlock, recurrence, durationMinutes: minutes || null });
  };
  const toggleDay = (d) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  const pill = (selected) => ({ ...S.pill, ...(selected ? S.pillSelected : {}) });
  const quiet = { fontSize: 12, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' };

  let n = 0;
  const ledger = stages.map((st) => {
    const numeral = st.rest ? '' : roman(++n);
    const terms = st.rest
      ? `Rest${st.until ? ` until ${shortDate(st.until)}` : ''}`
      : [st.text, st.durationMinutes && !st.text.includes(`${st.durationMinutes} min`) ? `${st.durationMinutes} min` : null, describeRecurrence(st)].filter(Boolean).join(' · ');
    return { key: st.from, numeral, terms, since: st.from === '0000-01-01' ? 'from the start' : `since ${shortDate(st.from)}` };
  });

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
        {startsStage && (
          <p style={{ ...S.settingsNote, marginTop: 20 }}>
            Saves as stage {roman(steps + 1)}, from today. The days before keep stage {roman(steps)}.
          </p>
        )}

        {ledger.length > 1 && (
          <div style={{ marginTop: 28 }}>
            <label style={S.modalLabel}>Stages</label>
            {ledger.map((row, i) => (
              <div key={row.key} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '10px 0', borderTop: `1px solid ${theme.borderLight}`, color: i === ledger.length - 1 ? theme.text : theme.textMuted }}>
                <span style={{ width: 28, flexShrink: 0, fontSize: 12, letterSpacing: '0.15em' }}>{row.numeral}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 300, minWidth: 0 }}>{row.terms}</span>
                <span style={{ ...quiet, flexShrink: 0 }}>{row.since}</span>
              </div>
            ))}
          </div>
        )}

        <button style={{ ...S.modalButton, opacity: valid || !touched ? 1 : 0.5 }} onClick={submit}>
          {isEdit ? 'Save' : 'Add habit'}
        </button>

        {isEdit && resting && (
          <>
            <p style={{ ...S.settingsNote, textAlign: 'center' }}>
              Resting {current.until ? `until ${shortDate(current.until)}` : 'until you bring it back'}.
            </p>
            <button style={{ ...S.archiveButton, color: theme.text }} onClick={() => onResume(habit.id)}>Bring it back today</button>
          </>
        )}
        {isEdit && !resting && !restOpen && (
          <button style={S.archiveButton} onClick={() => setRestOpen(true)}>Rest for a season</button>
        )}
        {isEdit && !resting && restOpen && (
          <div style={{ marginTop: 20 }}>
            <p style={{ ...S.settingsNote, marginTop: 0, marginBottom: 14 }}>It leaves Today while it rests. Rest days break nothing, and its history stays whole.</p>
            <div style={{ ...S.pillGroup, marginBottom: 0 }}>
              {REST_CHOICES.map(([choice, label]) => (
                <button key={choice} style={pill(false)} onClick={() => onRest(habit.id, choice)}>{label}</button>
              ))}
            </div>
          </div>
        )}
        {isEdit && (
          <button style={S.archiveButton} onClick={() => onArchive(habit.id)}>
            Archive this habit
          </button>
        )}
      </div>
    </div>
  );
}
