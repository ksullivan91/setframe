import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../Sheet';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, typeScale } from '../../theme/getTheme';

export interface FinishConfirmSheetProps {
  visible: boolean;
  /** Planned set rows with nothing written in them. */
  unloggedCount: number;
  /** True when the session has no exercises at all. */
  empty: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onKeepGoing: () => void;
  inline?: boolean;
}

/**
 * The confirmation between `Finish` and a completed session.
 *
 * Interaction spec §4: `Finish` is never disabled — "a disabled button in
 * that moment is the product arguing with the gym" — so finishing early is
 * handled by asking rather than by refusing. Unwritten rows are discarded,
 * never written as zeros, which is the one corruption that stays invisible
 * until a chart looks wrong months later.
 *
 * The empty case is its own wording. Finishing a session with nothing in it
 * still marks the day trained everywhere the app reads adherence, and
 * "0 sets unlogged" would be a strange way to say that.
 */
export function FinishConfirmSheet({
  visible,
  unloggedCount,
  empty,
  busy = false,
  onConfirm,
  onKeepGoing,
  inline,
}: FinishConfirmSheetProps) {
  const theme = useTheme();

  const title = empty
    ? 'Finish with nothing logged?'
    : `Finish with ${unloggedCount} set${unloggedCount === 1 ? '' : 's'} unlogged?`;
  const body = empty
    ? 'This workout has no sets in it. It will still count as a day you trained.'
    : 'They stay unlogged. A finished workout is still editable, so you can add them later.';

  return (
    <Sheet
      visible={visible}
      inline={inline}
      onRequestClose={onKeepGoing}
      dismissOnBackdropPress
      backdropTestID="finish-confirm-backdrop"
      bordered={false}
      gap={spacing[8]}
      padding={{ top: spacing[24], bottom: spacing[24], left: spacing[16], right: spacing[16] }}
    >
      <Text testID="finish-confirm-title" style={[styles.title, { color: theme.text.primary }]}>
        {title}
      </Text>
      <Text style={[styles.body, { color: theme.text.secondary }]}>{body}</Text>

      <Pressable
        testID="finish-confirm"
        accessibilityRole="button"
        disabled={busy}
        onPress={onConfirm}
        style={({ pressed }) => [
          styles.action,
          { backgroundColor: theme.action.primary, opacity: pressed || busy ? 0.8 : 1 },
        ]}
      >
        <Text style={[styles.actionLabel, { color: theme.text.primary }]}>Finish workout</Text>
      </Pressable>
      <Pressable
        testID="finish-keep-going"
        accessibilityRole="button"
        onPress={onKeepGoing}
        style={({ pressed }) => [
          styles.action,
          { backgroundColor: theme.surface.raised, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[styles.actionLabel, { color: theme.text.primary }]}>Keep going</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typeScale.pageTitle.fontSize, fontWeight: '600' },
  body: { fontSize: typeScale.compactBody.fontSize, lineHeight: 19, marginBottom: spacing[8] },
  action: { height: 48, borderRadius: radius.small, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: typeScale.compactBody.fontSize, fontWeight: '600' },
});
