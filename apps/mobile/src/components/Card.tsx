import { View, StyleSheet, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '@setframe/design-tokens';

/**
 * Card primitive per style guide §6 — used only for genuinely distinct
 * groupings (e.g. an exercise block, a trend card), not every row, per
 * setframe-design-system.md §5's warning against "everything is a
 * floating card."
 */
export interface CardProps extends ViewProps {
  /**
   * `inverse` paints the card on the dark ground the workout logger uses.
   *
   * The logger's rule is that a card carrying the session's own content is
   * dark; a light card below a dark completion banner and dark exercise
   * tables reads as a different app. Text inside an inverse card must take
   * its colours from `theme.inverse.*` to match.
   */
  tone?: 'default' | 'inverse';
}

export function Card({ children, style, tone = 'default', ...rest }: CardProps) {
  const theme = useTheme();
  const inverse = tone === 'inverse';
  return (
    <View
      style={[
        styles.base,
        inverse
          ? { backgroundColor: theme.inverse.raised, borderColor: 'transparent' }
          : { backgroundColor: theme.surface.raised, borderColor: theme.border.subtle },
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
