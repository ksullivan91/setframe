import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import styled from 'styled-components';
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
import { ActiveProgramCard } from '../components/training-v2/ActiveProgramCard';
import { WeekStrip } from '../components/training-v2/WeekStrip';
import { Card, CardAction, CardHeadRow, CardLabel, ListRow } from '../components/training-v2/TrainingCards';
import { NoPlanRoutes } from '../components/training-v2/NoPlanRoutes';

/**
 * Training v2 — one scrollable page, replacing three tabs.
 *
 * Figma: `Explore/Mobile/Training 7 · Set up, and training` (146:709).
 * Spec: `docs/design/training-page-exploration.md`.
 *
 * The page it replaces had three tabs named after tables — Programs,
 * Workouts, Schedule map one-to-one onto `training_program`, `day_type` and
 * `program_schedule_slot` — so the user had to pick which part of our data
 * model they wanted before they could do anything. This answers the three
 * questions in the order people actually ask them: what am I following, what
 * is this week, what is in it.
 *
 * **Every derived figure comes from `packages/domain`**, not from this file.
 * The week strip, the next-up pill and the block progress are shared with
 * mobile, which renders the identical state with different primitives.
 */

/* AppShell's <Content> already applies the 16px screen padding, so this page
   must not add its own or a 358px card renders at 326. */
const Screen = styled.div`
  display: flex;
  flex-direction: column;
`;

const Header = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${training.header.gap}px;
  padding: ${training.header.paddingTop - 16}px 0 ${training.header.paddingBottom}px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${training.header.titleSize}px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.primary};
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: ${training.header.subtitleSize}px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${training.cardGap}px;
  padding-bottom: ${training.bodyPaddingBottom}px;
`;

const Empty = styled.p`
  margin: 0;
  padding: 4px 0;
  font-size: 13px;
  color: ${({ theme }) => theme.text.secondary};
`;

/**
 * Creating a workout still goes through the old editor.
 *
 * Every other control now reaches its own pushed screen (stories 79-81).
 * Creating a *new* workout is guided setup's job, which story 83 rebuilds —
 * until then this lands on the editor that already works, because a
 * live-looking control that 404s is worse than one that goes somewhere plain.
 */
const MANAGE_ROUTE = '/training/manage';

interface TodayResponse {
  localDate: string;
}

function todayLocalDate(): string {
  /* The browser's own calendar day. The API is authoritative for a session's
     `local_date`, but the strip only needs to know which chip is today. */
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export default function TrainingPageV2() {
  const api = useApiClient();
  const navigate = useNavigate();
  const today = todayLocalDate();

  const { data: programs = [], isLoading: programsLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.get<TrainingProgram[]>('/programs'),
  });

  const activeProgram = useMemo(
    () => programs.find((p) => p.isActive) ?? programs[0] ?? null,
    [programs],
  );

  const { data: dayTypes = [] } = useQuery({
    queryKey: ['program-day-types', activeProgram?.id],
    queryFn: () => api.get<DayType[]>(`/programs/${activeProgram!.id}/day-types`),
    enabled: !!activeProgram,
  });

  const { data: slots = [] } = useQuery({
    queryKey: ['schedule-slots', activeProgram?.id],
    queryFn: () => api.get<ProgramScheduleSlot[]>(`/programs/${activeProgram!.id}/schedule-slots`),
    enabled: !!activeProgram,
  });

  const { data: todayData } = useQuery({
    queryKey: ['dashboard-today', today],
    queryFn: () => api.get<TodayResponse>(`/dashboard/today?localDate=${today}`),
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

  /* Slots carry a dayTypeId; the strip needs names. Resolving here rather
     than in the domain keeps that module free of any fetching concern. */
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

  /** Days of the week with at least one workout on them. */
  const scheduledDays = useMemo(
    () => new Set(overviewSlots.map((s) => s.dayIndex)).size,
    [overviewSlots],
  );

  /**
   * "Just start training" creates a real `workout_session` with a null
   * `templateId` — which the schema already permits, and explicitly blesses
   * with a comment. Not a special mode, not a scratchpad.
   */
  const startAdHoc = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>('/workout-sessions', {
        localDate: today,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    onSuccess: (session) => navigate(`/workout/${session.id}`),
  });

  if (programsLoading) return <Screen aria-busy="true" />;

  /* The outermost empty state: a user here cannot reach any of the others.
     It is not a card inside the page — it IS the page. */
  if (!activeProgram) {
    return (
      <Screen data-testid="training-no-plan">
        <Header>
          <Title>Training</Title>
          <Subtitle>Three ways in. None of them is a form you have to finish first.</Subtitle>
        </Header>
        <Body>
          <NoPlanRoutes
            onJustStart={() => startAdHoc.mutate()}
            onBuildYourOwn={() => navigate('/training/new')}
            busy={startAdHoc.isPending}
          />
        </Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header>
        <Title>Training</Title>
        <Subtitle>What you are following, and what is in it.</Subtitle>
      </Header>

      <Body>
        {activeProgram ? (
          <ActiveProgramCard
            programName={activeProgram.name}
            meta={formatProgramMeta(progress, scheduledDays)}
            progress={progress}
            onChange={() => navigate('/training/plans')}
          />
        ) : null}

        <Card data-testid="this-week-card">
          <CardHeadRow>
            <CardLabel>This week</CardLabel>
            <CardAction onClick={() => navigate('/training/schedule')}>Edit schedule</CardAction>
          </CardHeadRow>
          <WeekStrip
            days={strip}
            onSelectDay={(day) => {
              /* Today opens the logger; any other day opens that date. The
                 strip never starts a session itself — ADR 0009: a mount
                 effect that POSTed a session is what destroyed real data. */
              navigate(day.localDate === today ? '/today' : `/today?date=${day.localDate}`);
            }}
          />
        </Card>

        <Card data-testid="workouts-card">
          <CardHeadRow>
            <CardLabel>Workouts</CardLabel>
            <CardAction onClick={() => navigate(MANAGE_ROUTE)}>+ New</CardAction>
          </CardHeadRow>
          {dayTypes.length === 0 ? (
            /* "A plan with no workouts" — the most common way to meet an
               empty Training page, and until now a card with nothing in it. */
            <Empty>
              Nothing in this plan yet. A workout is a training day you can put on the calendar and
              repeat.
            </Empty>
          ) : (
            dayTypes.map((dayType, index) => (
              <ListRow
                key={dayType.id}
                name={dayType.name}
                meta={formatWorkoutMeta(dayType)}
                badge={nextUp?.workoutName === dayType.name ? 'Next up' : undefined}
                divided={index > 0}
                testId={`workout-row-${dayType.id}`}
                onClick={() => navigate(`/training/workouts/${dayType.id}`)}
              />
            ))
          )}
        </Card>
      </Body>
    </Screen>
  );
}

function formatWorkoutMeta(dayType: DayType): string {
  const segments: string[] = [];
  const count = dayType.exerciseCount ?? null;
  if (count != null) segments.push(count === 1 ? '1 exercise' : `${count} exercises`);
  if (dayType.estimatedDurationMinutes) {
    segments.push(`~${dayType.estimatedDurationMinutes} min`);
  }
  return segments.join(' · ');
}
