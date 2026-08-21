import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Pencil, Plus, Trash2, CalendarSync } from 'lucide-react';
import { spacing, radius } from '@setline/design-tokens';
import type { DayType, DayTypeExercise, Exercise, Prescription, ProgramScheduleSlot, ScheduleOverride, TrainingProgram } from '@setline/schemas';
import { Button, Card, IconButton, Input, Select, useToast } from '../components';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { useApiClient } from '../lib/api-client';

interface DayTypeDetail extends DayType { exercises: DayTypeExercise[] }
interface ScheduleResponse { date: string; override: ScheduleOverride | null; scheduledDayType: DayType | null; source: 'override' | 'program' | 'none' }

const Layout = styled.div`
  display: grid; gap: ${spacing[24]}px; grid-template-columns: 1fr;
  ${mq.desktop} { grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.3fr) minmax(320px, 0.9fr); align-items: start; }
`;
const SectionTitle = styled.h1`margin:0; font-size:${typeScale.pageTitle.fontSize}px;`;
const Column = styled.div`display:flex; flex-direction:column; gap:${spacing[16]}px;`;
const LibraryCard = styled(Card)`display:flex; flex-direction:column; gap:${spacing[12]}px;`;
const LibraryItem = styled.button<{ $active:boolean }>`text-align:left; padding:${spacing[12]}px; border-radius:${radius.small}px; border:1px solid ${(p)=>p.$active?p.theme.action.primary:p.theme.border.subtle}; background:${(p)=>p.$active?p.theme.action.accentSubtle:p.theme.surface.raised}; cursor:pointer;`;
const Small = styled.p`margin:0; color:${(p)=>p.theme.text.secondary}; font-size:${typeScale.compactBody.fontSize}px;`;
const Row = styled.div`display:flex; gap:${spacing[8]}px; align-items:center; flex-wrap:wrap;`;
const ExerciseRow = styled.div`display:flex; gap:${spacing[8]}px; align-items:flex-start; padding:${spacing[12]}px 0; border-top:1px solid ${(p)=>p.theme.border.subtle};`;
const PrescriptionGrid = styled.div`display:grid; gap:${spacing[8]}px; grid-template-columns: repeat(auto-fit,minmax(120px,1fr));`;
const TextArea = styled.textarea`width:100%; min-height:80px; padding:${spacing[12]}px; border-radius:${radius.small}px; border:1px solid ${(p)=>p.theme.border.default}; background:${(p)=>p.theme.surface.raised}; color:${(p)=>p.theme.text.primary};`;
const DayGrid = styled.div`display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:${spacing[8]}px;`;
const DayCell = styled.button<{ $active?:boolean }>`padding:${spacing[12]}px ${spacing[8]}px; border-radius:${radius.small}px; border:1px solid ${(p)=>p.$active?p.theme.action.primary:p.theme.border.subtle}; background:${(p)=>p.$active?p.theme.action.accentSubtle:p.theme.surface.sunken}; cursor:pointer; min-height:80px; text-align:left;`;

const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const modeOptions = [{ value: 'perpetual', label: 'Perpetual' }, { value: 'block', label: 'Block' }];
const prescriptionOptions = [
  { value: 'sets_reps', label: 'Sets + reps' },
  { value: 'timed', label: 'Timed sets' },
  { value: 'duration', label: 'Duration' },
  { value: 'distanceDuration', label: 'Distance + duration' },
  { value: 'distance', label: 'Distance' },
  { value: 'bodyweight_reps', label: 'Bodyweight reps' },
];
function currentDate() { return new Date().toISOString().slice(0,10); }
function summarizePrescription(p: Prescription) {
  switch (p.kind) {
    case 'sets_reps':
    case 'per_side':
    case 'bodyweight_reps': return `${p.sets} × ${p.repsMin}${p.repsMax ? `–${p.repsMax}` : ''}`;
    case 'top_set_backoff': return `${p.topSets} top / ${p.backoffSets} backoff`;
    case 'timed': return `${p.sets} × ${p.durationSeconds}s`;
    case 'distance': return `${p.sets} × ${p.distanceValue}${p.distanceUnit}`;
    case 'duration': return `${p.durationMinutes} min`;
    case 'distanceDuration': return `${p.distanceMiles} mi / ${p.durationMinutes} min`;
  }
}
function emptyPrescription(kind: string): Prescription {
  switch (kind) {
    case 'timed': return { kind: 'timed', sets: 3, durationSeconds: 60 };
    case 'duration': return { kind: 'duration', durationMinutes: 30 };
    case 'distanceDuration': return { kind: 'distanceDuration', distanceMiles: 5, durationMinutes: 30 };
    case 'distance': return { kind: 'distance', sets: 1, distanceValue: 5, distanceUnit: 'mi' };
    case 'bodyweight_reps': return { kind: 'bodyweight_reps', sets: 3, repsMin: 8 };
    default: return { kind: 'sets_reps', sets: 3, repsMin: 8 };
  }
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
  const [newDayTypeName, setNewDayTypeName] = useState('');
  const [newExerciseId, setNewExerciseId] = useState('');
  const [prescriptionKind, setPrescriptionKind] = useState('sets_reps');

  const { data: programs } = useQuery({ queryKey:['programs'], queryFn:()=>api.get<TrainingProgram[]>('/programs') });
  const { data: dayTypes=[] } = useQuery({ queryKey:['day-types'], queryFn:()=>api.get<DayType[]>('/day-types') });
  const { data: exercises=[] } = useQuery({ queryKey:['exercises'], queryFn:()=>api.get<Exercise[]>('/exercises') });
  const activeProgram = useMemo(()=>programs?.find((p)=>p.isActive) ?? programs?.[0] ?? null,[programs]);
  useEffect(()=>{ if(activeProgram && selectedProgramId!==activeProgram.id){ setSelectedProgramId(activeProgram.id); setMode(activeProgram.cycleLengthWeeks ? 'block' : 'perpetual'); } },[activeProgram, selectedProgramId]);
  useEffect(()=>{ if(dayTypes.length && !selectedDayTypeId) setSelectedDayTypeId(dayTypes[0]!.id); },[dayTypes, selectedDayTypeId]);

  const { data: selectedDayType } = useQuery({ queryKey:['day-type', selectedDayTypeId], queryFn:()=>api.get<DayTypeDetail>(`/day-types/${selectedDayTypeId}`), enabled:!!selectedDayTypeId });
  const { data: scheduleSlots=[] } = useQuery({ queryKey:['schedule-slots', selectedProgramId], queryFn:()=>api.get<ProgramScheduleSlot[]>(`/programs/${selectedProgramId}/schedule-slots`), enabled:!!selectedProgramId });
  const { data: overrideData } = useQuery({ queryKey:['schedule-override', overrideDate], queryFn:()=>api.get<ScheduleResponse>(`/me/schedule/${overrideDate}`) });

  const invalidateTraining = () => {
    queryClient.invalidateQueries({ queryKey:['day-types'] });
    queryClient.invalidateQueries({ queryKey:['day-type', selectedDayTypeId] });
    queryClient.invalidateQueries({ queryKey:['schedule-slots', selectedProgramId] });
    queryClient.invalidateQueries({ queryKey:['schedule-override', overrideDate] });
    queryClient.invalidateQueries({ queryKey:['today'] });
  };
  const createDayType = useMutation({ mutationFn:(body:{name:string})=>api.post<DayType>('/day-types', body), onSuccess:(row)=>{ invalidateTraining(); setSelectedDayTypeId(row.id); setNewDayTypeName(''); toast.show({ variant:'success', message:'Day type created.' }); } });
  const deleteDayType = useMutation({ mutationFn:(id:string)=>api.del<void>(`/day-types/${id}`), onSuccess:()=>{ invalidateTraining(); setSelectedDayTypeId(null); toast.show({ variant:'success', message:'Day type deleted.' }); } });
  const addExercise = useMutation({ mutationFn:(body:{ exerciseId:string; prescription:Prescription })=>api.post(`/day-types/${selectedDayTypeId}/exercises`, body), onSuccess:()=>{ invalidateTraining(); toast.show({ variant:'success', message:'Exercise added.' }); } });
  const patchExercise = useMutation({ mutationFn:(args:{ id:string; body: Partial<DayTypeExercise> & { prescription?: Prescription; sortOrder?: number } })=>api.patch(`/day-type-exercises/${args.id}`, args.body), onSuccess:()=>{ invalidateTraining(); toast.show({ variant:'success', message:'Exercise updated.' }); } });
  const removeExercise = useMutation({ mutationFn:(id:string)=>api.del<void>(`/day-type-exercises/${id}`), onSuccess:()=>{ invalidateTraining(); toast.show({ variant:'success', message:'Exercise removed.' }); } });
  const patchProgram = useMutation({ mutationFn:(body:Partial<TrainingProgram>)=>api.patch(`/programs/${selectedProgramId}`, body), onSuccess:()=>{ queryClient.invalidateQueries({ queryKey:['programs'] }); toast.show({ variant:'success', message:'Program updated.' }); } });
  const upsertSlot = useMutation({ mutationFn:(body:{ id?:string; dayTypeId:string; weekNumber:number|null; dayIndex:number; sortOrder:number })=> body.id ? api.patch(`/programs/${selectedProgramId}/schedule-slots/${body.id}`, body) : api.post(`/programs/${selectedProgramId}/schedule-slots`, body), onSuccess:()=>{ invalidateTraining(); toast.show({ variant:'success', message:'Schedule saved.' }); } });
  const putOverride = useMutation({ mutationFn:(body:{ dayTypeId:string; note:string | null })=>api.post(`/me/schedule/${overrideDate}/override`, body), onSuccess:()=>{ invalidateTraining(); toast.show({ variant:'success', message:'Override saved.' }); } });

  const slotsByDay = useMemo(()=>{
    const map = new Map<number, ProgramScheduleSlot>();
    scheduleSlots.filter((slot)=> mode === 'block' ? slot.weekNumber === 1 : slot.weekNumber === null).forEach((slot)=>map.set(slot.dayIndex, slot));
    return map;
  },[scheduleSlots, mode]);

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
            <Input label="New day type" value={newDayTypeName} onChange={(e)=>setNewDayTypeName(e.target.value)} placeholder="Upper A, Recovery Walk…" />
            <Button onClick={()=>newDayTypeName.trim() && createDayType.mutate({ name:newDayTypeName.trim() })} disabled={!newDayTypeName.trim() || createDayType.isPending}>Create day type</Button>
            {dayTypes.map((dayType)=><LibraryItem key={dayType.id} $active={selectedDayTypeId===dayType.id} onClick={()=>setSelectedDayTypeId(dayType.id)}><strong>{dayType.name}</strong><Small>{dayType.estimatedDurationMinutes ? `~${dayType.estimatedDurationMinutes} min` : 'No duration yet'}</Small></LibraryItem>)}
          </LibraryCard>
        </Column>
        <Column>
          <Card>
            <Row style={{ justifyContent:'space-between' }}>
              <div>
                <h2 style={{ margin:'0 0 4px 0' }}>{selectedDayType?.name ?? 'Select a day type'}</h2>
                <Small>{selectedDayType?.description ?? 'Build the exercise list and prescription here.'}</Small>
              </div>
              {selectedDayType ? <Button variant="destructive" onClick={()=>deleteDayType.mutate(selectedDayType.id)}>Delete</Button> : null}
            </Row>
            {(selectedDayType?.exercises ?? []).length === 0 ? <Small>No exercises yet.</Small> : selectedDayType!.exercises.sort((a,b)=>a.sortOrder-b.sortOrder).map((exercise, index)=><ExerciseRow key={exercise.id}><GripVertical size={16} /><div style={{ flex:1 }}><strong>{exercises.find((item)=>item.id===exercise.exerciseId)?.name ?? exercise.exerciseId}</strong><Small>{summarizePrescription(exercise.prescription)}{exercise.notes ? ` · ${exercise.notes}` : ''}</Small></div><IconButton aria-label="Move up" disabled={index===0} onClick={()=>patchExercise.mutate({ id:exercise.id, body:{ sortOrder:index-1 } })}><GripVertical size={16} /></IconButton><IconButton aria-label="Edit exercise" onClick={()=>patchExercise.mutate({ id:exercise.id, body:{ notes: exercise.notes ? `${exercise.notes}` : 'Edited in web builder' } })}><Pencil size={16} /></IconButton><IconButton aria-label="Delete exercise" onClick={()=>removeExercise.mutate(exercise.id)}><Trash2 size={16} /></IconButton></ExerciseRow>)}
            <PrescriptionGrid>
              <Select label="Exercise" value={newExerciseId} onChange={(e)=>setNewExerciseId(e.target.value)} options={[{ value:'', label:'Select exercise' }, ...exercises.map((exercise)=>({ value:exercise.id, label:exercise.name }))]} />
              <Select label="Prescription type" value={prescriptionKind} onChange={(e)=>setPrescriptionKind(e.target.value)} options={prescriptionOptions} />
            </PrescriptionGrid>
            <Button onClick={()=>newExerciseId && addExercise.mutate({ exerciseId:newExerciseId, prescription:emptyPrescription(prescriptionKind) })} disabled={!newExerciseId}>Add exercise</Button>
            <Small>{selectedDayType?.exercises.length ? 'Edit uses PATCH /v1/day-type-exercises/:id. Replace placeholder note-edit with full modal later if desired.' : 'Add exercises from the shared exercise library.'}</Small>
          </Card>
        </Column>
        <Column>
          <Card>
            <h2 style={{ margin:'0 0 12px 0' }}>Program schedule</h2>
            <Select label="Mode" value={mode} onChange={(e)=>{ const next = e.target.value as 'perpetual' | 'block'; setMode(next); patchProgram.mutate({ cycleLengthWeeks: next === 'block' ? 1 : null }); }} options={modeOptions} />
            <DayGrid>
              {dayNames.map((day, dayIndex)=>{
                const slot = slotsByDay.get(dayIndex);
                const label = dayTypes.find((type)=>type.id===slot?.dayTypeId)?.name ?? 'Unassigned';
                return <DayCell key={day} $active={Boolean(slot)} onClick={()=> selectedDayTypeId && upsertSlot.mutate({ id: slot?.id, dayTypeId:selectedDayTypeId, weekNumber: mode==='block' ? 1 : null, dayIndex, sortOrder: dayIndex })}><strong>{day}</strong><Small>{label}</Small></DayCell>;
              })}
            </DayGrid>
          </Card>
          <Card>
            <Row><CalendarSync size={18} /><strong>Ad hoc override</strong></Row>
            <Input label="Date" type="date" value={overrideDate} onChange={(e)=>setOverrideDate(e.target.value)} />
            <Select label="Override day type" value={selectedDayTypeId ?? ''} onChange={(e)=>setSelectedDayTypeId(e.target.value)} options={dayTypes.map((type)=>({ value:type.id, label:type.name }))} />
            <TextArea value={overrideNote} onChange={(e)=>setOverrideNote(e.target.value)} placeholder="Travel, swap, extra conditioning…" />
            <Button onClick={()=>selectedDayTypeId && putOverride.mutate({ dayTypeId:selectedDayTypeId, note: overrideNote || null })} disabled={!selectedDayTypeId}>Save override</Button>
            <Small>Resolved now: {overrideData?.scheduledDayType?.name ?? 'None'} ({overrideData?.source ?? 'none'})</Small>
          </Card>
        </Column>
      </Layout>
    </Column>
  );
}
