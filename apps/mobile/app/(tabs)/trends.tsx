import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing, typeScale } from '../../src/theme/getTheme';
import { useScreenTopPadding } from '../../src/lib/useScreenInsets';

/**
 * Trends — what your body is doing.
 *
 * Story 77 fills this in: Body / Recovery / Activity / Capacity over a
 * 30/90/365-day range. It is a stub because the data does not exist yet —
 * `/v1/daily/:localDate` and `/v1/dashboard/today` are both single-date and
 * nothing serves resting HR, sleep, HRV, steps, active energy or VO₂ max as
 * a series. Body weight is the exception: `/v1/progress/overview` already
 * returns a `bodyWeight` series.
 *
 * The tab exists now so the navigation shape (ADR 0013) is real and Log can
 * link into it, rather than shipping a link to nowhere.
 */
export default function TrendsScreen() {
  const theme = useTheme();
  const topPadding = useScreenTopPadding(spacing[24]);

  return (
    <ScrollView
      style={{ backgroundColor: theme.surface.canvas }}
      contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
    >
      <Text style={[styles.title, { color: theme.text.primary }]}>Trends</Text>
      <View style={[styles.card, { backgroundColor: theme.surface.raised }]}>
        <Text style={[styles.body, { color: theme.text.secondary }]}>
          Weight, resting heart rate, sleep and VO₂ max over time will live here.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[24], paddingBottom: spacing[24], gap: spacing[16] },
  title: { fontSize: 26, fontWeight: '600' },
  card: { borderRadius: 8, padding: spacing[16] },
  body: { fontSize: typeScale.body.fontSize, lineHeight: typeScale.body.lineHeight },
});
