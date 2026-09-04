import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, typeScale } from '../../theme/getTheme';

export interface LoggerCompleteBannerProps {
  /** Already formatted — the metric is the session's, not always weight. */
  total: string;
  totalUnit: string;
  loggedSets: number;
  personalRecordCount: number;
  /** Human duration, e.g. "52 min". Omitted when the session has no end. */
  duration: string | null;
  onDone: () => void;
}

/**
 * What the session added up to, in the bold treatment.
 *
 * Carries exactly the facts the green wash carried before — total, sets,
 * PRs, duration — but the total is the thing you see first rather than a
 * number buried in a run-on meta line. Dark rather than green because the
 * completed exercise cards below are light: the contrast is what separates
 * "the workout" from "an exercise in it".
 */
export function LoggerCompleteBanner({
  total,
  totalUnit,
  loggedSets,
  personalRecordCount,
  duration,
  onDone,
}: LoggerCompleteBannerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const stats: Array<{ value: string; label: string }> = [
    { value: String(loggedSets), label: loggedSets === 1 ? 'set' : 'sets' },
  ];
  if (personalRecordCount > 0) {
    stats.push({
      value: String(personalRecordCount),
      label: personalRecordCount === 1 ? 'personal record' : 'personal records',
    });
  }
  if (duration) stats.push({ value: duration, label: 'elapsed' });

  return (
    <View
      testID="completion-banner"
      style={[styles.banner, { paddingTop: insets.top + spacing[16], backgroundColor: theme.inverse.surface }]}
    >
      <View style={styles.row}>
        <Text style={[styles.eyebrow, { color: theme.inverse.accent }]}>WORKOUT COMPLETE</Text>
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel="Done"
          style={[styles.done, { backgroundColor: theme.inverse.accent }]}
        >
          <Text style={[styles.doneText, { color: theme.inverse.text }]}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.totalRow}>
        <Text style={[styles.total, { color: theme.inverse.text }]}>{total}</Text>
        <Text style={[styles.totalUnit, { color: theme.inverse.textMuted }]} testID="banner-total-suffix">
          {totalUnit}
        </Text>
      </View>

      <View style={styles.stats} testID="banner-meta">
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.inverse.text }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: theme.inverse.textMuted }]}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { gap: spacing[12], paddingBottom: spacing[24], paddingHorizontal: spacing[16] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[12] },
  eyebrow: { fontSize: typeScale.caption.fontSize, fontWeight: '600', letterSpacing: 1 },
  done: {
    borderRadius: radius.full,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[16],
    minHeight: 36,
    justifyContent: 'center',
  },
  doneText: { fontSize: typeScale.compactBody.fontSize, fontWeight: '600' },
  /* Baseline-aligned so the unit sits on the number's foot, not its middle. */
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[8] },
  total: { fontSize: typeScale.display.fontSize, fontWeight: '600' },
  totalUnit: { fontSize: typeScale.body.fontSize },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, gap: spacing[4] },
  statValue: { fontSize: typeScale.body.fontSize, fontWeight: '600' },
  statLabel: { fontSize: typeScale.caption.fontSize },
});
