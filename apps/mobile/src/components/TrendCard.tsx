import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/getTheme';

export interface TrendCardProps {
  label: string;
  value: string;
  delta: string;
  deltaVariant?: 'success' | 'muted';
  /** 6-bar restrained sparkline, 0-1 normalized heights — no axis/gridlines per style guide §11. */
  sparkline: number[];
}

/**
 * Progress screen trend card per style guide §11/§19.3 — label -> big
 * value -> delta subtitle -> 6-bar sparkline. Deliberately restrained
 * (no charting library), matching "keep charts restrained" from the
 * ExerciseHistory precedent (§9).
 */
export function TrendCard({ label, value, delta, deltaVariant = 'success', sparkline }: TrendCardProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.surface.raised, borderColor: theme.border.subtle }]}>
      <Text style={[styles.label, { color: theme.text.secondary }]}>{label}</Text>
      <Text
        style={[
          styles.value,
          { color: theme.text.primary, fontSize: typeScale.numericMetric.fontSize, lineHeight: typeScale.numericMetric.lineHeight },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.delta, { color: deltaVariant === 'success' ? theme.status.success : theme.text.secondary }]}>
        {delta}
      </Text>
      <View style={styles.sparkline}>
        {sparkline.map((height, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              { height: Math.max(4, height * 32), backgroundColor: theme.action.accentSubtle },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.large,
    borderWidth: 1,
    padding: spacing[16],
    gap: spacing[4],
  },
  label: {
    fontSize: typeScale.label.fontSize,
  },
  value: {
    fontWeight: '600',
  },
  delta: {
    fontSize: typeScale.caption.fontSize,
  },
  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[4],
    marginTop: spacing[8],
  },
  bar: {
    width: 8,
    borderRadius: 2,
  },
});
