import { type ReactNode } from 'react';
import { View, ScrollView, StyleSheet, Animated } from 'react-native';
import { spacing } from '@setframe/design-tokens';
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
}: {
  children: ReactNode;
  actions: ReactNode;
  testID?: string;
  /** Position in the flow, so the body can move in the right direction. */
  stepIndex?: number;
}) {
  const theme = useTheme();
  const motion = useStepTransition(stepIndex);
  /* Figma puts the body 72 from the top of an 844pt frame that draws no
     status bar; that frame's safe-area top is 47, so the designed gutter
     below the inset is 24 -- the same 24 the body uses on its sides. */
  const topPadding = useScreenTopPadding(spacing[24]);
  const bottomPadding = useStackBottomPadding(spacing[24]);

  return (
    <View
      testID={testID}
      style={[styles.fill, { backgroundColor: theme.surface.canvas, paddingTop: topPadding }]}
    >
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* Only the body moves. The action stack below is outside this and
            stays put, which is what makes the flow feel like one screen
            changing its question rather than a series of screens. */}
        <Animated.View style={[styles.stepBody, motion]}>{children}</Animated.View>
      </ScrollView>
      <View style={[styles.actions, { paddingBottom: bottomPadding }]}>{actions}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: spacing[24], paddingBottom: spacing[24] },
  stepBody: { gap: spacing[16] },
  actions: { paddingHorizontal: spacing[24], paddingTop: spacing[12], gap: spacing[8] },
});

export const onboardingText = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '600' },
  hero: { fontSize: 34, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22 },
  note: { fontSize: 12, lineHeight: 17 },
  eyebrow: { fontSize: 10, fontWeight: '500', letterSpacing: 0.6 },
});
