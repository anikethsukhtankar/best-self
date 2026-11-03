import { useEffect, useMemo, useState } from 'react';
import { formatDateKey, parseDateKey } from '../utils/date';

// The calendar day of `date` (midnight), as the same object for as long as the day is the same,
// so memoised Insights do not recompute on every render because `new Date()` is always new.
export function useDay(date = new Date()) {
  const key = formatDateKey(date);
  return useMemo(() => parseDateKey(key), [key]);
}

// Today (midnight), kept current while the app stays open: it turns over at midnight, and again
// whenever the app comes back to the foreground, because a phone can keep an installed app asleep
// across days and timers do not run while it sleeps.
export function useToday() {
  const [key, setKey] = useState(() => formatDateKey(new Date()));
  useEffect(() => {
    let timer;
    const check = () => setKey(formatDateKey(new Date()));
    const schedule = () => {
      clearTimeout(timer);
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => { check(); schedule(); }, midnight - now);
    };
    const wake = () => {
      if (document.visibilityState === 'hidden') return;
      check();
      schedule();
    };
    schedule();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('pageshow', wake);
    };
  }, []);
  return useMemo(() => parseDateKey(key), [key]);
}
