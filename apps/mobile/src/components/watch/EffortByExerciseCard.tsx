import { View, Text, StyleSheet, Pressable } from 'react-native';
import { effortChart, spacing } from '@setframe/design-tokens';
import type { ExerciseEffort } from '@setframe/domain';
import { Card } from '../Card';
import { useTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/getTheme';

/**
 * Average and peak heart rate per lift. Figma `265:2 › EffortByExerciseCard`.
 *
 * The chart that cannot exist in Apple Health, which has no set log, or in
 * a lifting app, which has no heart rate.
 *
 * One hue, so no categorical palette and nothing to fail colour-vision
 * checks: length carries the magnitude and the name carries the identity.
 */
export function EffortByExerciseCard({
  efforts,
  onSelectExercise,
}: {
  efforts: readonly ExerciseEffort[];
  onSelectExercise?: (exerciseName: string) => void;
}) {
  const theme = useTheme();
  if (efforts.length === 0) return null;

  /* Both bar and tick are drawn from 0 bpm on one scale, so the lengths are
     comparable. A truncated axis would exaggerate small differences, and
     these differences are small by nature — everything sits between about
     110 and 180. */
  const scale = Math.max(...efforts.map((e) => e.peakBpm));
  const hardest = efforts[0];
  const easiest = efforts[efforts.length - 1];

  return (
    <Card style={styles.card} testID="effort-by-exercise">
      <Text style={[styles.title, { color: theme.text.primary }]}>Effort by exercise</Text>
      <Text style={[styles.body, { color: theme.text.secondary }]}>
        Average heart rate while you were working each lift.
      </Text>

      {efforts.map((effort) => {
        const barWidth = Math.max(8, (effort.avgBpm / scale) * effortChart.maxBarWidth);
        const tickAt = (effort.peakBpm / scale) * effortChart.maxBarWidth;
        return (
          <Pressable
            key={effort.exerciseName}
            testID={`effort-row-${effort.exerciseName}`}
            accessibilityRole="button"
            accessibilityLabel={`${effort.exerciseName}, ${effort.avgBpm} average, ${effort.peakBpm} peak`}
            onPress={() => onSelectExercise?.(effort.exerciseName)}
            style={styles.row}
          >
            <View style={styles.label}>
              <Text style={[styles.name, { color: theme.text.primary }]} numberOfLines={1}>
                {effort.exerciseName}
              </Text>
              <Text style={[styles.value, { color: theme.text.secondary }]}>
                {effort.avgBpm} avg · {effort.peakBpm} peak
              </Text>
            </View>
            <View style={styles.track}>
              <View
                testID={`effort-bar-${effort.exerciseName}`}
                style={[styles.bar, { width: barWidth, backgroundColor: theme.action.primary }]}
              />
              {/* The peak, at its own position on the same axis rather than a
                  fixed offset past the bar — a tick that does not sit where
                  the number says contradicts its own label. */}
              <View style={{ width: Math.max(1, tickAt - barWidth - 2) }} />
              <View style={[styles.tick, { backgroundColor: theme.text.secondary + '80' }]} />
            </View>
          </Pressable>
        );
      })}

      {hardest && easiest && hardest !== easiest ? (
        <Text style={[styles.note, { color: theme.text.secondary }]}>
          Bar is average, tick is peak, both from 0 bpm so the lengths compare.{' '}
          {hardest.exerciseName} cost {hardest.avgBpm - easiest.avgBpm} bpm more than{' '}
          {easiest.exerciseName.toLowerCase()} — useful when ordering a session.
        </Text>
      ) : (
        <Text style={[styles.note, { color: theme.text.secondary }]}>
          Bar is average, tick is peak, both from 0 bpm so the lengths compare.
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[12] },
  title: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: typeScale.helper.fontSize, lineHeight: 17 },
  row: { gap: effortChart.rowGap },
  label: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[8] },
  name: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  value: { fontSize: 11 },
  track: { flexDirection: 'row', alignItems: 'center', height: effortChart.barHeight },
  bar: { height: effortChart.barHeight, borderRadius: effortChart.barRadius },
  tick: { width: effortChart.tickWidth, height: effortChart.barHeight },
  note: { fontSize: 11, lineHeight: 15 },
});
