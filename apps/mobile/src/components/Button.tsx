import { Pressable, Text, View, StyleSheet, ActivityIndicator, type GestureResponderEvent } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
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
  /**
   * Optional leading glyph, drawn before the label. Decorative only — the
   * label already names the action, and the accessible name comes from
   * `label`, so the icon is never the sole carrier of meaning.
   */
  icon?: LucideIcon;
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
  icon: Icon,
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
          : /* Secondary is a filled grey, not an outline. Every full-size
               secondary in the Figma file draws neutral-100 with no stroke
               (Skip, Not now, Add another workout, and the delete sheet's
               Cancel); the bordered-white version here predated them. */
            theme.surface.sunken;
  const textColor = variant === 'secondary' ? theme.text.primary : theme.action.primaryText;

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
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          width: fullWidth ? '100%' : undefined,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon size={16} color={textColor} /> : null}
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
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.small,
    minHeight: 44,
    /* `fullWidth` defaults to true, so two buttons side by side each asked
       for 100% of the row and the second was pushed clean off screen — the
       Dismiss button on Apple Health suggestions simply was not there, and
       six other rows (Cancel/Save on the activity sheet, both edit sheets,
       the picker footer) had the same defect unnoticed.
       `flexShrink` lets a row of them divide the space instead. */
    flexShrink: 1,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
  },
});
