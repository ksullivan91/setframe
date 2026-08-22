import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/getTheme';

export interface MetricTileProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  /** Trend vs. 30-day average, per style guide §18 Idea 4. Omit to hide the trend row entirely (e.g. unavailable metric). */
  trend?: { direction: 'up' | 'down'; label: string } | null;
}

/**
 * `MetricTile` per style guide §5 (label -> big number -> trend row
 * anatomy) — used in Today's "From Apple Health" metric grid. §18 Idea 4
 * added the trend-vs-30-day-average line, colored green/red by
 * direction.
 */
export function MetricTile({ label, value, icon: Icon, trend }: MetricTileProps) {
  const theme = useTheme();
  const TrendIcon = trend?.direction === 'up' ? TrendingUp : TrendingDown;
  const trendColor = trend?.direction === 'up' ? theme.status.success : theme.status.error;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.raised, borderColor: theme.border.subtle }]}>
      <View style={styles.headerRow}>
        {Icon ? <Icon size={16} color={theme.text.secondary} /> : null}
        <Text style={[styles.label, { color: theme.text.secondary }]}>{label}</Text>
      </View>
      <Text
        style={[
          styles.value,
          {
            color: theme.text.primary,
            fontSize: typeScale.numericMetric.fontSize,
            lineHeight: typeScale.numericMetric.lineHeight,
          },
        ]}
      >
        {value}
      </Text>
      {trend ? (
        <View style={styles.trendRow}>
          <TrendIcon size={12} color={trendColor} />
          <Text style={[styles.trendLabel, { color: trendColor }]}>{trend.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexBasis: '48%',
    borderRadius: radius.large,
    borderWidth: 1,
    padding: spacing[12],
    gap: spacing[4],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  label: {
    fontSize: typeScale.label.fontSize,
    lineHeight: typeScale.label.lineHeight,
  },
  value: {
    fontWeight: '600',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  trendLabel: {
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.lineHeight,
  },
});
