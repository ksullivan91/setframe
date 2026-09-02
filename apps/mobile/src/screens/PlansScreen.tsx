import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TrainingProgram } from '@setframe/schemas';
import { describeRepeatMode, planBadge, planSwitchLabel } from '@setframe/domain';
import { training, workoutEditor } from '@setframe/design-tokens';
import { useApiClient } from '../lib/api-client';
import { ListRowsSkeleton } from '../components/training-v2/TrainingSkeletons';
import { useScreenTopPadding } from '../lib/useScreenInsets';
import { useTheme } from '../theme/ThemeProvider';
import { Card } from '../components/training-v2/TrainingCards';
import { Toast } from '../components/Toast';

/**
 * "Your plans". Counterpart of `apps/web/src/pages/PlansPage.tsx`.
 *
 * Figma: `Explore/Mobile/Training 8 · Later — switch plans` (151:708).
 *
 * Switching is a pointer move — `program_version` keeps the history — so it
 * needs no confirmation. The reassurance is in the copy rather than a dialog.
 */
export function PlansScreen() {
  const api = useApiClient();
  const router = useRouter();
  const theme = useTheme();
  /* These screens draw their own header with `headerShown: false`, so
     nothing reserves space for the status bar or the Dynamic Island — the
     header, including its back chevron, rendered underneath both and could
     not be tapped. `useScreenTopPadding` already existed for exactly this
     and had simply never been wired into the v2 screens. */
  const topPadding = useScreenTopPadding(workoutEditor.header.paddingTop);
  const queryClient = useQueryClient();

  const programsQuery = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.get<TrainingProgram[]>('/programs'),
  });
  const programs = programsQuery.data ?? [];

  const [error, setError] = useState<string | null>(null);

  const activate = useMutation({
    mutationFn: (programId: string) => api.post(`/programs/${programId}/activate`),
    onSuccess: async () => {
      // Today's plan comes from the same programs query, so both screens
      // need to hear about the switch before we navigate back to one.
      await queryClient.invalidateQueries({ queryKey: ['programs'] });
      await queryClient.invalidateQueries({ queryKey: ['today'] });
      router.back();
    },
    /* This had no error path at all. When the request failed the button
       simply did nothing — no spinner, no message, no clue — which is how a
       plain 400 read to the user as a dead control. Anything that can fail
       silently eventually will. */
    onError: () => setError('Could not switch plans. Try again.'),
  });

  const sorted = useMemo(
    () => [...programs].sort((a, b) => Number(b.isActive) - Number(a.isActive)),
    [programs],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface.canvas }} testID="plans-page">
      <View style={[styles.header, { backgroundColor: theme.surface.raised, paddingTop: topPadding }]}>
        <View style={styles.titleRow}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Back to Training">
            <Text style={[styles.back, { color: theme.text.secondary }]}>‹</Text>
          </Pressable>
          <Text style={[styles.title, { color: theme.text.primary }]}>Your plans</Text>
        </View>
        <Text style={[styles.meta, { color: theme.text.secondary }]}>
          One drives Today. The rest keep their history.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Skeletons, not an empty list. Rendering `programs = []` while
            the query is in flight tells a user with four plans that they
            have none — the same defect Today's week strip had, where the
            week read "Rest" every day until the slots arrived. */}
        {programsQuery.isPending ? (
          <ListRowsSkeleton />
        ) : (
        sorted.map((program) => {
          const badge = planBadge(program.isActive);
          return (
            <Card key={program.id} testID={`plan-${program.id}`}>
              <View style={styles.planLeft}>
                <View style={styles.nameRow}>
                  <Text style={[styles.planName, { color: theme.text.primary }]} numberOfLines={1}>
                    {program.name}
                  </Text>
                  {/* Says what it DOES rather than using the word Active. */}
                  {badge ? (
                    <View style={[styles.badge, { backgroundColor: theme.action.accentSubtle }]}>
                      <Text style={[styles.badgeLabel, { color: theme.action.primary }]}>
                        {badge}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.planMeta, { color: theme.text.secondary }]}>
                  {describeRepeatMode(program.cycleLengthWeeks ?? null)}
                </Text>
              </View>
              {program.isActive ? null : (
                <Pressable
                  onPress={() => {
                    setError(null);
                    activate.mutate(program.id);
                  }}
                  disabled={activate.isPending}
                  accessibilityRole="button"
                  testID={`use-plan-${program.id}`}
                  style={[styles.use, { backgroundColor: theme.surface.sunken }]}
                >
                  <Text style={[styles.useLabel, { color: theme.action.primary }]}>
                    {planSwitchLabel(!!program.startDate)}
                  </Text>
                </Pressable>
              )}
            </Card>
          );
        }))}

        {/* Answered before they press, because it is the thing a user would
            most reasonably fear about these buttons. */}
        <Text style={[styles.note, { color: theme.text.secondary }]}>
          Switching keeps everything. Your logged workouts stay with the plan you did them on, and
          you can come back to it.
        </Text>

        <Pressable
          onPress={() => router.push('/guided-setup')}
          accessibilityRole="button"
          testID="new-plan"
          style={[styles.newPlan, { backgroundColor: theme.surface.sunken }]}
        >
          <Text style={[styles.newPlanLabel, { color: theme.action.primary }]}>+ New plan</Text>
        </Pressable>
      </ScrollView>

      {error ? <Toast variant="error" message={error} onDismiss={() => setError(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: workoutEditor.header.paddingTop,
    paddingBottom: workoutEditor.header.paddingBottom,
    paddingHorizontal: 12,
    gap: workoutEditor.header.gap,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { fontSize: workoutEditor.header.backSize, fontWeight: '600', width: 24 },
  title: { fontSize: workoutEditor.header.titleSize, fontWeight: '600' },
  meta: { fontSize: workoutEditor.header.metaSize, paddingLeft: 4 },
  body: { padding: training.bodyPaddingX, gap: training.cardGap },
  planLeft: { gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planName: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  badgeLabel: { fontSize: 10, fontWeight: '600' },
  planMeta: { fontSize: 12 },
  use: { height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  useLabel: { fontSize: 13, fontWeight: '600' },
  note: { fontSize: 12 },
  newPlan: {
    width: training.cardWidth,
    maxWidth: '100%',
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newPlanLabel: { fontSize: 14, fontWeight: '600' },
});
