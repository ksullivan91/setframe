import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BlockProgress } from '@setframe/domain';
import { training } from '@setframe/design-tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { Card, CardLabel } from './TrainingCards';

/**
 * "Your plan". Counterpart of
 * `apps/web/src/components/training-v2/ActiveProgramCard.tsx`.
 *
 * The progress bar is the figure the old Training page never showed at all:
 * `cycle_length_weeks` has always been in the schema and nothing said
 * "week 3 of 8".
 */

export interface ActiveProgramCardProps {
  programName: string;
  meta: string;
  progress: BlockProgress;
  onChange?: () => void;
}

export function ActiveProgramCard({
  programName,
  meta,
  progress,
  onChange,
}: ActiveProgramCardProps) {
  const theme = useTheme();

  return (
    <Card testID="active-program-card">
      <CardLabel>Your plan</CardLabel>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={[styles.name, { color: theme.text.primary }]} numberOfLines={1}>
            {programName}
          </Text>
          <Text style={[styles.meta, { color: theme.text.secondary }]}>{meta}</Text>
        </View>
        <Pressable
          onPress={onChange}
          accessibilityRole="button"
          testID="change-program"
          style={[styles.change, { backgroundColor: theme.surface.sunken }]}
        >
          <Text style={[styles.changeLabel, { color: theme.text.primary }]}>Change</Text>
        </Pressable>
      </View>
      {/* Perpetual mode has no bar at all — a plan that repeats forever has
          nothing to be part-way through. */}
      {progress.ratio == null ? null : (
        <View
          style={[styles.track, { backgroundColor: theme.surface.sunken }]}
          accessibilityRole="progressbar"
          accessibilityLabel={progress.label}
          testID="block-progress"
        >
          <View
            style={[
              styles.fill,
              { backgroundColor: theme.action.primary, width: `${Math.round(progress.ratio * 100)}%` },
            ]}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  left: { flex: 1, gap: 2 },
  name: { fontSize: training.activeProgram.nameSize, fontWeight: '600' },
  meta: { fontSize: training.activeProgram.metaSize },
  change: {
    height: training.activeProgram.buttonHeight,
    paddingHorizontal: training.activeProgram.buttonPaddingX,
    borderRadius: training.activeProgram.buttonRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeLabel: { fontSize: training.activeProgram.buttonLabelSize, fontWeight: '500' },
  track: {
    width: '100%',
    height: training.activeProgram.trackHeight,
    borderRadius: training.activeProgram.trackRadius,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: training.activeProgram.trackRadius },
});
