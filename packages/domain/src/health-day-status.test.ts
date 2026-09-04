import { describe, it, expect } from 'vitest';
import type { AppleHealthDay } from '@setframe/schemas';
import { deriveDayStatus, endOfLocalDay, needsResync, hasAnyMeasurement } from './health-day-status';

function day(over: Partial<AppleHealthDay> = {}): AppleHealthDay {
  return {
    localDate: '2026-09-01',
    timezone: 'America/Chicago',
    syncedThrough: '2026-09-02T05:00:00.000Z',
    outcome: 'ok',
    activity: {
      steps: 8000, activeEnergyKcal: 500, exerciseMinutes: 30,
      restingHeartRate: 55, hrvSdnnMs: 60, vo2Max: 44,
      weightKg: 80, bodyFatPercentage: 18, sleepTotalMinutes: 430,
    },
    ...over,
  };
}

describe('when a local day ends', () => {
  it('uses the record’s own zone, not the server’s', () => {
    // Chicago is UTC-5 on this date, so the day closes at 05:00 UTC.
    expect(endOfLocalDay('2026-09-01', 'America/Chicago').toISOString())
      .toBe('2026-09-02T05:00:00.000Z');
    // Tokyo is UTC+9, so the same calendar day closes 14 hours earlier.
    expect(endOfLocalDay('2026-09-01', 'Asia/Tokyo').toISOString())
      .toBe('2026-09-01T15:00:00.000Z');
  });

  it('follows the offset across a DST boundary', () => {
    // US DST ends 2026-11-01; the day after is UTC-6, not UTC-5.
    expect(endOfLocalDay('2026-11-01', 'America/Chicago').toISOString())
      .toBe('2026-11-02T06:00:00.000Z');
  });

  it('closes the day on time when the zone is unknown', () => {
    // An unsettleable day would be re-queried forever.
    expect(endOfLocalDay('2026-09-01', 'Not/AZone').toISOString())
      .toBe('2026-09-02T00:00:00.000Z');
  });
});

describe('what a reconciled day settles to', () => {
  const after = new Date('2026-09-03T00:00:00.000Z');

  it('is complete when the day is over and the read covered all of it', () => {
    expect(deriveDayStatus(day(), after)).toBe('complete');
  });

  it('is partial while the day is still running', () => {
    const now = new Date('2026-09-01T18:00:00.000Z');
    expect(deriveDayStatus(day({ syncedThrough: now.toISOString() }), now)).toBe('partial');
  });

  it('is stale when the day closed after the read stopped', () => {
    // A mid-day sync that never came back: late Watch writes may be waiting.
    expect(deriveDayStatus(day({ syncedThrough: '2026-09-01T18:00:00.000Z' }), after))
      .toBe('stale');
  });

  it('is missing when a finished day genuinely held nothing', () => {
    expect(deriveDayStatus(day({ activity: null, nutrition: null }), after)).toBe('missing');
  });

  it('reports the read’s own failure rather than guessing', () => {
    expect(deriveDayStatus(day({ outcome: 'error' }), after)).toBe('error');
    expect(deriveDayStatus(day({ outcome: 'unavailable' }), after)).toBe('unavailable');
  });

  it('counts a nutrition-only day as measured', () => {
    const d = day({
      activity: null,
      nutrition: { caloriesKcal: 2100, proteinG: 150, carbsG: 200, fatG: 70 },
    });
    expect(hasAnyMeasurement(d)).toBe(true);
    expect(deriveDayStatus(d, after)).toBe('complete');
  });

  it('does not treat an all-null activity block as a measurement', () => {
    const d = day({
      activity: {
        steps: null, activeEnergyKcal: null, exerciseMinutes: null,
        restingHeartRate: null, hrvSdnnMs: null, vo2Max: null,
        weightKg: null, bodyFatPercentage: null, sleepTotalMinutes: null,
      },
    });
    expect(deriveDayStatus(d, after)).toBe('missing');
  });
});

describe('which days a sweep asks about again', () => {
  it('re-queries only what can still change', () => {
    expect(needsResync('partial')).toBe(true);
    expect(needsResync('stale')).toBe(true);
    expect(needsResync('error')).toBe(true);
    // An empty Tuesday stays empty; re-querying it forever is a battery bug.
    expect(needsResync('missing')).toBe(false);
    expect(needsResync('complete')).toBe(false);
    expect(needsResync('unavailable')).toBe(false);
  });
});
