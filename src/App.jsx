import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './hooks/useAuth';
import { useData } from './hooks/useData';
import { useTheme } from './hooks/useTheme';
import { ThemeProvider } from './hooks/ThemeProvider';
import { AuthScreen } from './components/AuthScreen';
import { HabitRow } from './components/HabitRow';
import { Checkmark } from './components/Checkmark';
import { PenroseFigure } from './components/PenroseFigure';
import { LouverNumeral } from './components/LouverNumeral';
import { HabitModal } from './components/HabitModal';
import { ManageHabits } from './components/ManageHabits';
import { TimeBlockEditor } from './components/TimeBlockEditor';
import { YearGrid } from './components/YearGrid';
import { TrendLine } from './components/TrendLine';
import { StendigCalendar } from './components/StendigCalendar';
import {
  TIME_BLOCKS, TIME_BLOCK_LABELS, TIME_BLOCK_HOURS,
  DAY_NAMES, DAY_LETTERS, MONTH_NAMES, generateId
} from './utils/constants';
import { formatDateKey, addDays, getWeekStart, isSameDay } from './utils/date';
import { getHabitsForDay, getDayCompletion, isDayComplete } from './utils/habits';
import { currentStreak, bestStreak, weekPercent, habitBreakdown } from './utils/insights';
import { getTodosForDay, shortDate } from './utils/todos';

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

// Progress: the Impossible Figure, one stroke per share of the day's habits
function ProgressBar({ completed, total, threshold, width = 96, style }) {
  const { theme, S } = useTheme();
  const complete = total > 0 && completed / total >= threshold;

  return (
    <div style={{ ...S.progressContainer, ...style }}>
      <PenroseFigure completed={completed} total={total} complete={complete} width={width} color={theme.accent} />
      <span style={S.progressText}>
        {complete ? '✓' : `${completed}/${total}`}
      </span>
    </div>
  );
}

// Todo Row Component
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

// Left Panel (Timeline)
function LeftPanel({ habits, completions, selectedDate, settings }) {
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

// Stats Row: three thin numbers
export function StatsRow({ habits, completions, threshold }) {
  const { theme, S } = useTheme();
  const stats = useMemo(() => {
    const today = new Date();
    const week = weekPercent(habits, completions, today);
    return {
      current: currentStreak(habits, completions, threshold, today),
      best: bestStreak(habits, completions, threshold, today),
      week: week === null ? null : Math.round(week * 100),
    };
  }, [habits, completions, threshold]);
  const big = { fontSize: 'clamp(44px, 12vw, 72px)', fontWeight: 100, lineHeight: 1, color: theme.text, fontVariantNumeric: 'tabular-nums' };
  const cells = [[stats.current, 'Day streak'], [stats.best, 'Best streak'], [stats.week === null ? '–' : `${stats.week}%`, 'This week']];

  return (
    <div style={{ ...S.statsRow, justifyContent: 'space-between', gap: 24, marginBottom: 72, flexWrap: 'nowrap' }}>
      {cells.map(([value, label]) => (
        <div key={label} style={{ flex: 1 }}>
          <div style={big}>{value}</div>
          <div style={{ ...S.statLabel, marginTop: 12 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// Habit Breakdown: worst first, so what needs attention is at the top
export function HabitBreakdown({ habits, completions }) {
  const { theme, S } = useTheme();
  const rows = useMemo(() => habitBreakdown(habits, completions, 30, new Date()), [habits, completions]);
  if (rows.length === 0) return null;

  return (
    <div style={S.breakdownSection}>
      <div style={S.sectionLabel}>Habits · 30 days · worst first</div>
      {rows.map(({ habit, rate, streak, scheduled }) => (
        <div key={habit.id} style={{ padding: '14px 0', borderBottom: `1px solid ${theme.borderLight}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontSize: 14, color: theme.text }}>{habit.text}</span>
            <span style={{ fontSize: 13, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {rate === null ? '–' : `${Math.round(rate * 100)}%`}
            </span>
          </div>
          <div style={{ height: 2, background: theme.border, marginTop: 8 }}>
            <div style={{ height: '100%', width: `${Math.round((rate || 0) * 100)}%`, background: theme.accent }} />
          </div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 6 }}>
            {scheduled === 0 ? 'not scheduled in the last 30 days' : streak > 0 ? `${streak}-day streak` : 'no current streak'}
          </div>
        </div>
      ))}
    </div>
  );
}

// Settings Modal Component
function SettingsModal({ settings, onSave, onClose, habits, onManageHabits, fullState, onImport, onExport, user, onSignOut, syncing, lastSynced }) {
  const { theme, S } = useTheme();
  const [threshold, setThreshold] = useState(settings.completionThreshold);
  const [darkMode, setDarkMode] = useState(settings.darkMode || false);
  const [importStatus, setImportStatus] = useState(null);
  const [blocks, setBlocks] = useState({
    labels: { ...TIME_BLOCK_LABELS, ...(settings.timeBlockLabels || {}) },
    order: settings.timeBlockOrder || TIME_BLOCKS,
  });

  useEffect(() => {
    const onKey = ev => { if (ev.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
      } catch {
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
          <label style={S.modalLabel}>Time blocks</label>
          <TimeBlockEditor labels={blocks.labels} order={blocks.order} onChange={setBlocks} />
          <p style={S.settingsNote}>Rename a block or drag it into a new order. Blocks with nothing scheduled stay hidden.</p>
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
            <p style={{ ...S.settingsNote, marginTop: 12, color: theme.text }}>
              {importStatus.message}
            </p>
          )}
        </div>

        <button
          style={S.modalButton}
          onClick={() => {
            const timeBlockLabels = Object.fromEntries(TIME_BLOCKS.map(b => [b, (blocks.labels[b] || '').trim() || TIME_BLOCK_LABELS[b]]));
            onSave({ ...settings, completionThreshold: threshold, darkMode, timeBlockLabels, timeBlockOrder: blocks.order });
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
function Dashboard({ user, signOut, onDarkMode }) {
  const isMobile = useIsMobile();
  const { state, save, importData, exportData, syncing, lastSynced } = useData(user);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tab, setTab] = useState('today');
  const [showSettings, setShowSettings] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [todoText, setTodoText] = useState('');
  const [navHover, setNavHover] = useState(null);
  const [editor, setEditor] = useState(null); // null | { habit } | { defaultBlock }

  const { theme, S } = useTheme();

  const toggleHabit = useCallback(id => {
    const dk = formatDateKey(selectedDate);
    const newComp = { ...state.completions };
    if (!newComp[dk]) newComp[dk] = {};
    newComp[dk] = { ...newComp[dk], [id]: !newComp[dk][id] };
    save({ ...state, completions: newComp });
  }, [state, selectedDate, save]);

  const addTodo = useCallback(text => {
    const dk = formatDateKey(selectedDate);
    const todo = { id: generateId(), text, createdAt: new Date().toISOString() };
    if (dk !== formatDateKey(new Date())) todo.dueDate = dk;
    save({ ...state, todos: [...state.todos, todo] });
  }, [state, save, selectedDate]);

  const toggleTodo = useCallback(id => {
    save({ ...state, todos: state.todos.map(t => t.id === id ? { ...t, completedAt: t.completedAt ? null : new Date().toISOString() } : t) });
  }, [state, save]);

  const deleteTodo = useCallback(id => {
    save({ ...state, todos: state.todos.filter(t => t.id !== id) });
  }, [state, save]);

  const addHabit = useCallback(fields => {
    const inBlock = state.habits.filter(h => h.timeBlock === fields.timeBlock);
    const sortOrder = inBlock.length ? Math.max(...inBlock.map(h => h.sortOrder ?? 0)) + 1 : 0;
    save({ ...state, habits: [...state.habits, { id: generateId(), createdAt: new Date().toISOString(), sortOrder, ...fields }] });
    setEditor(null);
  }, [state, save]);

  const updateHabit = useCallback((id, fields) => {
    save({ ...state, habits: state.habits.map(h => h.id === id ? { ...h, ...fields } : h) });
    setEditor(null);
  }, [state, save]);

  // Soft delete: the habit leaves the daily view, its completion history stays for Insights.
  const archiveHabit = useCallback(id => {
    save({ ...state, habits: state.habits.map(h => h.id === id ? { ...h, archivedAt: new Date().toISOString() } : h) });
    setEditor(null);
  }, [state, save]);

  const restoreHabit = useCallback(id => {
    save({ ...state, habits: state.habits.map(h => {
      if (h.id !== id) return h;
      const copy = { ...h };
      delete copy.archivedAt;
      return copy;
    }) });
  }, [state, save]);

  const closeEditor = useCallback(() => setEditor(null), []);

  const darkMode = Boolean(state?.settings?.darkMode);
  useEffect(() => { if (onDarkMode) onDarkMode(darkMode); }, [darkMode, onDarkMode]);

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
  // One slat per scheduled habit, in list order (time block, then sort order), for the day numeral.
  const slatStates = Object.values(habitsByBlock).flat().map(h => !!completions[dk]?.[h.id]);
  const dayTodos = getTodosForDay(state.todos, selectedDate, today);
  const todoTag = todo => (todo.carriedFrom ? shortDate(todo.carriedFrom) : (todo.dueDate && todo.dueDate !== dk ? shortDate(todo.dueDate) : null));

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {user && <span style={{ fontSize: 11, color: theme.textMuted }}>☁️</span>}
            <button style={{ ...S.tab, fontSize: 28, fontWeight: 100, color: theme.text, lineHeight: 1 }} onClick={() => setEditor({ defaultBlock: TIME_BLOCKS[0] })} aria-label="New habit">+</button>
          </div>
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

        {tab === 'manage' ? (
          <ManageHabits
            habits={state.habits}
            labels={labels}
            blockOrder={state.settings?.timeBlockOrder || TIME_BLOCKS}
            onBack={() => setTab('today')}
            onNew={() => setEditor({ defaultBlock: TIME_BLOCKS[0] })}
            onEdit={habit => setEditor({ habit })}
            onArchive={archiveHabit}
            onRestore={restoreHabit}
          />
        ) : tab === 'today' ? (
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
                <LouverNumeral key={dk} value={selectedDate.getDate()} slats={slatStates} ink={theme.text} faint={theme.textFaintest} hinge={theme.border} style={S.mobileDayNumber}>
                  {isDayCompleted && (
                    <>
                      <div style={{ ...S.mobileStrikeX, transform: 'translate(-50%, -50%) rotate(45deg)' }} />
                      <div style={{ ...S.mobileStrikeX, transform: 'translate(-50%, -50%) rotate(-45deg)' }} />
                    </>
                  )}
                </LouverNumeral>
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
            <ProgressBar
              completed={dayProgress.completed}
              total={dayProgress.total}
              threshold={state.settings.completionThreshold}
              width={64}
              style={{ marginTop: 0, marginBottom: 28, padding: '18px 0', borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}` }}
            />

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
              {dayTodos.map(todo => (
                <TodoRow key={todo.id} todo={todo} tag={todoTag(todo)} onToggle={toggleTodo} onDelete={deleteTodo} />
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
            {Object.keys(completions).length === 0 && (
              <p style={{ ...S.settingsNote, marginTop: 0, marginBottom: 40 }}>Insights fill in as you check things off.</p>
            )}
            <StatsRow habits={state.habits} completions={completions} threshold={state.settings.completionThreshold} />
            <YearGrid habits={state.habits} completions={completions} threshold={state.settings.completionThreshold} />
            <TrendLine habits={state.habits} completions={completions} />
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

        {editor && (
          <HabitModal
            habit={editor.habit}
            labels={labels}
            blockOrder={state.settings?.timeBlockOrder || TIME_BLOCKS}
            defaultBlock={editor.defaultBlock}
            onSave={fields => (editor.habit ? updateHabit(editor.habit.id, fields) : addHabit(fields))}
            onArchive={archiveHabit}
            onClose={closeEditor}
          />
        )}
        {showSettings && (
          <SettingsModal
            settings={state.settings}
            onSave={s => save({ ...state, settings: s })}
            onClose={() => setShowSettings(false)}
            habits={state.habits}
            onManageHabits={() => setTab('manage')}
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
          <button style={{ ...S.tab, fontSize: 24, fontWeight: 100, color: theme.textMuted, marginRight: 32, lineHeight: 1 }} onClick={() => setEditor({ defaultBlock: TIME_BLOCKS[0] })} aria-label="New habit">+</button>
          <button style={{ ...S.tab, fontSize: 12 }} onClick={() => setShowSettings(true)}>
            Settings
          </button>
        </div>

        {tab === 'manage' ? (
          <ManageHabits
            habits={state.habits}
            labels={labels}
            blockOrder={state.settings?.timeBlockOrder || TIME_BLOCKS}
            onBack={() => setTab('today')}
            onNew={() => setEditor({ defaultBlock: TIME_BLOCKS[0] })}
            onEdit={habit => setEditor({ habit })}
            onArchive={archiveHabit}
            onRestore={restoreHabit}
          />
        ) : tab === 'today' ? (
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
                <LouverNumeral key={dk} value={selectedDate.getDate()} slats={slatStates} ink={theme.text} faint={theme.textFaintest} hinge={theme.border} style={S.dayNumber}>
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
                </LouverNumeral>
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
                    onEdit={h => setEditor({ habit: h })}
                  />
                ))}
              </div>
            ))}

            <div style={S.todoSection}>
              <div style={S.sectionLabel}>Tasks</div>
              {dayTodos.map(todo => (
                <TodoRow key={todo.id} todo={todo} tag={todoTag(todo)} onToggle={toggleTodo} onDelete={deleteTodo} />
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
            {Object.keys(completions).length === 0 && (
              <p style={{ ...S.settingsNote, marginTop: 0, marginBottom: 40 }}>Insights fill in as you check things off.</p>
            )}
            <StatsRow habits={state.habits} completions={completions} threshold={state.settings.completionThreshold} />
            <YearGrid habits={state.habits} completions={completions} threshold={state.settings.completionThreshold} />
            <TrendLine habits={state.habits} completions={completions} />
            <HabitBreakdown habits={state.habits} completions={completions} />
          </>
        )}

        {editor && (
          <HabitModal
            habit={editor.habit}
            labels={labels}
            blockOrder={state.settings?.timeBlockOrder || TIME_BLOCKS}
            defaultBlock={editor.defaultBlock}
            onSave={fields => (editor.habit ? updateHabit(editor.habit.id, fields) : addHabit(fields))}
            onArchive={archiveHabit}
            onClose={closeEditor}
          />
        )}
        {showSettings && (
          <SettingsModal
            settings={state.settings}
            onSave={s => save({ ...state, settings: s })}
            onClose={() => setShowSettings(false)}
            habits={state.habits}
            onManageHabits={() => setTab('manage')}
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
      <Dashboard user={user} signOut={signOut} onDarkMode={setDarkMode} />
    </ThemeProvider>
  );
}
