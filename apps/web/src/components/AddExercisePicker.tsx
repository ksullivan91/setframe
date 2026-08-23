import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Plus } from 'lucide-react';
import { spacing, radius } from '@setframe/design-tokens';
import { prescriptionSchema, type Exercise, type Prescription } from '@setframe/schemas';
import { Button, Input, Modal as SharedModal, Select } from './index';
import { typeScale } from '../theme/typeScale';
import { prescriptionOptions } from '../lib/prescription';

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
`;

const Row = styled.div`
  display: flex;
  gap: ${spacing[8]}px;
  align-items: center;
  flex-wrap: wrap;
`;

const Small = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;

const LibraryItem = styled.button<{ $active: boolean }>`
  text-align: left;
  padding: ${spacing[12]}px;
  border-radius: ${radius.small}px;
  border: 1px solid ${(p) => (p.$active ? p.theme.action.primary : p.theme.border.subtle)};
  background: ${(p) => (p.$active ? p.theme.action.accentSubtle : p.theme.surface.raised)};
  cursor: pointer;
`;

const PrescriptionGrid = styled.div`
  display: grid;
  gap: ${spacing[8]}px;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
`;



export function emptyPrescription(kind: string): Prescription {
  switch (kind) {
    case 'timed':
      return { kind: 'timed', sets: 3, durationSeconds: 60 };
    case 'duration':
      return { kind: 'duration', durationMinutes: 30 };
    case 'distanceDuration':
      return { kind: 'distanceDuration', distanceMiles: 5, durationMinutes: 30 };
    case 'distance':
      return { kind: 'distance', sets: 1, distanceValue: 5, distanceUnit: 'mi' };
    case 'bodyweight_reps':
      return { kind: 'bodyweight_reps', sets: 3, repsMin: 8 };
    default:
      return { kind: 'sets_reps', sets: 3, repsMin: 8 };
  }
}

/**
 * Add-exercise flow (user-experience-iteration.md #13-16). Replaces the
 * old always-visible Exercise/Prescription-type/Create-exercise/Add
 * cluster with progressive disclosure: search-and-pick an existing
 * exercise first; custom creation and prescription configuration are
 * separate steps reached only when needed.
 */
export function AddExercisePicker({
  exercises,
  exercisesLoading,
  exercisesError,
  onRetryExercises,
  onClose,
  onCreateExercise,
  isCreatingExercise,
  onAddExercise,
  isAddingExercise,
}: {
  exercises: Exercise[];
  exercisesLoading: boolean;
  exercisesError: boolean;
  onRetryExercises: () => void;
  onClose: () => void;
  onCreateExercise: (name: string) => Promise<Exercise>;
  isCreatingExercise: boolean;
  onAddExercise: (exerciseId: string, prescription: Prescription) => void | Promise<unknown>;
  isAddingExercise: boolean;
}) {
  const [step, setStep] = useState<'search' | 'create' | 'configure'>('search');
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [prescriptionKind, setPrescriptionKind] = useState('sets_reps');
  const [prescription, setPrescription] = useState<Prescription>(emptyPrescription('sets_reps'));
  const [addError, setAddError] = useState<string | null>(null);

  /* Every prescription field is `.positive()` in the schema, but clearing an
     input yields `Number('') === 0`. Validate against the schema itself so
     the button state can never drift from what the API will accept. */
  const prescriptionValid = prescriptionSchema.safeParse(prescription).success;

  const filtered = useMemo(
    () => exercises.filter((exercise) => exercise.name.toLowerCase().includes(query.trim().toLowerCase())),
    [exercises, query],
  );

  const chooseExercise = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setPrescriptionKind('sets_reps');
    setPrescription(emptyPrescription('sets_reps'));
    setAddError(null);
    setStep('configure');
  };

  const handlePrescriptionKindChange = (kind: string) => {
    setPrescriptionKind(kind);
    setPrescription(emptyPrescription(kind));
    setAddError(null);
  };

  if (step === 'create') {
    return (
      <SharedModal open onClose={onClose} title="Create custom exercise" maxWidth={420}>
        <Column>
          <Input
            label="Exercise name"
            placeholder="e.g. Outdoor Cycle"
            value={customName}
            onChange={(e) => {
              setCustomName(e.target.value);
              setCreateError(null);
            }}
            autoFocus
          />
          {createError ? <Small role="alert">{createError}</Small> : null}
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setStep('search')}>Cancel</Button>
            <Button
              disabled={!customName.trim() || isCreatingExercise}
              onClick={async () => {
                try {
                  setCreateError(null);
                  const created = await onCreateExercise(customName.trim());
                  setCustomName('');
                  chooseExercise(created);
                } catch {
                  // Keep the typed name so the user can retry without
                  // re-entering it (Story 01 acceptance criteria).
                  setCreateError("Couldn't create that exercise. Try again.");
                }
              }}
            >
              Create &amp; add
            </Button>
          </Row>
        </Column>
      </SharedModal>
    );
  }

  if (step === 'configure' && selectedExercise) {
    return (
      <SharedModal open onClose={onClose} title={selectedExercise.name} maxWidth={480}>
        <Column>
          <Select label="Prescription" value={prescriptionKind} onChange={(e) => handlePrescriptionKindChange(e.target.value)} options={prescriptionOptions} />

          {(prescription.kind === 'sets_reps' || prescription.kind === 'per_side' || prescription.kind === 'bodyweight_reps') && (
            <PrescriptionGrid>
              <Input
                label="Sets"
                inputMode="numeric"
                value={String(prescription.sets)}
                onChange={(e) => setPrescription((prev) => ({ ...prev, sets: Number(e.target.value) || 0 } as Prescription))}
              />
              <Input
                label="Reps"
                inputMode="numeric"
                value={String(prescription.repsMin)}
                onChange={(e) => setPrescription((prev) => ({ ...prev, repsMin: Number(e.target.value) || 0 } as Prescription))}
              />
            </PrescriptionGrid>
          )}

          {prescription.kind === 'timed' && (
            <PrescriptionGrid>
              <Input
                label="Sets"
                inputMode="numeric"
                value={String(prescription.sets)}
                onChange={(e) => setPrescription((prev) => ({ ...prev, sets: Number(e.target.value) || 0 } as Prescription))}
              />
              <Input
                label="Seconds"
                inputMode="numeric"
                value={String(prescription.durationSeconds)}
                onChange={(e) => setPrescription((prev) => ({ ...prev, durationSeconds: Number(e.target.value) || 0 } as Prescription))}
              />
            </PrescriptionGrid>
          )}

          {prescription.kind === 'duration' && (
            <Input
              label="Minutes"
              inputMode="numeric"
              value={String(prescription.durationMinutes)}
              onChange={(e) => setPrescription((prev) => ({ ...prev, durationMinutes: Number(e.target.value) || 0 } as Prescription))}
            />
          )}

          {prescription.kind === 'distanceDuration' && (
            <PrescriptionGrid>
              <Input
                label="Distance (mi)"
                inputMode="decimal"
                value={String(prescription.distanceMiles)}
                onChange={(e) => setPrescription((prev) => ({ ...prev, distanceMiles: Number(e.target.value) || 0 } as Prescription))}
              />
              <Input
                label="Minutes"
                inputMode="numeric"
                value={String(prescription.durationMinutes)}
                onChange={(e) => setPrescription((prev) => ({ ...prev, durationMinutes: Number(e.target.value) || 0 } as Prescription))}
              />
            </PrescriptionGrid>
          )}

          {prescription.kind === 'distance' && (
            <PrescriptionGrid>
              <Input
                label="Sets"
                inputMode="numeric"
                value={String(prescription.sets)}
                onChange={(e) => setPrescription((prev) => ({ ...prev, sets: Number(e.target.value) || 0 } as Prescription))}
              />
              <Input
                label="Distance"
                inputMode="decimal"
                value={String(prescription.distanceValue)}
                onChange={(e) => setPrescription((prev) => ({ ...prev, distanceValue: Number(e.target.value) || 0 } as Prescription))}
              />
            </PrescriptionGrid>
          )}

          {!prescriptionValid ? (
            <Small role="alert">Every value must be greater than zero.</Small>
          ) : null}
          {addError ? <Small role="alert">{addError}</Small> : null}
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setStep('search')}>Back</Button>
            <Button
              disabled={isAddingExercise || !prescriptionValid}
              onClick={async () => {
                // Close only once the add has landed, so a rejected request
                // can never look like a success.
                try {
                  setAddError(null);
                  await onAddExercise(selectedExercise.id, prescription);
                  onClose();
                } catch {
                  setAddError("Couldn't add that exercise. Try again.");
                }
              }}
            >
              Add to workout
            </Button>
          </Row>
        </Column>
      </SharedModal>
    );
  }

  return (
    <SharedModal open onClose={onClose} title="Add exercise" maxWidth={480}>
      <Column>
        <Input label="Search exercises" placeholder="Barbell Back Squat…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus disabled={exercisesLoading} />
        <Column style={{ maxHeight: 320, overflowY: 'auto', gap: spacing[4] }}>
          {exercisesLoading ? (
            <Small>Loading exercise catalog…</Small>
          ) : exercisesError ? (
            <Row style={{ alignItems: 'center', gap: spacing[8] }}>
              <Small>Couldn&apos;t load exercises.</Small>
              <Button variant="tertiary" onClick={onRetryExercises}>Retry</Button>
            </Row>
          ) : filtered.length === 0 ? (
            <Small>{exercises.length === 0 ? 'No exercises available yet.' : `No exercises match “${query}”.`}</Small>
          ) : (
            filtered.map((exercise) => (
              <LibraryItem key={exercise.id} $active={false} onClick={() => chooseExercise(exercise)}>
                <strong>{exercise.isCustom ? `${exercise.name} (custom)` : exercise.name}</strong>
              </LibraryItem>
            ))
          )}
        </Column>
        <Row style={{ justifyContent: 'space-between' }}>
          <Small>Can&apos;t find it?</Small>
          <Button
            variant="tertiary"
            onClick={() => {
              setCustomName(query.trim());
              setCreateError(null);
              setStep('create');
            }}
            disabled={exercisesLoading}
          >
            <Plus size={16} />Create custom exercise
          </Button>
        </Row>
      </Column>
    </SharedModal>
  );
}
