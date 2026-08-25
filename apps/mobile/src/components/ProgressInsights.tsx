import { View, Text, Pressable, StyleSheet } from 'react-native';
import { radius, spacing } from '@setframe/design-tokens';
import type { OverviewInsight } from '@setframe/domain';
import { useTheme } from '../theme/ThemeProvider';
import { typeScale } from '../theme/getTheme';

/**
 * The "what's changed" strip at the top of Progress.
 *
 * Story 51, and the mobile half of a deliberate parity pair — see
 * `apps/web/src/components/ProgressInsights.tsx`. Both render the *same*
 * sentences from `buildOverviewInsights`/`describeInsight` in
 * `packages/domain`; neither picks words of its own. Only the rendering
 * primitives differ, which is exactly the split ADR 0008 describes and the
 * reason the copy cannot drift between platforms.
 *
 * Renders nothing when there is nothing worth saying. An "insight" that
 * restates the number already shown below it is worse than silence.
 *
 * Nothing is coloured by direction: a user deliberately gaining is
 * succeeding when the number rises, and this component has no access to
 * their goal. See docs/research/body-weight-display-psychology.md.
 */

/**
 * Data-quality flags worth stating in plain sight. Kept identical to the web
 * component's copy on purpose — same payload, same words.
 */
function caveatFor(insight: OverviewInsight['insight']): string | null {
  if (insight.dataQuality.includes('sparse_previous_period')) {
    return 'Based on few readings last period, so treat the comparison loosely.';
  }
  if (insight.dataQuality.includes('sparse_current_period')) {
    return 'Based on few readings so far this period.';
  }
  return null;
}

export interface ProgressInsightsProps {
  insights: OverviewInsight[];
  /**
   * Focus the chart backing an insight. Optional: without it the sentences
   * render as plain text rather than as controls that go nowhere.
   */
  onFocus?: (insight: OverviewInsight) => void;
}

export function ProgressInsights({ insights, onFocus }: ProgressInsightsProps) {
  const theme = useTheme();

  if (insights.length === 0) return null;

  return (
    <View
      testID="progress-insights"
      style={[
        styles.container,
        { backgroundColor: theme.surface.raised, borderColor: theme.border.subtle },
      ]}
    >
      <Text style={[styles.heading, { color: theme.text.secondary }]}>WHAT’S CHANGED</Text>
      {insights.map((item) => {
        const caveat = caveatFor(item.insight);
        const body = (
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.text.secondary }]}>{item.label}</Text>
            <View style={styles.sentenceColumn}>
              <Text style={[styles.sentence, { color: theme.text.primary }]}>{item.sentence}</Text>
              {caveat ? (
                <Text style={[styles.caveat, { color: theme.text.secondary }]}>{caveat}</Text>
              ) : null}
            </View>
          </View>
        );

        return onFocus ? (
          <Pressable
            key={item.metric}
            testID={`progress-insight-${item.metric}`}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}. ${item.sentence}`}
            onPress={() => onFocus(item)}
          >
            {body}
          </Pressable>
        ) : (
          <View key={item.metric} testID={`progress-insight-${item.metric}`}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.large,
    borderWidth: 1,
    padding: spacing[12],
    gap: spacing[8],
  },
  heading: {
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.lineHeight,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    gap: spacing[8],
  },
  label: {
    fontSize: typeScale.body.fontSize,
    lineHeight: typeScale.body.lineHeight,
    fontWeight: '600',
  },
  sentenceColumn: {
    flex: 1,
    gap: spacing[4],
  },
  sentence: {
    fontSize: typeScale.body.fontSize,
    lineHeight: typeScale.body.lineHeight,
  },
  caveat: {
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.lineHeight,
  },
});
