import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Footprints, Flame, Clock, Utensils } from 'lucide-react-native';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { MetricTile } from '../../src/components/MetricTile';
import { SyncStatusPill, type SyncStatus } from '../../src/components/SyncStatusPill';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing, typeScale } from '../../src/theme/getTheme';
import { healthKit, type DailyHealthMetrics } from '../../src/healthkit/HealthKitAdapter';

/**
 * `Screen/Mobile/Today` per style guide §7/§18/§19 — date header, live
 * sync-status pill, "Updating health data…" reconciliation text, a
 * pre-workout preview card (Week/Day/duration per §18 Idea 5, backed by
 * `training_program.cycle_length_weeks` /
 * `workout_template.estimated_duration_minutes`), a "Today's check-in"
 * section (manual weight/BP, kept visually separate from HealthKit data
 * per §10's provenance rule), and a "From Apple Health" metric grid with
 * trend indicators (§18 Idea 4).
 *
 * TODO: replace the mocked `dashboard`/`metrics` state below with
 * `useQuery(['dashboard-today'], () => apiClient.get('/dashboard/today'))`
 * once apps/api's `/v1/dashboard/today` endpoint (docs/api.md) is live —
 * kept as local mock state for now so the screen renders meaningfully
 * without a running backend.
 */
export default function TodayScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [syncStatus] = useState<SyncStatus>('synced');
  const [weight, setWeight] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [metrics, setMetrics] = useState<DailyHealthMetrics | null>(null);

  useEffect(() => {
    let cancelled = false;
    healthKit.getTodayMetrics().then((result) => {
      if (!cancelled) setMetrics(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date();
  const dateLabel = today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={[styles.dateLabel, { color: theme.text.primary }]}>{dateLabel}</Text>
        <SyncStatusPill status={syncStatus} />
      </View>
      {syncStatus === 'syncing' ? (
        <Text style={[styles.reconcileNote, { color: theme.text.secondary }]}>Updating health data…</Text>
      ) : null}

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Push Day A</Text>
        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
          Week 2 · Day 3 · 5 exercises · ~45–55 min
        </Text>
        <View style={styles.ctaRow}>
          <View style={{ flex: 1 }}>
            <Button label="Start Workout" onPress={() => router.push('/(tabs)/training')} />
          </View>
          <View style={{ width: 88 }}>
            <Button label="Preview" variant="secondary" onPress={() => router.push('/program-editor')} />
          </View>
        </View>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Today's check-in</Text>
        <Input label="Morning weight" value={weight} onChangeText={setWeight} numeric unit="lb" />
        <View style={styles.bpRow}>
          <View style={{ flex: 1 }}>
            <Input label="Systolic" value={systolic} onChangeText={setSystolic} numeric />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Diastolic" value={diastolic} onChangeText={setDiastolic} numeric />
          </View>
        </View>
      </Card>

      <View>
        <Text style={[styles.sectionTitle, { color: theme.text.primary, marginBottom: spacing[8] }]}>
          From Apple Health
        </Text>
        <View style={styles.metricGrid}>
          <MetricTile
            label="Steps"
            value={metrics?.steps != null ? metrics.steps.toLocaleString() : '—'}
            icon={Footprints}
            trend={{ direction: 'up', label: '+8% vs 30-day avg' }}
          />
          <MetricTile
            label="Active Calories"
            value={metrics?.activeEnergyKcal != null ? `${metrics.activeEnergyKcal} kcal` : '—'}
            icon={Flame}
            trend={{ direction: 'down', label: '-4% vs 30-day avg' }}
          />
          <MetricTile
            label="Exercise Minutes"
            value={metrics?.exerciseMinutes != null ? `${metrics.exerciseMinutes} min` : '—'}
            icon={Clock}
            trend={{ direction: 'up', label: '+12% vs 30-day avg' }}
          />
          <MetricTile
            label="Calories (MFP)"
            value={metrics?.caloriesConsumedKcal != null ? `${metrics.caloriesConsumedKcal} kcal` : '—'}
            icon={Utensils}
            trend={null}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[16],
    gap: spacing[16],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateLabel: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '600',
  },
  reconcileNote: {
    fontSize: typeScale.caption.fontSize,
  },
  sectionTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: typeScale.compactBody.fontSize,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing[8],
  },
  bpRow: {
    flexDirection: 'row',
    gap: spacing[8],
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
});
