import { useTheme } from '../hooks/useTheme';
import { describeRecurrence, isResting, stagesOf, stageAt } from '../utils/habits';
import { formatDateKey } from '../utils/date';
import { shortDate } from '../utils/todos';

// Every habit: active ones grouped by time block, resting ones next, archived ones on a shelf below.
export function ManageHabits({ habits, labels, blockOrder, onBack, onNew, onEdit, onArchive, onRestore, onResume, onOpen }) {
  const { theme, S } = useTheme();
  const todayKey = formatDateKey(new Date());
  const resting = habits.filter((h) => !h.archivedAt && isResting(h, todayKey));
  const active = habits.filter((h) => !h.archivedAt && !isResting(h, todayKey));
  const archived = habits.filter((h) => h.archivedAt);
  const restingUntil = (h) => {
    const st = stagesOf(h)[stagesOf(h).length - 1];
    return st.until ? `until ${shortDate(st.until)}` : 'until you bring it back';
  };
  const linkStyle = { ...S.tab, fontSize: 12, color: theme.textMuted, marginLeft: 16 };
  // A habit's name opens its own page.
  const name = (h, text, style) => (
    <button style={{ ...style, border: 'none', background: 'none', padding: 0, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => onOpen(h.id)}>{text}</button>
  );

  return (
    <div>
      <span style={S.backLink} onClick={onBack}>‹ Back</span>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 36 }}>
        <div style={{ ...S.sectionLabel, marginBottom: 0 }}>Manage habits</div>
        <button style={{ ...S.tab, color: theme.text }} onClick={onNew}>+ New habit</button>
      </div>

      {blockOrder.map((block) => {
        const rows = active.filter((h) => h.timeBlock === block).sort((a, b) => a.sortOrder - b.sortOrder);
        if (rows.length === 0) return null;
        return (
          <div key={block} style={S.manageBlockSection}>
            <div style={S.sectionLabel}>{labels[block] || block}</div>
            {rows.map((h) => {
              // A step set for tomorrow shows from tomorrow; today the habit is as it is today.
              const now = stageAt(h, todayKey) || h;
              return (
              <div key={h.id} style={S.manageHabitRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div>{name(h, now.text, S.manageHabitText)}</div>
                  <div style={{ ...S.manageHabitMeta, marginLeft: 0, marginTop: 2, fontSize: 12 }}>
                    {describeRecurrence(now)}{now.durationMinutes ? ` · ${now.durationMinutes} min` : ''}{now !== h && h.text !== now.text ? ` · tomorrow: ${h.text}` : ''}
                  </div>
                </div>
                <button style={linkStyle} onClick={() => onEdit(h)}>Edit</button>
                <button style={linkStyle} onClick={() => onArchive(h.id)}>Archive</button>
              </div>
              );
            })}
          </div>
        );
      })}

      {active.length === 0 && (
        <p style={S.settingsNote}>No active habits. Add one and it will appear on its days.</p>
      )}

      {resting.length > 0 && (
        <div style={{ ...S.manageBlockSection, marginTop: 56 }}>
          <div style={S.sectionLabel}>Resting</div>
          {resting.map((h) => (
            <div key={h.id} style={S.manageHabitRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>{name(h, h.text, S.manageHabitText)}</div>
                <div style={{ ...S.manageHabitMeta, marginLeft: 0, marginTop: 2, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                  {labels[h.timeBlock] || h.timeBlock} · resting {restingUntil(h)}
                </div>
              </div>
              <button style={linkStyle} onClick={() => onEdit(h)}>Edit</button>
              <button style={linkStyle} onClick={() => onResume(h.id)}>Bring back</button>
            </div>
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div style={{ ...S.manageBlockSection, marginTop: 56 }}>
          <div style={S.sectionLabel}>Archived</div>
          {archived.map((h) => (
            <div key={h.id} style={S.manageHabitRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>{name(h, h.text, { ...S.manageHabitText, color: theme.textMuted })}</div>
                <div style={{ ...S.manageHabitMeta, marginLeft: 0, marginTop: 2, fontSize: 12 }}>
                  {labels[h.timeBlock] || h.timeBlock} · {describeRecurrence(h)} · history kept
                </div>
              </div>
              <button style={linkStyle} onClick={() => onRestore(h.id)}>Restore</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
