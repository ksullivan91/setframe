import { View, Text, StyleSheet, Pressable } from 'react-native';
import { spacing } from '@setframe/design-tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/getTheme';

/** Where the flow was opened from. The only host-aware thing in the flow. */
export type SetupHost = 'onboarding' | 'training';

/**
 * The bar at the top of guided setup — and the ONLY part of the flow that
 * knows which host it is in.
 *
 * Figma `339:1170 · One flow, two hosts`. It differs in exactly three
 * ways, listed there:
 *
 * | | onboarding | training |
 * |---|---|---|
 * | left   | plain chevron        | "‹ Training" |
 * | middle | "Step 3 of 4"        | the plan name, or "New plan" |
 * | right  | "Skip" → step 7      | "Save & exit" → Training |
 *
 * Nothing else may branch on the host. A step that needs to know is a
 * design smell — raise it rather than adding a second branch, because
 * that is how this repo ended up with two divergent exercise pickers
 * before story 78 unified them.
 */
export function SetupChrome({
  host,
  step,
  totalSteps,
  planName,
  onBack,
  onExit,
}: {
  host: SetupHost;
  step: number;
  totalSteps: number;
  planName?: string | null;
  onBack?: () => void;
  onExit: () => void;
}) {
  const theme = useTheme();
  const middle =
    host === 'onboarding' ? `Step ${step} of ${totalSteps}` : (planName ?? 'New plan');
  const exit = host === 'onboarding' ? 'Skip' : 'Save & exit';

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={host === 'onboarding' ? 'Back' : 'Back to Training'}
        onPress={onBack}
        disabled={!onBack}
        hitSlop={10}
        style={styles.side}
        testID="setup-back"
      >
        <Text
          style={[
            styles.sideLabel,
            { color: onBack ? theme.inverse.accentMuted : 'transparent' },
          ]}
        >
          {host === 'onboarding' ? '‹' : '‹  Training'}
        </Text>
      </Pressable>

      <Text numberOfLines={1} style={[styles.middle, { color: theme.inverse.textMuted }]}>
        {middle}
      </Text>

      {/* Always present. Guided setup used to have no exit of its own — only
          its sub-sheets had Cancel — so the OS back gesture was the only way
          out of a flow that also refused to finish without a schedule. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={exit}
        onPress={onExit}
        hitSlop={10}
        style={[styles.side, styles.right]}
        testID="setup-exit"
      >
        <Text style={[styles.sideLabel, styles.rightLabel, { color: theme.inverse.accentMuted }]}>
          {exit}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[8],
    gap: spacing[8],
  },
  side: { minWidth: 96 },
  right: { alignItems: 'flex-end' },
  sideLabel: { fontSize: typeScale.button.fontSize, fontWeight: '600' },
  rightLabel: { textAlign: 'right' },
  middle: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '500' },
});
