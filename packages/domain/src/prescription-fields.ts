import type { Prescription } from '@setframe/schemas';

export type PrescriptionKind = Prescription['kind'];

/**
 * Parses a numeric input's raw string into `number | undefined`, treating
 * an empty string as absence rather than `Number('') === 0` (Story 19) —
 * every prescription-editing surface (Guided Setup, the full editor's
 * per-set overrides, exercise edit sheets) must share this so a cleared
 * field can never round-trip as a fake `0` target.
 */
export function parseOptionalNumber(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * The render-side counterpart to `parseOptionalNumber`: an absent planned
 * value becomes `''`, never the literal string `"undefined"`. Every
 * prescription-editing surface should share this rather than re-writing
 * `value == null ? '' : String(value)` inline.
 */
export function formatOptionalNumber(value: number | undefined | null): string {
  return value == null ? '' : String(value);
}

/**
 * The inputs a workout-session set card can render. These map 1:1 onto the
 * generic `workout_sets` row, which carries every column as nullable — see
 * `workoutSetSchema` in `@setframe/schemas`. Nothing here implies a schema
 * change; this module only decides which of those columns are *meaningful*
 * for a given prescription.
 */
export type SessionField = 'setType' | 'weight' | 'reps' | 'duration' | 'distance' | 'rpe';

/** Canonical display order, so web and mobile lay fields out identically. */
export const sessionFieldOrder: readonly SessionField[] = [
  'setType',
  'weight',
  'reps',
  'duration',
  'distance',
  'rpe',
] as const;

/**
 * How a set's duration is expressed to the user. The column is always stored
 * in seconds; `minutes` only changes the input affordance and formatting.
 */
export type DurationDisplayUnit = 'seconds' | 'minutes';

/** Which metric a summary/progress readout should lead with for this kind. */
export type SummaryMetric = 'volume' | 'duration' | 'distance' | 'reps';

export interface PrescriptionDefinition {
  kind: PrescriptionKind;
  /** User-facing name, matching the labels used in the exercise pickers. */
  label: string;
  /** Visible fields, already in `sessionFieldOrder`. */
  fields: SessionField[];
  /** Subset of `fields` a set must have before it counts as logged. */
  requiredFields: SessionField[];
  /** Subset of `fields` that may be left blank. */
  optionalFields: SessionField[];
  units: {
    duration: DurationDisplayUnit;
    /** Default unit when the user has not already picked one on the set. */
    distance: 'm' | 'km' | 'mi';
  };
  /**
   * Whether weight × reps volume is a meaningful metric. Bodyweight, timed
   * and distance work all have null weight, so summing them silently
   * produces 0 and drags averages down.
   */
  countsTowardVolume: boolean;
  summaryMetric: SummaryMetric;
}

function define(
  kind: PrescriptionKind,
  label: string,
  required: SessionField[],
  optional: SessionField[],
  extras: Partial<Pick<PrescriptionDefinition, 'units' | 'countsTowardVolume' | 'summaryMetric'>> = {},
): PrescriptionDefinition {
  const fields = sessionFieldOrder.filter((field) => required.includes(field) || optional.includes(field));
  return {
    kind,
    label,
    fields,
    requiredFields: sessionFieldOrder.filter((field) => required.includes(field)),
    optionalFields: sessionFieldOrder.filter((field) => optional.includes(field)),
    units: { duration: 'seconds', distance: 'mi', ...extras.units },
    countsTowardVolume: extras.countsTowardVolume ?? false,
    summaryMetric: extras.summaryMetric ?? 'volume',
  };
}

/**
 * The single source of truth for prescription → session-field mapping.
 *
 * Guided setup, the full program editor, the workout preview, the active
 * session logger, the completed review, history and progress all read from
 * here so the six user-selectable types cannot drift apart across web and
 * mobile. See `Backlog/completed/09-prescription-aware-session-fields.md`.
 */
export const prescriptionDefinitions: Record<PrescriptionKind, PrescriptionDefinition> = {
  sets_reps: define('sets_reps', 'Sets + reps', ['weight', 'reps'], ['setType', 'rpe'], {
    countsTowardVolume: true,
    summaryMetric: 'volume',
  }),
  // Top-set/backoff and per-side are still strength work; they differ in how
  // the *plan* is expressed, not in what the user types per set.
  top_set_backoff: define('top_set_backoff', 'Top set + backoff', ['weight', 'reps'], ['setType', 'rpe'], {
    countsTowardVolume: true,
    summaryMetric: 'volume',
  }),
  per_side: define('per_side', 'Per side', ['weight', 'reps'], ['setType', 'rpe'], {
    countsTowardVolume: true,
    summaryMetric: 'volume',
  }),
  // Weight is deliberately absent: weighted planks/carries are not part of
  // the product model today. Adding it here is the only change required if
  // that ever becomes intentional.
  timed: define('timed', 'Timed sets', ['duration'], ['setType', 'rpe'], {
    summaryMetric: 'duration',
  }),
  distance: define('distance', 'Distance', ['distance'], ['setType', 'rpe'], {
    summaryMetric: 'distance',
  }),
  // A single continuous effort rather than sets, so no set type.
  duration: define('duration', 'Duration', ['duration'], ['rpe'], {
    units: { duration: 'minutes', distance: 'mi' },
    summaryMetric: 'duration',
  }),
  distanceDuration: define('distanceDuration', 'Distance + duration', ['distance', 'duration'], ['rpe'], {
    units: { duration: 'minutes', distance: 'mi' },
    summaryMetric: 'distance',
  }),
  bodyweight_reps: define('bodyweight_reps', 'Bodyweight reps', ['reps'], ['setType', 'rpe'], {
    summaryMetric: 'reps',
  }),
};

/**
 * Fallback for exercises with no prescription attached — ad-hoc exercises
 * added mid-session, and older rows created before prescriptions existed.
 * Deliberately permissive so nothing a user already logged becomes
 * invisible; a real prescription always narrows this.
 */
export const unprescribedDefinition: PrescriptionDefinition = define(
  'sets_reps',
  'Unplanned',
  [],
  ['setType', 'weight', 'reps', 'duration', 'distance', 'rpe'],
  { countsTowardVolume: true, summaryMetric: 'volume' },
);

/**
 * The prescription kinds a user can pick in the exercise pickers and
 * editors. `top_set_backoff` and `per_side` are authored elsewhere in the
 * advanced editor rather than offered in the simple pickers.
 */
export const selectablePrescriptionKinds: readonly PrescriptionKind[] = [
  'sets_reps',
  'timed',
  'duration',
  'distanceDuration',
  'distance',
  'bodyweight_reps',
] as const;

/** Dropdown options derived from the definitions, so labels cannot drift. */
export const prescriptionOptions: { value: PrescriptionKind; label: string }[] = selectablePrescriptionKinds.map(
  (kind) => ({ value: kind, label: prescriptionDefinitions[kind].label }),
);

export function getPrescriptionDefinition(
  prescription: Prescription | PrescriptionKind | null | undefined,
): PrescriptionDefinition {
  if (prescription == null) return unprescribedDefinition;
  const kind = typeof prescription === 'string' ? prescription : prescription.kind;
  return prescriptionDefinitions[kind] ?? unprescribedDefinition;
}

/** The subset of a logged set this module needs to reason about. */
export interface SessionSetValues {
  setType?: string | null;
  weightValue?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  distanceValue?: number | null;
  rpe?: number | null;
}

const fieldReaders: Record<SessionField, (set: SessionSetValues) => unknown> = {
  setType: (set) => set.setType,
  weight: (set) => set.weightValue,
  reps: (set) => set.reps,
  duration: (set) => set.durationSeconds,
  distance: (set) => set.distanceValue,
  rpe: (set) => set.rpe,
};

/** Whether a set already carries a value for a field. */
export function hasFieldValue(set: SessionSetValues, field: SessionField): boolean {
  // `setType` always has a value (it defaults to 'working' server-side), so
  // treating it as "populated" would defeat the legacy-data union below.
  if (field === 'setType') return false;
  return fieldReaders[field](set) != null;
}

/**
 * Fields to render for a set: everything the prescription calls for, plus
 * anything the set *already* has stored.
 *
 * The union is what makes this change non-destructive. A cycling exercise
 * that was logged before this story may carry stale weight/reps; hiding
 * those inputs outright would strand the values where the user can neither
 * see nor clear them, and the first save would look like silent data loss.
 * They stay visible until the user clears them, then disappear naturally.
 */
export function resolveSessionFields(
  prescription: Prescription | PrescriptionKind | null | undefined,
  set: SessionSetValues = {},
): SessionField[] {
  const definition = getPrescriptionDefinition(prescription);
  return sessionFieldOrder.filter(
    (field) => definition.fields.includes(field) || hasFieldValue(set, field),
  );
}

/** True when a set has enough data to count as actually performed. */
export function isSessionSetLogged(
  prescription: Prescription | PrescriptionKind | null | undefined,
  set: SessionSetValues,
): boolean {
  const definition = getPrescriptionDefinition(prescription);
  if (!definition.requiredFields.length) {
    // Unprescribed: any performance value at all counts.
    return sessionFieldOrder.some((field) => hasFieldValue(set, field));
  }
  return definition.requiredFields.every((field) => hasFieldValue(set, field));
}

/**
 * Story 38 — exercise-level completion is a derived domain state, not a UI
 * boolean toggled on accordion close: an exercise is complete once every
 * one of its sets is complete (per `isSessionSetLogged`, so only required
 * fields count and optional ones like RPE never block it), and it has at
 * least one set at all — an exercise with none logged is incomplete, not
 * vacuously complete. Always computed from the sets actually persisted on
 * the server, never a local unsaved draft, so a prefilled-but-unsaved
 * value can't count: removing a set, or the completing/un-completing edit
 * to any one set, naturally recomputes this on the next render with no
 * cached state of its own to invalidate.
 */
export function isExerciseComplete(
  prescription: Prescription | PrescriptionKind | null | undefined,
  sets: readonly SessionSetValues[],
): boolean {
  return sets.length > 0 && sets.every((set) => isSessionSetLogged(prescription, set));
}

export type SessionFieldErrors = Partial<Record<SessionField, string>>;

const fieldLabels: Record<SessionField, string> = {
  setType: 'Set type',
  weight: 'Weight',
  reps: 'Reps',
  duration: 'Duration',
  distance: 'Distance',
  rpe: 'RPE',
};

export function getSessionFieldLabel(field: SessionField, definition: PrescriptionDefinition): string {
  if (field === 'duration') {
    return definition.units.duration === 'minutes' ? 'Duration (min)' : 'Duration (sec)';
  }
  return fieldLabels[field];
}

/**
 * Validates a draft set against its prescription. Only visible fields are
 * checked, so hiding a field can never produce an error the user cannot see
 * or fix — which is the failure mode that makes conditional forms unusable.
 */
export function validateSessionSet(
  prescription: Prescription | PrescriptionKind | null | undefined,
  set: SessionSetValues,
  options: { requireComplete?: boolean } = {},
): SessionFieldErrors {
  const definition = getPrescriptionDefinition(prescription);
  const visible = resolveSessionFields(prescription, set);
  const errors: SessionFieldErrors = {};

  for (const field of visible) {
    const raw = fieldReaders[field](set);
    if (raw == null) {
      if (options.requireComplete && definition.requiredFields.includes(field)) {
        errors[field] = `${fieldLabels[field]} is required for ${definition.label.toLowerCase()}.`;
      }
      continue;
    }
    if (field === 'setType') continue;

    const value = raw as number;
    if (!Number.isFinite(value)) {
      errors[field] = `${fieldLabels[field]} must be a number.`;
    } else if (value < 0) {
      errors[field] = `${fieldLabels[field]} cannot be negative.`;
    } else if (field === 'rpe' && value > 10) {
      errors.rpe = 'RPE must be between 0 and 10.';
    } else if (field === 'reps' && !Number.isInteger(value)) {
      errors.reps = 'Reps must be a whole number.';
    }
  }

  return errors;
}

/**
 * Sets that should contribute to a weight × reps volume total. Timed,
 * distance and bodyweight work carries no weight, so including it adds
 * nothing but does let a bad prescription quietly zero out a total.
 */
export function countsTowardVolume(
  prescription: Prescription | PrescriptionKind | null | undefined,
): boolean {
  return getPrescriptionDefinition(prescription).countsTowardVolume;
}

/**
 * An exercise removed from a session ("Remove from today's workout") is
 * soft-deleted via `skipped` — its log and any logged sets stay in the
 * database, but it must not appear in the active list, a completed
 * session's review, or any total/count derived from either. Every screen
 * that renders or sums a session's exercises should filter through this
 * once, rather than re-writing the same `!skipped` predicate.
 */
export function visibleSessionExercises<T extends { skipped: boolean }>(exercises: readonly T[]): T[] {
  return exercises.filter((exerciseLog) => !exerciseLog.skipped);
}

/**
 * Story 37 — the quick-entry header's own field set: one common value
 * typed once and applied to every set. `setType` is a structural per-set
 * choice, not a "common value" the same way weight/reps/duration/distance/
 * rpe are, so it's excluded from what the header shows and applies.
 */
/**
 * Duration, converted between what the user types and what is stored.
 *
 * `durationSeconds` is always the stored unit, but a `duration` or
 * `distanceDuration` prescription declares `units.duration = 'minutes'`,
 * because nobody logs a 45-minute walk by typing 2700.
 *
 * The v2 logger read and wrote the column raw, ignoring the declared unit —
 * so a walk entered as 45 would have been stored as 45 SECONDS. v1 had these
 * two helpers and v2 dropped them; they live here now so neither platform can
 * lose them again.
 */
export function durationToDisplay(
  seconds: number | null | undefined,
  definition: PrescriptionDefinition,
): string {
  if (seconds == null) return '';
  if (definition.units.duration !== 'minutes') return `${seconds}`;
  const minutes = seconds / 60;
  return `${Number.isInteger(minutes) ? minutes : Number(minutes.toFixed(2))}`;
}

/** The inverse: what the user typed, in the column's unit. */
export function displayToDurationSeconds(
  value: number | null | undefined,
  definition: PrescriptionDefinition,
): number | null {
  if (value == null) return null;
  return definition.units.duration === 'minutes' ? Math.round(value * 60) : value;
}

/**
 * The API field name for a UI field.
 *
 * Three of the five differ, and the logger only ever mapped `weight`. A
 * duration exercise therefore sent `{ duration: 45 }` instead of
 * `{ durationSeconds: 45 }` — and because the request schema strips unknown
 * keys rather than rejecting them, the PATCH arrived EMPTY, every column kept
 * its existing value, and the API returned 200 having written nothing.
 * Silent data loss: a logged walk that simply vanished.
 *
 * It lives here so web and mobile read one table. Both had their own copy of
 * the same wrong ternary.
 */
export const SESSION_FIELD_WIRE_NAMES: Record<Exclude<SessionField, 'setType'>, string> = {
  weight: 'weightValue',
  reps: 'reps',
  duration: 'durationSeconds',
  distance: 'distanceValue',
  rpe: 'rpe',
};

/** The API field name for a UI field. */
export function wireNameFor(field: Exclude<SessionField, 'setType'>): string {
  return SESSION_FIELD_WIRE_NAMES[field];
}

export function quickEntryFields(definition: PrescriptionDefinition): Exclude<SessionField, 'setType'>[] {
  return definition.fields.filter((field): field is Exclude<SessionField, 'setType'> => field !== 'setType');
}
