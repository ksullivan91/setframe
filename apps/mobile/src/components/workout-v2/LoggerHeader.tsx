import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, typeScale } from '../../theme/getTheme';

export interface LoggerHeaderProps {
  totalVolume: number;
  loggedSets: number;
  plannedSets: number;
  /**
   * Chrome only — no stats, no Finish.
   *
   * Used while the session loads or after it fails. The header is chrome
   * rather than data, so it renders immediately and the screen does not
   * reflow when the session arrives; but "0 lb moved, 0 of 0 sets" is not a
   * neutral placeholder, it is a wrong number. This shows a status line
   * instead, and hides a Finish button that has nothing to finish.
   */
  statusLine?: string;
  finishing?: boolean;
  onBack: () => void;
  onFinish: () => void;
}

/**
 * The running session's header, in the bold treatment Log and onboarding
 * established: a dark block, white numerals, one purple action.
 *
 * Same three facts it carried before — volume, sets logged, sets planned —
 * only read at a glance now instead of as a grey run-on line. The stats are
 * deliberately not a timer: nothing on this screen tracks elapsed time
 * today, and this is a reskin.
 *
 * The route disables the native stack header, so reserving the status bar is
 * this component's job.
 */
export function LoggerHeader({
  totalVolume,
  loggedSets,
  plannedSets,
  statusLine,
  finishing = false,
  onBack,
  onFinish,
}: LoggerHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="logger-header"
      style={[styles.header, { paddingTop: insets.top + spacing[16], backgroundColor: theme.inverse.surface }]}
    >
      <View style={styles.row}>
        <View style={styles.titleGroup}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to Log"
            style={styles.back}
          >
            <Text style={[styles.backGlyph, { color: theme.inverse.textMuted }]}>‹</Text>
          </Pressable>
          <Text style={[styles.title, { color: theme.inverse.text }]} numberOfLines={1}>
            Workout session
          </Text>
        </View>
        {statusLine ? null : (
        <Pressable
          onPress={onFinish}
          /* Finishing is a real round trip that then navigates away. With no
             pending state a second tap fired a second complete while the
             first was still in flight — and, having no error path either, a
             failure looked identical to a button that did nothing. */
          /* Never disabled for lack of logged sets — §4 of the interaction
             spec: "a disabled button in that moment is the product arguing
             with the gym". Finishing early is an ordinary outcome, and the
             confirmation sheet is what handles it. Only in-flight disables
             it, to stop a second complete racing the first. */
          disabled={finishing}
          testID="finish-workout"
          accessibilityRole="button"
          accessibilityState={{ disabled: finishing }}
          style={[styles.finish, { backgroundColor: theme.inverse.accent, opacity: finishing ? 0.7 : 1 }]}
        >
          {finishing ? (
            <ActivityIndicator color={theme.inverse.text} />
          ) : (
            <Text style={[styles.finishText, { color: theme.inverse.text }]}>Finish</Text>
          )}
        </Pressable>
        )}
      </View>

      {statusLine ? (
        <Text style={[styles.statusLine, { color: theme.inverse.textMuted }]}>{statusLine}</Text>
      ) : (
      <View style={styles.stats} testID="session-meta">
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: theme.inverse.text }]}>
            {totalVolume.toLocaleString('en-US')}
          </Text>
          <Text style={[styles.statLabel, { color: theme.inverse.textMuted }]}>lb moved</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: theme.inverse.text }]}>{loggedSets}</Text>
          <Text style={[styles.statLabel, { color: theme.inverse.textMuted }]}>
            of {plannedSets} sets
          </Text>
        </View>
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[12], paddingBottom: spacing[16], paddingHorizontal: spacing[16] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[12] },
  titleGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  back: { minWidth: 32, minHeight: 44, justifyContent: 'center' },
  backGlyph: { fontSize: 26, fontWeight: '600', lineHeight: 28 },
  title: { flex: 1, fontSize: typeScale.pageTitle.fontSize, fontWeight: '600' },
  finish: {
    borderRadius: radius.full,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[16],
    minHeight: 36,
    justifyContent: 'center',
  },
  finishText: { fontSize: typeScale.compactBody.fontSize, fontWeight: '600' },
  statusLine: { fontSize: typeScale.compactBody.fontSize },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, gap: spacing[4] },
  statValue: { fontSize: typeScale.numericMetric.fontSize, fontWeight: '600' },
  statLabel: { fontSize: typeScale.caption.fontSize },
});
