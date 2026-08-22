/**
 * Prescription helpers now live in `@setframe/domain` so web and mobile
 * cannot drift apart (see Story 09). Re-exported here to keep the existing
 * import path stable for callers.
 */
export {
  summarizePrescription,
  formatSessionSet,
  getPrescriptionDefinition,
  resolveSessionFields,
  validateSessionSet,
  isSessionSetLogged,
  countsTowardVolume,
  getSessionFieldLabel,
  sessionFieldOrder,
  prescriptionDefinitions,
  prescriptionOptions,
  selectablePrescriptionKinds,
} from '@setframe/domain';
export type { PrescriptionDefinition, PrescriptionKind, SessionField, SessionFieldErrors } from '@setframe/domain';
