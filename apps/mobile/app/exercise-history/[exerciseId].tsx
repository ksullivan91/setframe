import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '../../src/components/Card';
import { SetRowReadOnly } from '../../src/components/SetRow';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing, typeScale } from '../../src/theme/getTheme';

/**
 * `Screen/Mobile/ExerciseHistory` per style guide §14 — explicitly NOT a
 * tab-bar destination (History stays web-nav-only per §13); a drill-in
 * screen (e.g. tapping an exercise name from a past session) with a
 * condensed single-row stat strip (top set, est. 1RM, last session
 * volume — no chart, per "keep charts restrained") and a shorter session
 * list than web's version.
 *
 * TODO: wire GET /v1/exercises/:exerciseId/history and
 * /v1/exercises/:exerciseId/progress (docs/api.md) once available.
 */
export default function ExerciseHistoryScreen() {
  const theme = useTheme();
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();

  const sessions = [
    { date: 'Aug 18', sets: [{ label: 'Set 1', value: '195 × 6' }], isPr: true },
    { date: 'Aug 11', sets: [{ label: 'Set 1', value: '185 × 8' }], isPr: false },
    { date: 'Aug 4', sets: [{ label: 'Set 1', value: '180 × 8' }], isPr: false },
  ];

  return (
    <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text.primary }]}>Barbell Bench Press</Text>
      <Text style={[styles.subtitle, { color: theme.text.secondary }]}>exerciseId: {exerciseId ?? 'unknown'}</Text>

      <View style={styles.statStrip}>
        <Stat label="Top set" value="195 × 6" />
        <Stat label="Est. 1RM" value="232 lb" />
        <Stat label="Last volume" value="4,440 lb" />
      </View>

      {sessions.map((session) => (
        <Card key={session.date}>
          <Text style={[styles.sessionDate, { color: theme.text.primary }]}>{session.date}</Text>
          {session.sets.map((set) => (
            <SetRowReadOnly key={set.label} setLabel={set.label} valueLabel={set.value} isPr={session.isPr} />
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.text.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.text.secondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[16],
    gap: spacing[16],
  },
  title: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: typeScale.caption.fontSize,
  },
  statStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
    gap: spacing[4],
  },
  statValue: {
    fontSize: typeScale.numericMetric.fontSize,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: typeScale.label.fontSize,
  },
  sessionDate: {
    fontWeight: '600',
  },
});
