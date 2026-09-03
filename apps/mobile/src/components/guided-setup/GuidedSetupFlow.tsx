import { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DayType, DayTypeExercise, Exercise, Prescription, TrainingProgram } from '@setframe/schemas';
import { summarizePrescription, type PickableExercise } from '@setframe/domain';
import { radius, spacing } from '@setframe/design-tokens';
import { useApiClient } from '../../lib/api-client';
import { useActionFeedback } from '../../lib/useActionFeedback';
import { useTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/getTheme';
import { Input } from '../Input';
import { Button } from '../Button';
import { ExercisePickerV2 } from '../exercise-picker/ExercisePickerV2';
import { PrescriptionSheet } from '../training-v2/PrescriptionSheet';
import { SetupScaffold } from './SetupScaffold';
import type { SetupHost } from './SetupChrome';

/**
 * Guided setup — one implementation, two hosts.
 *
 * Figma `338:2`. Four steps: name the plan, add a workout, add exercises,
 * pick the days. Replaces the four-tab wizard, which asked the user to
 * understand Program → Workout → Exercise before doing anything; this asks
 * one question per screen and explains the concept inside the question.
 *
 * **Every step writes as it completes.** There is no draft held in memory
 * and flushed at the end, because the flow is explicitly abandonable: a
 * plan with no workouts, and a workout with no schedule, are both valid
 * states the Training tab already renders. Leaving keeps what exists.
 */
const TOTAL_STEPS = 4;
/** Matches WorkoutEditorScreen: the API requires a prescription, and this
 *  is the least-assuming one that still lets a session build a row. */
const DEFAULT_PICKED_PRESCRIPTION = { kind: 'sets_reps' as const, sets: 1 };
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function GuidedSetupFlow({
  host,
  onExit,
  onBack,
}: {
  host: SetupHost;
  /** Leaving the flow entirely — Skip, or Save & exit, or Done. */
  onExit: () => void;
  /**
   * Going back one, from the FIRST step.
   *
   * Distinct from `onExit` on purpose. Back on step 1 used to call
   * `onExit`, which in onboarding means "skip the whole setup" — so the
   * back chevron and Skip did the same thing, which is not what a back
   * chevron means anywhere. Falls back to `onExit` for a host with
   * nothing behind it.
   */
  onBack?: () => void;
}) {
  const theme = useTheme();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const feedback = useActionFeedback();

  const [step, setStep] = useState(1);
  const [planName, setPlanName] = useState('');
  const [workoutName, setWorkoutName] = useState('');
  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [dayType, setDayType] = useState<DayType | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sheetFor, setSheetFor] = useState<string | null>(null);

  const invalidate = () => {
    for (const key of [['programs'], ['day-types'], ['program-day-types'], ['schedule-slots'], ['today']]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const catalogue = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.get<Exercise[]>('/exercises'),
    /* Not gated on the picker: the list on step 3 resolves its names from
       this, so loading it only while the picker is open would leave every
       row reading "Exercise". */
    enabled: pickerOpen || step >= 3,
  });

  const exercisesQuery = useQuery({
    queryKey: ['day-type-exercises', dayType?.id],
    queryFn: () => api.get<DayTypeExercise[]>(`/day-types/${dayType!.id}/exercises`),
    enabled: Boolean(dayType?.id),
  });
  const exercises = exercisesQuery.data ?? [];

  const createProgram = useMutation({
    mutationFn: (name: string) => api.post<TrainingProgram>('/programs', { name }),
    onSuccess: (created) => {
      setProgram(created);
      invalidate();
      setStep(2);
    },
    onError: feedback.report('Could not create that plan. Try again.'),
  });

  const createWorkout = useMutation({
    mutationFn: (name: string) =>
      api.post<DayType>('/day-types', { name, programId: program?.id }),
    onSuccess: (created) => {
      setDayType(created);
      invalidate();
      setStep(3);
    },
    onError: feedback.report('Could not add that workout. Try again.'),
  });

  const addExercises = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const exerciseId of ids) {
        /* `prescription` is required by addDayTypeExerciseSchema — sending
           null fails validation. Same default the workout editor uses: a
           set count and no reps, which is enough for a session to
           instantiate a row to log into without inventing a rep target the
           user never chose. Blank targets stay legitimate (story 19). */
        await api.post(`/day-types/${dayType!.id}/exercises`, {
          exerciseId,
          prescription: DEFAULT_PICKED_PRESCRIPTION,
        });
      }
    },
    onSuccess: () => {
      setPickerOpen(false);
      void exercisesQuery.refetch();
      invalidate();
    },
    onError: feedback.report('Could not add those exercises. Try again.'),
  });

  const savePrescription = useMutation({
    mutationFn: ({ id, prescription }: { id: string; prescription: Prescription | null }) =>
      api.patch(`/day-types/${dayType!.id}/exercises/${id}`, { prescription }),
    onSuccess: () => {
      setSheetFor(null);
      void exercisesQuery.refetch();
    },
    onError: feedback.report('Could not save that target. Try again.'),
  });

  const removeExercise = useMutation({
    mutationFn: (id: string) => api.del(`/day-types/${dayType!.id}/exercises/${id}`),
    onSuccess: () => {
      setSheetFor(null);
      void exercisesQuery.refetch();
    },
    onError: feedback.report('Could not remove that exercise. Try again.'),
  });

  /* Leaving step 4 by EITHER path has to write first.
     "Add another workout" used to reset `days` and jump to step 2 while
     saveDays had only ever been wired to Done — so the days picked for
     the first workout were silently dropped and only the last workout
     was ever scheduled. Every step writes as it completes; this one was
     writing as the flow ended, which is not the same thing. */
  const saveDays = useMutation({
    mutationFn: async (selected: number[]) => {
      /* `dayIndex` and `sortOrder`, matching ScheduleScreen and the
         programScheduleSlot schema. The first version of this sent
         `dayOfWeek` — a field that does not exist — so every schedule
         would have failed validation on the last step of the flow.
         weekNumber stays null: that is "repeats every week", and pinning
         a slot to one week of a block is the part of the model still
         undesigned (training-v2 pack, "What is still open"). */
      for (const [index, dayIndex] of selected.entries()) {
        await api.post(`/programs/${program!.id}/schedule-slots`, {
          dayTypeId: dayType!.id,
          dayIndex,
          sortOrder: index,
          weekNumber: null,
        });
      }
    },
    onSuccess: () => invalidate(),
    onError: feedback.report('Could not save your week. The workout is still saved.'),
  });

  /* Always present. On step 1 there is no previous step, but there IS
     somewhere to go back TO — Training, or the onboarding screen before
     this — so back exits rather than disappearing. A chrome whose left
     side is blank on the first screen reads as a dead end, which is the
     defect the old wizard actually had. */
  const startAnotherWorkout = () => {
    setWorkoutName('');
    setDayType(null);
    setDays([]);
    setStep(2);
  };

  /** Writes the week, then does whatever came next. */
  const commitDays = (next: () => void) => {
    if (days.length === 0) {
      next();
      return;
    }
    saveDays.mutate(days, { onSuccess: next });
  };

  /* Back is a step backwards, never an exit in disguise. On step 1 it
     leaves to whatever is behind this flow — the previous onboarding
     screen, or Training — which is still "backwards", not "skip". */
  const back = step > 1 ? () => setStep((n) => n - 1) : (onBack ?? onExit);
  const active = exercises.find((e) => e.id === sheetFor) ?? null;
  const byId = new Map((catalogue.data ?? []).map((e) => [e.id, e] as const));

  return (
    <>
      <SetupScaffold
        host={host}
        step={step}
        totalSteps={TOTAL_STEPS}
        planName={program?.name ?? null}
        onBack={back}
        onExit={onExit}
        actions={<StepActions
          step={step}
          planName={planName}
          workoutName={workoutName}
          busy={createProgram.isPending || createWorkout.isPending || saveDays.isPending}
          onCreatePlan={() => createProgram.mutate(planName.trim())}
          onCreateWorkout={() => createWorkout.mutate(workoutName.trim())}
          onExercisesDone={() => setStep(4)}
          onAddAnother={() => commitDays(startAnotherWorkout)}
          onFinish={() => commitDays(onExit)}
        />}
      >
        {step === 1 ? (
          <>
            <Text style={[styles.title, { color: theme.text.primary }]}>What should we call it?</Text>
            <Text style={[styles.help, { color: theme.text.secondary }]}>
              A plan is the whole thing you are following — the workouts in it and the days they
              land on. Most people have one at a time.
            </Text>
            <Input
              label="PLAN NAME"
              value={planName}
              onChangeText={setPlanName}
              placeholder="Upper / Lower 4-day"
              testID="plan-name"
            />
            <View style={[styles.hint, { backgroundColor: theme.surface.raised }]}>
              <Text style={[styles.hintLabel, { color: theme.text.disabled }]}>COMMON ONES</Text>
              <Text style={[styles.hintBody, { color: theme.text.primary }]}>
                Upper / Lower  ·  Push Pull Legs  ·  Full Body 3-day
              </Text>
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={[styles.title, { color: theme.text.primary }]}>Add your first workout</Text>
            <Text style={[styles.help, { color: theme.text.secondary }]}>
              A workout is one training day you repeat — the thing you tap to start. You can add
              more after this one.
            </Text>
            <Input
              label="WORKOUT NAME"
              value={workoutName}
              onChangeText={setWorkoutName}
              placeholder="Upper A"
              testID="workout-name"
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={[styles.title, { color: theme.text.primary }]}>
              What is in {dayType?.name ?? 'this workout'}?
            </Text>
            <Text style={[styles.help, { color: theme.text.secondary }]}>
              Add the movements you do. Targets are optional — you can leave them blank and just
              log what you lift.
            </Text>
            {exercises.map((row) => (
              <Pressable
                key={row.id}
                testID={`setup-exercise-${row.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${byId.get(row.exerciseId)?.name ?? 'exercise'}`}
                onPress={() => setSheetFor(row.id)}
                style={[styles.row, { backgroundColor: theme.surface.raised }]}
              >
                <View style={styles.rowMeta}>
                  <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.text.primary }]}>
                    {byId.get(row.exerciseId)?.name ?? 'Exercise'}
                  </Text>
                  <Text style={[styles.rowDetail, { color: theme.text.secondary }]}>
                    {row.prescription ? summarizePrescription(row.prescription) : 'No target'}
                  </Text>
                </View>
                <Text style={[styles.rowAction, { color: theme.action.primary }]}>Edit</Text>
              </Pressable>
            ))}
            <Pressable
              testID="setup-add-exercises"
              accessibilityRole="button"
              accessibilityLabel="Add exercises"
              onPress={() => setPickerOpen(true)}
              style={[styles.add, { borderColor: theme.border.default }]}
            >
              <Text style={[styles.addLabel, { color: theme.action.primary }]}>+  Add exercises</Text>
            </Pressable>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Text style={[styles.title, { color: theme.text.primary }]}>
              When do you do {dayType?.name ?? 'this workout'}?
            </Text>
            <Text style={[styles.help, { color: theme.text.secondary }]}>
              This is what lets Today tell you what is next. Leave it blank and the workout still
              exists — you just start it yourself.
            </Text>
            <View style={styles.days}>
              {DAY_LABELS.map((label, index) => {
                const on = days.includes(index);
                return (
                  <Pressable
                    key={index}
                    testID={`setup-day-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Day ${index}`}
                    accessibilityState={{ selected: on }}
                    onPress={() =>
                      setDays((prev) => (on ? prev.filter((d) => d !== index) : [...prev, index]))
                    }
                    style={[
                      styles.day,
                      { backgroundColor: on ? theme.action.primary : theme.surface.raised },
                    ]}
                  >
                    <Text
                      style={[styles.dayLabel, { color: on ? theme.action.primaryText : theme.text.primary }]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </SetupScaffold>

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <ExercisePickerV2
          exercises={(catalogue.data ?? []) as PickableExercise[]}
          title={`Add to ${dayType?.name ?? 'workout'}`}
          onCancel={() => setPickerOpen(false)}
          onAdd={(ids) => addExercises.mutate(ids)}
          busy={addExercises.isPending}
          loading={catalogue.isPending}
        />
      </Modal>

      {active ? (
        <PrescriptionSheet
          exerciseName={byId.get(active.exerciseId)?.name ?? 'Exercise'}
          workoutName={dayType?.name ?? 'this workout'}
          prescription={active.prescription ?? null}
          onClose={() => setSheetFor(null)}
          onSave={(prescription) => savePrescription.mutate({ id: active.id, prescription })}
          onRemove={() => removeExercise.mutate(active.id)}
        />
      ) : null}
      {feedback.node}
    </>
  );
}

function StepActions({
  step, planName, workoutName, busy,
  onCreatePlan, onCreateWorkout, onExercisesDone, onAddAnother, onFinish,
}: {
  step: number; planName: string; workoutName: string; busy: boolean;
  onCreatePlan: () => void; onCreateWorkout: () => void; onExercisesDone: () => void;
  onAddAnother: () => void; onFinish: () => void;
}) {
  if (step === 1) {
    return <Button label="Continue" onPress={onCreatePlan} disabled={!planName.trim() || busy} loading={busy} />;
  }
  if (step === 2) {
    return <Button label="Continue" onPress={onCreateWorkout} disabled={!workoutName.trim() || busy} loading={busy} />;
  }
  if (step === 3) {
    /* Not gated on having added anything. A workout with no exercises is a
       valid thing to come back to, and blocking here would rebuild the
       dead end the old wizard had. */
    return <Button label="Continue" onPress={onExercisesDone} />;
  }
  return (
    <>
      <Button label="Add another workout" variant="secondary" onPress={onAddAnother} disabled={busy} />
      <Button label="Done" onPress={onFinish} loading={busy} disabled={busy} />
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600' },
  /* typeScale.helper is 12, which made every step's body copy read a size
     smaller than the frames intend; body is the 14 they were drawn at. */
  help: { fontSize: typeScale.body.fontSize, lineHeight: typeScale.body.lineHeight },
  hint: { borderRadius: radius.small, padding: spacing[12], gap: spacing[4] },
  hintLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.6 },
  hintBody: { fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[8],
    borderRadius: radius.small, paddingVertical: spacing[12], paddingHorizontal: spacing[12],
  },
  rowMeta: { flex: 1, minWidth: 0, gap: spacing[4] },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowDetail: { fontSize: 11 },
  rowAction: { fontSize: 12, fontWeight: '500' },
  add: {
    borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.small,
    paddingVertical: spacing[12], alignItems: 'center',
  },
  addLabel: { fontSize: 14, fontWeight: '600' },
  days: { flexDirection: 'row', gap: spacing[4] },
  day: { flex: 1, borderRadius: radius.full, paddingVertical: spacing[12], alignItems: 'center' },
  dayLabel: { fontSize: 14, fontWeight: '600' },
});
