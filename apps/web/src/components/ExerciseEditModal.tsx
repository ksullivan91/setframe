import { useEffect, useState, type ReactNode } from 'react';
import styled from 'styled-components';
import { spacing, radius } from '@setframe/design-tokens';
import type { Prescription } from '@setframe/schemas';
import { parseOptionalNumber, formatOptionalNumber as numberFieldValue } from '@setframe/domain';
import { Button, Input, Modal as SharedModal, Select } from './index';
import { prescriptionOptions } from '../lib/prescription';
import { typeScale, mobileSafeInputFontSize } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';

export interface EditState {
  dayTypeId: string;
  exerciseId: string;
  exerciseName: string;
  prescription: Prescription;
  notes: string;
}

const Row = styled.div`
  display: flex;
  gap: ${spacing[8]}px;
  align-items: center;
  flex-wrap: wrap;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: ${spacing[12]}px;
  border-radius: ${radius.small}px;
  border: 1px solid ${(p) => p.theme.border.default};
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.primary};
  resize: vertical;
  /* Story 28 — this textarea had no font-size at all (browser default,
     well under 16px) and so triggered iOS Safari's focus zoom. */
  font-size: ${mobileSafeInputFontSize}px;

  ${mq.tablet} {
    font-size: ${typeScale.body.fontSize}px;
  }
`;

const PrescriptionGrid = styled.div`
  display: grid;
  gap: ${spacing[8]}px;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
`;



/**
 * Edit an already-added workout exercise's prescription. Shared by the
 * full program editor and Guided Setup (Story 03) so a setup mistake can
 * be corrected without finishing the program first.
 */
export function ExerciseEditModal({
  state,
  onClose,
  onSave,
  onDelete,
  deleteLabel = 'Delete',
  advancedSlot,
}: {
  state: EditState;
  onClose: () => void;
  onSave: (next: EditState) => void;
  onDelete: () => void;
  /** Guided Setup says "Remove" — removal there only detaches the exercise from the workout. */
  deleteLabel?: string;
  /**
   * Advanced per-set planning. Omitted in Guided Setup, which stays a
   * simple correction surface rather than the full workout editor.
   */
  advancedSlot?: ReactNode;
}) {
  const [draft, setDraft] = useState<EditState>(state);

  useEffect(() => setDraft(state), [state]);

  return (
    <SharedModal open onClose={onClose} title="Edit exercise" description={draft.exerciseName} maxWidth={560}>
      <Select label="Prescription type" value={draft.prescription.kind} options={prescriptionOptions} disabled onChange={() => undefined} />

        {(draft.prescription.kind === 'sets_reps' ||
          draft.prescription.kind === 'per_side' ||
          draft.prescription.kind === 'bodyweight_reps') && (
          <PrescriptionGrid>
            <Input
              label="Sets"
              placeholder="No target"
              value={numberFieldValue(draft.prescription.sets)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, sets: parseOptionalNumber(e.target.value) } as Prescription,
                }))
              }
              inputMode="numeric"
            />
            <Input
              label="Reps"
              placeholder="No target"
              value={numberFieldValue(draft.prescription.repsMin)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, repsMin: parseOptionalNumber(e.target.value) } as Prescription,
                }))
              }
              inputMode="numeric"
            />
            <Input label="Weight" value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Optional weight cue" />
          </PrescriptionGrid>
        )}

        {draft.prescription.kind === 'duration' && (
          <Input
            label="Minutes"
            placeholder="No target"
            value={numberFieldValue(draft.prescription.durationMinutes)}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                prescription: { ...prev.prescription, durationMinutes: parseOptionalNumber(e.target.value) } as Prescription,
              }))
            }
            inputMode="numeric"
          />
        )}

        {draft.prescription.kind === 'distanceDuration' && (
          <PrescriptionGrid>
            <Input
              label="Distance"
              placeholder="No target"
              value={numberFieldValue(draft.prescription.distanceMiles)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, distanceMiles: parseOptionalNumber(e.target.value) } as Prescription,
                }))
              }
              inputMode="decimal"
            />
            <Input
              label="Duration"
              placeholder="No target"
              value={numberFieldValue(draft.prescription.durationMinutes)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, durationMinutes: parseOptionalNumber(e.target.value) } as Prescription,
                }))
              }
              inputMode="numeric"
            />
          </PrescriptionGrid>
        )}

        {draft.prescription.kind === 'timed' && (
          <PrescriptionGrid>
            <Input
              label="Sets"
              placeholder="No target"
              value={numberFieldValue(draft.prescription.sets)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, sets: parseOptionalNumber(e.target.value) } as Prescription,
                }))
              }
              inputMode="numeric"
            />
            <Input
              label="Seconds"
              placeholder="No target"
              value={numberFieldValue(draft.prescription.durationSeconds)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, durationSeconds: parseOptionalNumber(e.target.value) } as Prescription,
                }))
              }
              inputMode="numeric"
            />
          </PrescriptionGrid>
        )}

        {draft.prescription.kind === 'distance' && (
          <PrescriptionGrid>
            <Input
              label="Sets"
              placeholder="No target"
              value={numberFieldValue(draft.prescription.sets)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, sets: parseOptionalNumber(e.target.value) } as Prescription,
                }))
              }
              inputMode="numeric"
            />
            <Input
              label="Distance"
              placeholder="No target"
              value={numberFieldValue(draft.prescription.distanceValue)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, distanceValue: parseOptionalNumber(e.target.value) } as Prescription,
                }))
              }
              inputMode="decimal"
            />
          </PrescriptionGrid>
        )}

        <TextArea value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notes" />

        {advancedSlot}

        <Row style={{ justifyContent: 'space-between' }}>
          <Button variant="destructive" onClick={onDelete}>{deleteLabel}</Button>
          <Row>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave(draft)}>Save</Button>
          </Row>
        </Row>
    </SharedModal>
  );
}
