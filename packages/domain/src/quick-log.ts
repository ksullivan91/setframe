/**
 * Quick Log — the exercise-level fast path for logging a whole exercise.
 *
 * Stories 58 and 59. The previous exercise header exposed every field the set
 * model supports, including RPE, and its action only *populated* the set
 * inputs: the user still had to expand the exercise and save each set. So the
 * "fast path" cost more taps than typing into the sets directly, and the
 * header read as a second copy of the set editor rather than a shortcut.
 *
 * The rule this module encodes: **exercise level carries what is uniform
 * across the sets, set level carries the exceptions.** Everything below
 * follows from that, and each decision is derived rather than listed again,
 * so a new prescription kind cannot silently acquire the wrong quick path.
 */

import {
  getPrescriptionDefinition,
  isSessionSetLogged,
  type PrescriptionKind,
  type SessionField,
  type SessionSetValues,
} from './prescription-fields';
import type { Prescription } from '@setframe/schemas';

/** A field Quick Log can carry. `setType` is per-set and never bulk-set. */
export type QuickLogField = Exclude<SessionField, 'setType'>;

/**
 * The fields Quick Log offers for a prescription.
 *
 * Derived from `requiredFields`, not from a separate list. That is what keeps
 * RPE out: RPE is in every definition's `optionalFields`, so it is excluded by
 * construction rather than by remembering to filter it — and it is exactly
 * the field the pack calls out as commonly set-specific.
 *
 * The same derivation makes the path representation-aware for free: weighted
 * sets+reps yields weight and reps, bodyweight yields reps alone, distance
 * yields distance. A bodyweight movement never shows a weight box it would
 * have to fill with a meaningless `0 lb`.
 */
export function quickLogFields(
  prescription: Prescription | PrescriptionKind | null | undefined,
): QuickLogField[] {
  const definition = getPrescriptionDefinition(prescription);
  return definition.requiredFields.filter(
    (field): field is QuickLogField => field !== 'setType',
  );
}

/**
 * Whether Quick Log is meaningful for this prescription at all.
 *
 * `top_set_backoff` is excluded, and this is the one place the derivation
 * needs a judgement rather than a rule. Its sets are non-uniform *by design* —
 * session start creates `top` sets and `backoff` sets with different planned
 * reps, because the whole point is a heavy top set followed by lighter work.
 * One weight applied across them would be wrong for at least one group, so
 * the honest answer is to send the user straight to the detailed sets rather
 * than offer a shortcut that quietly produces bad data.
 *
 * A per-set-type quick path (one row for top, one for backoff) is a
 * reasonable future addition; it is a different design, not a tweak to this
 * one.
 */
export function supportsQuickLog(
  prescription: Prescription | PrescriptionKind | null | undefined,
): boolean {
  const definition = getPrescriptionDefinition(prescription);
  if (definition.kind === 'top_set_backoff') return false;
  return quickLogFields(prescription).length > 0;
}

/** A set as Quick Log needs to see it: enough to decide whether to write it. */
export interface QuickLogSet extends SessionSetValues {
  id: string;
}

/**
 * The sets a Quick Log action would actually write.
 *
 * Two exclusions, both load-bearing:
 *
 * - **Already-logged sets are never touched.** This is how "do not silently
 *   overwrite a manual edit" is satisfied structurally rather than by
 *   tracking a dirty flag that can drift. A user who logs three sets, opens
 *   set 3 and corrects it to 6 reps, then taps Quick Log again does not lose
 *   that correction — there is nothing left for Quick Log to write.
 * - **Warmups are never touched.** A warmup set at the working weight is
 *   simply wrong, and session start never creates warmups: they exist only
 *   because the user added one deliberately.
 *
 * Because session start pre-creates one row per planned set, this is a list
 * of *existing* sets to update, never rows to create. Re-running the same
 * action therefore converges rather than duplicating, which is what makes a
 * double tap in a gym harmless.
 */
export function quickLogTargets(
  prescription: Prescription | PrescriptionKind | null | undefined,
  sets: readonly QuickLogSet[],
): QuickLogSet[] {
  return sets.filter(
    (set) => set.setType !== 'warmup' && !isSessionSetLogged(prescription, set),
  );
}

export interface QuickLogValues {
  weightValue?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  distanceValue?: number | null;
  distanceUnit?: 'm' | 'km' | 'mi' | null;
}

/**
 * Whether the entered values are enough to log with.
 *
 * Every field Quick Log offers is required by definition, so all of them must
 * be present — a half-filled quick path would write sets that still do not
 * count as logged, which looks like the action silently failed.
 */
export function isQuickLogComplete(
  prescription: Prescription | PrescriptionKind | null | undefined,
  values: QuickLogValues,
): boolean {
  const fields = quickLogFields(prescription);
  if (!fields.length) return false;
  return fields.every((field) => {
    switch (field) {
      case 'weight':
        return values.weightValue != null;
      case 'reps':
        return values.reps != null;
      case 'duration':
        return values.durationSeconds != null;
      case 'distance':
        return values.distanceValue != null;
      case 'rpe':
        /* Unreachable today — RPE sits in every definition's optionalFields,
           which is precisely why it never reaches Quick Log. Were a future
           definition to make it required, treating it as satisfied here would
           be the wrong answer, so it reports unsatisfied and the action stays
           disabled rather than writing sets that do not count as logged. */
        return false;
      default:
        return false;
    }
  });
}

/**
 * The label for the Quick Log action.
 *
 * It names what will actually happen, which is why the count comes from
 * `quickLogTargets` rather than the planned set count: with one set already
 * logged, "Log all 3 sets" would be a lie about both the number and the
 * effect. Copy that says `Apply` when the action persists is the specific
 * mismatch the pack calls out.
 */
export function describeQuickLogAction(targetCount: number, totalCount: number): string {
  if (targetCount <= 0) return 'All sets logged';
  if (targetCount === totalCount) {
    return targetCount === 1 ? 'Log 1 set' : `Log all ${targetCount} sets`;
  }
  return targetCount === 1 ? 'Log remaining set' : `Log remaining ${targetCount} sets`;
}

/**
 * The values a quick-log draft starts from, taken from the plan.
 *
 * Story 42.3, and the other half of 42.1. Session sets no longer carry planned
 * values — copying intent onto them is what let a plan count as performance —
 * so the draft has to seed from the prescription instead. That is the
 * distinction the architecture insists on:
 *
 *     planned  →  may seed a draft  →  never proof of performed work
 *
 * Seeding is a convenience, not a claim. Nothing here is persisted, and
 * `isSessionSetLogged` still reads only what the server holds, so a seeded
 * field cannot make an exercise look complete.
 *
 * Weight is deliberately absent. The model has no planned weight — a
 * prescription says "3 × 8", not "3 × 8 at 135 lb" — and inventing one would
 * put a number in front of the user that nothing in their plan justifies.
 * It is also the single field most likely to differ from last time, which is
 * the whole reason the user is here.
 */
export function plannedQuickLogSeed(
  prescription: Prescription | PrescriptionKind | null | undefined,
): QuickLogValues {
  const seed: QuickLogValues = {};
  if (prescription == null || typeof prescription === 'string') return seed;

  switch (prescription.kind) {
    case 'sets_reps':
    case 'per_side':
    case 'bodyweight_reps':
      if (prescription.repsMin != null) seed.reps = prescription.repsMin;
      return seed;
    case 'top_set_backoff':
      // No single seed is honest here: top and backoff sets plan different
      // reps, so one value would be wrong for at least one group. This is the
      // same reason `supportsQuickLog` excludes the kind outright.
      return seed;
    case 'timed':
      if (prescription.durationSeconds != null) seed.durationSeconds = prescription.durationSeconds;
      return seed;
    case 'distance':
      if (prescription.distanceValue != null) {
        seed.distanceValue = prescription.distanceValue;
        seed.distanceUnit = prescription.distanceUnit ?? null;
      }
      return seed;
    case 'duration':
      if (prescription.durationMinutes != null) seed.durationSeconds = prescription.durationMinutes * 60;
      return seed;
    case 'distanceDuration':
      if (prescription.distanceMiles != null) {
        seed.distanceValue = prescription.distanceMiles;
        seed.distanceUnit = 'mi';
      }
      if (prescription.durationMinutes != null) seed.durationSeconds = prescription.durationMinutes * 60;
      return seed;
  }
}
