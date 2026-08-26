/**
 * The week boundary. One definition, imported everywhere.
 *
 * **Setframe weeks run Sunday through Saturday.**
 *
 * This is deliberately *not* the ISO-8601 week, which starts on Monday. The
 * product previously used ISO, and the two functions that computed it lived in
 * two different modules (`training-trends.ts` and `weight-trend.ts`) as
 * byte-identical copies. That is why this module exists: a week boundary
 * duplicated across files is one edit away from body-weight weeks and training
 * weeks disagreeing, which would be invisible until a user noticed two cards
 * on one screen summarising different seven-day spans.
 *
 * The change to Sunday also removes a smaller inconsistency: `dayIndex` on
 * `program_schedule_slot` has always been the real day of week (0 = Sunday),
 * so a Sunday-anchored week makes a slot's index and its position within the
 * week the same number.
 *
 * Nothing persists a week start — every weekly figure is computed from a
 * `local_date` at read time — so changing this boundary needs no migration.
 * It does change what "this week" means for existing users, which is a
 * product decision, not a bug.
 */

/** 0 = Sunday. Change this and the whole product's week moves with it. */
export const WEEK_START_DAY = 0;

function toUtc(localDate: string): Date {
  return new Date(`${localDate}T00:00:00Z`);
}

/**
 * The Sunday that begins the week containing `localDate`, as `YYYY-MM-DD`.
 *
 * Operates on a UTC-midnight instant so it never crosses a day boundary
 * through a local timezone offset: the input is a calendar date, not a moment,
 * and must come back as the same calendar date's week regardless of where the
 * caller is.
 */
export function weekStart(localDate: string): string {
  const date = toUtc(localDate);
  const offset = (date.getUTCDay() - WEEK_START_DAY + 7) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

/** The Saturday that ends the week beginning `weekStartDate`. */
export function weekEnd(weekStartDate: string): string {
  const date = toUtc(weekStartDate);
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
}

/** Whether two calendar dates fall in the same week. */
export function isSameWeek(a: string, b: string): boolean {
  return weekStart(a) === weekStart(b);
}
