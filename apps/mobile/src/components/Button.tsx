import { Pressable, Text, StyleSheet, ActivityIndicator, type GestureResponderEvent } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/getTheme';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'success';

export interface ButtonProps {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  testID?: string;
}

/**
 * Button/Primary|Secondary|Destructive per style guide §5/§6. Primary
 * fills with Semantic/Action/Primary; Secondary is outline-only
 * (Semantic/Border/Subtle stroke, per §18's "Preview" secondary CTA
 * next to "Start Workout"); Destructive uses Semantic/Action/Destructive
 * for the Settings "Delete account" row (§12).
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = true,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === 'primary'
      ? theme.action.primary
      : variant === 'destructive'
        ? theme.action.destructive
        : variant === 'success'
          ? theme.status.success
          : 'transparent';
  const textColor = variant === 'secondary' ? theme.text.primary : theme.action.primaryText;
  const borderColor = variant === 'secondary' ? theme.border.subtle : 'transparent';

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          borderColor,
          borderWidth: variant === 'secondary' ? 1 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          width: fullWidth ? '100%' : undefined,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text
          style={[
            styles.label,
            {
              color: textColor,
              fontSize: typeScale.button.fontSize,
              lineHeight: typeScale.button.lineHeight,
              fontWeight: typeScale.button.fontWeight as '600',
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.small,
    minHeight: 44,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
});
