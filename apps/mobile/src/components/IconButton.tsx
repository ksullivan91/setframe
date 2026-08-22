import { Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '@setframe/design-tokens';

export interface IconButtonProps {
  icon: LucideIcon;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: 'default' | 'subtle';
  size?: number;
  accessibilityLabel: string;
  testID?: string;
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
}: IconButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: variant === 'subtle' ? theme.surface.sunken : theme.action.accentSubtle,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon size={Math.round(size * 0.55)} color={theme.action.primary} />
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
