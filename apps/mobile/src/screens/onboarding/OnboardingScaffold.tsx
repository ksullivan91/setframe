import { type ReactNode } from 'react';
import { View, ScrollView, StyleSheet, Animated } from 'react-native';
import { spacing } from '@setframe/design-tokens';
/* getTheme re-types typeScale concretely — the package exports it as a
   Record, which noUncheckedIndexedAccess makes possibly-undefined. */
import { typeScale } from '../../theme/getTheme';
import { useTheme } from '../../theme/ThemeProvider';
import { useScreenTopPadding, useStackBottomPadding } from '../../lib/useScreenInsets';
import { useStepTransition } from '../../lib/useStepTransition';

/**
 * The shell every onboarding step renders inside.
 *
 * Same division as guided setup's scaffold, for the same reason: the frame
 * is owned here so a step contributes only its content, and the action
 * stack never moves between steps.
 *
 * Figma page `🚀 Onboarding`, section `334:1177`.
 */
export function OnboardingScaffold({
  children,
  actions,
  testID,
  stepIndex = 0,
  step = null,
  totalSteps = 4,
}: {
  children: ReactNode;
  actions: ReactNode;
  testID?: string;
  /** Position in the flow, so the body can move in the right direction. */
  stepIndex?: number;
  /**
   * Which of the four numbered steps this screen is, or `null` for the ones
   * outside the count — Welcome, and the closing screen where all four read
   * as complete.
   */
  step?: number | null;
  totalSteps?: number;
}) {
  const theme = useTheme();
  const motion = useStepTransition(stepIndex);
  /* Figma puts the body 72 from the top of an 844pt frame that draws no
     status bar; that frame's safe-area top is 47, so the designed gutter
     below the inset is 24 -- the same 24 the body uses on its sides. */
  const topPadding = useScreenTopPadding(spacing[24]);
  const bottomPadding = useStackBottomPadding(spacing[24]);

  return (
    /* Onboarding is dark end to end.
     *
     * Log's hero is a dark panel on a light canvas because the day around it
     * is a record. Onboarding is one message per screen, so the screen *is*
     * the panel. `theme.inverse` is the token group that exists for exactly
     * this — a deliberately dark surface inside whichever theme is active,
     * with its own text, muted text and accent steps. */
    <View
      testID={testID}
      style={[styles.fill, { backgroundColor: theme.inverse.surface, paddingTop: topPadding }]}
    >
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* Only the body moves. The action stack below is outside this and
            stays put, which is what makes the flow feel like one screen
            changing its question rather than a series of screens. */}
        <Animated.View style={[styles.stepBody, motion]}>
          {step != null ? (
            <View style={styles.steps} accessibilityLabel={`Step ${step} of ${totalSteps}`}>
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((n) => (
                <View
                  key={n}
                  style={[
                    styles.stepDot,
                    /* The current step is a bar rather than a dot, so the
                       sequence has a direction as well as a position. */
                    n === step && styles.stepDotCurrent,
                    { backgroundColor: n <= step ? theme.inverse.accent : theme.inverse.raised },
                  ]}
                />
              ))}
            </View>
          ) : null}
          {children}
        </Animated.View>
      </ScrollView>
      <View style={[styles.actions, { paddingBottom: bottomPadding }]}>{actions}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: spacing[24], paddingBottom: spacing[24] },
  stepBody: { gap: spacing[16] },
  steps: { flexDirection: 'row', gap: spacing[4] },
  stepDot: { width: 6, height: 6, borderRadius: 999 },
  stepDotCurrent: { width: 20 },
  actions: { paddingHorizontal: spacing[24], paddingTop: spacing[12], gap: spacing[8] },
});

/**
 * Onboarding's type, on the scale.
 *
 * 28, 34, 15, 10 were none of them steps in `typeScale` — the frames were
 * drawn off it and the code copied them. Titles are `display`, copy is
 * `body`, notes are `label`, eyebrows are `caption`.
 */
export const onboardingText = StyleSheet.create({
  title: { fontSize: typeScale.display.fontSize, lineHeight: typeScale.display.lineHeight, fontWeight: '600' },
  hero: { fontSize: typeScale.display.fontSize, lineHeight: typeScale.display.lineHeight, fontWeight: '600' },
  body: { fontSize: typeScale.body.fontSize, lineHeight: typeScale.body.lineHeight },
  note: { fontSize: typeScale.label.fontSize, lineHeight: 17 },
  eyebrow: { fontSize: typeScale.caption.fontSize, fontWeight: '500', letterSpacing: 0.6 },
});
