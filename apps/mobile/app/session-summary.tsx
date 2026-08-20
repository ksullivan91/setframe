import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Trophy } from 'lucide-react-native';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { SetRowReadOnly } from '../src/components/SetRow';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing, typeScale } from '../src/theme/getTheme';

/**
 * `Screen/Mobile/SessionSummary` per style guide §17 — dedicated
 * mobile-only post-workout recap: title/date header, 3-up stat row
 * (Duration / Volume / PRs), a highlighted PR card (trophy icon,
 * accent-subtle background), a condensed per-exercise set list, and
 * Share/Done actions. Backed by `detectWeightPR`/`detectRepPR`
 * (docs/data-model.md §8 decision 5) — no schema change needed.
 */
export default function SessionSummaryScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text.primary }]}>Push Day A</Text>
      <Text style={[styles.date, { color: theme.text.secondary }]}>Today, 6:42 PM</Text>

      <View style={styles.statRow}>
        <Stat label="Duration" value="52 min" />
        <Stat label="Volume" value="12,840 lb" />
        <Stat label="PRs" value="1" />
      </View>

      <Card style={[styles.prCard, { backgroundColor: theme.action.accentSubtle }]}>
        <View style={styles.prHeader}>
          <Trophy size={20} color={theme.action.primary} />
          <Text style={[styles.prTitle, { color: theme.action.primary }]}>New PR</Text>
        </View>
        <Text style={{ color: theme.text.primary }}>
          Barbell Bench Press — 195 lb × 6, up from 185 lb × 8
        </Text>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Barbell Bench Press</Text>
        <SetRowReadOnly setLabel="Set 1" valueLabel="185 × 8" />
        <SetRowReadOnly setLabel="Set 2" valueLabel="185 × 8" />
        <SetRowReadOnly setLabel="Set 3" valueLabel="195 × 6" isPr />
      </Card>

      <View style={styles.actionRow}>
        <View style={{ flex: 1 }}>
          <Button label="Share" variant="secondary" onPress={() => {}} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Done" onPress={() => router.replace('/(tabs)/today')} />
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text
        style={[
          styles.statValue,
          { color: theme.text.primary, fontSize: typeScale.numericMetric.fontSize, lineHeight: typeScale.numericMetric.lineHeight },
        ]}
      >
        {value}
      </Text>
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
  date: {
    fontSize: typeScale.compactBody.fontSize,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
    gap: spacing[4],
  },
  statValue: {
    fontWeight: '600',
  },
  statLabel: {
    fontSize: typeScale.label.fontSize,
  },
  prCard: {
    borderWidth: 0,
  },
  prHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  prTitle: {
    fontWeight: '600',
    fontSize: typeScale.sectionTitle.fontSize,
  },
  sectionTitle: {
    fontWeight: '600',
    fontSize: typeScale.sectionTitle.fontSize,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing[8],
  },
});
