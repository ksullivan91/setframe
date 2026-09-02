import { type ReactNode } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { spacing } from '@setframe/design-tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { useScreenTopPadding, useStackBottomPadding } from '../../lib/useScreenInsets';

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
}: {
  children: ReactNode;
  actions: ReactNode;
  testID?: string;
}) {
  const theme = useTheme();
  const topPadding = useScreenTopPadding(spacing[24] + spacing[16]);
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
        {children}
      </ScrollView>
      <View style={[styles.actions, { paddingBottom: bottomPadding }]}>{actions}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: spacing[24], paddingBottom: spacing[24], gap: spacing[12] + 2 },
  actions: { paddingHorizontal: spacing[24], paddingTop: spacing[12], gap: spacing[8] },
});

export const onboardingText = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '600' },
  hero: { fontSize: 34, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22 },
  note: { fontSize: 12, lineHeight: 17 },
  eyebrow: { fontSize: 10, fontWeight: '500', letterSpacing: 0.6 },
});
