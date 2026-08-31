import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DayType, ProgramScheduleSlot, TrainingProgram } from '@setframe/schemas';
import { buildScheduleDays, describeRepeatMode, type OverviewSlot } from '@setframe/domain';
import { training, workoutEditor } from '@setframe/design-tokens';
import { useApiClient } from '../lib/api-client';
import { useScreenTopPadding } from '../lib/useScreenInsets';
import { useTheme } from '../theme/ThemeProvider';
import { Card, CardLabel } from '../components/training-v2/TrainingCards';
import { AssignDaySheet } from '../components/training-v2/AssignDaySheet';
import { ScheduleDaysSkeleton } from '../components/training-v2/TrainingSkeletons';
import { useActionFeedback } from '../lib/useActionFeedback';

/**
 * The weekly schedule. Counterpart of `apps/web/src/pages/SchedulePage.tsx`.
 *
 * Figma: `Explore/Mobile/Training 5 · Plan the week` (150:708).
 *
 * Surfaces `cycle_length_weeks`, which has always been in the schema and has
 * never been shown anywhere. Nothing here touches a logged session —
 * rescheduling changes intent (ADR 0005).
 */
export function ScheduleScreen() {
  const api = useApiClient();
  const feedback = useActionFeedback();
  const router = useRouter();
  const theme = useTheme();
  /* These screens draw their own header with `headerShown: false`, so
     nothing reserves space for the status bar or the Dynamic Island — the
     header, including its back chevron, rendered underneath both and could
     not be tapped. `useScreenTopPadding` already existed for exactly this
     and had simply never been wired into the v2 screens. */
  const topPadding = useScreenTopPadding(workoutEditor.header.paddingTop);
  const queryClient = useQueryClient();
  const [assigning, setAssigning] = useState<number | null>(null);

  const { data: programs = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.get<TrainingProgram[]>('/programs'),
  });
  const program = useMemo(
    () => programs.find((p) => p.isActive) ?? programs[0] ?? null,
    [programs],
  );

  const { data: dayTypes = [] } = useQuery({
    queryKey: ['program-day-types', program?.id],
    queryFn: () => api.get<DayType[]>(`/programs/${program!.id}/day-types`),
    enabled: !!program,
  });

  const { data: slots = [], isPending: slotsPending } = useQuery({
    queryKey: ['schedule-slots', program?.id],
    queryFn: () => api.get<ProgramScheduleSlot[]>(`/programs/${program!.id}/schedule-slots`),
    enabled: !!program,
  });

  const assignDay = useMutation({
    mutationFn: async ({ dayIndex, dayTypeIds }: { dayIndex: number; dayTypeIds: string[] }) => {
      /* Rest is the absence of a slot — dayTypeId is NOT NULL, so clearing a
         day deletes its rows rather than writing one pointing nowhere. */
      for (const slot of slots.filter((s) => s.dayIndex === dayIndex)) {
        await api.del(`/programs/${program!.id}/schedule-slots/${slot.id}`);
      }
      for (const [index, dayTypeId] of dayTypeIds.entries()) {
        await api.post(`/programs/${program!.id}/schedule-slots`, {
          dayTypeId,
          dayIndex,
          sortOrder: index,
          weekNumber: null,
        });
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['schedule-slots', program?.id] }),
  
    onError: feedback.report('Could not change that day. Try again.'),
  });

  const overviewSlots = useMemo<OverviewSlot[]>(() => {
    const names = new Map(dayTypes.map((d) => [d.id, d.name]));
    return slots.flatMap((slot) => {
      const dayTypeName = names.get(slot.dayTypeId);
      return dayTypeName
        ? [{ dayIndex: slot.dayIndex, weekNumber: slot.weekNumber, sortOrder: slot.sortOrder, dayTypeName }]
        : [];
    });
  }, [slots, dayTypes]);

  const days = useMemo(() => buildScheduleDays(overviewSlots), [overviewSlots]);
  const isBlock = !!program?.cycleLengthWeeks;

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface.canvas }} testID="schedule-page">
      <View style={[styles.header, { backgroundColor: theme.surface.raised, paddingTop: topPadding }]}>
        <View style={styles.titleRow}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Back to Training">
            <Text style={[styles.back, { color: theme.text.secondary }]}>‹</Text>
          </Pressable>
          <Text style={[styles.title, { color: theme.text.primary }]}>Schedule</Text>
        </View>
        <Text style={[styles.meta, { color: theme.text.secondary }]}>
          {program?.name ?? 'Your plan'} · {describeRepeatMode(program?.cycleLengthWeeks ?? null)}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Card testID="repeat-mode-card">
          <CardLabel>Repeats</CardLabel>
          <View style={styles.modeRow}>
            <View
              testID="mode-perpetual"
              style={[
                styles.modeChip,
                { backgroundColor: isBlock ? theme.surface.sunken : theme.action.primary },
              ]}
            >
              <Text
                style={[
                  styles.modeLabel,
                  { color: isBlock ? theme.text.primary : theme.action.primaryText },
                ]}
              >
                Every week
              </Text>
            </View>
            <View
              testID="mode-block"
              style={[
                styles.modeChip,
                { backgroundColor: isBlock ? theme.action.primary : theme.surface.sunken },
              ]}
            >
              <Text
                style={[
                  styles.modeLabel,
                  { color: isBlock ? theme.action.primaryText : theme.text.primary },
                ]}
              >
                {isBlock ? `As a ${program!.cycleLengthWeeks}-week block` : 'As a block'}
              </Text>
            </View>
          </View>
        </Card>

        <Card testID="weekly-template-card">
          <CardLabel>Each week</CardLabel>
          {/* Every day would read "Rest" while the slots load — a claim,
              not an absence. */}
          {slotsPending ? <ScheduleDaysSkeleton /> : days.map((day, index) => (
            <Pressable
              key={day.dayIndex}
              onPress={() => setAssigning(day.dayIndex)}
              accessibilityRole="button"
              testID={`schedule-day-${day.dayIndex}`}
              style={[
                styles.dayRow,
                index > 0 && { borderTopWidth: 1, borderTopColor: theme.border.subtle },
              ]}
            >
              <Text style={[styles.dayName, { color: theme.text.primary }]}>{day.dayName}</Text>
              <View style={styles.dayRight}>
                <Text style={[styles.daySummary, { color: theme.text.secondary }]} numberOfLines={1}>
                  {day.summary}
                </Text>
                <Text style={[styles.chevron, { color: theme.text.secondary }]}>›</Text>
              </View>
            </Pressable>
          ))}
        </Card>

        <Card testID="overrides-card">
          <CardLabel>Changes to specific days</CardLabel>
          {/* The distinction users most often get wrong, stated before they
              can act on it. */}
          <Text style={[styles.help, { color: theme.text.secondary }]}>
            Swapping one date does not change the weekly pattern above.
          </Text>
        </Card>
      </ScrollView>

      {assigning != null ? (
        <AssignDaySheet
          dayName={days.find((d) => d.dayIndex === assigning)!.dayName}
          dayTypes={dayTypes}
          selectedIds={slots
            .filter((slot) => slot.dayIndex === assigning)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((slot) => slot.dayTypeId)}
          onClose={() => setAssigning(null)}
          onChange={(dayTypeIds) => assignDay.mutate({ dayIndex: assigning, dayTypeIds })}
        />
      ) : null}
      {feedback.node}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: workoutEditor.header.paddingTop,
    paddingBottom: workoutEditor.header.paddingBottom,
    paddingHorizontal: 12,
    gap: workoutEditor.header.gap,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { fontSize: workoutEditor.header.backSize, fontWeight: '600', width: 24 },
  title: { fontSize: workoutEditor.header.titleSize, fontWeight: '600' },
  meta: { fontSize: workoutEditor.header.metaSize, paddingLeft: 4 },
  body: { padding: training.bodyPaddingX, gap: training.cardGap },
  modeRow: { flexDirection: 'row', gap: 6 },
  modeChip: { height: 34, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modeLabel: { fontSize: 13, fontWeight: '500' },
  dayRow: {
    height: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dayName: { fontSize: 15, fontWeight: '500' },
  dayRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  daySummary: { fontSize: 13, flexShrink: 1 },
  chevron: { fontSize: 16, fontWeight: '600' },
  help: { fontSize: 12 },
});
