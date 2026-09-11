import { useTheme } from '../hooks/useTheme';
import { describeRecurrence } from '../utils/habits';

// Every habit, active ones grouped by time block, archived ones on a shelf below.
export function ManageHabits({ habits, labels, blockOrder, onBack, onNew, onEdit, onArchive, onRestore }) {
  const { theme, S } = useTheme();
  const active = habits.filter((h) => !h.archivedAt);
  const archived = habits.filter((h) => h.archivedAt);
  const linkStyle = { ...S.tab, fontSize: 12, color: theme.textMuted, marginLeft: 16 };

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
            {rows.map((h) => (
              <div key={h.id} style={S.manageHabitRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.manageHabitText}>{h.text}</div>
                  <div style={{ ...S.manageHabitMeta, marginLeft: 0, marginTop: 2, fontSize: 12 }}>
                    {describeRecurrence(h)}{h.durationMinutes ? ` · ${h.durationMinutes} min` : ''}
                  </div>
                </div>
                <button style={linkStyle} onClick={() => onEdit(h)}>Edit</button>
                <button style={linkStyle} onClick={() => onArchive(h.id)}>Archive</button>
              </div>
            ))}
          </div>
        );
      })}

      {active.length === 0 && (
        <p style={S.settingsNote}>No active habits. Add one and it will appear on its days.</p>
      )}

      {archived.length > 0 && (
        <div style={{ ...S.manageBlockSection, marginTop: 56 }}>
          <div style={S.sectionLabel}>Archived</div>
          {archived.map((h) => (
            <div key={h.id} style={S.manageHabitRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...S.manageHabitText, color: theme.textMuted }}>{h.text}</div>
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
