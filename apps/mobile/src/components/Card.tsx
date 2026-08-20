import { View, StyleSheet, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '@setline/design-tokens';

/**
 * Card primitive per style guide §6 — used only for genuinely distinct
 * groupings (e.g. an exercise block, a trend card), not every row, per
 * setline-design-system.md §5's warning against "everything is a
 * floating card."
 */
export function Card({ children, style, ...rest }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: theme.surface.raised, borderColor: theme.border.subtle },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.large,
    borderWidth: 1,
    padding: spacing[16],
    gap: spacing[12],
  },
});
