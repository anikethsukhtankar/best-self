import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './hooks/useAuth';
import { useData } from './hooks/useData';
import { ThemeProvider, useTheme } from './hooks/useTheme.jsx';
import { AuthScreen } from './components/AuthScreen';
import { HabitRow } from './components/HabitRow';
import { Checkmark } from './components/Checkmark';
import {
  TIME_BLOCKS, TIME_BLOCK_LABELS, TIME_BLOCK_HOURS,
  DAY_NAMES, DAY_LETTERS, MONTH_NAMES, generateId
} from './utils/constants';
import { formatDateKey, addDays, getWeekStart, isSameDay } from './utils/date';
import { getHabitsForDay, getDayCompletion, isDayComplete, isHabitScheduledForDay } from './utils/habits';

// Hook for mobile detection
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);
  return isMobile;
}

// Progress Ring Component
function ProgressRing({ progress, size = 140, strokeWidth = 3 }) {
  const { theme } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={theme.ring} strokeWidth={strokeWidth} />
      <circle
        cx={size/2} cy={size/2} r={radius} fill="none" stroke={theme.accent} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 500ms ease-out' }}
      />
    </svg>
  );
}

// Week Strip Component
function WeekStrip({ selectedDate, onSelect, habits, completions, threshold }) {
  const { theme, S } = useTheme();
  const ws = getWeekStart(selectedDate);
  const today = new Date();

  return (
    <div style={S.weekStrip}>
      {[0,1,2,3,4,5,6].map(i => {
        const d = addDays(ws, i);
        const sel = isSameDay(d, selectedDate);
        const fut = d > today;
        const comp = !fut && isDayComplete(habits, completions, d, threshold);
        const { total } = getDayCompletion(habits, completions, d);

        return (
          <div key={i} style={S.weekDay} onClick={() => onSelect(d)}>
            <span style={S.weekDayLetter}>{DAY_LETTERS[i]}</span>
            <span style={{ ...S.weekDayNum, fontWeight: sel ? 500 : 300, color: fut ? theme.textFaintest : theme.text }}>
              {d.getDate()}
            </span>
            {!fut && total > 0 && (
              <div style={{
                ...S.weekDayDot,
                background: comp ? theme.accent : 'transparent',
                borderColor: total === 0 ? theme.textFaintest : theme.accent
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Progress Bar Component
function ProgressBar({ completed, total, threshold }) {
  const { S } = useTheme();
  const pct = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div style={S.progressContainer}>
      <div style={S.progressBar}>
        <div style={{ ...S.progressFill, width: pct + '%' }} />
      </div>
      <span style={S.progressText}>
        {pct >= threshold * 100 ? '✓' : `${completed}/${total}`}
      </span>
    </div>
  );
}

// Todo Row Component
function TodoRow({ todo, onToggle, onDelete }) {
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
      <span
        style={{ fontSize: 14, color: theme.textFaintest, cursor: 'pointer', padding: '0 8px', opacity: hovered ? 1 : 0 }}
        onClick={(ev) => { ev.stopPropagation(); onDelete(todo.id); }}
      >
        ×
      </span>
    </div>
  );
}

// Stendig Calendar Component
function StendigCalendar({ selectedDate, onSelect, habits, completions, threshold }) {
  const { theme, S } = useTheme();
  const [viewMonth, setViewMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const today = new Date();

  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const current = new Date(startDate);
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [viewMonth]);

  return (
    <div style={S.stendigCalendar}>
      <div style={S.stendigHeader}>
        <span style={S.stendigNavArrow} onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>‹</span>
        <span style={S.stendigMonth}>{MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}</span>
        <span style={S.stendigNavArrow} onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>›</span>
      </div>
      <div style={S.stendigGrid}>
        {DAY_LETTERS.map((d, i) => (
          <div key={'h' + i} style={S.stendigDayHeader}>{d}</div>
        ))}
        {calendarDays.map((day, i) => {
          const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentDay = isSameDay(day, today);
          const { percentage, total } = getDayCompletion(habits, completions, day);
          const isComplete = total > 0 && percentage >= threshold && day <= today;

          let style = { ...S.stendigDay };
          if (!isCurrentMonth) style = { ...style, ...S.stendigDayOtherMonth };
          if (isCurrentDay) style = { ...style, ...S.stendigDayToday };
          if (isSelected) style = { ...style, ...S.stendigDaySelected };

          return (
            <div key={i} style={style} onClick={() => onSelect(day)}>
              {day.getDate()}
              {isComplete && !isSelected && (
                <>
                  <div style={{ ...S.stendigStrikeX, transform: 'translate(-50%, -50%) rotate(45deg)' }} />
                  <div style={{ ...S.stendigStrikeX, transform: 'translate(-50%, -50%) rotate(-45deg)' }} />
                </>
              )}
              {isComplete && isSelected && (
                <>
                  <div style={{ ...S.stendigStrikeX, background: theme.accentText, transform: 'translate(-50%, -50%) rotate(45deg)' }} />
                  <div style={{ ...S.stendigStrikeX, background: theme.accentText, transform: 'translate(-50%, -50%) rotate(-45deg)' }} />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Left Panel (Timeline)
function LeftPanel({ habits, completions, threshold, selectedDate, settings }) {
  const { S } = useTheme();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const timeBlockHours = settings?.timeBlockHours || TIME_BLOCK_HOURS;
  const timeBlockLabels = settings?.timeBlockLabels || TIME_BLOCK_LABELS;
  const dayHabits = getHabitsForDay(habits, selectedDate);
  const dk = formatDateKey(selectedDate);
  const dayCompletions = completions[dk] || {};
  const isToday = isSameDay(selectedDate, new Date());

  const habitsByBlock = {};
  TIME_BLOCKS.forEach(block => {
    habitsByBlock[block] = dayHabits.filter(h => h.timeBlock === block).sort((a, b) => a.sortOrder - b.sortOrder);
  });

  const completedCount = dayHabits.filter(h => dayCompletions[h.id]).length;
  const totalCount = dayHabits.length;

  const startHour = 6;
  const endHour = 23;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  const formatHour = h => h === 0 || h === 12 ? '12' : (h > 12 ? h - 12 : h);
  const getAmPm = h => h >= 12 ? 'p' : 'a';

  const currentHour = now.getHours() + now.getMinutes() / 60;
  const nowTop = isToday && currentHour >= startHour && currentHour <= endHour
    ? (currentHour - startHour) * 48
    : null;

  return (
    <div style={S.leftPanel}>
      <div style={S.timelineContainer}>
        <div style={S.timelineHeader}>
          <div style={S.timelineTitle}>Schedule</div>
          <div style={S.timelineDate}>
            {DAY_NAMES[selectedDate.getDay()]}, {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getDate()}
          </div>
        </div>

        <div style={S.timelineScroll}>
          <div style={S.timelineHours}>
            {hours.map(hour => {
              const block = TIME_BLOCKS.find(b => timeBlockHours[b].start === hour);
              const blockHabits = block ? habitsByBlock[block] : [];
              const blockHeight = block ? (timeBlockHours[block].end - timeBlockHours[block].start) * 48 : 0;

              return (
                <div key={hour} style={S.timelineHour}>
                  <div style={S.timelineHourLabel}>{formatHour(hour)}{getAmPm(hour)}</div>
                  <div style={S.timelineHourContent}>
                    {block && blockHabits.length > 0 && (
                      <div style={{ ...S.timelineBlockBar, height: blockHeight }}>
                        <div style={S.timelineBlockLabel}>{timeBlockLabels[block]}</div>
                        {blockHabits.map(habit => (
                          <div
                            key={habit.id}
                            style={{
                              ...S.timelineHabit,
                              ...(dayCompletions[habit.id] ? S.timelineHabitDone : {})
                            }}
                          >
                            {habit.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {nowTop !== null && (
              <>
                <div style={{ ...S.timelineNowLine, top: nowTop }} />
                <div style={{ ...S.timelineNowDot, top: nowTop }} />
              </>
            )}
          </div>
        </div>

        <div style={S.timelineSummary}>
          <div style={S.timelineSummaryValue}>{completedCount}/{totalCount}</div>
          <div style={S.timelineSummaryLabel}>Completed</div>
        </div>
      </div>
    </div>
  );
}

// Stats Row Component
function StatsRow({ habits, completions, threshold }) {
  const { S } = useTheme();

  const stats = useMemo(() => {
    const today = new Date();
    let cur = 0;
    for (let i = 0; i < 365; i++) {
      const d = addDays(today, -i);
      const { total } = getDayCompletion(habits, completions, d);
      if (total === 0) continue;
      if (isDayComplete(habits, completions, d, threshold)) cur++;
      else break;
    }

    let best = 0, tmp = 0;
    for (let i = 365; i >= 0; i--) {
      const d = addDays(today, -i);
      const { total } = getDayCompletion(habits, completions, d);
      if (total === 0) continue;
      if (isDayComplete(habits, completions, d, threshold)) {
        tmp++;
        if (tmp > best) best = tmp;
      } else {
        tmp = 0;
      }
    }

    const ws = getWeekStart(today);
    let wt = 0, wc = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      if (d > today) break;
      const { completed, total } = getDayCompletion(habits, completions, d);
      wt += total;
      wc += completed;
    }

    let mt = 0, mc = 0;
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    for (let d = new Date(monthStart); d <= today; d.setDate(d.getDate() + 1)) {
      const { completed, total } = getDayCompletion(habits, completions, new Date(d));
      mt += total;
      mc += completed;
    }
    const monthPct = mt > 0 ? Math.round((mc / mt) * 100) : 0;

    return {
      currentStreak: cur,
      bestStreak: best,
      weekPct: wt > 0 ? Math.round((wc / wt) * 100) : 0,
      monthPct
    };
  }, [habits, completions, threshold]);

  const streakProgress = Math.min((stats.currentStreak / Math.max(stats.bestStreak, 30)) * 100, 100);

  return (
    <div style={S.statsRow}>
      <div style={S.statItem}>
        <div style={S.statRing}>
          <ProgressRing progress={streakProgress} />
          <div style={S.statNumber}>{stats.currentStreak}</div>
        </div>
        <div style={S.statLabel}>Day Streak</div>
      </div>
      <div style={S.statItem}>
        <div style={S.statRing}>
          <ProgressRing progress={stats.weekPct} />
          <div style={S.statNumber}>{stats.weekPct}%</div>
        </div>
        <div style={S.statLabel}>This Week</div>
      </div>
      <div style={S.statItem}>
        <div style={S.statRing}>
          <ProgressRing progress={stats.monthPct} />
          <div style={S.statNumber}>{stats.monthPct}%</div>
        </div>
        <div style={S.statLabel}>This Month</div>
      </div>
    </div>
  );
}

// Habit Breakdown Component
function HabitBreakdown({ habits, completions }) {
  const { theme, S } = useTheme();
  const [compactView, setCompactView] = useState(true);

  const breakdown = useMemo(() => {
    const today = new Date();
    return habits.filter(h => !h.archivedAt).map(habit => {
      let tot = 0, comp = 0, cur = 0, tmp = 0;
      for (let i = 0; i < 30; i++) {
        const d = addDays(today, -i);
        if (isHabitScheduledForDay(habit, d)) {
          tot++;
          const dk = formatDateKey(d);
          if (completions[dk]?.[habit.id]) {
            comp++;
            tmp++;
          } else {
            if (cur === 0) cur = tmp;
            tmp = 0;
          }
        }
      }
      if (cur === 0) cur = tmp;
      return { habit, rate: tot > 0 ? comp / tot : 0, streak: cur };
    }).sort((a, b) => b.rate - a.rate);
  }, [habits, completions]);

  const getRateColor = (rate) => {
    if (rate >= 0.8) return theme.gridHigh;
    if (rate >= 0.6) return theme.gridMid;
    if (rate >= 0.4) return theme.textMuted;
    return theme.gridLow;
  };

  return (
    <div style={S.breakdownSection}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ ...S.sectionLabel, marginBottom: 0 }}>Habit Performance · 30 Days</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            style={{ ...S.trendToggle, padding: '4px 10px', fontSize: 11, color: compactView ? theme.text : theme.textMuted }}
            onClick={() => setCompactView(true)}
          >
            Compact
          </button>
          <button
            style={{ ...S.trendToggle, padding: '4px 10px', fontSize: 11, color: !compactView ? theme.text : theme.textMuted }}
            onClick={() => setCompactView(false)}
          >
            Cards
          </button>
        </div>
      </div>

      {compactView ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {breakdown.map(({ habit, rate, streak }) => (
            <div
              key={habit.id}
              style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${theme.borderLight}` }}
            >
              <div style={{ width: 40, height: 4, background: theme.gridEmpty, borderRadius: 2, marginRight: 12, flexShrink: 0 }}>
                <div style={{ width: (rate * 100) + '%', height: '100%', background: getRateColor(rate), borderRadius: 2 }} />
              </div>
              <span style={{ width: 40, fontSize: 13, fontWeight: 400, color: theme.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {Math.round(rate * 100)}%
              </span>
              <span style={{ flex: 1, fontSize: 13, color: theme.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {habit.text}
              </span>
              {streak > 0 && (
                <span style={{ fontSize: 11, color: theme.textMuted, marginLeft: 8, flexShrink: 0 }}>{streak}d</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={S.breakdownGrid}>
          {breakdown.map(({ habit, rate, streak }) => (
            <div key={habit.id} style={S.breakdownCard}>
              <div style={S.breakdownCardHeader}>
                <span style={S.breakdownCardTitle}>{habit.text}</span>
                <span style={S.breakdownCardPct}>{Math.round(rate * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Settings Modal Component
function SettingsModal({ settings, onSave, onClose, habits, onManageHabits, fullState, onImport, onExport, user, onSignOut, syncing, lastSynced }) {
  const { theme, S } = useTheme();
  const [threshold, setThreshold] = useState(settings.completionThreshold);
  const [darkMode, setDarkMode] = useState(settings.darkMode || false);
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useState(null);

  const todayHabits = getHabitsForDay(habits, new Date());
  const required = Math.ceil(todayHabits.length * threshold);
  const habitCount = habits.filter(h => !h.archivedAt).length;
  const completionDays = Object.keys(fullState.completions || {}).length;

  const handleImport = (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.habits || !data.settings) {
          setImportStatus({ type: 'error', message: 'Invalid backup file format' });
          return;
        }
        onImport(data);
        setImportStatus({ type: 'success', message: 'Data imported successfully!' });
        setTimeout(() => onClose(), 1500);
      } catch (err) {
        setImportStatus({ type: 'error', message: 'Failed to parse backup file' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modal} onClick={ev => ev.stopPropagation()}>
        <button style={S.modalClose} onClick={onClose}>×</button>
        <div style={S.modalTitle}>Settings</div>

        {user && (
          <div style={S.settingsSection}>
            <label style={S.modalLabel}>Account</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {user.photoURL && (
                <img src={user.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: theme.text }}>{user.displayName}</div>
                <div style={{ fontSize: 12, color: theme.textMuted }}>{user.email}</div>
              </div>
              <button
                style={{ ...S.trendToggle, fontSize: 12, color: theme.textMuted }}
                onClick={onSignOut}
              >
                Sign out
              </button>
            </div>
            {syncing && <p style={{ ...S.settingsNote, marginTop: 8 }}>Syncing...</p>}
            {lastSynced && !syncing && (
              <p style={{ ...S.settingsNote, marginTop: 8 }}>
                Last synced: {lastSynced.toLocaleTimeString()}
              </p>
            )}
          </div>
        )}

        <div style={S.settingsSection}>
          <label style={S.modalLabel}>Appearance</label>
          <div style={S.darkModeToggle}>
            <span style={{ fontSize: 14, color: theme.text }}>Dark Mode</span>
            <div
              style={{ ...S.darkModeSwitch, ...(darkMode ? S.darkModeSwitchActive : {}) }}
              onClick={() => setDarkMode(!darkMode)}
            >
              <div style={{ ...S.darkModeSwitchKnob, ...(darkMode ? S.darkModeSwitchKnobActive : {}) }} />
            </div>
          </div>
        </div>

        <div style={S.settingsSection}>
          <label style={S.modalLabel}>Completion Threshold</label>
          <div style={S.sliderContainer}>
            <input
              type="range"
              min={50}
              max={100}
              value={threshold * 100}
              onChange={ev => setThreshold(parseInt(ev.target.value, 10) / 100)}
              style={S.slider}
            />
            <span style={S.sliderValue}>{Math.round(threshold * 100)}%</span>
          </div>
          <p style={S.settingsNote}>
            Your day is complete when you finish <strong>{required} of {todayHabits.length}</strong> habits.
          </p>
        </div>

        <div style={S.settingsSection}>
          <label style={S.modalLabel}>Habits</label>
          <button
            style={{ ...S.modalButton, marginTop: 0, background: 'transparent', color: theme.text, border: `1px solid ${theme.accent}` }}
            onClick={() => { onClose(); onManageHabits(); }}
          >
            Manage Habits
          </button>
        </div>

        <div style={S.settingsSection}>
          <label style={S.modalLabel}>Data Backup</label>
          <p style={{ ...S.settingsNote, marginTop: 0, marginBottom: 16 }}>
            {habitCount} active habits · {completionDays} days of history
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              style={{ ...S.modalButton, flex: 1, marginTop: 0, background: 'transparent', color: theme.text, border: `1px solid ${theme.accent}` }}
              onClick={onExport}
            >
              Export
            </button>
            <button
              style={{ ...S.modalButton, flex: 1, marginTop: 0, background: 'transparent', color: theme.text, border: `1px solid ${theme.accent}` }}
              onClick={() => document.getElementById('import-input').click()}
            >
              Import
            </button>
            <input
              id="import-input"
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </div>
          {importStatus && (
            <p style={{ ...S.settingsNote, marginTop: 12, color: importStatus.type === 'error' ? '#e53935' : '#4caf50' }}>
              {importStatus.message}
            </p>
          )}
        </div>

        <button
          style={S.modalButton}
          onClick={() => {
            onSave({ ...settings, completionThreshold: threshold, darkMode });
            onClose();
          }}
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}

// Main Dashboard Component
function Dashboard({ user, signOut }) {
  const isMobile = useIsMobile();
  const { state, save, importData, exportData, syncing, lastSynced } = useData(user);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tab, setTab] = useState('today');
  const [showSettings, setShowSettings] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [todoText, setTodoText] = useState('');
  const [navHover, setNavHover] = useState(null);

  const { theme, S } = useTheme();

  const toggleHabit = useCallback(id => {
    const dk = formatDateKey(selectedDate);
    const newComp = { ...state.completions };
    if (!newComp[dk]) newComp[dk] = {};
    newComp[dk] = { ...newComp[dk], [id]: !newComp[dk][id] };
    save({ ...state, completions: newComp });
  }, [state, selectedDate, save]);

  const addTodo = useCallback(text => {
    save({ ...state, todos: [...state.todos, { id: generateId(), text, createdAt: new Date().toISOString() }] });
  }, [state, save]);

  const toggleTodo = useCallback(id => {
    save({ ...state, todos: state.todos.map(t => t.id === id ? { ...t, completedAt: t.completedAt ? null : new Date().toISOString() } : t) });
  }, [state, save]);

  const deleteTodo = useCallback(id => {
    save({ ...state, todos: state.todos.filter(t => t.id !== id) });
  }, [state, save]);

  if (!state) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 100, color: theme.textMuted, minHeight: '100vh', background: theme.bg }}>
        Loading...
      </div>
    );
  }

  const today = new Date();
  const isToday = isSameDay(selectedDate, today);
  const dk = formatDateKey(selectedDate);
  const dayHabits = getHabitsForDay(state.habits, selectedDate);
  const dayProgress = getDayCompletion(state.habits, state.completions, selectedDate);
  const isDayCompleted = dayProgress.percentage >= state.settings.completionThreshold;
  const completions = state.completions || {};
  const labels = state.settings?.timeBlockLabels || TIME_BLOCK_LABELS;

  const habitsByBlock = {};
  (state.settings?.timeBlockOrder || TIME_BLOCKS).forEach(block => {
    const bh = dayHabits.filter(h => h.timeBlock === block).sort((a, b) => a.sortOrder - b.sortOrder);
    if (bh.length > 0) habitsByBlock[block] = bh;
  });

  // Mobile Layout
  if (isMobile) {
    return (
      <div style={S.mobileContainer}>
        {/* Mobile Header */}
        <div style={S.mobileHeader}>
          <button style={S.mobileCalendarToggle} onClick={() => setShowCalendar(!showCalendar)}>
            {MONTH_NAMES[selectedDate.getMonth()].slice(0, 3)} {selectedDate.getDate()}
            <span style={{ fontSize: 10 }}>▼</span>
          </button>
          {user && <span style={{ fontSize: 11, color: theme.textMuted }}>☁️</span>}
        </div>

        {/* Calendar Dropdown */}
        {showCalendar && (
          <div style={S.mobileCalendarDropdown}>
            <StendigCalendar
              selectedDate={selectedDate}
              onSelect={(d) => { setSelectedDate(d); setShowCalendar(false); }}
              habits={state.habits}
              completions={completions}
              threshold={state.settings.completionThreshold}
            />
          </div>
        )}

        {tab === 'today' ? (
          <>
            {/* Mobile Date Header */}
            <div style={S.mobileDateHeader}>
              <div style={{ fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8 }}>
                {DAY_NAMES[selectedDate.getDay()]}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span
                  style={{ fontSize: 28, padding: '0 16px', color: theme.textFaint, cursor: 'pointer' }}
                  onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                >
                  ‹
                </span>
                <div style={S.mobileDayNumber}>
                  {selectedDate.getDate()}
                  {isDayCompleted && (
                    <>
                      <div style={{ ...S.mobileStrikeX, transform: 'translate(-50%, -50%) rotate(45deg)' }} />
                      <div style={{ ...S.mobileStrikeX, transform: 'translate(-50%, -50%) rotate(-45deg)' }} />
                    </>
                  )}
                </div>
                <span
                  style={{ fontSize: 28, padding: '0 16px', color: theme.textFaint, cursor: 'pointer' }}
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                >
                  ›
                </span>
              </div>
              {!isToday && (
                <span style={{ fontSize: 12, color: theme.textMuted, cursor: 'pointer', marginTop: 12, display: 'inline-block' }} onClick={() => setSelectedDate(new Date())}>
                  Today
                </span>
              )}
            </div>

            {/* Mobile Week Strip */}
            <WeekStrip
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
              habits={state.habits}
              completions={completions}
              threshold={state.settings.completionThreshold}
            />

            {/* Mobile Progress */}
            <div style={S.mobileStatsRow}>
              <div style={S.mobileStatItem}>
                <div style={S.mobileStatValue}>{dayProgress.completed}</div>
                <div style={S.mobileStatLabel}>Done</div>
              </div>
              <div style={S.mobileStatItem}>
                <div style={S.mobileStatValue}>{dayProgress.total}</div>
                <div style={S.mobileStatLabel}>Total</div>
              </div>
              <div style={S.mobileStatItem}>
                <div style={S.mobileStatValue}>{Math.round(dayProgress.percentage)}%</div>
                <div style={S.mobileStatLabel}>Progress</div>
              </div>
            </div>

            {/* Mobile Habits */}
            {Object.entries(habitsByBlock).map(([block, habits]) => (
              <div key={block} style={{ marginBottom: 32 }}>
                <div style={S.sectionLabel}>{labels[block]}</div>
                {habits.map(habit => (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    checked={completions[dk]?.[habit.id] || false}
                    onToggle={() => toggleHabit(habit.id)}
                  />
                ))}
              </div>
            ))}

            {/* Mobile Todos */}
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${theme.border}` }}>
              <div style={S.sectionLabel}>Tasks</div>
              {state.todos.map(todo => (
                <TodoRow key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
              ))}
              <input
                type="text"
                style={{ ...S.todoInput, fontSize: 16 }}
                placeholder="Add a task..."
                value={todoText}
                onChange={ev => setTodoText(ev.target.value)}
                onKeyDown={ev => {
                  if (ev.key === 'Enter' && todoText.trim()) {
                    addTodo(todoText.trim());
                    setTodoText('');
                  }
                }}
              />
            </div>
          </>
        ) : (
          <>
            <StatsRow habits={state.habits} completions={completions} threshold={state.settings.completionThreshold} />
            <HabitBreakdown habits={state.habits} completions={completions} />
          </>
        )}

        {/* Mobile Bottom Navigation */}
        <div style={S.mobileNav}>
          <button style={{ ...S.mobileNavItem, color: tab === 'today' ? theme.text : theme.textMuted }} onClick={() => setTab('today')}>
            <span style={S.mobileNavIcon}>○</span>
            <span style={S.mobileNavLabel}>Today</span>
          </button>
          <button style={{ ...S.mobileNavItem, color: tab === 'insights' ? theme.text : theme.textMuted }} onClick={() => setTab('insights')}>
            <span style={S.mobileNavIcon}>◐</span>
            <span style={S.mobileNavLabel}>Insights</span>
          </button>
          <button style={{ ...S.mobileNavItem, color: theme.textMuted }} onClick={() => setShowSettings(true)}>
            <span style={S.mobileNavIcon}>☰</span>
            <span style={S.mobileNavLabel}>Settings</span>
          </button>
        </div>

        {showSettings && (
          <SettingsModal
            settings={state.settings}
            onSave={s => save({ ...state, settings: s })}
            onClose={() => setShowSettings(false)}
            habits={state.habits}
            onManageHabits={() => {}}
            fullState={state}
            onImport={importData}
            onExport={exportData}
            user={user}
            onSignOut={signOut}
            syncing={syncing}
            lastSynced={lastSynced}
          />
        )}
      </div>
    );
  }

  // Desktop Layout
  return (
    <div style={S.pageWrapper}>
      <LeftPanel
        habits={state.habits}
        completions={completions}
        threshold={state.settings.completionThreshold}
        selectedDate={selectedDate}
        settings={state.settings}
      />

      <div style={S.container}>
        <div style={S.tabs}>
          <button style={{ ...S.tab, ...(tab === 'today' ? S.tabActive : {}) }} onClick={() => setTab('today')}>
            Today
          </button>
          <button style={{ ...S.tab, ...(tab === 'insights' ? S.tabActive : {}) }} onClick={() => setTab('insights')}>
            Insights
          </button>
          <div style={{ flex: 1 }} />
          {user && (
            <span style={{ fontSize: 12, color: theme.textMuted, marginRight: 16 }}>
              ☁️ Synced
            </span>
          )}
          <button style={{ ...S.tab, fontSize: 12 }} onClick={() => setShowSettings(true)}>
            Settings
          </button>
        </div>

        {tab === 'today' ? (
          <>
            <div style={S.dateHeader}>
              <div style={S.monthYear}>
                {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span
                  style={{ ...S.navArrow, color: navHover === 'left' ? theme.text : theme.textFaintest }}
                  onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                  onMouseEnter={() => setNavHover('left')}
                  onMouseLeave={() => setNavHover(null)}
                >
                  ‹
                </span>
                <div style={S.dayNumber}>
                  {selectedDate.getDate()}
                  <div style={{
                    ...S.strikeX,
                    transform: isDayCompleted ? 'translate(-50%, -50%) rotate(45deg) scaleX(1)' : 'translate(-50%, -50%) rotate(45deg) scaleX(0)',
                    opacity: isDayCompleted ? 1 : 0
                  }} />
                  <div style={{
                    ...S.strikeX,
                    transform: isDayCompleted ? 'translate(-50%, -50%) rotate(-45deg) scaleX(1)' : 'translate(-50%, -50%) rotate(-45deg) scaleX(0)',
                    opacity: isDayCompleted ? 1 : 0
                  }} />
                </div>
                <span
                  style={{ ...S.navArrow, color: navHover === 'right' ? theme.text : theme.textFaintest }}
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  onMouseEnter={() => setNavHover('right')}
                  onMouseLeave={() => setNavHover(null)}
                >
                  ›
                </span>
              </div>
              <div style={S.dayOfWeek}>{DAY_NAMES[selectedDate.getDay()]}</div>
              {!isToday && (
                <span style={S.todayLink} onClick={() => setSelectedDate(new Date())}>
                  Today
                </span>
              )}
            </div>

            <WeekStrip
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
              habits={state.habits}
              completions={completions}
              threshold={state.settings.completionThreshold}
            />

            {Object.entries(habitsByBlock).map(([block, habits]) => (
              <div key={block} style={S.timeBlock}>
                <div style={S.sectionLabel}>{labels[block]}</div>
                {habits.map(habit => (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    checked={completions[dk]?.[habit.id] || false}
                    onToggle={() => toggleHabit(habit.id)}
                  />
                ))}
              </div>
            ))}

            <div style={S.todoSection}>
              <div style={S.sectionLabel}>Tasks</div>
              {state.todos.map(todo => (
                <TodoRow key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
              ))}
              <input
                type="text"
                style={S.todoInput}
                placeholder="Add a task..."
                value={todoText}
                onChange={ev => setTodoText(ev.target.value)}
                onKeyDown={ev => {
                  if (ev.key === 'Enter' && todoText.trim()) {
                    addTodo(todoText.trim());
                    setTodoText('');
                  }
                  if (ev.key === 'Escape') {
                    setTodoText('');
                    ev.target.blur();
                  }
                }}
              />
            </div>

            <ProgressBar
              completed={dayProgress.completed}
              total={dayProgress.total}
              threshold={state.settings.completionThreshold}
            />
          </>
        ) : (
          <>
            <StatsRow habits={state.habits} completions={completions} threshold={state.settings.completionThreshold} />
            <HabitBreakdown habits={state.habits} completions={completions} />
          </>
        )}

        {showSettings && (
          <SettingsModal
            settings={state.settings}
            onSave={s => save({ ...state, settings: s })}
            onClose={() => setShowSettings(false)}
            habits={state.habits}
            onManageHabits={() => {}}
            fullState={state}
            onImport={importData}
            onExport={exportData}
            user={user}
            onSignOut={signOut}
            syncing={syncing}
            lastSynced={lastSynced}
          />
        )}
      </div>

      <div style={S.rightPanel}>
        <StendigCalendar
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          habits={state.habits}
          completions={completions}
          threshold={state.settings.completionThreshold}
        />
      </div>
    </div>
  );
}

// Main App Component
export default function App() {
  const { user, loading, signInWithGoogle, signOut, isFirebaseConfigured } = useAuth();
  const [skipAuth, setSkipAuth] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const stored = localStorage.getItem('best-self-state');
      return stored ? JSON.parse(stored).settings?.darkMode || false : false;
    } catch {
      return false;
    }
  });

  // Update dark mode when settings change
  useEffect(() => {
    const checkDarkMode = () => {
      try {
        const stored = localStorage.getItem('best-self-state');
        if (stored) {
          const parsed = JSON.parse(stored);
          setDarkMode(parsed.settings?.darkMode || false);
        }
      } catch {}
    };

    window.addEventListener('storage', checkDarkMode);
    const interval = setInterval(checkDarkMode, 1000);
    return () => {
      window.removeEventListener('storage', checkDarkMode);
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <ThemeProvider darkMode={darkMode}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Loading...
        </div>
      </ThemeProvider>
    );
  }

  // Show auth screen only if Firebase is configured and not signed in and hasn't skipped
  if (isFirebaseConfigured && !user && !skipAuth) {
    return (
      <ThemeProvider darkMode={darkMode}>
        <AuthScreen onSignIn={signInWithGoogle} onSkip={() => setSkipAuth(true)} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider darkMode={darkMode}>
      <Dashboard user={user} signOut={signOut} />
    </ThemeProvider>
  );
}
