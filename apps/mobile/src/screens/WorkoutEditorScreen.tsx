import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DayType, DayTypeExercise, Exercise, Prescription } from '@setframe/schemas';
import { describeExercise, summarizePrescription, type PickableExercise } from '@setframe/domain';
import { training, workoutEditor } from '@setframe/design-tokens';
import { useApiClient } from '../lib/api-client';
import { useScreenTopPadding } from '../lib/useScreenInsets';
import { useTheme } from '../theme/ThemeProvider';
import { ExercisePickerV2 } from '../components/exercise-picker/ExercisePickerV2';
import { PrescriptionSheet } from '../components/training-v2/PrescriptionSheet';
import { WorkoutExerciseRow } from '../components/training-v2/WorkoutExerciseRow';
import { EditorRowsSkeleton } from '../components/training-v2/TrainingSkeletons';

/**
 * The workout editor. Counterpart of `apps/web/src/pages/WorkoutEditorPage.tsx`.
 *
 * Figma: `Explore/Mobile/Training 3 · Build a workout` (147:708).
 *
 * **Pushed, not appended** — master/detail on a phone is a push. Everything
 * here edits intent; ADR 0005 keeps that separate from logged fact, and the
 * hint line says so where someone might doubt it.
 */

interface EditorExercise extends DayTypeExercise {
  exercise?: Exercise;
}

/**
 * What an exercise added through the picker is prescribed.
 *
 * `POST /day-types/:id/exercises` REQUIRES a prescription — posting
 * `{ exerciseId }` alone fails with
 * "body/prescription Invalid input: expected object, received undefined".
 * The single-select picker this replaced had a configure step that supplied
 * one; the multi-select picker deliberately does not ask, so it has to send
 * the default instead of nothing.
 *
 * Blank targets are legitimate (story 19), so this carries a set count and no
 * reps — enough for the session to instantiate a row to log into, without
 * inventing a rep target the user never chose.
 */
const DEFAULT_PICKED_PRESCRIPTION = { kind: 'sets_reps' as const, sets: 1 };

export function WorkoutEditorScreen() {
  const { dayTypeId } = useLocalSearchParams<{ dayTypeId: string }>();
  const api = useApiClient();
  const router = useRouter();
  const theme = useTheme();
  /* These screens draw their own header with `headerShown: false`, so
     nothing reserves space for the status bar or the Dynamic Island — the
     header, including its back chevron, rendered underneath both and could
     not be tapped. `useScreenTopPadding` already existed for exactly this
     and had simply never been wired into the v2 screens. */
  const topPadding = useScreenTopPadding(workoutEditor.header.paddingTop);
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sheetFor, setSheetFor] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['day-type', dayTypeId] });

  const { data: dayType, isPending: dayTypePending } = useQuery({
    queryKey: ['day-type', dayTypeId],
    queryFn: () => api.get<DayType & { exercises?: EditorExercise[] }>(`/day-types/${dayTypeId}`),
    enabled: !!dayTypeId,
  });

  const { data: catalogue = [], isPending: cataloguePending } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.get<PickableExercise[]>('/exercises'),
  });

  const exercises = useMemo(() => dayType?.exercises ?? [], [dayType]);
  const byId = useMemo(() => new Map(catalogue.map((item) => [item.id, item])), [catalogue]);

  const addExercises = useMutation({
    mutationFn: async (exerciseIds: string[]) => {
      /* Sequential: sortOrder comes from insertion order. */
      for (const exerciseId of exerciseIds) {
        await api.post(`/day-types/${dayTypeId}/exercises`, {
          exerciseId,
          prescription: DEFAULT_PICKED_PRESCRIPTION,
        });
      }
    },
    onSuccess: async () => {
      setPickerOpen(false);
      await invalidate();
    },
  });

  const savePrescription = useMutation({
    mutationFn: ({ id, prescription }: { id: string; prescription: Prescription }) =>
      api.patch(`/day-types/${dayTypeId}/exercises/${id}`, { prescription }),
    onSuccess: invalidate,
  });

  const removeExercise = useMutation({
    mutationFn: (id: string) => api.del(`/day-types/${dayTypeId}/exercises/${id}`),
    onSuccess: async () => {
      setSheetFor(null);
      await invalidate();
    },
  });

  const active = exercises.find((item) => item.id === sheetFor) ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface.canvas }} testID="workout-editor">
      <View style={[styles.header, { backgroundColor: theme.surface.raised, paddingTop: topPadding }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Back to Training">
            <Text style={[styles.back, { color: theme.text.secondary }]}>‹</Text>
          </Pressable>
          <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
            {dayType?.name ?? 'Workout'}
          </Text>
        </View>
        <Text style={[styles.meta, { color: theme.text.secondary }]}>
          {formatEditorMeta(exercises.length, dayType?.estimatedDurationMinutes ?? null)}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.list, { backgroundColor: theme.surface.raised }]} testID="editor-list">
          {/* An empty state is a claim about the data. Rendering it while the
              query is in flight told a user opening a workout for the first
              time that it had no exercises — which reads as data loss. */}
          {dayTypePending ? (
            <EditorRowsSkeleton />
          ) : exercises.length === 0 ? (
            <Text style={[styles.empty, { color: theme.text.secondary }]}>
              Nothing in here yet. Add the first exercise to start building it.
            </Text>
          ) : (
            exercises.map((item, index) => {
              const exercise = byId.get(item.exerciseId);
              return (
                <WorkoutExerciseRow
                  key={item.id}
                  rowId={item.id}
                  name={item.exercise?.name ?? exercise?.name ?? 'Exercise'}
                  meta={exercise ? describeExercise(exercise) : ''}
                  planLabel={planLabelOf(item.prescription)}
                  divided={index > 0}
                  onOpenActions={() => setSheetFor(item.id)}
                />
              );
            })
          )}
        </View>

        <Pressable
          onPress={() => setPickerOpen(true)}
          testID="editor-add"
          accessibilityRole="button"
          style={[styles.add, { backgroundColor: theme.surface.sunken }]}
        >
          <Text style={[styles.addLabel, { color: theme.action.primary }]}>+ Add exercise</Text>
        </Pressable>

        {/* ADR 0005's separation, stated where someone might doubt it. */}
        <Text style={[styles.hint, { color: theme.text.secondary }]}>
          Editing this workout changes the plan, not any workout you have already logged.
        </Text>
      </ScrollView>

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <ExercisePickerV2
          exercises={catalogue}
          title={`Add to ${dayType?.name ?? 'workout'}`}
          onCancel={() => setPickerOpen(false)}
          onAdd={(ids) => addExercises.mutate(ids)}
          busy={addExercises.isPending}
          loading={cataloguePending}
        />
      </Modal>

      {active ? (
        <PrescriptionSheet
          exerciseName={active.exercise?.name ?? byId.get(active.exerciseId)?.name ?? 'Exercise'}
          workoutName={dayType?.name ?? 'this workout'}
          prescription={active.prescription ?? null}
          onClose={() => setSheetFor(null)}
          onSave={(prescription) => savePrescription.mutate({ id: active.id, prescription })}
          onRemove={() => removeExercise.mutate(active.id)}
        />
      ) : null}
    </View>
  );
}

function planLabelOf(prescription: Prescription | null | undefined): string | null {
  if (!prescription) return null;
  const stripped = summarizePrescription(prescription).replace(/^Planned:\s*/, '').trim();
  return stripped && stripped !== '—' ? stripped : null;
}

function formatEditorMeta(count: number, minutes: number | null): string {
  const segments = [count === 1 ? '1 exercise' : `${count} exercises`];
  if (minutes) segments.push(`~${minutes} min`);
  return segments.join(' · ');
}

const styles = StyleSheet.create({
  header: {
    paddingTop: workoutEditor.header.paddingTop,
    paddingBottom: workoutEditor.header.paddingBottom,
    paddingHorizontal: 12,
    gap: workoutEditor.header.gap,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { fontSize: workoutEditor.header.backSize, fontWeight: '600', width: 24 },
  title: { fontSize: workoutEditor.header.titleSize, fontWeight: '600', flexShrink: 1 },
  meta: { fontSize: workoutEditor.header.metaSize, paddingLeft: 4 },
  body: {
    padding: training.bodyPaddingX,
    gap: training.cardGap,
  },
  list: {
    width: training.cardWidth,
    maxWidth: '100%',
    paddingVertical: workoutEditor.listPaddingY,
    paddingHorizontal: workoutEditor.listPaddingX,
    borderRadius: workoutEditor.listRadius,
  },
  add: {
    width: training.cardWidth,
    maxWidth: '100%',
    height: workoutEditor.addButton.height,
    borderRadius: workoutEditor.addButton.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: { fontSize: workoutEditor.addButton.labelSize, fontWeight: '600' },
  hint: { fontSize: workoutEditor.hintSize },
  empty: { paddingVertical: 24, textAlign: 'center', fontSize: 14 },
});
