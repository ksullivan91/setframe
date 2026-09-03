import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HealthConnection } from '../../healthkit/useHealthConnection';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, typeScale } from '../../theme/getTheme';

export interface DaySignal {
  label: string;
  value: string;
}

export interface DaySignalsProps {
  signals: readonly DaySignal[];
  health: HealthConnection;
  onOpenTrends: () => void;
}

/**
 * The day's body signals — a summary, with depth in Trends.
 *
 * This replaces the full Health metrics card on Log. The card showed nine
 * tiles and a macro breakdown, which is what made the old screen read as a
 * pile of unrelated things: it competed with the day's one decision while
 * saying nothing the user had to act on. Four values and a way through is
 * the whole job here.
 *
 * It carries the four connection states itself, because the states are the
 * point rather than a detail — see `useHealthConnection`.
 */
export function DaySignals({ signals, health, onOpenTrends }: DaySignalsProps) {
  const theme = useTheme();

  /* An offer that cannot be accepted is worse than silence: on an iPad or
     the Simulator there is no Health app to send anyone to. */
  if (health.state === 'unavailable') return null;

  if (health.state === 'not_connected') {
    return (
      <Pressable
        accessibilityRole="button"
        testID="health-connect-prompt"
        onPress={() => void health.connect()}
        style={[styles.prompt, { backgroundColor: theme.action.accentSubtle }]}
      >
        <View style={styles.promptMeta}>
          <Text style={[styles.promptTitle, { color: theme.text.primary }]}>Connect Apple Health</Text>
          <Text style={[styles.promptBody, { color: theme.text.secondary }]}>
            Steps, sleep and heart rate fill in on their own.
          </Text>
        </View>
        <Text style={[styles.action, { color: theme.action.primary }]}>
          {health.connecting ? 'Opening…' : 'Connect'}
        </Text>
      </Pressable>
    );
  }

  if (health.state === 'no_data') {
    return (
      <Pressable
        accessibilityRole="button"
        testID="health-no-data"
        onPress={() => void health.openHealthApp()}
        style={[styles.prompt, { backgroundColor: theme.surface.raised }]}
      >
        <View style={styles.promptMeta}>
          <Text style={[styles.promptTitle, { color: theme.text.primary }]}>No health data yet</Text>
          {/* True whether they refused or simply have not synced — iOS never
              tells us which, so the copy must fit both. */}
          <Text style={[styles.promptBody, { color: theme.text.secondary }]}>
            If you meant to share it, check Setframe in the Health app.
          </Text>
        </View>
        <Text style={[styles.action, { color: theme.action.primary }]}>Open</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.headLabel, { color: theme.text.secondary }]}>ALSO TODAY</Text>
        <Pressable accessibilityRole="button" testID="open-trends" onPress={onOpenTrends} hitSlop={8}>
          <Text style={[styles.action, { color: theme.action.primary }]}>Trends ›</Text>
        </Pressable>
      </View>
      <View style={[styles.row, { backgroundColor: theme.surface.raised }]}>
        {signals.map((signal) => (
          <View key={signal.label} style={styles.signal}>
            <Text style={[styles.value, { color: theme.text.primary }]}>{signal.value}</Text>
            <Text style={[styles.label, { color: theme.text.secondary }]}>{signal.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[8] },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headLabel: { fontSize: typeScale.caption.fontSize, fontWeight: '500', letterSpacing: 0.6 },
  action: { fontSize: typeScale.label.fontSize, fontWeight: '500' },
  row: { flexDirection: 'row', borderRadius: radius.small, padding: spacing[16] },
  signal: { flex: 1, gap: spacing[4] },
  value: { fontSize: typeScale.sectionTitle.fontSize, fontWeight: '600' },
  label: { fontSize: typeScale.caption.fontSize },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[12],
    borderRadius: radius.small,
    padding: spacing[16],
    minHeight: 44,
  },
  promptMeta: { flex: 1, gap: spacing[4] },
  promptTitle: { fontSize: typeScale.compactBody.fontSize, fontWeight: '600' },
  promptBody: { fontSize: typeScale.label.fontSize, lineHeight: 17 },
});
