import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { radius, spacing, typeScale } from '../theme/getTheme';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

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
  /** Schedule data is still loading — renders a spinner instead of day rows. */
  isLoading?: boolean;
  /** Disables every control (e.g. no program saved yet). */
  disabled?: boolean;
  /** Day currently being written to the API — shows an inline spinner. */
  pendingDayIndex?: number | null;
  /** Shown instead of the workout picker when `workouts` is empty. */
  emptyMessage?: string;
  errorMessage?: string | null;
  onRetry?: () => void;
  testID?: string;
}

/**
 * WeekScheduleEditor (mobile) — Story 04 counterpart of the web
 * component, with identical terminology and interaction: pick the
 * workout you're "holding", then tap days to assign it. Tapping a day
 * that already holds the selected workout clears it, and every assigned
 * day also carries an explicit clear button so clearing never depends on
 * discovering that toggle.
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
  testID = 'week-schedule-editor',
}: WeekScheduleEditorProps) {
  const theme = useTheme();
  const [announcement, setAnnouncement] = useState('');

  const workoutsById = useMemo(
    () => new Map(workouts.map((workout) => [workout.id, workout])),
    [workouts],
  );
  const selectedWorkout = selectedWorkoutId ? workoutsById.get(selectedWorkoutId) ?? null : null;
  const hasWorkouts = workouts.length > 0;

  const handleDayPress = (dayIndex: number, assignedId: string | null) => {
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
    <View style={styles.wrapper} testID={testID} accessibilityLabel="Weekly schedule">
      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: theme.text.secondary }]}>Selected workout</Text>
        {hasWorkouts ? (
          <>
            <View style={styles.chipRow}>
              {workouts.map((workout) => {
                const active = workout.id === selectedWorkoutId;
                return (
                  <Pressable
                    key={workout.id}
                    testID={`week-schedule-workout-${workout.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled }}
                    accessibilityLabel={`Select workout ${workout.name}`}
                    disabled={disabled}
                    onPress={() => onSelectWorkout(workout.id)}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: active ? theme.action.primary : theme.surface.raised,
                        borderColor: active ? theme.action.primary : theme.border.subtle,
                        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? theme.action.primaryText : theme.text.primary,
                        fontWeight: '600',
                      }}
                    >
                      {workout.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.helper, { color: theme.text.secondary }]}>
              {selectedWorkout
                ? `Tap a day to assign ${selectedWorkout.name}. Tap it again to clear that day.`
                : 'Choose a workout above, then tap the days it should run on.'}
            </Text>
          </>
        ) : (
          <Text style={[styles.helper, { color: theme.text.secondary }]}>{emptyMessage}</Text>
        )}
      </View>

      {errorMessage ? (
        <View style={styles.errorRow} accessibilityRole="alert" testID="week-schedule-error">
          <Text style={{ color: theme.status.errorText, flex: 1 }}>{errorMessage}</Text>
          {onRetry ? (
            <Button label="Retry" variant="secondary" fullWidth={false} onPress={onRetry} testID="week-schedule-retry" />
          ) : null}
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={theme.action.primary} testID="week-schedule-loading" />
      ) : (
        <View style={styles.dayList}>
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
              <View
                key={dayName}
                style={[
                  styles.dayRow,
                  {
                    backgroundColor: isAssigned ? theme.action.accentSubtle : theme.surface.raised,
                    borderColor: isAssigned ? theme.action.primary : theme.border.subtle,
                  },
                ]}
              >
                <Pressable
                  testID={`week-schedule-day-${dayIndex}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isAssigned, disabled: dayDisabled, busy: isPending }}
                  accessibilityLabel={`${dayName}: ${assignmentLabel}. Activate to ${actionHint}.`}
                  disabled={dayDisabled}
                  onPress={() => handleDayPress(dayIndex, assignedId)}
                  style={({ pressed }) => [
                    styles.dayButton,
                    { opacity: dayDisabled ? 0.6 : pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={[styles.dayName, { color: theme.text.primary }]}>{dayName}</Text>
                  <View style={styles.assignmentRow}>
                    {isPending ? <ActivityIndicator size="small" color={theme.action.primary} /> : null}
                    {/* Two-line clamp keeps long template names from pushing
                        the clear button off-screen; the full name stays in
                        the row's accessibility label. */}
                    <Text
                      numberOfLines={2}
                      style={{
                        flex: 1,
                        color: isAssigned ? theme.text.primary : theme.text.secondary,
                        fontSize: typeScale.compactBody.fontSize,
                      }}
                    >
                      {assignmentLabel}
                    </Text>
                  </View>
                </Pressable>
                {isAssigned ? (
                  <Pressable
                    testID={`week-schedule-clear-${dayIndex}`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled }}
                    accessibilityLabel={`Clear ${dayName} (currently ${assignmentLabel})`}
                    disabled={disabled}
                    hitSlop={8}
                    onPress={() => handleClear(dayIndex)}
                    style={({ pressed }) => [
                      styles.clearButton,
                      { backgroundColor: theme.surface.sunken, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
                    ]}
                  >
                    <X size={18} color={theme.text.secondary} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <Text
        accessibilityLiveRegion="polite"
        testID="week-schedule-announcement"
        style={styles.visuallyHidden}
      >
        {announcement}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing[16],
  },
  group: {
    gap: spacing[8],
  },
  groupLabel: {
    fontSize: typeScale.label.fontSize,
    fontWeight: '600',
  },
  helper: {
    fontSize: typeScale.helper.fontSize,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[16],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
  },
  dayList: {
    gap: spacing[8],
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    padding: spacing[8],
    borderRadius: radius.large,
    borderWidth: 1,
  },
  dayButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    gap: spacing[4],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[8],
  },
  dayName: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '600',
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  clearButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visuallyHidden: {
    height: 0,
    opacity: 0,
  },
});
