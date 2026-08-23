import { type ReactNode } from 'react';
import { Modal, View, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing } from '@setframe/design-tokens';
import { useTheme } from '../theme/ThemeProvider';

export interface SheetProps {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
  /** Percent of screen height the sheet may grow to. Defaults to 85. */
  maxHeightPercent?: number;
  /** Tapping the dimmed area outside the sheet closes it. Defaults to false,
   * matching the prior per-component behavior for AddExercisePicker/
   * ExerciseEditSheet (Select and the wizard's action sheet opt in). */
  dismissOnBackdropPress?: boolean;
  /** Applied to the tappable backdrop, so tests can target it directly. */
  backdropTestID?: string;
  /** Sheet border, before this primitive existed some callers had one and
   * some didn't. Defaults to true. */
  bordered?: boolean;
  /** Gap between direct children. Defaults to `spacing[12]`. */
  gap?: number;
  /** Base padding on each side before safe-area insets are added (insets
   * only ever add to bottom/left/right, never shrink below this). Defaults
   * to `spacing[16]` on every side. */
  padding?: { top?: number; bottom?: number; left?: number; right?: number };
}

/**
 * Shared bottom-sheet primitive (Story 20). Previously AddExercisePicker,
 * ExerciseEditSheet, Select, and the program-wizard action sheet each
 * hand-rolled their own `Modal` + backdrop/sheet `View` with no keyboard
 * handling at all, so the iOS keyboard could obscure sheet content (a
 * search input, a numeric field) with nothing in app code compensating.
 * Wrapping every sheet in one `KeyboardAvoidingView` + safe-area-aware
 * primitive fixes it once instead of four times.
 */
export function Sheet({
  visible,
  onRequestClose,
  children,
  maxHeightPercent = 85,
  dismissOnBackdropPress = false,
  backdropTestID,
  bordered = true,
  gap = spacing[12],
  padding = {},
}: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const base = { top: spacing[16], bottom: spacing[16], left: spacing[16], right: spacing[16], ...padding };

  const sheet = (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: theme.surface.raised,
          borderWidth: bordered ? 1 : 0,
          borderColor: theme.border.default,
          gap,
          maxHeight: `${maxHeightPercent}%`,
          paddingTop: base.top,
          paddingBottom: Math.max(base.bottom, insets.bottom),
          paddingLeft: base.left + insets.left,
          paddingRight: base.right + insets.right,
        },
      ]}
    >
      {children}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onRequestClose}>
      <KeyboardAvoidingView style={styles.backdropLayout} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {dismissOnBackdropPress ? (
          // Nesting a second Pressable around the sheet content, rather than
          // relying on DOM-style event propagation (RN's gesture responder
          // system has no `stopPropagation`), so a tap that lands on the
          // sheet claims the touch responder before it can reach the
          // backdrop's own onPress.
          <Pressable testID={backdropTestID} style={styles.backdropLayout} onPress={onRequestClose}>
            <Pressable onPress={() => {}}>{sheet}</Pressable>
          </Pressable>
        ) : (
          <View testID={backdropTestID} style={styles.backdropLayout}>{sheet}</View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropLayout: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
  },
});
