import { describe, expect, it } from 'vitest';
import {
  durationPartsToSeconds,
  formatActivityDuration,
  secondsToDurationParts,
  validateDurationDraft,
} from './duration';

describe('durationPartsToSeconds', () => {
  it('combines the two fields', () => {
    expect(durationPartsToSeconds(23, 9)).toBe(1389);
    expect(durationPartsToSeconds(14, 37)).toBe(877);
    expect(durationPartsToSeconds(75, 20)).toBe(4520);
  });

  it('carries seconds above 59 into minutes rather than truncating', () => {
    // Silently dropping the excess is the failure this module exists to stop.
    expect(durationPartsToSeconds(1, 60)).toBe(durationPartsToSeconds(2, 0));
    expect(durationPartsToSeconds(14, 75)).toBe(durationPartsToSeconds(15, 15));
  });

  it('treats a missing part as zero', () => {
    expect(durationPartsToSeconds(0, 30)).toBe(30);
    expect(durationPartsToSeconds(5, 0)).toBe(300);
  });

  it('clamps nonsense rather than producing a total that contradicts its fields', () => {
    expect(durationPartsToSeconds(-5, 30)).toBe(30);
    expect(durationPartsToSeconds(Number.NaN, 30)).toBe(30);
  });
});

describe('secondsToDurationParts', () => {
  it('splits canonical seconds back into fields', () => {
    expect(secondsToDurationParts(877)).toEqual({ minutes: 14, seconds: 37 });
    expect(secondsToDurationParts(1389)).toEqual({ minutes: 23, seconds: 9 });
  });

  it('keeps minutes uncapped past an hour rather than inventing an hours field', () => {
    expect(secondsToDurationParts(4520)).toEqual({ minutes: 75, seconds: 20 });
  });

  it('round-trips without losing a second', () => {
    /* The live bug this replaces: the form read Math.round(seconds / 60) and
       wrote minutes * 60, so opening an existing 877-second activity and
       saving it rewrote it to 900. */
    for (const total of [1, 30, 59, 60, 877, 1389, 4520, 5999]) {
      const parts = secondsToDurationParts(total);
      expect(durationPartsToSeconds(parts.minutes, parts.seconds)).toBe(total);
    }
  });

  it('reports zero for absent or nonsensical input', () => {
    expect(secondsToDurationParts(0)).toEqual({ minutes: 0, seconds: 0 });
    expect(secondsToDurationParts(-10)).toEqual({ minutes: 0, seconds: 0 });
  });
});

describe('formatActivityDuration', () => {
  it('omits seconds for a whole minute, so existing history reads unchanged', () => {
    expect(formatActivityDuration(840)).toBe('14 min');
    expect(formatActivityDuration(4500)).toBe('75 min');
  });

  it('shows seconds only where they exist', () => {
    expect(formatActivityDuration(877)).toBe('14 min 37 sec');
    expect(formatActivityDuration(4520)).toBe('75 min 20 sec');
  });

  it('reports a sub-minute activity in seconds alone', () => {
    expect(formatActivityDuration(30)).toBe('30 sec');
  });

  it('is null when there is no duration to show', () => {
    expect(formatActivityDuration(null)).toBeNull();
    expect(formatActivityDuration(0)).toBeNull();
  });
});

describe('validateDurationDraft', () => {
  const draft = (minutes: string, seconds: string) => ({ minutes, seconds });

  it('accepts a normal two-field entry', () => {
    expect(validateDurationDraft(draft('23', '09'))).toEqual({
      totalSeconds: 1389,
      errors: {},
    });
  });

  it('accepts minutes alone and seconds alone', () => {
    expect(validateDurationDraft(draft('14', '')).totalSeconds).toBe(840);
    expect(validateDurationDraft(draft('', '30')).totalSeconds).toBe(30);
  });

  it('accepts minutes past 59 without demanding an hours field', () => {
    expect(validateDurationDraft(draft('75', '20')).totalSeconds).toBe(4520);
  });

  it('carries seconds past 59 instead of rejecting them', () => {
    // Refusing would send the user to do arithmetic the product can do.
    expect(validateDurationDraft(draft('14', '75')).totalSeconds).toBe(915);
  });

  it('reports an empty draft as no duration, not as an error', () => {
    // Duration is optional for some activity types; the caller decides.
    expect(validateDurationDraft(draft('', ''))).toEqual({ totalSeconds: null, errors: {} });
  });

  it('treats an all-zero draft as no duration', () => {
    expect(validateDurationDraft(draft('0', '0')).totalSeconds).toBeNull();
  });

  it('rejects fractional or negative input per field', () => {
    expect(validateDurationDraft(draft('1.5', '')).errors.minutes).toBeTruthy();
    expect(validateDurationDraft(draft('', '-4')).errors.seconds).toBeTruthy();
    expect(validateDurationDraft(draft('1.5', '')).totalSeconds).toBeNull();
  });

  it('does not silently reinterpret a clock-style value typed into one box', () => {
    /* `2309` meaning 23:09 is exactly what produced the original bug. It is
       accepted only as what it literally says — 2,309 minutes — and the
       two-field affordance is what prevents the user meaning otherwise. */
    expect(validateDurationDraft(draft('2309', '')).totalSeconds).toBe(2309 * 60);
  });
});
