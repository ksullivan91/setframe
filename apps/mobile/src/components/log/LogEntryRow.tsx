import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Plus } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, typeScale } from '../../theme/getTheme';

/**
 * Where a save has got to.
 *
 * Mirrors the contract WorkoutSessionScreenV2 already uses: `onMutate`
 * writes the value into the cache and returns the previous copy, `onError`
 * puts it back, `onSuccess` clears the flag.
 */
export type EntrySyncState = 'settled' | 'pending' | 'error';

export interface LogEntryRowProps {
  label: string;
  /** The value, or null when nothing has been recorded. */
  value: string | null;
  /** Shown in place of a value. */
  emptyLabel: string;
  state?: EntrySyncState;
  /** Absent on a past date, where the row is a record rather than a control. */
  onPress?: () => void;
  onRetry?: () => void;
  testID?: string;
}

export function LogEntryRow({
  label,
  value,
  emptyLabel,
  state = 'settled',
  onPress,
  onRetry,
  testID,
}: LogEntryRowProps) {
  const theme = useTheme();
  const readOnly = !onPress;

  /* Retry is a sibling of the row's own press target, never a child of it.
     Nesting them produces a button inside a button — invalid markup on web,
     and on native the outer touchable swallows the inner one's presses, so
     Retry would silently reopen the editor instead of retrying. */
  return (
    <View style={[styles.row, { backgroundColor: theme.surface.raised }]}>
      <Pressable
        testID={testID}
        accessibilityRole={readOnly ? undefined : 'button'}
        accessibilityLabel={`${label}. ${value ?? emptyLabel}`}
        disabled={readOnly}
        onPress={onPress}
        style={({ pressed }) => [styles.pressArea, { opacity: pressed && !readOnly ? 0.8 : 1 }]}
      >
        <View style={styles.meta}>
          <Text style={[styles.label, { color: theme.text.primary }]}>{label}</Text>
          {state === 'error' ? (
          <View style={styles.statusLine}>
            {/* The colour is in the dot and the meaning is in the words:
                status.error is 2.85:1 on white and fails as text. */}
            <View style={[styles.dot, { backgroundColor: theme.status.error }]} />
            <Text style={[styles.errorText, { color: theme.status.errorText }]}>
              Couldn’t save — still on your phone
            </Text>
          </View>
        ) : (
          <View style={styles.statusLine}>
            <Text
              style={[styles.value, { color: value ? theme.text.secondary : theme.text.disabled }]}
              numberOfLines={2}
            >
              {value ?? emptyLabel}
            </Text>
            {state === 'pending' ? (
              <>
                <View style={[styles.dot, styles.pendingDot, { backgroundColor: theme.text.disabled }]} />
                <Text style={[styles.pending, { color: theme.text.secondary }]}>Saving</Text>
              </>
            ) : null}
          </View>
        )}
        </View>
        {/* The chevron and the plus live *inside* the press target. As
            siblings of it they looked like the button and did nothing when
            tapped — which is the part of the row people aim at. Only Retry
            stays outside, because it is a different action. */}
        {readOnly || state === 'error' ? null : value ? (
          <ChevronRight size={18} color={theme.text.secondary} />
        ) : (
          <Plus size={18} color={theme.action.primary} />
        )}
      </Pressable>

      {state === 'error' && onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Retry saving ${label}`}
          onPress={onRetry}
          hitSlop={12}
          testID={`${testID}-retry`}
        >
          <Text style={[styles.retry, { color: theme.action.primary }]}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[12],
    borderRadius: radius.small,
    padding: spacing[16],
    minHeight: 44,
  },
  /* The press target fills the row so the whole card is tappable, with
     Retry sitting outside it. */
  pressArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[12],
  },
  meta: { gap: spacing[4] },
  label: { fontSize: typeScale.compactBody.fontSize, fontWeight: '500' },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  value: { flexShrink: 1, fontSize: typeScale.label.fontSize },
  dot: { width: 8, height: 8, borderRadius: 999 },
  pendingDot: { width: 6, height: 6 },
  pending: { fontSize: typeScale.caption.fontSize },
  errorText: { flexShrink: 1, fontSize: typeScale.label.fontSize, fontWeight: '500' },
  retry: { fontSize: typeScale.label.fontSize, fontWeight: '500' },
});
