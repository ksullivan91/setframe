import { Pressable, StyleSheet, Text, View } from 'react-native';
import { workoutEditor } from '@setframe/design-tokens';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * One exercise inside the workout editor. Counterpart of
 * `apps/web/src/components/training-v2/WorkoutExerciseRow.tsx`.
 *
 * A 334px row inside a 358px card — the card's 12px padding, narrower than an
 * overview card's 14, is what makes those two numbers meet.
 */

export interface WorkoutExerciseRowProps {
  rowId: string;
  name: string;
  meta: string;
  /** `3 × 8`, or null when nothing is planned (story 19). */
  planLabel: string | null;
  divided: boolean;
  onOpenActions: () => void;
}

export function WorkoutExerciseRow({
  rowId,
  name,
  meta,
  planLabel,
  divided,
  onOpenActions,
}: WorkoutExerciseRowProps) {
  const theme = useTheme();
  return (
    <View
      testID={`editor-row-${rowId}`}
      style={[
        styles.row,
        divided && { borderTopWidth: 1, borderTopColor: theme.border.subtle },
      ]}
    >
      <Text style={[styles.grip, { color: theme.text.disabled }]}>⠿</Text>
      <View style={[styles.tile, { backgroundColor: theme.surface.sunken }]}>
        <Text style={[styles.tileLabel, { color: theme.text.secondary }]}>{initials(name)}</Text>
      </View>
      <View style={styles.text}>
        <Text style={[styles.name, { color: theme.text.primary }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.meta, { color: theme.text.secondary }]}>{meta}</Text>
      </View>
      {/* Absent rather than "—" when nothing is planned: a blank target is
          legitimate, and a dash reads like a missing value. */}
      {planLabel ? (
        <View style={[styles.pill, { backgroundColor: theme.action.accentSubtle }]}>
          <Text style={[styles.pillLabel, { color: theme.action.primary }]}>{planLabel}</Text>
        </View>
      ) : null}
      <Pressable
        onPress={onOpenActions}
        accessibilityRole="button"
        accessibilityLabel={`Actions for ${name}`}
        testID={`editor-actions-${rowId}`}
        style={styles.more}
      >
        <Text style={[styles.moreGlyph, { color: theme.text.secondary }]}>⋯</Text>
      </Pressable>
    </View>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: workoutEditor.row.gap,
    height: workoutEditor.row.height,
    paddingVertical: workoutEditor.row.paddingY,
  },
  grip: { width: workoutEditor.row.gripWidth, fontSize: workoutEditor.row.gripSize, textAlign: 'center' },
  tile: {
    width: workoutEditor.row.tileSize,
    height: workoutEditor.row.tileSize,
    borderRadius: workoutEditor.row.tileRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontSize: 13, fontWeight: '600' },
  text: { flex: 1, gap: workoutEditor.row.textGap },
  name: { fontSize: workoutEditor.row.nameSize, fontWeight: '500' },
  meta: { fontSize: workoutEditor.row.metaSize },
  pill: {
    paddingHorizontal: workoutEditor.row.pillPaddingX,
    paddingVertical: workoutEditor.row.pillPaddingY,
    borderRadius: workoutEditor.row.pillRadius,
  },
  pillLabel: { fontSize: workoutEditor.row.pillLabelSize, fontWeight: '600' },
  more: { width: workoutEditor.row.moreWidth, alignItems: 'center' },
  moreGlyph: { fontSize: workoutEditor.row.moreSize, fontWeight: '600' },
});
