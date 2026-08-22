import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { ProgressOverviewResponse } from '@setframe/schemas';
import { ConsistencyStreakGrid } from '../../src/components/ConsistencyStreakGrid';
import { TrendCard } from '../../src/components/TrendCard';
import { useApiClient } from '../../src/lib/api-client';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing, typeScale } from '../../src/theme/getTheme';

export default function ProgressScreen() {
  const theme = useTheme();
  const api = useApiClient();
  const query = useQuery({
    queryKey: ['progress-overview'],
    queryFn: () => api.get<ProgressOverviewResponse>('/progress/overview?weeks=8'),
  });

  const consistencySummaryLabel = useMemo(() => {
    if (!query.data) return '';
    const { currentStreakWeeks, totalCompleted, totalPlanned } = query.data.consistency.summary;
    return `${currentStreakWeeks}-week streak · ${totalCompleted} of ${totalPlanned} planned sessions completed`;
  }, [query.data]);

  const hasAnyHistory = useMemo(() => {
    if (!query.data) return false;
    return (
      query.data.consistency.summary.totalCompleted > 0 ||
      query.data.bodyWeight.points.length > 0 ||
      (query.data.featuredExercise?.points.length ?? 0) > 0
    );
  }, [query.data]);

  return (
    <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Progress</Text>
        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
          Review trends that help you understand what is changing — and what to do next.
        </Text>
      </View>

      {query.isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color={theme.action.primary} />
          <Text style={[styles.stateText, { color: theme.text.secondary }]}>Loading progress…</Text>
        </View>
      ) : query.isError || !query.data ? (
        <View style={styles.centeredState}>
          <Text style={[styles.stateTitle, { color: theme.text.primary }]}>Couldn't load progress.</Text>
          <Text style={[styles.stateText, { color: theme.text.secondary }]}>
            Pull to refresh and try again.
          </Text>
        </View>
      ) : !hasAnyHistory ? (
        <View style={styles.centeredState}>
          <Text style={[styles.stateTitle, { color: theme.text.primary }]}>No training history yet</Text>
          <Text style={[styles.stateText, { color: theme.text.secondary }]}>
            Complete a workout or log a morning weight to unlock your trends.
          </Text>
        </View>
      ) : (
        <>
          {query.data.cards.map((card) => (
            <TrendCard
              key={card.key}
              label={card.label}
              value={card.value}
              delta={card.detail ?? ' '}
              deltaVariant={card.status === 'positive' ? 'success' : 'muted'}
              sparkline={normalizeTrend(card.trend)}
            />
          ))}

          <ConsistencyStreakGrid
            weeks={query.data.consistency.weeks.map((week) => ({
              completed: week.completedCount,
              planned: Math.max(week.plannedCount, week.completedCount, 1),
            }))}
            summaryLabel={consistencySummaryLabel}
          />
        </>
      )}
    </ScrollView>
  );
}

function normalizeTrend(values: number[]) {
  if (values.length === 0) return [];
  const max = Math.max(...values, 1);
  return values.map((value) => value / max);
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[16],
    gap: spacing[16],
  },
  header: {
    gap: spacing[4],
  },
  title: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: typeScale.compactBody.fontSize,
  },
  centeredState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
    paddingVertical: spacing[24],
  },
  stateTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
    textAlign: 'center',
  },
  stateText: {
    fontSize: typeScale.compactBody.fontSize,
    textAlign: 'center',
  },
});
