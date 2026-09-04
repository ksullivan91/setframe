import { type ReactNode } from 'react';
import { View, ScrollView, StyleSheet, Animated } from 'react-native';
import { spacing } from '@setframe/design-tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { useScreenTopPadding, useStackBottomPadding } from '../../lib/useScreenInsets';
import { SetupChrome, type SetupHost } from './SetupChrome';
import { useStepTransition } from '../../lib/useStepTransition';

/**
 * The shell every guided-setup step renders inside.
 *
 * It owns the chrome and the action bar; a step contributes only its body.
 * That is what makes the flow one implementation rather than two, and it
 * is also what makes the transition work: because the chrome and actions
 * are rendered HERE, they never unmount between steps, so the header
 * genuinely stays put while the body changes. The Figma prototype fakes
 * that with Smart Animate interpolating between two copies of the same
 * header; this does it for real, and needs no shared-element tagging.
 *
 * The body transition uses React Native's own Animated rather than
 * reanimated: reanimated is a native module, so adding it would mean a
 * prebuild and a new binary before anyone could see a 180ms fade. Not a
 * trade worth making for this.
 */
export function SetupScaffold({
  host,
  step,
  totalSteps,
  planName,
  onBack,
  onExit,
  children,
  actions,
}: {
  host: SetupHost;
  step: number;
  totalSteps: number;
  planName?: string | null;
  onBack?: () => void;
  onExit: () => void;
  children: ReactNode;
  actions: ReactNode;
}) {
  const theme = useTheme();
  const topPadding = useScreenTopPadding(spacing[8]);
  const bottomPadding = useStackBottomPadding(spacing[24]);

  const motion = useStepTransition(step);

  return (
    <View style={[styles.fill, { backgroundColor: theme.inverse.surface, paddingTop: topPadding }]}>
      <SetupChrome
        host={host}
        step={step}
        totalSteps={totalSteps}
        planName={planName}
        onBack={onBack}
        onExit={onExit}
      />

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
      >
        {/* Only the body animates. A short rise reads as "the next
            question"; a full slide would imply the whole screen moved,
            which it did not — the header is the same header. */}
        <Animated.View
          style={{
            /* The gap lives HERE, not on the scroll content.
               Wrapping the step in one animated view left the content
               container with a single child, so its `gap` applied between
               nothing and every element inside sat flush — the label
               against the help text, the field against the card. */
            gap: spacing[16],
            ...motion,
          }}
        >
          {children}
        </Animated.View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: bottomPadding }]}>{actions}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: spacing[24] },
  actions: { paddingHorizontal: spacing[24], paddingTop: spacing[12], gap: spacing[8] },
});
