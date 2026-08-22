import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CircleCheck, CircleX } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/getTheme';

export interface ToastProps {
  variant: 'success' | 'error';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

/**
 * `Toast/Error` + `Toast/Success` per style guide §8. Error toast
 * includes a visible "Retry now" action per §15's offline "retry failed
 * writes" requirement; success toast is a plain positive confirmation
 * (e.g. "Workout saved").
 */
export function Toast({ variant, message, actionLabel, onAction, onDismiss }: ToastProps) {
  const theme = useTheme();
  const Icon = variant === 'success' ? CircleCheck : CircleX;
  const accent = variant === 'success' ? theme.status.success : theme.status.error;

  return (
    <Pressable
      onPress={onDismiss}
      style={[styles.container, { backgroundColor: '#151522' }]}
    >
      <Icon size={20} color={accent} />
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[styles.action, { color: variant === 'error' ? theme.status.error : theme.status.success }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    borderRadius: radius.small,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
  },
  message: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: typeScale.body.fontSize,
  },
  action: {
    fontSize: typeScale.button.fontSize,
    fontWeight: '600',
  },
});
