import { describe, expect, it } from 'vitest';
import { deriveRecentActivitySuggestions, type RecentActivityInput } from './additional-activity-recents';

function activity(overrides: Partial<RecentActivityInput> = {}): RecentActivityInput {
  return {
    activityType: 'walk',
    title: null,
    durationSeconds: 900,
    distanceValue: null,
    distanceUnit: null,
    createdAt: '2026-08-24T12:00:00.000Z',
    ...overrides,
  };
}

describe('deriveRecentActivitySuggestions', () => {
  it('dedupes repeated identical activities down to one suggestion', () => {
    const activities = [
      activity({ createdAt: '2026-08-20T08:00:00.000Z' }),
      activity({ createdAt: '2026-08-22T08:00:00.000Z' }),
      activity({ createdAt: '2026-08-24T08:00:00.000Z' }),
    ];
    expect(deriveRecentActivitySuggestions(activities)).toHaveLength(1);
  });

  it('orders suggestions most-recently-used first', () => {
    const activities = [
      activity({ activityType: 'yoga', createdAt: '2026-08-20T08:00:00.000Z' }),
      activity({ activityType: 'walk', createdAt: '2026-08-24T08:00:00.000Z' }),
    ];
    const suggestions = deriveRecentActivitySuggestions(activities);
    expect(suggestions[0]!.activityType).toBe('walk');
    expect(suggestions[1]!.activityType).toBe('yoga');
  });

  it('treats different durations of the same type as distinct suggestions', () => {
    const activities = [
      activity({ durationSeconds: 900, createdAt: '2026-08-24T08:00:00.000Z' }),
      activity({ durationSeconds: 1200, createdAt: '2026-08-23T08:00:00.000Z' }),
    ];
    expect(deriveRecentActivitySuggestions(activities)).toHaveLength(2);
  });

  it('caps the result at the given limit', () => {
    const activities = Array.from({ length: 10 }, (_, i) =>
      activity({ durationSeconds: 60 * (i + 1), createdAt: `2026-08-${10 + i}T08:00:00.000Z` }),
    );
    expect(deriveRecentActivitySuggestions(activities, 3)).toHaveLength(3);
  });

  it('returns nothing for a new user with no history', () => {
    expect(deriveRecentActivitySuggestions([])).toEqual([]);
  });
});
