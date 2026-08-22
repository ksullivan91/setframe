import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { X } from 'lucide-react';
import { radius, spacing } from '@setframe/design-tokens';
import { mq } from '../theme/breakpoints';
import { typeScale } from '../theme/typeScale';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { ProgressRing } from './ProgressRing';
import { Skeleton, SkeletonStack } from './Skeleton';

/** Sunday-first, matching `ProgramScheduleSlot.dayIndex` (0 = Sunday). */
export const WEEK_DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const REST_LABEL = 'Rest / unassigned';

export interface ScheduleWorkoutOption {
  /** `dayTypeId` of the workout template. */
  id: string;
  name: string;
}

export interface WeekScheduleEditorProps {
  /** Workout templates the user can assign to days. */
  workouts: ScheduleWorkoutOption[];
  /** dayIndex (0 = Sunday) → assigned workout id, or null/undefined for a rest day. */
  assignmentsByDay: Record<number, string | null | undefined>;
  /** Workout currently "held" by the user; tapping a day assigns this one. */
  selectedWorkoutId: string | null;
  onSelectWorkout: (workoutId: string) => void;
  onAssignDay: (dayIndex: number, workoutId: string) => void;
  onClearDay: (dayIndex: number) => void;
  /** Schedule data is still loading — renders skeleton day rows. */
  isLoading?: boolean;
  /** Disables every control (e.g. no program saved yet). */
  disabled?: boolean;
  /** Day currently being written to the API — shows an inline spinner. */
  pendingDayIndex?: number | null;
  /** Shown instead of the workout picker when `workouts` is empty. */
  emptyMessage?: string;
  errorMessage?: string | null;
  onRetry?: () => void;
  className?: string;
}

const Wrapper = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
`;

const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]}px;
`;

const GroupLabel = styled.h3`
  margin: 0;
  font-size: ${typeScale.label.fontSize}px;
  line-height: ${typeScale.label.lineHeight}px;
  font-weight: ${typeScale.label.fontWeight};
  color: ${(p) => p.theme.text.secondary};
`;

const Helper = styled.p`
  margin: 0;
  font-size: ${typeScale.helper.fontSize}px;
  line-height: ${typeScale.helper.lineHeight}px;
  color: ${(p) => p.theme.text.secondary};
`;

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing[8]}px;
`;

const Chip = styled.button<{ $active: boolean }>`
  min-height: 44px;
  padding: ${spacing[8]}px ${spacing[16]}px;
  border-radius: ${radius.full}px;
  border: 1px solid ${(p) => (p.$active ? p.theme.action.primary : p.theme.border.subtle)};
  background: ${(p) => (p.$active ? p.theme.action.primary : p.theme.surface.raised)};
  color: ${(p) => (p.$active ? p.theme.action.primaryText : p.theme.text.primary)};
  font-size: ${typeScale.button.fontSize}px;
  font-weight: ${typeScale.button.fontWeight};
  cursor: pointer;
  /* Long template names must stay legible rather than force a horizontal
     scroller on a phone — wrap instead of shrinking the chip. */
  max-width: 100%;
  overflow-wrap: anywhere;
  text-align: left;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.action.primary};
    outline-offset: 2px;
  }
`;

/**
 * Mobile-first: one full-width day row per line so neither the weekday
 * nor the assignment can clip. Wider viewports get a readable multi-column
 * grid (never seven squeezed columns) — the row itself is unchanged, so
 * behaviour and copy stay identical across breakpoints.
 */
const DayList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: ${spacing[8]}px;

  ${mq.tablet} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  ${mq.desktop} {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }
`;

const DayRow = styled.li<{ $active: boolean }>`
  display: flex;
  align-items: stretch;
  gap: ${spacing[8]}px;
  padding: ${spacing[8]}px;
  border-radius: ${radius.large}px;
  border: 1px solid ${(p) => (p.$active ? p.theme.action.primary : p.theme.border.subtle)};
  background: ${(p) => (p.$active ? p.theme.action.accentSubtle : p.theme.surface.raised)};
`;

const DayButton = styled.button`
  flex: 1;
  min-width: 0;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: ${spacing[4]}px;
  padding: ${spacing[8]}px;
  border: none;
  border-radius: ${radius.small}px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.action.primary};
    outline-offset: 2px;
  }
`;

const DayName = styled.span`
  font-size: ${typeScale.body.fontSize}px;
  font-weight: 600;
  color: ${(p) => p.theme.text.primary};
`;

const Assignment = styled.span<{ $assigned: boolean }>`
  width: 100%;
  min-width: 0;
  font-size: ${typeScale.compactBody.fontSize}px;
  color: ${(p) => (p.$assigned ? p.theme.text.primary : p.theme.text.secondary)};
  /* Deliberate two-line clamp: the full name stays available via the
     button title attribute and accessible name, so nothing is silently
     lost. */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
`;

const Pending = styled.span`
  display: inline-flex;
  align-items: center;
  padding-right: ${spacing[4]}px;
`;

const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;

const ErrorRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[12]}px;
  color: ${(p) => p.theme.status.error};
  font-size: ${typeScale.helper.fontSize}px;
`;

/**
 * WeekScheduleEditor — Story 04. Replaces the seven-across day grid (and
 * the per-day `<Select>` variant in the wizard) with one mobile-first
 * interaction shared by every schedule surface: pick the workout you're
 * "holding", then tap days to assign it.
 *
 * Click semantics preserve the existing full-editor behaviour — tapping a
 * day already holding the selected workout clears it — while adding an
 * explicit clear button so clearing never depends on discovering the
 * toggle.
 */
export function WeekScheduleEditor({
  workouts,
  assignmentsByDay,
  selectedWorkoutId,
  onSelectWorkout,
  onAssignDay,
  onClearDay,
  isLoading = false,
  disabled = false,
  pendingDayIndex = null,
  emptyMessage = 'Create a workout first, then assign it to days.',
  errorMessage = null,
  onRetry,
  className,
}: WeekScheduleEditorProps) {
  const [announcement, setAnnouncement] = useState('');

  const workoutsById = useMemo(
    () => new Map(workouts.map((workout) => [workout.id, workout])),
    [workouts],
  );
  const selectedWorkout = selectedWorkoutId ? workoutsById.get(selectedWorkoutId) ?? null : null;
  const hasWorkouts = workouts.length > 0;

  const handleDayClick = (dayIndex: number, assignedId: string | null) => {
    const dayName = WEEK_DAY_NAMES[dayIndex]!;
    if (assignedId && assignedId === selectedWorkoutId) {
      onClearDay(dayIndex);
      setAnnouncement(`${dayName} cleared. Now ${REST_LABEL}.`);
      return;
    }
    if (!selectedWorkoutId || !selectedWorkout) return;
    onAssignDay(dayIndex, selectedWorkoutId);
    setAnnouncement(`${dayName} assigned to ${selectedWorkout.name}.`);
  };

  const handleClear = (dayIndex: number) => {
    onClearDay(dayIndex);
    setAnnouncement(`${WEEK_DAY_NAMES[dayIndex]!} cleared. Now ${REST_LABEL}.`);
  };

  return (
    <Wrapper className={className} aria-label="Weekly schedule">
      <Group>
        <GroupLabel id="week-schedule-selected-workout">Selected workout</GroupLabel>
        {hasWorkouts ? (
          <>
            <ChipRow role="group" aria-labelledby="week-schedule-selected-workout">
              {workouts.map((workout) => {
                const active = workout.id === selectedWorkoutId;
                return (
                  <Chip
                    key={workout.id}
                    type="button"
                    $active={active}
                    aria-pressed={active}
                    disabled={disabled}
                    title={workout.name}
                    onClick={() => onSelectWorkout(workout.id)}
                  >
                    {workout.name}
                  </Chip>
                );
              })}
            </ChipRow>
            <Helper>
              {selectedWorkout
                ? `Tap a day to assign ${selectedWorkout.name}. Tap it again to clear that day.`
                : 'Choose a workout above, then tap the days it should run on.'}
            </Helper>
          </>
        ) : (
          <Helper>{emptyMessage}</Helper>
        )}
      </Group>

      {errorMessage ? (
        <ErrorRow role="alert">
          <span>{errorMessage}</span>
          {onRetry ? (
            <Button variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </ErrorRow>
      ) : null}

      {isLoading ? (
        <SkeletonStack aria-busy="true" aria-label="Loading schedule">
          {WEEK_DAY_NAMES.map((dayName) => (
            <Skeleton key={dayName} $height={64} />
          ))}
        </SkeletonStack>
      ) : (
        <DayList aria-label="Days of the week">
          {WEEK_DAY_NAMES.map((dayName, dayIndex) => {
            const assignedId = assignmentsByDay[dayIndex] ?? null;
            const assignedWorkout = assignedId ? workoutsById.get(assignedId) ?? null : null;
            const assignmentLabel = assignedWorkout?.name ?? (assignedId ? 'Workout' : REST_LABEL);
            const isAssigned = Boolean(assignedId);
            const isSelectedHere = Boolean(assignedId && assignedId === selectedWorkoutId);
            const isPending = pendingDayIndex === dayIndex;
            const dayDisabled = disabled || (!selectedWorkoutId && !isSelectedHere);

            const actionHint = isSelectedHere
              ? 'clear this day'
              : selectedWorkout
                ? `assign ${selectedWorkout.name}`
                : 'select a workout first';

            return (
              <DayRow key={dayName} $active={isAssigned}>
                <DayButton
                  type="button"
                  aria-pressed={isAssigned}
                  aria-busy={isPending || undefined}
                  disabled={dayDisabled}
                  title={assignmentLabel}
                  aria-label={`${dayName}: ${assignmentLabel}. Activate to ${actionHint}.`}
                  onClick={() => handleDayClick(dayIndex, assignedId)}
                >
                  <DayName>{dayName}</DayName>
                  <Assignment $assigned={isAssigned}>
                    {isPending ? (
                      <Pending>
                        <ProgressRing size={14} />
                      </Pending>
                    ) : null}
                    {assignmentLabel}
                  </Assignment>
                </DayButton>
                {isAssigned ? (
                  <IconButton
                    aria-label={`Clear ${dayName} (currently ${assignmentLabel})`}
                    disabled={disabled}
                    onClick={() => handleClear(dayIndex)}
                  >
                    <X size={16} />
                  </IconButton>
                ) : null}
              </DayRow>
            );
          })}
        </DayList>
      )}

      <VisuallyHidden role="status" aria-live="polite">
        {announcement}
      </VisuallyHidden>
    </Wrapper>
  );
}
