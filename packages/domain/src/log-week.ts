/**
 * The seven days the Log week strip shows.
 *
 * Pure date arithmetic on `YYYY-MM-DD` strings, deliberately never `Date`
 * objects in local time: a `Date` built from a bare date string is UTC
 * midnight, which is the previous day for anyone west of Greenwich. Every
 * daily record in this system is keyed by `local_date` for the same reason.
 */

export type LogDayState = 'trained' | 'rest' | 'none';

export interface LogWeekDay {
  localDate: string;
  /** Single letter for the column head: S M T W T F S. */
  letter: string;
  state: LogDayState;
  isToday: boolean;
  isSelected: boolean;
  /** A date after today cannot be marked or corrected. */
  isFuture: boolean;
}

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Days since the Unix epoch for a `YYYY-MM-DD` string. */
function toDayNumber(localDate: string): number {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function toLocalDate(dayNumber: number): string {
  return new Date(dayNumber * 86_400_000).toISOString().slice(0, 10);
}

/** 0 = Sunday, matching the letters above. */
export function weekdayIndex(localDate: string): number {
  // 1970-01-01 was a Thursday, which is index 4.
  return (((toDayNumber(localDate) + 4) % 7) + 7) % 7;
}

export function addDays(localDate: string, delta: number): string {
  return toLocalDate(toDayNumber(localDate) + delta);
}

/** The Sunday on or before the given date. */
export function startOfWeek(localDate: string): string {
  return addDays(localDate, -weekdayIndex(localDate));
}

export interface BuildLogWeekInput {
  /** The date the screen is currently showing. */
  selectedDate: string;
  /** The user's actual today, which may be a different week entirely. */
  today: string;
  /** Dates with at least one completed session. */
  trainedDates: readonly string[];
  /** Dates the user marked as rest. */
  restDates: readonly string[];
}

/**
 * Builds the strip around the *selected* date, not around today — browsing
 * to last Tuesday should show last week, with today's marker absent because
 * today is not in it.
 *
 * Training wins over rest when a date somehow has both, matching the
 * precedence Log itself uses: a real session always beats a logged rest day.
 */
export function buildLogWeek({
  selectedDate,
  today,
  trainedDates,
  restDates,
}: BuildLogWeekInput): LogWeekDay[] {
  const trained = new Set(trainedDates);
  const rest = new Set(restDates);
  const start = startOfWeek(selectedDate);
  const todayNumber = toDayNumber(today);

  return LETTERS.map((letter, offset) => {
    const localDate = addDays(start, offset);
    const state: LogDayState = trained.has(localDate)
      ? 'trained'
      : rest.has(localDate)
        ? 'rest'
        : 'none';
    return {
      localDate,
      letter,
      state,
      isToday: localDate === today,
      isSelected: localDate === selectedDate,
      isFuture: toDayNumber(localDate) > todayNumber,
    };
  });
}
