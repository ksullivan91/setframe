import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useState } from 'react';
import type { SessionWatchWorkout } from '@setframe/schemas';
import { WatchAttachCard } from '../src/components/watch/WatchAttachCard';
import { WatchSummaryCard } from '../src/components/watch/WatchSummaryCard';
import { HeartRateCard } from '../src/components/watch/HeartRateCard';
import { EffortByExerciseCard } from '../src/components/watch/EffortByExerciseCard';
import { useTheme } from '../src/theme/ThemeProvider';

/**
 * A development gallery for the story 45 cards.
 *
 * Exists because these components could not be *seen* before shipping —
 * jest does no layout, and the iOS simulator is not always available. It
 * renders each card from fixtures with no auth, no network and no
 * HealthKit, so `expo start --web` is enough to look at them.
 *
 * Reachable only at /dev-watch-gallery and linked from nowhere.
 */
/* A lifter's trace: sets drive it up, rests let it fall back. Deliberately
   low-frequency — the chart buckets to 25 bars by PEAK, so a fast sine
   would put a near-maximum in every bucket and render as a flat ramp,
   which is not what an hour of lifting looks like. */
const SERIES = (() => {
  const offsets: number[] = [];
  const values: number[] = [];
  const SETS = 14;
  const period = 384 / SETS;
  for (let i = 0; i < 384; i += 1) {
    offsets.push(i * 10);
    const phase = (i % period) / period;
    // Ramp up hard through the set, decay through the rest.
    const effort = phase < 0.45 ? phase / 0.45 : Math.max(0, 1 - (phase - 0.45) / 0.4);
    const drift = (i / 384) * 14; // cardiac drift over the hour
    values.push(Math.round(96 + effort * 62 + drift));
  }
  return { offsets, values };
})();

const WORKOUT: SessionWatchWorkout = {
  id: 'w1',
  sessionId: 's1',
  externalId: 'hk-lift',
  activityType: 'other',
  appleActivityType: 50,
  title: 'Traditional Strength Training',
  startedAt: '2026-09-01T17:32:00.000Z',
  endedAt: '2026-09-01T18:36:00.000Z',
  durationSeconds: 3840,
  activeEnergyKcal: 612,
  totalEnergyKcal: 842,
  avgHeartRateBpm: Math.round(SERIES.values.reduce((n, v) => n + v, 0) / SERIES.values.length),
  peakHeartRateBpm: Math.max(...SERIES.values),
  minHeartRateBpm: Math.min(...SERIES.values),
  distanceValue: null,
  distanceUnit: null,
  deviceName: 'Series 9',
  createdAt: '2026-09-01T18:40:00.000Z',
  updatedAt: '2026-09-01T18:40:00.000Z',
};

const EFFORTS = [
  { exerciseName: 'Bench Press', avgBpm: 158, peakBpm: 174, setCount: 3 },
  { exerciseName: 'Incline DB Press', avgBpm: 149, peakBpm: 163, setCount: 3 },
  { exerciseName: 'Overhead Press', avgBpm: 141, peakBpm: 157, setCount: 3 },
  { exerciseName: 'Cable Fly', avgBpm: 126, peakBpm: 138, setCount: 3 },
  { exerciseName: 'Triceps Pushdown', avgBpm: 116, peakBpm: 127, setCount: 2 },
];

const CANDIDATES = [
  {
    relation: 'overlaps' as const,
    workout: {
      externalId: 'hk-lift',
      appleType: 50,
      activityType: 'other' as const,
      title: 'Traditional Strength Training',
      startedAt: '2026-09-01T17:32:00.000Z',
      endedAt: '2026-09-01T18:36:00.000Z',
      durationSeconds: 3840,
      distanceValue: null,
      distanceUnit: null,
      caloriesKcal: 612,
      avgHeartRateBpm: 142,
      peakHeartRateBpm: 171,
    },
  },
  {
    relation: 'after' as const,
    workout: {
      externalId: 'hk-run',
      appleType: 37,
      activityType: 'run' as const,
      title: 'Run',
      startedAt: '2026-09-01T18:41:00.000Z',
      endedAt: '2026-09-01T19:03:00.000Z',
      durationSeconds: 1320,
      distanceValue: 2.4,
      distanceUnit: 'mi' as const,
      caloriesKcal: 268,
      avgHeartRateBpm: 156,
      peakHeartRateBpm: 178,
    },
  },
];

export default function DevWatchGallery() {
  const theme = useTheme();
  const [selected, setSelected] = useState<number | null>(null);

  // Unlinked, but it is still a route in the bundle — keep it out of a
  // release build rather than relying on nobody typing the path. Below the
  // hooks, not above: an early return before useState is the crash class
  // this app has already shipped once.
  if (!__DEV__) return null;

  return (
    <ScrollView
      style={{ backgroundColor: theme.surface.canvas }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.heading, { color: theme.text.primary }]}>Watch cards</Text>
      <Text style={[styles.note, { color: theme.text.secondary }]}>
        Development gallery. Fixtures only — no auth, no network, no HealthKit.
      </Text>

      <Section label="Attach — two candidates">
        <WatchAttachCard candidates={CANDIDATES} onAttach={() => {}} onAttachAll={() => {}} />
      </Section>

      <Section label="Summary">
        <WatchSummaryCard workouts={[WORKOUT]} />
      </Section>

      <Section label="Heart rate — resting">
        <HeartRateCard
          series={SERIES}
          model={{ restingBpm: 54, maxBpm: 186 }}
          startedAt={WORKOUT.startedAt}
          endedAt={WORKOUT.endedAt}
          avgBpm={WORKOUT.avgHeartRateBpm}
          peakBpm={WORKOUT.peakHeartRateBpm}
          selectedIndex={selected}
          onSelect={setSelected}
        />
      </Section>

      <Section label="Heart rate — scrubbing (bar 18)">
        <HeartRateCard
          series={SERIES}
          model={{ restingBpm: 54, maxBpm: 186 }}
          startedAt={WORKOUT.startedAt}
          endedAt={WORKOUT.endedAt}
          avgBpm={WORKOUT.avgHeartRateBpm}
          peakBpm={WORKOUT.peakHeartRateBpm}
          selectedIndex={18}
        />
      </Section>

      <Section label="Effort by exercise">
        <EffortByExerciseCard efforts={EFFORTS} />
      </Section>

      <Section label="No Watch that day — every card renders nothing">
        <WatchAttachCard candidates={[]} onAttach={() => {}} onAttachAll={() => {}} />
        <WatchSummaryCard workouts={[]} />
        <EffortByExerciseCard efforts={[]} />
        <Text style={[styles.note, { color: theme.text.disabled }]}>
          (nothing above this line, by design)
        </Text>
      </Section>
    </ScrollView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: theme.text.disabled }]}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24, maxWidth: 390, alignSelf: 'center', width: '100%' },
  heading: { fontSize: 26, fontWeight: '600' },
  note: { fontSize: 12 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 10, letterSpacing: 1, fontWeight: '500' },
});
