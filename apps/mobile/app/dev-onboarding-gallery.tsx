import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { OnboardingScaffold, onboardingText as T } from '../src/screens/onboarding/OnboardingScaffold';
import { GuidedSetupFlow } from '../src/components/guided-setup/GuidedSetupFlow';
import { Button } from '../src/components/Button';
import { DeleteAccountSheet } from '../src/components/DeleteAccountSheet';
import { useTheme } from '../src/theme/ThemeProvider';
import { CARD_WIDTH } from '../src/components/workout-v2/ExerciseTableCard';

/**
 * Every onboarding and setup surface, side by side, from fixtures.
 *
 * Exists because these are first-run-only screens: they cannot be reached
 * twice from one account, so "look at it and compare to Figma" is
 * otherwise a one-shot per test user. Dev-guarded, linked from nowhere.
 */
const PHONE = { width: 390, height: 780 };

export default function DevOnboardingGallery() {
  const theme = useTheme();
  const [sheet, setSheet] = useState(false);
  if (!__DEV__) return null;

  return (
    <ScrollView horizontal contentContainerStyle={styles.row}>
      <Frame label="1 · Welcome">
        <OnboardingScaffold
          actions={<>
            <Button label="Get started" onPress={() => {}} />
            <Text style={[T.note, styles.centre, { color: theme.inverse.textMuted }]}>
              Takes about a minute. You can skip any of it.
            </Text>
          </>}
        >
          <Text style={[T.hero, { color: theme.inverse.text }]}>Setframe</Text>
          <Text style={[T.body, { color: theme.inverse.textMuted }]}>Log the set. Keep the record.</Text>
          <Text style={[T.body, { color: theme.inverse.textMuted }]}>
            Everything you log builds one history — what you lifted, how you recovered, and what
            actually changed over time.
          </Text>
        </OnboardingScaffold>
      </Frame>

      <Frame label="5 · Turn workouts into progress">
        <OnboardingScaffold
          actions={<>
            <Button label="Set up my training" onPress={() => {}} />
            <Button label="Skip — just let me train" variant="ghostOnDark" onPress={() => {}} />
          </>}
        >
          <Text style={[T.title, { color: theme.inverse.text }]}>Turn workouts into progress</Text>
          <Text style={[T.body, { color: theme.inverse.textMuted }]}>
            You can train without this. Here is what changes if you set it up.
          </Text>
          <View style={[styles.card, { backgroundColor: theme.inverse.raised }]}>
            <Text style={[T.eyebrow, { color: theme.inverse.accentMuted }]}>WITHOUT A PROGRAM</Text>
            <Text style={[styles.item, { color: theme.inverse.text }]}>
              Every set is saved, and you can see one exercise&apos;s history at a time. That is all
              — there is nothing to compare a week against.
            </Text>
            <Text style={[T.eyebrow, { color: theme.inverse.accentMuted }]}>WITH ONE</Text>
            <Text style={[styles.item, { color: theme.inverse.text }]}>
              Today knows what is next. Weeks can be compared to each other. Streaks and adherence
              mean something. And the record becomes dense enough that coaching has something real
              to read.
            </Text>
          </View>
          <Text style={[T.note, { color: theme.inverse.textMuted }]}>
            Takes about two minutes, and you can stop anywhere — whatever you have made is kept.
          </Text>
        </OnboardingScaffold>
      </Frame>

      <Frame label="6a · Guided setup (live)">
        <GuidedSetupFlow host="onboarding" onExit={() => {}} onBack={() => {}} />
      </Frame>

      <Frame label="Delete account sheet">
        <View style={[styles.sheetFrame, { backgroundColor: theme.inverse.surface }]}>
          <Button label="Open the sheet" variant="ghostOnDark" onPress={() => setSheet(true)} />
          {/* A real RN Modal draws over the whole window, so leaving this
              open would hide every other frame in the gallery. */}
          <DeleteAccountSheet
            visible={sheet}
            onCancel={() => setSheet(false)}
            onConfirm={() => setSheet(false)}
          />
        </View>
      </Frame>
    </ScrollView>
  );
}

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.frame}>
      <Text style={[styles.label, { color: theme.text.disabled }]}>{label.toUpperCase()}</Text>
      <View
        style={[
          styles.phone,
          /* Onboarding is dark end to end now, so the frame has to be too —
             a light frame around a dark screen reads as a bug. */
          { borderColor: theme.border.subtle, backgroundColor: theme.inverse.surface },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 24, padding: 24, alignItems: 'flex-start' },
  frame: { gap: 8 },
  label: { fontSize: 10, letterSpacing: 1, fontWeight: '500' },
  phone: { ...PHONE, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  centre: { textAlign: 'center' },
  sheetFrame: { flex: 1, justifyContent: 'flex-end', padding: 24 },
  /* Mirrors OnboardingFlow's `card` — keep the two in step, or this frame
     stops being evidence about the shipped screen. */
  card: { borderRadius: 12, padding: 16, gap: 12 },
  item: { fontSize: 13, lineHeight: 19 },
});
