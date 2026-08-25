import type { AdditionalActivityType } from '@setframe/schemas';

export type AdditionalActivityField = 'title' | 'duration' | 'distance' | 'startTime' | 'notes';

/**
 * Story 42 — which fields are relevant for a given activity type, so the
 * add/edit form only ever shows what that type actually needs (no
 * weight/sets/reps/RPE for any of these). One shared mapping, not
 * duplicated per-platform forms, per the story's own steering doc.
 *
 * The story's own field table doesn't explicitly enumerate `run` — it's
 * grouped here with `walk`/the cycle types (duration + distance +
 * start time + notes) as the closest analogous distance-based activity,
 * rather than treated as an omission that hides its distance field.
 */
export const additionalActivityFieldsByType: Record<AdditionalActivityType, AdditionalActivityField[]> = {
  walk: ['duration', 'distance', 'startTime', 'notes'],
  run: ['duration', 'distance', 'startTime', 'notes'],
  outdoor_cycle: ['duration', 'distance', 'startTime', 'notes'],
  indoor_cycle: ['duration', 'distance', 'startTime', 'notes'],
  yoga: ['duration', 'startTime', 'notes'],
  mobility: ['duration', 'startTime', 'notes'],
  foam_rolling: ['duration', 'startTime', 'notes'],
  stretching: ['duration', 'startTime', 'notes'],
  other: ['title', 'duration', 'distance', 'notes'],
};

export function getAdditionalActivityFields(type: AdditionalActivityType): AdditionalActivityField[] {
  return additionalActivityFieldsByType[type];
}
