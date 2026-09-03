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

  return (
    <Pressable
      testID={testID}
      accessibilityRole={readOnly ? undefined : 'button'}
      accessibilityLabel={`${label}. ${value ?? emptyLabel}`}
      disabled={readOnly}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.surface.raised, opacity: pressed && !readOnly ? 0.8 : 1 },
      ]}
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
                <Text style={[styles.pending, { color: theme.text.disabled }]}>Saving</Text>
              </>
            ) : null}
          </View>
        )}
      </View>

      {state === 'error' && onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={12} testID={`${testID}-retry`}>
          <Text style={[styles.retry, { color: theme.action.primary }]}>Retry</Text>
        </Pressable>
      ) : readOnly ? null : value ? (
        <ChevronRight size={18} color={theme.text.secondary} />
      ) : (
        <Plus size={18} color={theme.action.primary} />
      )}
    </Pressable>
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
  meta: { flex: 1, gap: spacing[4] },
  label: { fontSize: typeScale.compactBody.fontSize, fontWeight: '500' },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  value: { flexShrink: 1, fontSize: typeScale.label.fontSize },
  dot: { width: 8, height: 8, borderRadius: 999 },
  pendingDot: { width: 6, height: 6 },
  pending: { fontSize: typeScale.caption.fontSize },
  errorText: { flexShrink: 1, fontSize: typeScale.label.fontSize, fontWeight: '500' },
  retry: { fontSize: typeScale.label.fontSize, fontWeight: '500' },
});
