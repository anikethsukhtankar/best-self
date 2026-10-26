// Date formatting and manipulation utilities

export const formatDateKey = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

export const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

export const getWeekStart = (d) => {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
};

export const isSameDay = (a, b) => formatDateKey(a) === formatDateKey(b);

// A 'YYYY-MM-DD' key as a local date (new Date('YYYY-MM-DD') would be UTC midnight).
export const parseDateKey = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Locale date text, e.g. formatDate(d, 'monthDay') -> 'Oct 26'. One Intl formatter per style,
// made once: toLocaleDateString builds a new one on every call, which is slow in long lists.
const STYLES = {
  monthDay: { month: 'short', day: 'numeric' },
  weekdayMonthDay: { weekday: 'short', month: 'short', day: 'numeric' },
  month: { month: 'short' },
  monthYear: { month: 'short', year: 'numeric' },
};
const formatters = {};
export const formatDate = (date, style = 'monthDay') => {
  formatters[style] ||= new Intl.DateTimeFormat(undefined, STYLES[style]);
  return formatters[style].format(date);
};
