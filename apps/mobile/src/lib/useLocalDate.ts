import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

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
 * midnight rollover while the app stays open/foregrounded — a plain
 * `todayLocalDate()` call only runs once per render, so a user who leaves
 * the app open (or backgrounded) across midnight would keep seeing
 * yesterday's date (and, more importantly, yesterday's completion state)
 * until an unrelated re-render happened to occur (Story 07).
 *
 * Re-checks on an interval and whenever the app returns to the foreground,
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

    // Catches rollover promptly if the app is active across midnight.
    const intervalId = setInterval(refresh, 60_000);
    // Catches rollover when the app returns from the background.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, []);

  return localDate;
}
