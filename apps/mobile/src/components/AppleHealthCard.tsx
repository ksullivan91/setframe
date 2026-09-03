import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { Card } from './Card';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing, typeScale } from '../theme/getTheme';
import type { HealthConnection } from '../healthkit/useHealthConnection';
import {
  hasAnyBody,
  hasAnyRecovery,
  type BodyProfile,
  type DailyHealthMetrics,
} from '../healthkit/HealthKitAdapter';

/**
 * Apple Health card on Today, per the Figma flow
 * (`🔬 Exploration — Apple Health connection`, node 193:896) and
 * docs/design/health-connection-flow.md.
 *
 * The state model is the honest one, not the drawn one: iOS refuses to
 * tell a read-only app whether read access was granted, so there is no
 * "denied" state to render. "We asked and nothing came back" is
 * ambiguous between refused and nothing-recorded, and the copy says so
 * rather than picking one. See HealthKitAdapter's class comment.
 */
export function AppleHealthCard({
  connection,
  fallback = null,
}: {
  connection: HealthConnection;
  /**
   * The server's reconciled snapshot for today, if it has one. HealthKit is
   * authoritative (architecture §4) so a live device reading always wins,
   * but the snapshot is what a second device already pushed — dropping it
   * would blank numbers the old card used to show.
   */
  fallback?: DailyHealthMetrics | null;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { state, connecting } = connection;

  const metrics: DailyHealthMetrics = {
    steps: connection.metrics.steps ?? fallback?.steps ?? null,
    activeEnergyKcal: connection.metrics.activeEnergyKcal ?? fallback?.activeEnergyKcal ?? null,
    exerciseMinutes: connection.metrics.exerciseMinutes ?? fallback?.exerciseMinutes ?? null,
    caloriesConsumedKcal:
      connection.metrics.caloriesConsumedKcal ?? fallback?.caloriesConsumedKcal ?? null,
    proteinG: connection.metrics.proteinG ?? fallback?.proteinG ?? null,
    carbsG: connection.metrics.carbsG ?? fallback?.carbsG ?? null,
    fatG: connection.metrics.fatG ?? fallback?.fatG ?? null,
  };
  const hasAny =
    metrics.steps != null ||
    metrics.activeEnergyKcal != null ||
    metrics.exerciseMinutes != null ||
    metrics.caloriesConsumedKcal != null;
  // Nothing from the device but something from the server is still data on
  // screen, so it must not read as "No data yet".
  const state_ = state === 'no_data' && hasAny ? 'connected' : state;

  if (state_ === 'unavailable') return null;

  /* "Health metrics" in every state. What the card holds is your metrics;
     where they came from is said in the provenance line underneath, and
     the connect button names Apple Health explicitly, so the source is
     never in doubt where it matters. */
  const title = 'Health metrics';

  const fmt = (value: number | null, unit?: string) =>
    value == null ? null : unit ? `${value.toLocaleString()} ${unit}` : value.toLocaleString();
  const tiles = [
    { label: 'Steps', value: fmt(metrics.steps) },
    { label: 'Active energy', value: fmt(metrics.activeEnergyKcal, 'cal') },
    { label: 'Exercise minutes', value: fmt(metrics.exerciseMinutes, 'min') },
    /* Was "Calories (MFP)". Setframe has no MyFitnessPal integration and
       never had one — it reads whatever any tracker syncs into Apple
       Health. Naming one vendor in the label told users the other trackers
       would not work, which was never true. The actual writer is named in
       the provenance line below, read from the sample's own source. */
    { label: 'Calories eaten', value: fmt(metrics.caloriesConsumedKcal, 'cal') },
  ];
  const missingCount = tiles.filter((t) => t.value == null).length;

  const macros = [
    { label: 'Protein', value: fmt(metrics.proteinG, 'g') },
    { label: 'Carbs', value: fmt(metrics.carbsG, 'g') },
    { label: 'Fat', value: fmt(metrics.fatG, 'g') },
  ];
  const showMacros = macros.some((m) => m.value != null);

  const { recovery, body, nutritionSource } = connection;
  const recoveryTiles = [
    { label: 'Sleep', value: formatSleep(recovery.sleepMinutes) },
    { label: 'HRV', value: fmt(recovery.hrvMs, 'ms') },
    { label: 'Resting HR', value: fmt(recovery.restingHeartRateBpm, 'bpm') },
    /* Cardio fitness. The label carries the reading's age because watchOS
       only estimates this during a qualifying outdoor walk, run or hike —
       most days have none, and a bare number invites the reader to assume
       it is today's when it may be months old. */
    { label: vo2Label(recovery.vo2MaxAt), value: fmt(recovery.vo2Max) },
  ];
  const showRecovery = hasAnyRecovery(recovery);
  const showBody = hasAnyBody(body);
  /* Name what is actually missing. A fixed label offered someone their own
     sleep data back the week workouts were added. */
  const groups = connection.unaskedGroups;
  const grantMoreLabel =
    groups.length === 1 ? `Share ${groups[0]}`
    : groups.length === 2 ? `Share ${groups[0]} and ${groups[1]}`
    : 'Share more health data';
  const provenance = nutritionSource
    ? `From Apple Health · nutrition via ${nutritionSource} · updated`
    : 'From Apple Health · updated';

  return (
    <>
      <Card testID={`apple-health-card-${state_}`}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.text.primary }]}>{title}</Text>
          <StatePill state={state_} />
        </View>

        {state_ === 'loading' ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.text.secondary} />
            <Text style={[styles.body, { color: theme.text.secondary }]}>Checking Apple Health…</Text>
          </View>
        ) : null}

        {state_ === 'not_connected' ? (
          <>
            <Text style={[styles.body, { color: theme.text.secondary }]}>
              Setframe can read your steps, active energy, exercise minutes and calories, so Today
              and Progress reflect everything you did — not just what you logged here.
            </Text>
            <Pressable
              testID="health-connect"
              accessibilityRole="button"
              accessibilityLabel="Connect Apple Health"
              disabled={connecting}
              onPress={() => router.push('/health-access')}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.action.primary, opacity: pressed || connecting ? 0.85 : 1 },
              ]}
            >
              {connecting ? (
                <ActivityIndicator color={theme.action.primaryText} />
              ) : (
                <Text style={[styles.primaryLabel, { color: theme.action.primaryText }]}>
                  Connect Apple Health
                </Text>
              )}
            </Pressable>
            {/* The promise that earns the tap — set in secondary, not
                disabled grey, so it is actually readable. */}
            <Text style={[styles.note, { color: theme.text.secondary }]}>
              Read only. Setframe never writes anything to Apple Health.
            </Text>
          </>
        ) : null}

        {state_ === 'connected' || state_ === 'no_data' ? (
          <>
            <MetricGrid tiles={tiles} />
            {/* Macros only appear once a tracker is actually writing them,
                so the card does not grow three empty tiles for someone who
                only syncs calories. */}
            {showMacros ? (
              <>
                <Text style={[styles.eyebrow, { color: theme.text.secondary }]}>MACROS</Text>
                <MetricGrid tiles={macros} />
              </>
            ) : null}
            {showRecovery ? (
              <>
                <Text style={[styles.eyebrow, { color: theme.text.secondary }]}>RECOVERY</Text>
                <MetricGrid tiles={recoveryTiles} />
              </>
            ) : null}
            {/* One quiet line, not a grid: height and sex are context for
                coaching, not numbers anyone checks daily. */}
            {showBody ? (
              <Text
                testID="health-body-line"
                style={[styles.note, { color: theme.text.secondary }]}
              >
                {describeBody(body)}
              </Text>
            ) : null}
            {state_ === 'connected' ? (
              <Text style={[styles.note, { color: theme.text.secondary }]}>
                {provenance} {formatRelative(connection.lastSyncedAt)}
              </Text>
            ) : null}
            {/* Someone who connected before sleep/HRV/body existed would
                otherwise stare at missing tiles forever: iOS never re-asks
                on its own, and we cannot tell refusal from absence. */}
            {connection.hasMoreToGrant ? (
              <Pressable
                testID="health-grant-more"
                accessibilityRole="button"
                accessibilityLabel={grantMoreLabel}
                disabled={connecting}
                onPress={() => void connection.connect()}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { backgroundColor: theme.surface.sunken, opacity: pressed || connecting ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.secondaryLabel, { color: theme.action.primary }]}>
                  {grantMoreLabel}
                </Text>
              </Pressable>
            ) : null}
            {state_ === 'no_data' ? (
              <Text style={[styles.body, { color: theme.text.secondary }]}>
                Nothing has come through from Apple Health today. That happens either when there is
                nothing recorded yet, or when Setframe was not given access — iOS does not tell us
                which.
              </Text>
            ) : missingCount > 0 ? (
              <Text style={[styles.note, { color: theme.text.secondary }]}>
                {missingCount === 1 ? 'One metric has' : `${missingCount} metrics have`} no data for
                today.
              </Text>
            ) : null}
            {state_ === 'no_data' || missingCount > 0 ? (
              <Pressable
                testID="health-open-settings"
                accessibilityRole="button"
                accessibilityLabel="Check access in the Health app"
                onPress={() => void connection.openHealthApp()}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { backgroundColor: theme.surface.sunken, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.secondaryLabel, { color: theme.action.primary }]}>
                  Check access in Health
                </Text>
              </Pressable>
            ) : null}
            {state_ === 'no_data' ? (
              <Text style={[styles.note, { color: theme.text.secondary }]}>
                Setframe works without it. You will just log those numbers yourself.
              </Text>
            ) : null}
          </>
        ) : null}
      </Card>

      {/* Figma screen 1's second card: show the value of connecting
          rather than describing it. Only while there is nothing to show. */}
      {state_ === 'not_connected' ? (
        <Card testID="health-preview">
          <Text style={[styles.eyebrow, { color: theme.text.secondary }]}>WHAT YOU WOULD SEE</Text>
          <MetricGrid tiles={tiles} />
        </Card>
      ) : null}
    </>
  );
}

function StatePill({ state }: { state: HealthConnection['state'] }) {
  const theme = useTheme();
  if (state === 'loading') return null;
  const config = {
    not_connected: { label: 'Not connected', color: theme.status.caution, Icon: AlertTriangle },
    connected: { label: 'Synced', color: theme.status.successText, Icon: CheckCircle2 },
    no_data: { label: 'No data yet', color: theme.status.caution, Icon: AlertTriangle },
    unavailable: null,
  }[state];
  if (!config) return null;
  return (
    <View style={[styles.pill, { backgroundColor: theme.surface.sunken }]}>
      <config.Icon size={14} color={config.color} />
      <Text style={[styles.pillLabel, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

/**
 * "VO₂ max", or "VO₂ max · 12d ago" when the reading is not from today.
 *
 * Same-day readings say nothing extra — the absence of an age IS the
 * statement that it is current.
 */
function vo2Label(measuredAt: string | null): string {
  const base = 'VO\u2082 max';
  if (!measuredAt) return base;
  const at = new Date(measuredAt);
  if (Number.isNaN(at.getTime())) return base;

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(at)) / 86_400_000);

  if (days <= 0) return base;
  if (days === 1) return `${base} · yesterday`;
  if (days < 7) return `${base} · ${days}d ago`;
  if (days < 60) return `${base} · ${Math.floor(days / 7)}w ago`;
  return `${base} · ${Math.floor(days / 30)}mo ago`;
}

function MetricGrid({ tiles }: { tiles: { label: string; value: string | null }[] }) {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {tiles.map((tile) => (
        <View
          key={tile.label}
          testID={`health-tile-${tile.label}`}
          style={[styles.tile, { backgroundColor: theme.surface.sunken }]}
        >
          <Text
            style={[
              styles.tileValue,
              { color: tile.value == null ? theme.text.disabled : theme.text.primary },
            ]}
          >
            {tile.value ?? '—'}
          </Text>
          <Text style={[styles.tileLabel, { color: theme.text.secondary }]}>{tile.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Hours and minutes, because "437 min" is not how anyone thinks about a
 *  night's sleep. */
function formatSleep(minutes: number | null): string | null {
  if (minutes == null) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** The coaching context line: age, sex, height, body fat — whichever of
 *  them Apple Health actually has. */
function describeBody(body: BodyProfile): string {
  const parts: string[] = [];
  if (body.ageYears != null) parts.push(`${body.ageYears}`);
  if (body.biologicalSex) parts.push(body.biologicalSex);
  if (body.heightCm != null) parts.push(`${body.heightCm} cm`);
  if (body.weightKg != null) parts.push(`${body.weightKg} kg`);
  if (body.bodyFatPercent != null) parts.push(`${body.bodyFatPercent}% body fat`);
  return parts.join(' · ');
}

/** Coarse on purpose — a to-the-second timestamp implies a precision the
 *  underlying HealthKit write times do not have. */
function formatRelative(at: Date | null): string {
  if (!at) return 'just now';
  const seconds = Math.max(0, Math.round((Date.now() - at.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[8],
  },
  title: {
    fontSize: typeScale.sectionTitle.fontSize,
    lineHeight: typeScale.sectionTitle.lineHeight,
    fontWeight: '600',
  },
  body: {
    fontSize: typeScale.body.fontSize,
    lineHeight: typeScale.body.lineHeight,
  },
  note: {
    fontSize: typeScale.helper.fontSize,
    lineHeight: typeScale.helper.lineHeight,
  },
  eyebrow: {
    fontSize: typeScale.caption.fontSize,
    letterSpacing: 1,
    fontWeight: '500',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  primaryButton: {
    height: 48,
    borderRadius: radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: typeScale.button.fontSize,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 44,
    borderRadius: radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: typeScale.button.fontSize,
    fontWeight: '600',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[12],
  },
  pillLabel: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  tile: {
    flexGrow: 1,
    flexBasis: '47%',
    borderRadius: radius.small,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[12],
    gap: 2,
  },
  tileValue: {
    fontSize: typeScale.numericMetric.fontSize,
    lineHeight: typeScale.numericMetric.lineHeight,
    fontWeight: '600',
  },
  tileLabel: {
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.lineHeight,
  },
});
