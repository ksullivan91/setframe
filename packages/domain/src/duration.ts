/**
 * Duration entry and display, in canonical seconds.
 *
 * Story 63. Additional Activity's form collected a single `Duration (min)`
 * field, which caused a real user to type `2309` meaning 23:09 and store it
 * as 2,309 minutes — the affordance said "number" while the model meant
 * "whole minutes", and nothing reconciled the two.
 *
 * The persistence layer was already right: `additional_activity.
 * duration_seconds` has always been an integer number of seconds. So no
 * migration is needed. What existed instead was quieter and worse: the form
 * read `Math.round(durationSeconds / 60)` and wrote `minutes * 60`, so
 * **opening an existing 877-second activity and saving it rewrote it to
 * 900**. Precision was not merely unavailable, it was destroyed on every
 * round-trip through the edit form.
 *
 * Minutes stay the primary unit even past an hour — `75 min 20 sec`, not
 * `1 hr 15 min 20 sec` — because that is how the product's user thinks about
 * activity length, and one consistent representation beats a unit that
 * changes shape at an arbitrary threshold.
 */

export interface DurationParts {
  minutes: number;
  seconds: number;
}

/** Seconds in a minute. Named so the arithmetic below reads as intent. */
const SECONDS_PER_MINUTE = 60;

/**
 * Combines minutes and seconds into canonical total seconds.
 *
 * Seconds above 59 carry into minutes rather than being rejected or
 * truncated: `14 min 75 sec` is unambiguous and means 15:15, and silently
 * dropping the excess is the failure this module exists to prevent. Negative
 * inputs clamp to zero — they have no meaning for an elapsed duration, and
 * letting one through would produce a total that disagrees with both fields.
 */
export function durationPartsToSeconds(minutes: number, seconds: number): number {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(Math.trunc(minutes), 0) : 0;
  const safeSeconds = Number.isFinite(seconds) ? Math.max(Math.trunc(seconds), 0) : 0;
  return safeMinutes * SECONDS_PER_MINUTE + safeSeconds;
}

/**
 * Splits canonical seconds back into the two fields the form shows.
 *
 * Minutes are deliberately uncapped, so a 90-minute activity round-trips as
 * `90 min 0 sec` rather than acquiring an hours field the form does not have.
 */
export function secondsToDurationParts(totalSeconds: number): DurationParts {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return { minutes: 0, seconds: 0 };
  const total = Math.trunc(totalSeconds);
  return {
    minutes: Math.floor(total / SECONDS_PER_MINUTE),
    seconds: total % SECONDS_PER_MINUTE,
  };
}

/**
 * Human-readable duration, e.g. `14 min`, `14 min 37 sec`, `75 min 20 sec`.
 *
 * Whole minutes omit the seconds entirely rather than padding `0 sec`, so
 * existing whole-minute history reads exactly as it did before this change —
 * the new precision is visible only where it exists.
 */
export function formatActivityDuration(totalSeconds: number | null | undefined): string | null {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;
  const { minutes, seconds } = secondsToDurationParts(totalSeconds);
  if (minutes === 0) return `${seconds} sec`;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes} min ${seconds} sec`;
}

export interface DurationDraft {
  /** Raw field text, so a half-typed value is never coerced mid-edit. */
  minutes: string;
  seconds: string;
}

export interface DurationValidation {
  /** Canonical total, or null when the draft does not describe a duration. */
  totalSeconds: number | null;
  /** Field-scoped message, or null. Keyed so each input can show its own. */
  errors: { minutes?: string; seconds?: string };
}

/**
 * Validates a two-field draft.
 *
 * Empty is not an error here — a duration may be genuinely optional for the
 * activity type, and the caller decides whether it is required. What this
 * rejects is input that *looks* like a duration but is not one, so the
 * ambiguity that produced `2309 minutes` cannot recur silently.
 */
export function validateDurationDraft(draft: DurationDraft): DurationValidation {
  const errors: DurationValidation['errors'] = {};
  const minutesText = draft.minutes.trim();
  const secondsText = draft.seconds.trim();

  if (!minutesText && !secondsText) return { totalSeconds: null, errors };

  const minutes = minutesText === '' ? 0 : Number(minutesText);
  const seconds = secondsText === '' ? 0 : Number(secondsText);

  if (minutesText !== '' && (!Number.isInteger(minutes) || minutes < 0)) {
    errors.minutes = 'Whole minutes only.';
  }
  if (secondsText !== '' && (!Number.isInteger(seconds) || seconds < 0)) {
    errors.seconds = 'Whole seconds only.';
  }
  /* Above 59 is accepted and carried, not rejected: `90` in the seconds box
     is unambiguous, and refusing it would send the user to do arithmetic the
     product can do correctly. `durationPartsToSeconds` performs the carry. */

  if (errors.minutes || errors.seconds) return { totalSeconds: null, errors };

  const total = durationPartsToSeconds(minutes, seconds);
  return { totalSeconds: total > 0 ? total : null, errors };
}
