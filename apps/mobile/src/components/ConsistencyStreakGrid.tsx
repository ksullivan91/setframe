import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/getTheme';

export interface ConsistencyStreakGridProps {
  /** One entry per week; `completed` of `planned` dots filled, per style guide §19.3. */
  weeks: { completed: number; planned: number }[];
  summaryLabel: string;
}

/**
 * "Consistency (last N weeks)" streak dot-grid widget per style guide
 * §19.3 — N columns of dots (one per planned session), filled dots bound
 * to Semantic/Action/Primary, empty to Semantic/Action/AccentSubtle, plus
 * a bold summary line. Backed by GET /v1/progress/consistency
 * (docs/api.md) and packages/domain's `summarizeConsistency`.
 */
export function ConsistencyStreakGrid({ weeks, summaryLabel }: ConsistencyStreakGridProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.surface.raised, borderColor: theme.border.subtle }]}>
      <Text style={[styles.title, { color: theme.text.primary }]}>Consistency (last {weeks.length} weeks)</Text>
      <View style={styles.grid}>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.column}>
            {Array.from({ length: Math.max(week.planned, 1) }).map((_, dotIndex) => (
              <View
                key={dotIndex}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      dotIndex < week.completed ? theme.action.primary : theme.action.accentSubtle,
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      <Text style={[styles.summary, { color: theme.text.primary }]}>{summaryLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.large,
    borderWidth: 1,
    padding: spacing[16],
    gap: spacing[12],
  },
  title: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    gap: spacing[4],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  summary: {
    fontSize: typeScale.compactBody.fontSize,
    fontWeight: '600',
  },
});
