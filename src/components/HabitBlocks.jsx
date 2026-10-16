import { useTheme } from '../hooks/useTheme';
import { HabitRow } from './HabitRow';
import { stageAt } from '../utils/habits';

// The day's habits, one titled group per time block. `compact` is the phone spacing.
// Each row shows the habit as it was on that day (its stage then), so past days read true.
export function HabitBlocks({ blocks, dateKey, labels, done, onToggle, onEdit, compact }) {
  const { S } = useTheme();
  return Object.entries(blocks).map(([block, habits]) => (
    <div key={block} style={compact ? { marginBottom: 32 } : S.timeBlock}>
      <div style={S.sectionLabel}>{labels[block]}</div>
      {habits.map((habit) => (
        <HabitRow
          key={habit.id}
          habit={habit}
          stage={stageAt(habit, dateKey) || habit}
          checked={done?.[habit.id] || false}
          onToggle={() => onToggle(habit.id)}
          onEdit={onEdit}
        />
      ))}
    </div>
  ));
}
