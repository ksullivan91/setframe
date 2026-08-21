import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { spacing, radius } from '@setline/design-tokens';
import type {
  DayType,
  DayTypeExercise,
  Exercise,
  Prescription,
  ProgramScheduleSlot,
  ScheduleOverride,
  TrainingProgram,
} from '@setline/schemas';
import { Button, Card, IconButton, Input, Select, useToast } from '../components';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { useApiClient } from '../lib/api-client';

interface DayTypeDetail extends DayType {
  exercises: DayTypeExercise[];
}

interface ScheduleResponse {
  date: string;
  override: ScheduleOverride | null;
  scheduledDayType: DayType | null;
  source: 'override' | 'program' | 'none';
}

interface EditState {
  exerciseId: string;
  exerciseName: string;
  prescription: Prescription;
  notes: string;
}

const Layout = styled.div`
  display: grid;
  gap: ${spacing[24]}px;
  grid-template-columns: 1fr;

  ${mq.desktop} {
    grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.3fr) minmax(320px, 0.9fr);
    align-items: start;
  }
`;

const SectionTitle = styled.h1`
  margin: 0;
  font-size: ${typeScale.pageTitle.fontSize}px;
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
`;

const LibraryCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
`;

const StackCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
`;

const LibraryItem = styled.button<{ $active: boolean }>`
  text-align: left;
  padding: ${spacing[12]}px;
  border-radius: ${radius.small}px;
  border: 1px solid ${(p) => (p.$active ? p.theme.action.primary : p.theme.border.subtle)};
  background: ${(p) => (p.$active ? p.theme.action.accentSubtle : p.theme.surface.raised)};
  cursor: pointer;
`;

const Small = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;

const Row = styled.div`
  display: flex;
  gap: ${spacing[8]}px;
  align-items: center;
  flex-wrap: wrap;
`;

const ExerciseRow = styled.div`
  display: flex;
  gap: ${spacing[8]}px;
  align-items: flex-start;
  padding: ${spacing[12]}px 0;
  border-top: 1px solid ${(p) => p.theme.border.subtle};
`;

const PrescriptionGrid = styled.div`
  display: grid;
  gap: ${spacing[8]}px;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
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
`;

const DayGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: ${spacing[8]}px;

  ${mq.tablet} {
    gap: ${spacing[4]}px;
  }
`;

const DayCell = styled.button<{ $active?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
  padding: ${spacing[8]}px ${spacing[4]}px;
  border-radius: ${radius.small}px;
  border: 1px solid ${(p) => (p.$active ? p.theme.action.primary : p.theme.border.subtle)};
  background: ${(p) => (p.$active ? p.theme.action.accentSubtle : p.theme.surface.sunken)};
  cursor: pointer;
  min-height: 64px;
  text-align: left;
  font-size: ${typeScale.caption.fontSize}px;
`;

const DayName = styled.span`
  font-weight: 600;
  font-size: ${typeScale.compactBody.fontSize}px;
`;

const DayLabel = styled.span`
  color: ${(p) => p.theme.text.secondary};
  overflow-wrap: break-word;
  line-height: 1.2;
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(21, 21, 34, 0.56);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${spacing[16]}px;
  z-index: 1000;
`;

const Modal = styled(Card)`
  width: min(560px, 100%);
  max-height: 90vh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
`;

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const modeOptions = [
  { value: 'perpetual', label: 'Perpetual' },
  { value: 'block', label: 'Block' },
];
const prescriptionOptions = [
  { value: 'sets_reps', label: 'Sets + reps' },
  { value: 'timed', label: 'Timed sets' },
  { value: 'duration', label: 'Duration' },
  { value: 'distanceDuration', label: 'Distance + duration' },
  { value: 'distance', label: 'Distance' },
  { value: 'bodyweight_reps', label: 'Bodyweight reps' },
];

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

function summarizePrescription(p: Prescription) {
  switch (p.kind) {
    case 'sets_reps':
    case 'per_side':
    case 'bodyweight_reps':
      return `${p.sets} × ${p.repsMin}${p.repsMax ? `–${p.repsMax}` : ''}`;
    case 'top_set_backoff':
      return 'Top + backoff';
    case 'timed':
      return `${p.sets} × ${p.durationSeconds}s`;
    case 'distance':
      return `${p.sets} × ${p.distanceValue}${p.distanceUnit}`;
    case 'duration':
      return `${p.durationMinutes} min`;
    case 'distanceDuration':
      return `${p.distanceMiles} mi / ${p.durationMinutes} min`;
  }
}

function emptyPrescription(kind: string): Prescription {
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

function moveItem(items: string[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (!item) return items;
  next.splice(to, 0, item);
  return next;
}

function ExerciseEditModal({
  state,
  onClose,
  onSave,
  onDelete,
}: {
  state: EditState;
  onClose: () => void;
  onSave: (next: EditState) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<EditState>(state);

  useEffect(() => setDraft(state), [state]);

  return (
    <Backdrop>
      <Modal>
        <Row style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0' }}>Edit exercise</h2>
            <Small>{draft.exerciseName}</Small>
          </div>
          <IconButton aria-label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </Row>

        <Select label="Prescription type" value={draft.prescription.kind} options={prescriptionOptions} disabled onChange={() => undefined} />

        {(draft.prescription.kind === 'sets_reps' ||
          draft.prescription.kind === 'per_side' ||
          draft.prescription.kind === 'bodyweight_reps') && (
          <PrescriptionGrid>
            <Input
              label="Sets"
              value={String(draft.prescription.sets)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, sets: Number(e.target.value) || 0 } as Prescription,
                }))
              }
              inputMode="numeric"
            />
            <Input
              label="Reps"
              value={String(draft.prescription.repsMin)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, repsMin: Number(e.target.value) || 0 } as Prescription,
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
            value={String(draft.prescription.durationMinutes)}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                prescription: { ...prev.prescription, durationMinutes: Number(e.target.value) || 0 } as Prescription,
              }))
            }
            inputMode="numeric"
          />
        )}

        {draft.prescription.kind === 'distanceDuration' && (
          <PrescriptionGrid>
            <Input
              label="Distance"
              value={String(draft.prescription.distanceMiles)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, distanceMiles: Number(e.target.value) || 0 } as Prescription,
                }))
              }
              inputMode="decimal"
            />
            <Input
              label="Duration"
              value={String(draft.prescription.durationMinutes)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, durationMinutes: Number(e.target.value) || 0 } as Prescription,
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
              value={String(draft.prescription.sets)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, sets: Number(e.target.value) || 0 } as Prescription,
                }))
              }
              inputMode="numeric"
            />
            <Input
              label="Seconds"
              value={String(draft.prescription.durationSeconds)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, durationSeconds: Number(e.target.value) || 0 } as Prescription,
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
              value={String(draft.prescription.sets)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, sets: Number(e.target.value) || 0 } as Prescription,
                }))
              }
              inputMode="numeric"
            />
            <Input
              label="Distance"
              value={String(draft.prescription.distanceValue)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, distanceValue: Number(e.target.value) || 0 } as Prescription,
                }))
              }
              inputMode="decimal"
            />
          </PrescriptionGrid>
        )}

        <TextArea value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notes" />

        <Row style={{ justifyContent: 'space-between' }}>
          <Button variant="destructive" onClick={onDelete}>Delete</Button>
          <Row>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave(draft)}>Save</Button>
          </Row>
        </Row>
      </Modal>
    </Backdrop>
  );
}

export function ProgramEditorPage() {
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedDayTypeId, setSelectedDayTypeId] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [mode, setMode] = useState<'perpetual' | 'block'>('perpetual');
  const [overrideDate, setOverrideDate] = useState(currentDate());
  const [overrideNote, setOverrideNote] = useState('');
  const [overrideDayTypeId, setOverrideDayTypeId] = useState<string>('');
  const [newDayTypeName, setNewDayTypeName] = useState('');
  const [newExerciseId, setNewExerciseId] = useState('');
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [prescriptionKind, setPrescriptionKind] = useState('sets_reps');
  const [editState, setEditState] = useState<EditState | null>(null);

  const { data: programs } = useQuery({ queryKey: ['programs'], queryFn: () => api.get<TrainingProgram[]>('/programs') });
  const { data: dayTypes = [] } = useQuery({ queryKey: ['day-types'], queryFn: () => api.get<DayType[]>('/day-types') });
  const { data: exercises = [] } = useQuery({ queryKey: ['exercises'], queryFn: () => api.get<Exercise[]>('/exercises') });

  const activeProgram = useMemo(() => programs?.find((p) => p.isActive) ?? programs?.[0] ?? null, [programs]);

  const createProgram = useMutation({
    mutationFn: (body: { name: string }) => api.post<TrainingProgram>('/programs', body),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      setSelectedProgramId(created.id);
    },
  });

  useEffect(() => {
    if (activeProgram && selectedProgramId !== activeProgram.id) {
      setSelectedProgramId(activeProgram.id);
      setMode(activeProgram.cycleLengthWeeks ? 'block' : 'perpetual');
    } else if (programs && programs.length === 0 && !createProgram.isPending && !createProgram.isSuccess) {
      // New users have no program yet — schedule slots require one to
      // attach to, so create a sensible default rather than leaving the
      // schedule/override UI silently broken (POST .../null/... 400s).
      createProgram.mutate({ name: 'My Training Program' });
    }
  }, [activeProgram, selectedProgramId, programs, createProgram]);

  useEffect(() => {
    if (dayTypes.length && !selectedDayTypeId) setSelectedDayTypeId(dayTypes[0]!.id);
  }, [dayTypes, selectedDayTypeId]);

  const { data: selectedDayType } = useQuery({
    queryKey: ['day-type', selectedDayTypeId],
    queryFn: () => api.get<DayTypeDetail>(`/day-types/${selectedDayTypeId}`),
    enabled: !!selectedDayTypeId,
  });

  const { data: scheduleSlots = [] } = useQuery({
    queryKey: ['schedule-slots', selectedProgramId],
    queryFn: () => api.get<ProgramScheduleSlot[]>(`/programs/${selectedProgramId}/schedule-slots`),
    enabled: !!selectedProgramId,
  });

  const { data: overrideData } = useQuery({
    queryKey: ['schedule-override', overrideDate],
    queryFn: () => api.get<ScheduleResponse>(`/me/schedule/${overrideDate}`),
  });

  const invalidateTraining = () => {
    queryClient.invalidateQueries({ queryKey: ['day-types'] });
    queryClient.invalidateQueries({ queryKey: ['day-type', selectedDayTypeId] });
    queryClient.invalidateQueries({ queryKey: ['schedule-slots', selectedProgramId] });
    queryClient.invalidateQueries({ queryKey: ['schedule-override', overrideDate] });
  };

  const createDayType = useMutation({
    mutationFn: (body: { name: string }) => api.post<DayType>('/day-types', body),
    onSuccess: (row) => {
      invalidateTraining();
      setSelectedDayTypeId(row.id);
      setNewDayTypeName('');
    },
  });

  const deleteDayType = useMutation({
    mutationFn: (id: string) => api.del<void>(`/day-types/${id}`),
    onSuccess: () => {
      invalidateTraining();
      setSelectedDayTypeId(null);
    },
  });

  const addExercise = useMutation({
    mutationFn: (body: { exerciseId: string; prescription: Prescription }) =>
      api.post(`/day-types/${selectedDayTypeId}/exercises`, body),
    onSuccess: () => invalidateTraining(),
  });

  const createExercise = useMutation({
    mutationFn: (body: { name: string }) => api.post<Exercise>('/exercises', body),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      setNewExerciseId(created.id);
      setCustomExerciseName('');
    },
  });

  const patchExercise = useMutation({
    mutationFn: (args: { exerciseId: string; body: { prescription?: Prescription; notes?: string | null } }) =>
      api.patch(`/day-types/${selectedDayTypeId}/exercises/${args.exerciseId}`, args.body),
    onSuccess: () => {
      invalidateTraining();
      setEditState(null);
      toast.show({ variant: 'success', message: 'Exercise updated.' });
    },
  });

  const removeExercise = useMutation({
    mutationFn: (id: string) => api.del<void>(`/day-types/${selectedDayTypeId}/exercises/${id}`),
    onSuccess: () => {
      invalidateTraining();
      setEditState(null);
      toast.show({ variant: 'success', message: 'Exercise removed.' });
    },
  });

  const reorderExercises = useMutation({
    mutationFn: (exerciseIdsInOrder: string[]) =>
      api.post(`/day-types/${selectedDayTypeId}/exercises/reorder`, { exerciseIdsInOrder }),
    onSuccess: () => invalidateTraining(),
  });

  const patchProgram = useMutation({
    mutationFn: (body: Partial<TrainingProgram>) => api.patch(`/programs/${selectedProgramId}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['programs'] }),
  });

  const upsertSlot = useMutation({
    mutationFn: (body: { id?: string; dayTypeId: string; weekNumber: number | null; dayIndex: number; sortOrder: number }) =>
      body.id
        ? api.patch(`/programs/${selectedProgramId}/schedule-slots/${body.id}`, body)
        : api.post(`/programs/${selectedProgramId}/schedule-slots`, body),
    onSuccess: () => invalidateTraining(),
  });

  const removeSlot = useMutation({
    mutationFn: (id: string) => api.del<void>(`/programs/${selectedProgramId}/schedule-slots/${id}`),
    onSuccess: () => invalidateTraining(),
  });

  const putOverride = useMutation({
    mutationFn: (body: { dayTypeId: string; note: string | null }) =>
      api.put(`/me/schedule/${overrideDate}/override`, body),
    onSuccess: () => invalidateTraining(),
  });

  const slotsByDay = useMemo(() => {
    const map = new Map<number, ProgramScheduleSlot>();
    scheduleSlots
      .filter((slot) => (mode === 'block' ? slot.weekNumber === 1 : slot.weekNumber === null))
      .forEach((slot) => map.set(slot.dayIndex, slot));
    return map;
  }, [scheduleSlots, mode]);

  const sortedExercises = useMemo(
    () => [...(selectedDayType?.exercises ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [selectedDayType?.exercises],
  );

  const reorderByDelta = (index: number, delta: number) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= sortedExercises.length) return;
    reorderExercises.mutate(moveItem(sortedExercises.map((item) => item.id), index, nextIndex));
  };

  return (
    <Column>
      <div>
        <SectionTitle>Training</SectionTitle>
        <Small>Day-type library, builder, schedule, and one-off override.</Small>
      </div>
      <Layout>
        <Column>
          <LibraryCard>
            <strong>Day-type library</strong>
            <Input label="New day type" value={newDayTypeName} onChange={(e) => setNewDayTypeName(e.target.value)} placeholder="Upper A, Recovery Walk…" />
            <Button onClick={() => newDayTypeName.trim() && createDayType.mutate({ name: newDayTypeName.trim() })} disabled={!newDayTypeName.trim() || createDayType.isPending}>Create day type</Button>
            {dayTypes.map((dayType) => (
              <LibraryItem key={dayType.id} $active={selectedDayTypeId === dayType.id} onClick={() => setSelectedDayTypeId(dayType.id)}>
                <strong>{dayType.name}</strong>
                <Small>{dayType.estimatedDurationMinutes ? `~${dayType.estimatedDurationMinutes} min` : 'No duration yet'}</Small>
              </LibraryItem>
            ))}
          </LibraryCard>
        </Column>

        <Column>
          <StackCard>
            <Row style={{ justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0' }}>{selectedDayType?.name ?? 'Select a day type'}</h2>
                <Small>{selectedDayType?.description ?? 'Build the exercise list and prescription here.'}</Small>
              </div>
              {selectedDayType ? <Button variant="destructive" onClick={() => deleteDayType.mutate(selectedDayType.id)}>Delete</Button> : null}
            </Row>

            {sortedExercises.length === 0 ? (
              <Small>No exercises yet.</Small>
            ) : (
              sortedExercises.map((exercise, index) => (
                <ExerciseRow key={exercise.id}>
                  <div style={{ flex: 1 }}>
                    <strong>{exercises.find((item) => item.id === exercise.exerciseId)?.name ?? exercise.exerciseId}</strong>
                    <Small>
                      {summarizePrescription(exercise.prescription)}
                      {exercise.notes ? ` · ${exercise.notes}` : ''}
                    </Small>
                  </div>
                  <IconButton aria-label="Move exercise up" disabled={index === 0} onClick={() => reorderByDelta(index, -1)}><ChevronUp size={16} /></IconButton>
                  <IconButton aria-label="Move exercise down" disabled={index === sortedExercises.length - 1} onClick={() => reorderByDelta(index, 1)}><ChevronDown size={16} /></IconButton>
                  <IconButton aria-label="Edit exercise" onClick={() => setEditState({ exerciseId: exercise.id, exerciseName: exercises.find((item) => item.id === exercise.exerciseId)?.name ?? exercise.exerciseId, prescription: exercise.prescription, notes: exercise.notes ?? '' })}><Pencil size={16} /></IconButton>
                  <IconButton aria-label="Delete exercise" onClick={() => removeExercise.mutate(exercise.id)}><Trash2 size={16} /></IconButton>
                </ExerciseRow>
              ))
            )}

            <PrescriptionGrid>
              <Select
                label="Exercise"
                value={newExerciseId}
                onChange={(e) => setNewExerciseId(e.target.value)}
                options={[
                  { value: '', label: 'Select exercise' },
                  ...exercises.map((exercise) => ({
                    value: exercise.id,
                    label: exercise.isCustom ? `${exercise.name} (custom)` : exercise.name,
                  })),
                ]}
              />
              <Select label="Prescription type" value={prescriptionKind} onChange={(e) => setPrescriptionKind(e.target.value)} options={prescriptionOptions} />
            </PrescriptionGrid>
            <Row style={{ gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <Input
                  label="Create a new exercise"
                  placeholder="e.g. Cable Face Pull"
                  value={customExerciseName}
                  onChange={(e) => setCustomExerciseName(e.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                onClick={() => customExerciseName.trim() && createExercise.mutate({ name: customExerciseName.trim() })}
                disabled={!customExerciseName.trim() || createExercise.isPending}
              >
                <Plus size={16} />Create exercise
              </Button>
            </Row>
            <Button onClick={() => newExerciseId && addExercise.mutate({ exerciseId: newExerciseId, prescription: emptyPrescription(prescriptionKind) })} disabled={!newExerciseId}><Plus size={16} />Add exercise</Button>
          </StackCard>
        </Column>

        <Column>
          <StackCard>
            <h2 style={{ margin: '0 0 12px 0' }}>Program schedule</h2>
            {!selectedProgramId ? (
              <Small>Setting up your training program…</Small>
            ) : (
              <>
                <Select label="Mode" value={mode} onChange={(e) => { const next = e.target.value as 'perpetual' | 'block'; setMode(next); patchProgram.mutate({ cycleLengthWeeks: next === 'block' ? 1 : null }); }} options={modeOptions} />
                <DayGrid>
                  {dayNames.map((day, dayIndex) => {
                    const slot = slotsByDay.get(dayIndex);
                    const label = dayTypes.find((type) => type.id === slot?.dayTypeId)?.name ?? 'Unassigned';
                    const handleClick = () => {
                      if (slot && slot.dayTypeId === selectedDayTypeId) {
                        // Clicking the already-assigned day type again clears it,
                        // instead of silently re-PATCHing to the same value.
                        removeSlot.mutate(slot.id);
                        return;
                      }
                      if (selectedDayTypeId) {
                        upsertSlot.mutate({ id: slot?.id, dayTypeId: selectedDayTypeId, weekNumber: mode === 'block' ? 1 : null, dayIndex, sortOrder: dayIndex });
                      }
                    };
                    return (
                      <DayCell key={day} $active={Boolean(slot)} onClick={handleClick}>
                        <DayName>{day}</DayName>
                        <DayLabel>{label}</DayLabel>
                      </DayCell>
                    );
                  })}
                </DayGrid>
              </>
            )}
          </StackCard>

          <StackCard>
            <strong>Ad hoc override</strong>
            <Input label="Date" type="date" value={overrideDate} onChange={(e) => setOverrideDate(e.target.value)} />
            <Select label="Override day type" value={overrideDayTypeId} onChange={(e) => setOverrideDayTypeId(e.target.value)} options={[{ value: '', label: 'Select day type' }, ...dayTypes.map((type) => ({ value: type.id, label: type.name }))]} />
            <TextArea value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} placeholder="Travel, swap, extra conditioning…" />
            <Button onClick={() => overrideDayTypeId && putOverride.mutate({ dayTypeId: overrideDayTypeId, note: overrideNote || null })} disabled={!overrideDayTypeId}>Save override</Button>
            <Small>Resolved now: {overrideData?.scheduledDayType?.name ?? 'None'} ({overrideData?.source ?? 'none'})</Small>
          </StackCard>
        </Column>
      </Layout>

      {editState ? (
        <ExerciseEditModal
          state={editState}
          onClose={() => setEditState(null)}
          onSave={(next) => patchExercise.mutate({ exerciseId: next.exerciseId, body: { prescription: next.prescription, notes: next.notes || null } })}
          onDelete={() => removeExercise.mutate(editState.exerciseId)}
        />
      ) : null}
    </Column>
  );
}
