import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, typeScale } from '../../theme/getTheme';
import { CARD_WIDTH } from './ExerciseTableCard';

export interface EmptySessionCardProps {
  onAddExercise: () => void;
}

/**
 * A session with no exercises in it yet.
 *
 * Previously nothing rendered at all: `exercises.map` over an empty array
 * left a header, a blank canvas and a bottom bar. That was unreachable while
 * every session came from a template, and became reachable the moment the
 * workout picker started offering "Start an empty workout" — so the first
 * thing that flow produced was a blank screen.
 *
 * It repeats the bottom bar's action rather than inventing a second one: the
 * bar is easy to miss at the foot of an otherwise empty screen, and there is
 * genuinely only one thing to do here.
 */
export function EmptySessionCard({ onAddExercise }: EmptySessionCardProps) {
  const theme = useTheme();
  return (
    <View
      testID="empty-session"
      style={[styles.card, { backgroundColor: theme.surface.raised }]}
    >
      <Text style={[styles.title, { color: theme.text.primary }]}>Nothing logged yet</Text>
      <Text style={[styles.body, { color: theme.text.secondary }]}>
        This workout started empty. Add the first exercise and it will show up here, set by set.
      </Text>
      <Pressable
        testID="empty-session-add"
        accessibilityRole="button"
        onPress={onAddExercise}
        style={({ pressed }) => [
          styles.action,
          { backgroundColor: theme.action.primary, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[styles.actionLabel, { color: theme.text.primary }]}>Add an exercise</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    gap: spacing[8],
    borderRadius: radius.large,
    paddingVertical: spacing[24],
    paddingHorizontal: spacing[16],
  },
  title: { fontSize: typeScale.pageTitle.fontSize, fontWeight: '600' },
  body: { fontSize: typeScale.compactBody.fontSize, lineHeight: 19 },
  action: {
    marginTop: spacing[8],
    height: 44,
    borderRadius: radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: typeScale.compactBody.fontSize, fontWeight: '600' },
});
