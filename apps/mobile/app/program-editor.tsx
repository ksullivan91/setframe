import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react-native';
import type { DayType, DayTypeExercise, Exercise, ProgramScheduleSlot, TrainingProgram } from '@setframe/schemas';
import { Card } from '../src/components/Card';
import { Badge } from '../src/components/Badge';
import { Button } from '../src/components/Button';
import { Toast } from '../src/components/Toast';
import { useApiClient } from '../src/lib/api-client';
import { summarizePrescription } from '../src/lib/prescription';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing, typeScale } from '../src/theme/getTheme';

interface DayTypeDetail extends DayType {
  exercises: DayTypeExercise[];
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * `Screen/Mobile/ProgramEditor` per style guide §14 — a lighter,
 * read-only mobile view of the active program: title/status, the
 * weekly day sequence, and one selected day's real exercise list with
 * prescriptions. Per the design doc, reorder/prescription-editing/
 * schedule-editing stay on web — mobile links out to `/training/new`
 * (guided setup) when there's no program yet, and otherwise just notes
 * that deeper edits happen on web.
 */
export default function ProgramEditorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [selectedDayTypeId, setSelectedDayTypeId] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ variant: 'success' | 'error'; message: string } | null>(null);

  const programsQuery = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.get<TrainingProgram[]>('/programs'),
  });
  const activeProgram = useMemo(
    () => programsQuery.data?.find((program) => program.isActive) ?? programsQuery.data?.[0] ?? null,
    [programsQuery.data],
  );
  // Distinct from `activeProgram`'s fallback-to-first behavior above (kept
  // so there's always something to view/select) — this is specifically
  // "does any program actually have isActive: true", so the switcher below
  // can surface a single non-active program too, not just >1 programs.
  const hasActiveProgram = programsQuery.data?.some((program) => program.isActive) ?? false;
  const selectedProgram = useMemo(
    () => programsQuery.data?.find((program) => program.id === selectedProgramId) ?? activeProgram,
    [programsQuery.data, selectedProgramId, activeProgram],
  );

  // Same fix as web (Story 24): viewing a non-active program must never
  // implicitly activate it. This only ever picks a *default* selection —
  // once on load, or if the previous selection stopped existing — and
  // never overwrites a manual selection.
  useEffect(() => {
    if (!programsQuery.data) return;
    const stillExists = programsQuery.data.some((program) => program.id === selectedProgramId);
    if (!stillExists) setSelectedProgramId(activeProgram?.id ?? programsQuery.data[0]?.id ?? null);
  }, [programsQuery.data, selectedProgramId, activeProgram]);

  const activateMutation = useMutation({
    mutationFn: (programId: string) => api.post<TrainingProgram>(`/programs/${programId}/activate`),
    onSuccess: (activated) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      setToast({ variant: 'success', message: `${activated.name} is now your active program.` });
    },
    onError: () => setToast({ variant: 'error', message: 'Could not switch your active program.' }),
  });

  const scheduleSlotsQuery = useQuery({
    queryKey: ['schedule-slots', selectedProgram?.id],
    queryFn: () => api.get<ProgramScheduleSlot[]>(`/programs/${selectedProgram?.id}/schedule-slots`),
    enabled: Boolean(selectedProgram?.id),
  });

  const dayTypesQuery = useQuery({
    queryKey: ['day-types'],
    queryFn: () => api.get<DayType[]>('/day-types'),
  });

  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.get<Exercise[]>('/exercises'),
  });

  const weekOneSlots = useMemo(
    () =>
      (scheduleSlotsQuery.data ?? [])
        .filter((slot) => slot.weekNumber === null || slot.weekNumber === 1)
        .sort((a, b) => a.dayIndex - b.dayIndex),
    [scheduleSlotsQuery.data],
  );

  const dayTypeById = useMemo(() => {
    const map = new Map<string, DayType>();
    (dayTypesQuery.data ?? []).forEach((dayType) => map.set(dayType.id, dayType));
    return map;
  }, [dayTypesQuery.data]);

  const exerciseNameById = useMemo(() => {
    const map = new Map<string, string>();
    (exercisesQuery.data ?? []).forEach((exercise) => map.set(exercise.id, exercise.name));
    return map;
  }, [exercisesQuery.data]);

  // Switching the viewed program must not leave a day selected from the
  // previous one's schedule (Story 26's "no leaking selection" rule
  // applies here too, even though this screen is read-only).
  useEffect(() => {
    setSelectedDayTypeId(null);
  }, [selectedProgram?.id]);

  useEffect(() => {
    if (!selectedDayTypeId && weekOneSlots.length > 0) {
      setSelectedDayTypeId(weekOneSlots[0]!.dayTypeId);
    }
  }, [selectedDayTypeId, weekOneSlots]);

  const selectedDayTypeDetailQuery = useQuery({
    queryKey: ['day-type', selectedDayTypeId],
    queryFn: () => api.get<DayTypeDetail>(`/day-types/${selectedDayTypeId}`),
    enabled: Boolean(selectedDayTypeId),
  });

  const isLoading = programsQuery.isLoading || dayTypesQuery.isLoading;

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.surface.canvas }]}>
        <ActivityIndicator color={theme.action.primary} />
      </View>
    );
  }

  if (programsQuery.isError || dayTypesQuery.isError) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.surface.canvas, padding: spacing[16] }]}>
        <Text style={{ color: theme.text.primary, textAlign: 'center' }}>Couldn&apos;t load your training program.</Text>
      </View>
    );
  }

  if (!activeProgram) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.surface.canvas, padding: spacing[16], gap: spacing[16] }]}>
        <Text style={{ color: theme.text.primary, textAlign: 'center', fontWeight: '600' }}>No training program yet</Text>
        <Text style={{ color: theme.text.secondary, textAlign: 'center' }}>
          Set up your first program with a few guided steps.
        </Text>
        <Button label="Start guided setup" onPress={() => router.push('/program-wizard')} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text.primary }]}>{selectedProgram?.name ?? activeProgram.name}</Text>
        <Badge
          label={selectedProgram?.isActive ? 'Active' : 'Inactive'}
          tone={selectedProgram?.isActive ? 'success' : 'neutral'}
        />
      </View>

      {/* Story 24 — only shown once there's an actual choice to make; the
          header above already makes the single-program case clear. */}
      {programsQuery.data && (programsQuery.data.length > 1 || !hasActiveProgram) ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Your programs</Text>
          {programsQuery.data.map((program) => (
            <View key={program.id} style={styles.programRow}>
              <Pressable
                onPress={() => setSelectedProgramId(program.id)}
                accessibilityRole="button"
                accessibilityLabel={`View ${program.name}`}
                style={styles.programRowName}
              >
                <Text
                  style={[
                    styles.bodyText,
                    { color: theme.text.primary, fontWeight: program.id === selectedProgram?.id ? '600' : '400' },
                  ]}
                  numberOfLines={1}
                >
                  {program.name}
                </Text>
                {program.isActive ? <Badge label="Active" tone="success" /> : null}
              </Pressable>
              <Button
                label={program.isActive ? 'Active' : 'Set active'}
                variant="secondary"
                fullWidth={false}
                disabled={program.isActive}
                loading={activateMutation.isPending && activateMutation.variables === program.id}
                onPress={() => activateMutation.mutate(program.id)}
              />
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Weekly sequence</Text>
        {weekOneSlots.length === 0 ? (
          <Text style={{ color: theme.text.secondary }}>No days scheduled yet. Set this up on web.</Text>
        ) : (
          weekOneSlots.map((slot) => {
            const dayType = dayTypeById.get(slot.dayTypeId);
            const isSelected = slot.dayTypeId === selectedDayTypeId;
            return (
              <Pressable
                key={slot.id}
                onPress={() => setSelectedDayTypeId(slot.dayTypeId)}
                style={[
                  styles.dayRow,
                  isSelected ? { backgroundColor: theme.action.accentSubtle, borderRadius: spacing[8] } : null,
                ]}
              >
                <Text style={{ color: theme.text.secondary, width: 40 }}>{dayNames[slot.dayIndex]}</Text>
                <Text style={{ color: theme.text.primary, flex: 1 }}>{dayType?.name ?? 'Workout'}</Text>
                <ChevronRight size={16} color={theme.text.secondary} />
              </Pressable>
            );
          })
        )}
      </Card>

      {selectedDayTypeId ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
            {dayTypeById.get(selectedDayTypeId)?.name ?? 'Workout'}
          </Text>
          {selectedDayTypeDetailQuery.isLoading ? (
            <ActivityIndicator color={theme.action.primary} />
          ) : selectedDayTypeDetailQuery.isError ? (
            <Text style={{ color: theme.text.secondary }}>Couldn&apos;t load this workout&apos;s exercises.</Text>
          ) : (selectedDayTypeDetailQuery.data?.exercises.length ?? 0) === 0 ? (
            <Text style={{ color: theme.text.secondary }}>No exercises added to this workout yet.</Text>
          ) : (
            selectedDayTypeDetailQuery.data!.exercises
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((exercise) => (
                <View key={exercise.id} style={styles.exerciseRow}>
                  <Text style={{ color: theme.text.primary }}>
                    {exerciseNameById.get(exercise.exerciseId) ?? 'Exercise'}
                  </Text>
                  <Text style={{ color: theme.text.secondary, fontSize: typeScale.caption.fontSize }}>
                    {summarizePrescription(exercise.prescription)}
                  </Text>
                </View>
              ))
          )}
        </Card>
      ) : null}

      <Text style={[styles.editNote, { color: theme.text.secondary }]}>
        Edit on web for reorder, prescriptions, schedule changes, and planning or correcting rest days.
      </Text>

      {toast ? <Toast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[16],
    gap: spacing[16],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[4],
  },
  exerciseRow: {
    gap: spacing[4],
    paddingVertical: spacing[4],
  },
  editNote: {
    fontSize: typeScale.caption.fontSize,
    textAlign: 'center',
  },
  bodyText: {
    fontSize: typeScale.compactBody.fontSize,
  },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[8],
    paddingVertical: spacing[8],
  },
  programRowName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    flex: 1,
    minWidth: 0,
  },
});
