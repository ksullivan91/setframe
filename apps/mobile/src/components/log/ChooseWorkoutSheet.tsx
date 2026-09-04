import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DayType } from '@setframe/schemas';
import { Sheet } from '../Sheet';
import { Button } from '../Button';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, typeScale } from '../../theme/getTheme';

export interface ChooseWorkoutSheetProps {
  visible: boolean;
  workouts: DayType[];
  loading?: boolean;
  starting?: boolean;
  errorMessage?: string | null;
  /** `null` means "start an empty workout" — no template, log as you go. */
  onStart: (dayTypeId: string | null) => void;
  onCancel: () => void;
  /** Renders in the view tree rather than a Modal. Dev-log gallery only. */
  inline?: boolean;
  /**
   * Opens straight onto the confirm step for this workout.
   *
   * The gallery needs both steps side by side, and the step is internal
   * state. Unset in the app, where the picker always opens on the list.
   */
  initialSelectedId?: string;
}

/** "5 exercises · 14 sets · ~52 min", skipping whatever the workout has not set. */
function summarise(workout: DayType): string {
  const parts: string[] = [];
  const exercises = workout.exerciseCount ?? 0;
  parts.push(`${exercises} ${exercises === 1 ? 'exercise' : 'exercises'}`);
  if (workout.plannedSetCount) parts.push(`${workout.plannedSetCount} sets`);
  if (workout.estimatedDurationMinutes) parts.push(`~${workout.estimatedDurationMinutes} min`);
  return parts.join(' · ');
}

/**
 * Picking a workout for a day the program does not schedule.
 *
 * Before this, the Log hero's "Choose a workout" pushed to the Training tab —
 * which is the program *editor* (ADR 0009) and deliberately cannot start a
 * session, so tapping a workout there just listed its exercises and the
 * journey dead-ended. The choice belongs on the day you are choosing for.
 *
 * Two steps rather than one, because starting a session is not undoable from
 * the hero: picking a workout shows what you are about to commit to, and the
 * only button that actually creates a `workout_session` is the one on that
 * second screen.
 */
export function ChooseWorkoutSheet({
  visible,
  workouts,
  loading = false,
  starting = false,
  errorMessage = null,
  onStart,
  onCancel,
  inline,
  initialSelectedId,
}: ChooseWorkoutSheetProps) {
  const theme = useTheme();
  const [selected, setSelected] = useState<DayType | null>(
    () => workouts.find((workout) => workout.id === initialSelectedId) ?? null,
  );

  /* Reopening always starts at the list — a stale confirm screen for the
     workout you picked last time is the wrong thing to land on. */
  useEffect(() => {
    if (!visible) setSelected(null);
  }, [visible]);

  const cancelStep = () => (selected ? setSelected(null) : onCancel());

  return (
    <Sheet
      inline={inline}
      visible={visible}
      onRequestClose={cancelStep}
      dismissOnBackdropPress
      backdropTestID="choose-workout-backdrop"
      gap={spacing[16]}
      padding={{ top: spacing[24], bottom: spacing[24], left: spacing[24], right: spacing[24] }}
    >
      {selected ? (
        <>
          <Text testID="choose-workout-confirm-title" style={[styles.title, { color: theme.text.primary }]}>
            Start {selected.name}?
          </Text>
          <Text style={[styles.body, { color: theme.text.secondary }]}>
            You can add, skip or change anything once it is running.
          </Text>

          <View style={[styles.summary, { backgroundColor: theme.inverse.surface }]}>
            <Text style={[styles.summaryName, { color: theme.inverse.text }]}>{selected.name}</Text>
            <View style={styles.stats}>
              {[
                [String(selected.exerciseCount ?? 0), 'exercises'],
                [selected.plannedSetCount ? String(selected.plannedSetCount) : '—', 'planned sets'],
                [selected.estimatedDurationMinutes ? `~${selected.estimatedDurationMinutes}` : '—', 'minutes'],
              ].map(([value, label]) => (
                <View key={label} style={styles.stat}>
                  <Text style={[styles.statValue, { color: theme.inverse.text }]}>{value}</Text>
                  <Text style={[styles.statLabel, { color: theme.inverse.textMuted }]}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          {errorMessage ? (
            <Text style={[styles.error, { color: theme.status.errorText }]}>{errorMessage}</Text>
          ) : null}

          <Button
            testID="choose-workout-confirm"
            label="Start workout"
            onPress={() => onStart(selected.id)}
            loading={starting}
          />
          <Button testID="choose-workout-back" label="Cancel" variant="secondary" onPress={cancelStep} />
        </>
      ) : (
        <>
          <Text style={[styles.title, { color: theme.text.primary }]}>Choose a workout</Text>
          <Text style={[styles.body, { color: theme.text.secondary }]}>
            Nothing is scheduled, so pick whatever you feel like doing. It still lands on this day&rsquo;s record.
          </Text>

          {loading ? (
            <ActivityIndicator testID="choose-workout-loading" color={theme.action.primary} />
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {workouts.map((workout) => (
                <Pressable
                  key={workout.id}
                  testID={`choose-workout-option-${workout.id}`}
                  accessibilityRole="button"
                  onPress={() => setSelected(workout)}
                  style={[styles.option, { backgroundColor: theme.surface.canvas }]}
                >
                  <View style={styles.optionText}>
                    <Text style={[styles.optionName, { color: theme.text.primary }]}>{workout.name}</Text>
                    <Text style={[styles.optionMeta, { color: theme.text.secondary }]}>{summarise(workout)}</Text>
                  </View>
                  <Text style={[styles.chevron, { color: theme.text.secondary }]}>›</Text>
                </Pressable>
              ))}
              {workouts.length === 0 ? (
                <Text testID="choose-workout-empty" style={[styles.body, { color: theme.text.secondary }]}>
                  You have not built any workouts yet. Start an empty one and log as you go, or build a
                  program on the Training tab.
                </Text>
              ) : null}
            </ScrollView>
          )}

          {errorMessage ? (
            <Text style={[styles.error, { color: theme.status.errorText }]}>{errorMessage}</Text>
          ) : null}

          <Button
            testID="choose-workout-empty-session"
            label="Start an empty workout"
            variant="secondary"
            onPress={() => onStart(null)}
            loading={starting}
          />
          <Pressable testID="choose-workout-cancel" accessibilityRole="button" onPress={onCancel} style={styles.cancel}>
            <Text style={[styles.cancelLabel, { color: theme.text.secondary }]}>Cancel</Text>
          </Pressable>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typeScale.pageTitle.fontSize, fontWeight: '600' },
  body: { fontSize: typeScale.compactBody.fontSize, lineHeight: 19 },
  error: { fontSize: typeScale.label.fontSize, fontWeight: '500' },
  /* Capped so a long workout list scrolls inside the sheet rather than
     pushing the buttons under the fold. */
  list: { maxHeight: 320 },
  listContent: { gap: spacing[8] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.small,
    paddingVertical: spacing[16],
    paddingHorizontal: spacing[16],
  },
  optionText: { flex: 1, gap: spacing[4] },
  optionName: { fontSize: typeScale.compactBody.fontSize, fontWeight: '500' },
  optionMeta: { fontSize: typeScale.caption.fontSize },
  chevron: { fontSize: typeScale.compactBody.fontSize, fontWeight: '500' },
  summary: { gap: spacing[12], borderRadius: radius.small, padding: spacing[16] },
  summaryName: { fontSize: typeScale.pageTitle.fontSize, fontWeight: '600' },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, gap: spacing[4] },
  statValue: { fontSize: typeScale.body.fontSize, fontWeight: '600' },
  statLabel: { fontSize: typeScale.caption.fontSize },
  cancel: { alignItems: 'center', paddingVertical: spacing[12] },
  cancelLabel: { fontSize: typeScale.compactBody.fontSize, fontWeight: '500' },
});
