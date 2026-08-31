import { useEffect, useRef } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
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
  /** Milliseconds before it clears itself. Omit for the sensible default. */
  durationMs?: number;
}

/**
 * `Toast/Error` + `Toast/Success` per style guide §8. Error toast
 * includes a visible "Retry now" action per §15's offline "retry failed
 * writes" requirement; success toast is a plain positive confirmation
 * (e.g. "Workout saved").
 */
export function Toast({ variant, message, actionLabel, onAction, onDismiss, durationMs }: ToastProps) {
  const theme = useTheme();

  /* It never went away. The only way to clear it was to tap it, and a
     caller that passed no `onDismiss` produced a toast that could not be
     dismissed at all — so every confirmation and every error sat on the
     screen for the rest of the session.

     `onDismiss` lives in a ref because callers pass an inline arrow
     (`onDismiss={() => setToast(null)}`), which is a new function on every
     render. Depending on it directly would reset the timer each render and
     reproduce the same bug in a subtler form. */
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const isActionable = Boolean(actionLabel && onAction);

  useEffect(() => {
    // A toast offering a retry waits for the decision rather than vanishing
    // mid-reach.
    if (isActionable || !dismissRef.current) return;
    const timeout = setTimeout(
      () => dismissRef.current?.(),
      durationMs ?? (variant === 'error' ? 5000 : 3000),
    );
    return () => clearTimeout(timeout);
    // `message` is in here so a second toast restarts the clock rather than
    // inheriting the remainder of the first one's.
  }, [message, variant, durationMs, isActionable]);

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
