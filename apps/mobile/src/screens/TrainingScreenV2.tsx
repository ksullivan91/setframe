import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { DayType, ProgramScheduleSlot, TrainingProgram } from '@setframe/schemas';
import {
  buildWeekStrip,
  describeBlockProgress,
  formatProgramMeta,
  resolveNextUp,
  type OverviewSlot,
} from '@setframe/domain';
import { training } from '@setframe/design-tokens';
import { useApiClient } from '../lib/api-client';
import { useTheme } from '../theme/ThemeProvider';
import { ActiveProgramCard } from '../components/training-v2/ActiveProgramCard';
import { WeekStrip } from '../components/training-v2/WeekStrip';
import { Card, CardAction, CardHeadRow, CardLabel, ListRow } from '../components/training-v2/TrainingCards';
import { NoPlanRoutes } from '../components/training-v2/NoPlanRoutes';
import { ListRowsSkeleton, WeekStripSkeleton } from '../components/training-v2/TrainingSkeletons';

/**
 * Training v2 — one scrollable screen, replacing three tabs.
 * Counterpart of `apps/web/src/pages/TrainingPageV2.tsx`.
 *
 * Figma: `Explore/Mobile/Training 7 · Set up, and training` (146:709).
 *
 * **Every derived figure comes from `packages/domain`**, identical to web.
 * The week strip, the next-up pill and block progress are computed once and
 * consumed by both renderers, so the two platforms cannot disagree about
 * which day is today or what is next — the divergence ADR 0009 exists
 * because of.
 */

/**
 * Creating a workout still goes through the old editor.
 *
 * Every other control now reaches its own pushed screen. Creating a *new*
 * workout is guided setup's job, which story 83 rebuilds.
 */
const MANAGE_ROUTE = '/training-manage';

function todayLocalDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function TrainingScreenV2() {
  const api = useApiClient();
  const router = useRouter();
  const theme = useTheme();
  const today = todayLocalDate();

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.get<TrainingProgram[]>('/programs'),
  });

  const activeProgram = useMemo(
    () => programs.find((p) => p.isActive) ?? programs[0] ?? null,
    [programs],
  );

  const { data: dayTypes = [], isPending: dayTypesPending } = useQuery({
    queryKey: ['program-day-types', activeProgram?.id],
    queryFn: () => api.get<DayType[]>(`/programs/${activeProgram!.id}/day-types`),
    enabled: !!activeProgram,
  });

  const { data: slots = [], isPending: slotsPending } = useQuery({
    queryKey: ['schedule-slots', activeProgram?.id],
    queryFn: () => api.get<ProgramScheduleSlot[]>(`/programs/${activeProgram!.id}/schedule-slots`),
    enabled: !!activeProgram,
  });

  const progress = useMemo(
    () =>
      describeBlockProgress({
        cycleLengthWeeks: activeProgram?.cycleLengthWeeks ?? null,
        programStartDate: activeProgram?.startDate ?? null,
        todayLocalDate: today,
      }),
    [activeProgram, today],
  );

  const overviewSlots = useMemo<OverviewSlot[]>(() => {
    const names = new Map(dayTypes.map((d) => [d.id, d.name]));
    return slots.flatMap((slot) => {
      const dayTypeName = names.get(slot.dayTypeId);
      return dayTypeName
        ? [{
            dayIndex: slot.dayIndex,
            weekNumber: slot.weekNumber,
            sortOrder: slot.sortOrder,
            dayTypeName,
          }]
        : [];
    });
  }, [slots, dayTypes]);

  const strip = useMemo(
    () =>
      buildWeekStrip({
        localDate: today,
        todayLocalDate: today,
        slots: overviewSlots,
        completedDates: [],
        restDates: [],
        cycleWeekNumber: progress.currentWeek,
      }),
    [today, overviewSlots, progress.currentWeek],
  );

  const nextUp = useMemo(() => resolveNextUp(strip, today), [strip, today]);
  const scheduledDays = useMemo(
    () => new Set(overviewSlots.map((s) => s.dayIndex)).size,
    [overviewSlots],
  );

  /**
   * Creates a real `workout_session` with a null `templateId` — which the
   * schema already permits and explicitly blesses with a comment.
   */
  const startAdHoc = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>('/workout-sessions', {
        localDate: today,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    onSuccess: (session) => router.push(`/workout/${session.id}`),
  });

  if (isLoading) return <View style={{ flex: 1, backgroundColor: theme.surface.canvas }} />;

  /* The outermost empty state — it IS the page, not a card inside it. */
  if (!activeProgram) {
    return (
      <ScrollView
        style={{ backgroundColor: theme.surface.canvas }}
        contentContainerStyle={styles.content}
        testID="training-no-plan"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text.primary }]}>Training</Text>
          <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
            Three ways in. None of them is a form you have to finish first.
          </Text>
        </View>
        <NoPlanRoutes
          onJustStart={() => startAdHoc.mutate()}
          onBuildYourOwn={() => router.push('/program-wizard')}
          busy={startAdHoc.isPending}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.surface.canvas }}
      contentContainerStyle={styles.content}
      testID="training-v2"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Training</Text>
        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
          What you are following, and what is in it.
        </Text>
      </View>

      {activeProgram ? (
        <ActiveProgramCard
          programName={activeProgram.name}
          meta={formatProgramMeta(progress, scheduledDays)}
          progress={progress}
          onChange={() => router.push('/plans')}
        />
      ) : null}

      <Card testID="this-week-card">
        <CardHeadRow>
          <CardLabel>This week</CardLabel>
          <CardAction label="Edit schedule" onPress={() => router.push('/schedule')} />
        </CardHeadRow>
        {/* Without this the strip reads every day as "Rest" while the slots
            load — it briefly tells a user with a full week that they have
            nothing scheduled. */}
        {slotsPending ? <WeekStripSkeleton /> : (
        <WeekStrip
          days={strip}
          /* Navigates only. The strip never starts a session — ADR 0009: a
             mount effect that POSTed one is what destroyed real data. */
          onSelectDay={() => router.push('/(tabs)/today')}
        />
        )}
      </Card>

      <Card testID="workouts-card">
        <CardHeadRow>
          <CardLabel>Workouts</CardLabel>
          <CardAction label="+ New" onPress={() => router.push(MANAGE_ROUTE)} />
        </CardHeadRow>
        {dayTypesPending ? (
          <ListRowsSkeleton />
        ) : dayTypes.length === 0 ? (
          <Text style={[styles.empty, { color: theme.text.secondary }]}>
            Nothing in this plan yet. A workout is a training day you can put on the calendar
            and repeat.
          </Text>
        ) : (
          dayTypes.map((dayType, index) => (
            <ListRow
              key={dayType.id}
              name={dayType.name}
              meta={formatWorkoutMeta(dayType)}
              badge={nextUp?.workoutName === dayType.name ? 'Next up' : undefined}
              divided={index > 0}
              testID={`workout-row-${dayType.id}`}
              onPress={() => router.push(`/workout-editor?dayTypeId=${dayType.id}`)}
            />
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function formatWorkoutMeta(dayType: DayType): string {
  const segments: string[] = [];
  const count = dayType.exerciseCount ?? null;
  if (count != null) segments.push(count === 1 ? '1 exercise' : `${count} exercises`);
  if (dayType.estimatedDurationMinutes) segments.push(`~${dayType.estimatedDurationMinutes} min`);
  return segments.join(' · ');
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: training.bodyPaddingX,
    paddingBottom: training.bodyPaddingBottom,
    gap: training.cardGap,
  },
  header: {
    paddingTop: training.header.paddingTop,
    paddingBottom: training.header.paddingBottom - training.cardGap,
    gap: training.header.gap,
  },
  title: { fontSize: training.header.titleSize, fontWeight: '600' },
  subtitle: { fontSize: training.header.subtitleSize },
  empty: { fontSize: 13, paddingVertical: 4 },
});
