import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  healthKit,
  hasAnyMetric,
  EMPTY_SNAPSHOT,
  type BodyProfile,
  type DailyHealthMetrics,
  type HealthConnectionState,
  type HealthSnapshot,
  type RecoveryMetrics,
} from './HealthKitAdapter';

/**
 * What the Today card actually renders. Deliberately *not* a mirror of
 * HealthKit's own states, because HealthKit will not tell us whether the
 * user granted read access (see HealthKitAdapter's class comment).
 *
 * - `not_connected` — we have never shown the sheet. Connect will work.
 * - `connected`     — we asked, and data came back.
 * - `no_data`       — we asked, and nothing came back. **Ambiguous**: the
 *                     user may have refused, or may simply have nothing
 *                     recorded today. The UI must not claim to know which.
 */
export type HealthCardState =
  | 'loading'
  | 'unavailable'
  | 'not_connected'
  | 'connected'
  | 'no_data';

function toCardState(
  connection: HealthConnectionState,
  metrics: DailyHealthMetrics,
): HealthCardState {
  if (connection === 'unavailable') return 'unavailable';
  if (connection === 'not_asked') return 'not_connected';
  // 'error' is treated as asked-but-empty rather than a separate screen:
  // there is nothing the user can do about it that differs from no_data.
  return hasAnyMetric(metrics) ? 'connected' : 'no_data';
}

export interface HealthConnection {
  state: HealthCardState;
  metrics: DailyHealthMetrics;
  recovery: RecoveryMetrics;
  body: BodyProfile;
  /** Name of whichever app wrote today's food, straight from HealthKit. */
  nutritionSource: string | null;
  lastSyncedAt: Date | null;
  /**
   * True when some readable type has never been asked about — i.e. there
   * is a shorter, second sheet available. Set for a user who connected
   * before sleep/HRV/body types were added.
   */
  hasMoreToGrant: boolean;
  /** True while Apple's sheet is up, so the button can show a spinner. */
  connecting: boolean;
  /** Shows Apple's permission sheet, then re-reads. Safe to call twice. */
  connect: () => Promise<void>;
  /** Re-reads without prompting. */
  refresh: () => Promise<void>;
  /** Opens the Health app so the user can change access themselves. */
  openHealthApp: () => Promise<void>;
}

/**
 * Owns the Today screen's Apple Health state.
 *
 * Re-reads on every foreground transition, per the reconciliation model
 * in docs/architecture.md §5: background delivery is a freshness
 * optimization, never the correctness mechanism, so a foreground event
 * always re-queries rather than trusting what we last saw.
 */
export function useHealthConnection(): HealthConnection {
  const [connection, setConnection] = useState<HealthConnectionState | null>(null);
  const [snapshot, setSnapshot] = useState<HealthSnapshot>(EMPTY_SNAPSHOT);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [hasMoreToGrant, setHasMoreToGrant] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const read = useCallback(async () => {
    const next = await healthKit.getConnectionState();
    if (!mounted.current) return;
    setConnection(next);
    if (next !== 'asked' && next !== 'error') {
      setSnapshot(EMPTY_SNAPSHOT);
      setHasMoreToGrant(false);
      return;
    }
    const [result, unasked] = await Promise.all([
      healthKit.getSnapshot(),
      healthKit.hasUnaskedTypes(),
    ]);
    if (!mounted.current) return;
    setSnapshot(result);
    setHasMoreToGrant(unasked);
    if (hasAnyMetric(result.daily)) setLastSyncedAt(new Date());
  }, []);

  /**
   * Re-read whenever this screen regains focus.
   *
   * AppState alone was not enough, and the gap was user-visible: Apple's
   * permission sheet is presented *inside* the app, so granting access
   * never moves AppState away from 'active', and returning from the
   * priming screen is in-app navigation that never unmounts Today. A user
   * who granted everything came back to a card still saying "Connect
   * Apple Health", and only a full app relaunch — which remounts, and so
   * re-reads — cleared it.
   *
   * Focus covers mount, the return from priming, and tab switches;
   * AppState below still covers coming back from the Health app itself.
   */
  useFocusEffect(
    useCallback(() => {
      void read();
    }, [read]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void read();
    });
    return () => subscription.remove();
  }, [read]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await healthKit.requestAuthorization();
      // The sheet's result never says what the user chose, so the only
      // honest confirmation is to go and read.
      await read();
    } finally {
      if (mounted.current) setConnecting(false);
    }
  }, [read]);

  const openHealthApp = useCallback(async () => {
    // Health's own URL scheme lands closer to the toggles than the app's
    // Settings pane does, which shows no health switches at all.
    try {
      await Linking.openURL('x-apple-health://');
    } catch {
      try {
        await Linking.openSettings();
      } catch {
        /* Nothing further we can offer; the copy still names the path. */
      }
    }
  }, []);

  return {
    state: connection == null ? 'loading' : toCardState(connection, snapshot.daily),
    metrics: snapshot.daily,
    recovery: snapshot.recovery,
    body: snapshot.body,
    nutritionSource: snapshot.nutritionSource,
    lastSyncedAt,
    hasMoreToGrant,
    connecting,
    connect,
    refresh: read,
    openHealthApp,
  };
}
