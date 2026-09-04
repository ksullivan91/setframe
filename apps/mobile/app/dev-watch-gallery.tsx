import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useState } from 'react';
import { SERIES, WORKOUT, EFFORTS, CANDIDATES } from '../src/dev/watchFixtures';
import { WatchAttachCard } from '../src/components/watch/WatchAttachCard';
import { WatchSummaryCard } from '../src/components/watch/WatchSummaryCard';
import { HeartRateCard } from '../src/components/watch/HeartRateCard';
import { EffortByExerciseCard } from '../src/components/watch/EffortByExerciseCard';
import { useTheme } from '../src/theme/ThemeProvider';
import { GuidedSetupFlow } from '../src/components/guided-setup/GuidedSetupFlow';
import { OnboardingScaffold, onboardingText as OT } from '../src/screens/onboarding/OnboardingScaffold';
import { Button } from '../src/components/Button';
import { CARD_WIDTH } from '../src/components/workout-v2/ExerciseTableCard';

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

      <Section label="Onboarding 2 · Apple Health (live scaffold + real copy)">
        <View style={{ height: 700, width: CARD_WIDTH, overflow: 'hidden', borderRadius: 12 }}>
          <OnboardingScaffold
            actions={<>
              <Button label="Enable Apple Health" onPress={() => {}} />
              <Button label="Not now" variant="secondary" onPress={() => {}} />
            </>}
          >
            <Text style={[OT.title, { color: theme.text.primary }]}>Connect Apple Health</Text>
            <Text style={[OT.body, { color: theme.text.secondary }]}>
              One tap, and most of what follows fills itself in. Setframe reads your activity,
              heart and body data so Today reflects everything you did — not only what you logged
              here.
            </Text>
            <View style={{ backgroundColor: theme.surface.raised, borderRadius: 12, padding: 16, gap: 8 }}>
              <Text style={[OT.eyebrow, { color: theme.text.disabled }]}>WHAT IT READS</Text>
              {['Steps, active energy and exercise minutes',
                'Heart rate, resting heart rate and HRV',
                'Sleep, VO₂ max and body measurements',
                'Apple Watch workouts, to attach to a session'].map((l) => (
                <Text key={l} style={{ fontSize: 13, lineHeight: 19, color: theme.text.primary }}>·  {l}</Text>
              ))}
            </View>
            <Text style={[OT.note, { color: theme.text.secondary }]}>
              Read only. Setframe never writes anything to Apple Health.
            </Text>
          </OnboardingScaffold>
        </View>
      </Section>

      <Section label="Guided setup — Training host (live component)">
        <View style={{ height: 720, width: CARD_WIDTH, overflow: 'hidden', borderRadius: 12 }}>
          <GuidedSetupFlow host="training" onExit={() => {}} />
        </View>
      </Section>

      <Section label="Attach — two candidates">
        <WatchAttachCard
          candidates={CANDIDATES}
          onAttach={() => {}}
          onAttachAll={() => {}}
          onDismiss={() => {}}
        />
      </Section>

      <Section label="Summary">
        <WatchSummaryCard workouts={[WORKOUT]} />
      </Section>

      <Section label="Width check — block pinned to CARD_WIDTH (358), as the screen does">
        <View style={styles.block}>
        <WatchSummaryCard
          workouts={[
            { ...WORKOUT, title: 'Traditional Strength Training', durationSeconds: 5796,
              activeEnergyKcal: 429, avgHeartRateBpm: 92, peakHeartRateBpm: 132 },
            { ...WORKOUT, id: 'w2', externalId: 'hk-walk', title: 'Outdoor Walk', durationSeconds: 653,
              activeEnergyKcal: 51, avgHeartRateBpm: 86, peakHeartRateBpm: 94 },
            { ...WORKOUT, id: 'w3', externalId: 'hk-cycle', title: 'Outdoor Cycle', durationSeconds: 1488,
              activeEnergyKcal: 204, avgHeartRateBpm: 129, peakHeartRateBpm: 149 },
          ]}
          onRemove={() => {}}
        />
        </View>
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
  content: { padding: 16, gap: 24, maxWidth: 390, alignSelf: 'center', width: '100%', alignItems: 'center' },
  block: { width: CARD_WIDTH, gap: 12 },
  heading: { fontSize: 26, fontWeight: '600' },
  note: { fontSize: 12 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 10, letterSpacing: 1, fontWeight: '500' },
});
