import type { AdditionalActivityType } from '@setframe/schemas';

export interface RecentActivityInput {
  activityType: AdditionalActivityType;
  title: string | null;
  durationSeconds: number | null;
  distanceValue: number | null;
  distanceUnit: 'm' | 'km' | 'mi' | null;
  /** Used only to order by recency — most recent first. */
  createdAt: string;
}

export interface RecentActivitySuggestion {
  activityType: AdditionalActivityType;
  title: string | null;
  durationSeconds: number | null;
  distanceValue: number | null;
  distanceUnit: 'm' | 'km' | 'mi' | null;
}

/**
 * Story 43 — "Recent activities" for the Quick add row. A user's raw
 * activity history repeats itself constantly (the same 15-minute walk
 * logged most days), so the list must be deduplicated to distinct
 * combinations, most-recently-used first, rather than showing the same
 * suggestion over and over.
 */
export function deriveRecentActivitySuggestions(
  activities: readonly RecentActivityInput[],
  limit = 3,
): RecentActivitySuggestion[] {
  const seen = new Set<string>();
  const suggestions: RecentActivitySuggestion[] = [];

  const sorted = [...activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const activity of sorted) {
    const key = `${activity.activityType}|${activity.title ?? ''}|${activity.durationSeconds ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push({
      activityType: activity.activityType,
      title: activity.title,
      durationSeconds: activity.durationSeconds,
      distanceValue: activity.distanceValue,
      distanceUnit: activity.distanceUnit,
    });
    if (suggestions.length >= limit) break;
  }
  return suggestions;
}
