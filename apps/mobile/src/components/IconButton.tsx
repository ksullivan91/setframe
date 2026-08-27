import { Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '@setframe/design-tokens';

export interface IconButtonProps {
  icon: LucideIcon;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: 'default' | 'subtle';
  /**
   * For a control that shows and hides something. Story 42.2 — the native
   * half of the disclosure contract: web gets `aria-expanded` from React
   * Aria, and VoiceOver needs the same state announced here rather than left
   * to be inferred from a chevron's direction, which it cannot see.
   */
  expanded?: boolean;
  size?: number;
  accessibilityLabel: string;
  testID?: string;
  /**
   * Dims the control and blocks presses, and — importantly — reports the
   * state to VoiceOver. A reorder arrow at the end of a list still needs to
   * be announced as present-but-unavailable rather than silently doing
   * nothing when tapped.
   */
  disabled?: boolean;
}

/**
 * IconButton per style guide §6 — 28-32px circular tap targets
 * (add/remove/duplicate/reorder), icon-only, no label, sized per §15's
 * "large targets" mobile intent. `size` sets the tap-target diameter;
 * the icon itself is drawn slightly smaller.
 */
export function IconButton({
  icon: Icon,
  onPress,
  variant = 'default',
  size = 32,
  accessibilityLabel,
  testID,
  disabled = false,
  expanded,
}: IconButtonProps) {
  const theme = useTheme();
  /* `disabled` is handed to Pressable rather than used to null `onPress`:
     Pressable already blocks the press, and removing the handler only made
     the control harder to find by its role in tests and accessibility
     tooling. */
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, ...(expanded === undefined ? {} : { expanded }) }}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: variant === 'subtle' ? theme.surface.sunken : theme.action.accentSubtle,
          opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon
        size={Math.round(size * 0.55)}
        color={disabled ? theme.text.disabled : theme.action.primary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
});
