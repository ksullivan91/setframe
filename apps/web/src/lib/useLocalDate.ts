import { useEffect, useState } from 'react';

/** Computes the device's local calendar date as `YYYY-MM-DD` (not UTC). */
function computeLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the current local calendar date and keeps it fresh across a
 * midnight rollover while the page stays open/foregrounded — a plain
 * `todayLocalDate()` call only runs once per render, so a user who leaves
 * the Today page open across midnight would keep seeing yesterday's date
 * (and, more importantly, yesterday's completion state) until an
 * unrelated re-render happened to occur (Story 07).
 *
 * Re-checks on an interval and whenever the tab regains visibility/focus,
 * since those are the realistic moments a user would expect "today" to
 * be re-evaluated.
 */
export function useLocalDate(): string {
  const [localDate, setLocalDate] = useState(computeLocalDate);

  useEffect(() => {
    const refresh = () => {
      const next = computeLocalDate();
      setLocalDate((prev) => (prev === next ? prev : next));
    };

    // Catches rollover promptly if the tab is active across midnight.
    const intervalId = window.setInterval(refresh, 60_000);
    // Catches rollover when the user returns to a backgrounded/inactive tab.
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return localDate;
}
