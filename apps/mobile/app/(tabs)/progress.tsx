import { ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing } from '../../src/theme/getTheme';
import { TrendCard } from '../../src/components/TrendCard';
import { ConsistencyStreakGrid } from '../../src/components/ConsistencyStreakGrid';

/**
 * `Screen/Mobile/Progress` per style guide §11/§19.3 — 5 trend cards
 * (body weight, bench top set, weekly volume, squat est. 1RM, workouts
 * this month) reusing `calculateVolume`/`estimateOneRepMax` from
 * packages/domain server-side, plus the "Consistency (last 8 weeks)"
 * streak dot-grid widget backed by GET /v1/progress/consistency.
 *
 * TODO: replace mocked card data with
 * `useQuery(['progress-consistency'], () => apiClient.get('/progress/consistency'))`
 * once that endpoint (docs/api.md) is live.
 */
export default function ProgressScreen() {
  const theme = useTheme();

  return (
    <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={styles.content}>
      <TrendCard label="Body weight (30 days)" value="169.6 lb" delta="-3.1 lb since Jul 21" sparkline={[0.6, 0.55, 0.5, 0.52, 0.45, 0.4]} />
      <TrendCard label="Bench press top set" value="195 × 6" delta="Est. 1RM 232 lb, +12 lb this month" sparkline={[0.3, 0.4, 0.5, 0.55, 0.7, 0.8]} />
      <TrendCard label="Weekly volume" value="18,420 lb" delta="+8% vs last week" sparkline={[0.5, 0.55, 0.6, 0.58, 0.65, 0.72]} />
      <TrendCard label="Squat Est. 1RM" value="285 lb" delta="+15 lb this month" sparkline={[0.4, 0.45, 0.5, 0.6, 0.65, 0.75]} />
      <TrendCard label="Workouts this month" value="14" delta="vs 11 last month" sparkline={[0.5, 0.6, 0.55, 0.7, 0.75, 0.8]} />
      <ConsistencyStreakGrid
        weeks={[
          { completed: 4, planned: 4 },
          { completed: 3, planned: 4 },
          { completed: 4, planned: 4 },
          { completed: 4, planned: 4 },
          { completed: 3, planned: 4 },
          { completed: 4, planned: 4 },
          { completed: 2, planned: 4 },
          { completed: 3, planned: 4 },
        ]}
        summaryLabel="4-week streak · 27 of 32 planned sessions completed"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[16],
    gap: spacing[16],
  },
});
