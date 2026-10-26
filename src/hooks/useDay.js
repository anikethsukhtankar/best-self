import { useMemo } from 'react';
import { formatDateKey, parseDateKey } from '../utils/date';

// The calendar day of `date` (midnight), as the same object for as long as the day is the same,
// so memoised Insights do not recompute on every render because `new Date()` is always new.
export function useDay(date = new Date()) {
  const key = formatDateKey(date);
  return useMemo(() => parseDateKey(key), [key]);
}
