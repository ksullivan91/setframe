import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@setframe/schemas';
import { radius, spacing } from '@setframe/design-tokens';
import { useApiClient } from '../../lib/api-client';
import { useActionFeedback } from '../../lib/useActionFeedback';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { useHealthConnection } from '../../healthkit/useHealthConnection';
import { GuidedSetupFlow } from '../../components/guided-setup/GuidedSetupFlow';
import { OnboardingScaffold, onboardingText as T } from './OnboardingScaffold';
import { releaseSplash } from '../../lib/appReady';

/**
 * First run. Figma page `🚀 Onboarding`.
 *
 * The order is the argument: Health first because it is one tap and pays
 * for itself immediately — everything after it arrives prefilled — and the
 * program last because it is the most work and the most declinable. Every
 * step can be skipped, and step 7 says so out loud.
 *
 * Marked finished on the way out whether it was completed OR skipped:
 * both are decisions, and re-running the flow for someone who declined it
 * is the failure this exists to avoid.
 */
type Step = 'welcome' | 'health' | 'about' | 'measured' | 'program' | 'setup' | 'done';

/** Order on screen, so the body knows which way it is travelling. */
const STEP_INDEX: Record<Step, number> = {
  welcome: 0, health: 1, about: 2, measured: 3, program: 4, setup: 5, done: 6,
};

export function OnboardingFlow({ onFinished }: { onFinished: () => void }) {
  const theme = useTheme();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const feedback = useActionFeedback();
  const health = useHealthConnection();
  const [step, setStep] = useState<Step>('welcome');

  /* Onboarding is a first surface, like Today and the auth screens, so it
     has to release the launch screen. It did not, and nothing else routes
     here — so a new account sat behind the logo with no way forward. */
  useEffect(releaseSplash, []);

  const finish = useMutation({
    mutationFn: () => api.post<User>('/me/onboarded', {}),
    onSuccess: (updated) => {
      /* Write the response in rather than invalidating.
         Invalidating leaves the STALE user in cache while it refetches, so
         the gate we are navigating towards would read onboardedAt: null,
         bounce straight back here, and loop. The endpoint returns the
         updated user, so there is nothing to refetch. */
      queryClient.setQueryData(['me'], updated);
      onFinished();
    },
    /* A failed write must not trap anyone in onboarding. Worst case it
       runs once more next launch, which is a far smaller harm than a user
       who cannot reach the app. */
    onError: () => onFinished(),
  });

  /* Health is only worth a payoff screen if something actually came
     through. With nothing to show, step 4 would be an empty promise. */
  const hasHealthData = useMemo(
    () =>
      health.metrics.steps != null ||
      health.recovery.vo2Max != null ||
      health.recovery.restingHeartRateBpm != null ||
      health.body.weightKg != null,
    [health.metrics, health.recovery, health.body],
  );

  const afterAbout = () => setStep(hasHealthData ? 'measured' : 'program');

  /* Both Health-derived screens are skipped together when nothing came
     through. "About you" reads entirely from Health and Setframe never
     writes back, so with no data it is four rows of "Not set" and no way
     to set any of them — a worse dead end than not showing it. */
  const afterHealth = () => setStep(hasHealthData ? 'about' : 'program');

  if (step === 'setup') {
    return (
      <GuidedSetupFlow
        host="onboarding"
        /* Skip and Done both land here: whatever was created is already
           written, so there is nothing to discard either way. */
        onExit={() => setStep('done')}
        /* Back from the first step returns to the screen that offered the
           setup, rather than skipping past it. */
        onBack={() => setStep('program')}
      />
    );
  }

  return (
    <>
      {step === 'welcome' ? (
        <OnboardingScaffold
          testID="onboarding-welcome"
          stepIndex={STEP_INDEX.welcome}
          actions={
            <>
              <Button label="Get started" onPress={() => setStep('health')} />
              <Text style={[T.note, styles.centered, { color: theme.text.secondary }]}>
                Takes about a minute. You can skip any of it.
              </Text>
            </>
          }
        >
          <Text style={[T.hero, { color: theme.text.primary }]}>Setframe</Text>
          <Text style={[T.body, { color: theme.text.secondary }]}>
            Log the set. Keep the record.
          </Text>
          <Text style={[T.body, { color: theme.text.secondary }]}>
            Everything you log builds one history — what you lifted, how you recovered, and what
            actually changed over time.
          </Text>
        </OnboardingScaffold>
      ) : null}

      {step === 'health' ? (
        <OnboardingScaffold
          testID="onboarding-health"
          stepIndex={STEP_INDEX.health}
          actions={
            <>
              <Button
                label="Enable Apple Health"
                loading={health.connecting}
                onPress={async () => {
                  await health.connect();
                  afterHealth();
                }}
              />
              {/* "Not now" never calls requestAuthorization, so iOS never
                  shows its sheet and the state stays not_asked — which is
                  what lets us ask again later. Declining Apple's own sheet
                  is permanent; declining ours is not. */}
              <Button label="Not now" variant="secondary" onPress={() => setStep('program')} />
            </>
          }
        >
          <Text style={[T.title, { color: theme.text.primary }]}>Connect Apple Health</Text>
          <Text style={[T.body, { color: theme.text.secondary }]}>
            One tap, and most of what follows fills itself in. Setframe reads your activity, heart
            and body data so Today reflects everything you did — not only what you logged here.
          </Text>
          <View style={[styles.listCard, { backgroundColor: theme.surface.raised }]}>
            <Text style={[T.eyebrow, { color: theme.text.disabled }]}>WHAT IT READS</Text>
            {[
              'Steps, active energy and exercise minutes',
              'Heart rate, resting heart rate and HRV',
              'Sleep, VO₂ max and body measurements',
              'Apple Watch workouts, to attach to a session',
            ].map((line) => (
              <Text key={line} style={[styles.bullet, { color: theme.text.primary }]}>
                ·  {line}
              </Text>
            ))}
          </View>
          <Text style={[T.note, { color: theme.text.secondary }]}>
            Read only. Setframe never writes anything to Apple Health.
          </Text>
        </OnboardingScaffold>
      ) : null}

      {step === 'done' ? (
        <OnboardingScaffold
          testID="onboarding-done"
          stepIndex={STEP_INDEX.done}
          actions={
            <Button label="Go to Today" loading={finish.isPending} onPress={() => finish.mutate()} />
          }
        >
          <Text style={[T.title, { color: theme.text.primary }]}>You&apos;re set</Text>
          <Text style={[T.body, { color: theme.text.secondary }]}>
            Start a workout whenever you like — Setframe will keep the record either way.
          </Text>
          <View style={[styles.card, { backgroundColor: theme.surface.raised }]}>
            <Text style={[T.eyebrow, { color: theme.text.disabled }]}>STILL AVAILABLE</Text>
            <Text style={[styles.bullet, { color: theme.text.primary }]}>
              Set up your training — on Today, any time
            </Text>
            <Text style={[T.note, { color: theme.text.secondary }]}>
              Nothing here was a one-time offer. Anything skipped is offered again where it
              matters.
            </Text>
          </View>
        </OnboardingScaffold>
      ) : null}

      <OnboardingSteps
        step={step}
        health={health}
        hasHealthData={hasHealthData}
        onAboutContinue={afterAbout}
        onMeasuredContinue={() => setStep('program')}
        onSetUp={() => setStep('setup')}
        onSkipProgram={() => setStep('done')}
      />
      {feedback.node}
    </>
  );
}

/** Steps 3 and 4, which both read Health. Split only for file length. */
function OnboardingSteps({
  step,
  health,
  hasHealthData,
  onAboutContinue,
  onMeasuredContinue,
  onSetUp,
  onSkipProgram,
}: {
  step: Step;
  health: ReturnType<typeof useHealthConnection>;
  hasHealthData: boolean;
  onAboutContinue: () => void;
  onMeasuredContinue: () => void;
  onSetUp: () => void;
  onSkipProgram: () => void;
}) {
  const theme = useTheme();
  if (step !== 'about' && step !== 'measured' && step !== 'program') return null;

  const body = health.body;
  const recovery = health.recovery;

  if (step === 'about') {
    const rows: [string, string, boolean][] = [
      ['Sex', body.biologicalSex ?? 'Not set', body.biologicalSex != null],
      ['Age', body.ageYears != null ? `${body.ageYears}` : 'Not set', body.ageYears != null],
      [
        'Height',
        body.heightCm != null ? `${Math.round(body.heightCm)} cm` : 'Not set',
        body.heightCm != null,
      ],
      [
        'Weight',
        body.weightKg != null ? `${Math.round(body.weightKg * 2.2046)} lb` : 'Not set',
        body.weightKg != null,
      ],
    ];
    return (
      <OnboardingScaffold
        testID="onboarding-about"
        stepIndex={STEP_INDEX.about}
        actions={<Button label="Continue" onPress={onAboutContinue} />}
      >
        <Text style={[T.title, { color: theme.text.primary }]}>About you</Text>
        <Text style={[T.body, { color: theme.text.secondary }]}>
          Used for heart-rate zones and to show weights the way you think about them. These come
          from Apple Health — if something looks wrong, change it there and it updates here.
        </Text>
        {rows.map(([label, value, prefilled]) => (
          <View
            key={label}
            testID={`onboarding-field-${label}`}
            style={[styles.field, { backgroundColor: theme.surface.raised }]}
          >
            <View style={styles.fieldMeta}>
              <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>{label}</Text>
              <Text style={[styles.fieldValue, { color: theme.text.primary }]}>{value}</Text>
            </View>
            {prefilled ? (
              <View style={[styles.badge, { backgroundColor: theme.surface.sunken }]}>
                <Text style={[styles.badgeLabel, { color: theme.text.secondary }]}>From Health</Text>
              </View>
            ) : null}
          </View>
        ))}
      </OnboardingScaffold>
    );
  }

  if (step === 'measured') {
    const tiles: [string, string][] = [
      [recovery.vo2Max != null ? String(recovery.vo2Max) : '—', 'VO₂ max'],
      [
        recovery.restingHeartRateBpm != null ? String(recovery.restingHeartRateBpm) : '—',
        'Resting HR',
      ],
      [recovery.hrvMs != null ? String(recovery.hrvMs) : '—', 'HRV ms'],
    ];
    const maxHr = body.ageYears != null ? Math.round(208 - 0.7 * body.ageYears) : null;
    return (
      <OnboardingScaffold
        testID="onboarding-measured"
        stepIndex={STEP_INDEX.measured}
        actions={<Button label="Continue" onPress={onMeasuredContinue} />}
      >
        <Text style={[T.title, { color: theme.text.primary }]}>Already measured</Text>
        <Text style={[T.body, { color: theme.text.secondary }]}>
          Your own numbers, read a moment ago. None of it was typed in.
        </Text>
        <View style={styles.tiles}>
          {tiles.map(([value, label]) => (
            <View key={label} style={[styles.tile, { backgroundColor: theme.surface.raised }]}>
              <Text style={[styles.tileValue, { color: theme.text.primary }]}>{value}</Text>
              <Text style={[styles.tileLabel, { color: theme.text.secondary }]}>{label}</Text>
            </View>
          ))}
        </View>
        {maxHr != null && recovery.restingHeartRateBpm != null ? (
          <View style={[styles.card, { backgroundColor: theme.surface.raised }]}>
            <Text style={[T.eyebrow, { color: theme.text.disabled }]}>AND YOUR TRAINING ZONES</Text>
            <Text style={[styles.bullet, { color: theme.text.primary }]}>
              Your age gives an estimated maximum of {maxHr} bpm. With a resting rate of{' '}
              {recovery.restingHeartRateBpm}, every workout can now be scored against your own five
              zones rather than a generic chart.
            </Text>
          </View>
        ) : null}
        <Text style={[T.note, { color: theme.text.secondary }]}>
          Nothing here is stored anywhere but your account, and Setframe never writes back to
          Health.
        </Text>
      </OnboardingScaffold>
    );
  }

  return (
    <OnboardingScaffold
      testID="onboarding-program"
        stepIndex={STEP_INDEX.program}
      actions={
        <>
          <Button label="Set up my training" onPress={onSetUp} />
          <Button label="Skip — just let me train" variant="secondary" onPress={onSkipProgram} />
        </>
      }
    >
      <Text style={[T.title, { color: theme.text.primary }]}>Turn workouts into progress</Text>
      <Text style={[T.body, { color: theme.text.secondary }]}>
        You can train without this. Here is what changes if you set it up.
      </Text>
      <View style={[styles.card, { backgroundColor: theme.surface.raised }]}>
        <Text style={[T.eyebrow, { color: theme.text.disabled }]}>WITHOUT A PROGRAM</Text>
        <Text style={[styles.bullet, { color: theme.text.primary }]}>
          Every set is saved, and you can see one exercise&apos;s history at a time. That is all —
          there is nothing to compare a week against.
        </Text>
        <Text style={[T.eyebrow, { color: theme.text.disabled }]}>WITH ONE</Text>
        <Text style={[styles.bullet, { color: theme.text.primary }]}>
          Today knows what is next. Weeks can be compared to each other. Streaks and adherence mean
          something. And the record becomes dense enough that coaching has something real to read.
        </Text>
      </View>
      <Text style={[T.note, { color: theme.text.secondary }]}>
        Takes about two minutes, and you can stop anywhere — whatever you have made is kept.
      </Text>
      {hasHealthData ? null : null}
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  centered: { textAlign: 'center' },
  /* Two card rhythms: prose cards breathe 12 between blocks, the
     read-permission list runs tighter at 8. */
  card: { borderRadius: radius.small, padding: spacing[16], gap: spacing[12] },
  listCard: { borderRadius: radius.small, padding: spacing[16], gap: spacing[8] },
  bullet: { fontSize: 13, lineHeight: 19 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    borderRadius: radius.small,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[12],
  },
  fieldMeta: { flex: 1, minWidth: 0, gap: spacing[4] },
  fieldLabel: { fontSize: 11 },
  fieldValue: { fontSize: 15, fontWeight: '600' },
  badge: { borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: spacing[8] },
  badgeLabel: { fontSize: 9, fontWeight: '500' },
  tiles: { flexDirection: 'row', gap: spacing[8] },
  tile: { flex: 1, borderRadius: radius.small, padding: spacing[12], gap: spacing[4] },
  tileValue: { fontSize: 20, fontWeight: '600' },
  tileLabel: { fontSize: 11 },
});
