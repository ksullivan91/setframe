import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, Switch, StyleSheet, ActivityIndicator } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useClerk, useAuth, useUser } from '@clerk/clerk-expo';
import { DeleteAccountSheet } from '../components/DeleteAccountSheet';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationPreference, User } from '@setframe/schemas';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, typeScale } from '../theme/getTheme';
import { useApiClient } from '../lib/api-client';
import { useHealthConnection, type HealthCardState } from '../healthkit/useHealthConnection';
import { useActionFeedback } from '../lib/useActionFeedback';

type PreferredUnits = User['preferredUnits'];

interface SettingsRowProps {
  label: string;
  value?: string;
  valueTone?: 'default' | 'success' | 'destructive';
}

function SettingsRow({ label, value, valueTone = 'default' }: SettingsRowProps) {
  const theme = useTheme();
  const valueColor =
    valueTone === 'success'
      ? theme.status.successText
      : valueTone === 'destructive'
        ? theme.status.errorText
        : theme.text.primary;

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.text.secondary }]}>{label}</Text>
      {value ? <Text style={[styles.rowValue, { color: valueColor }]}>{value}</Text> : null}
    </View>
  );
}

/**
 * Apple Health status, read from the device rather than the server.
 *
 * This row used to render `integration_sync_state.status`, which stays
 * `never_synced` because nothing posts a reconcile payload yet — so it told
 * a user with Apple Health data visible on Today that they were "Not
 * connected", and that their last sync was "Never". Both were false from
 * where they were standing. What they can actually verify is whether this
 * phone can read their data, so that is what it now reports.
 */
function formatHealthStatus(state: HealthCardState) {
  if (state === 'loading') return { label: 'Checking…', tone: 'default' as const };
  if (state === 'unavailable') return { label: 'Not available on this device', tone: 'default' as const };
  if (state === 'not_connected') return { label: 'Not connected', tone: 'default' as const };
  if (state === 'connected') return { label: 'Connected', tone: 'success' as const };
  return { label: 'Connected, no data today', tone: 'default' as const };
}

function formatRelativeTime(timestamp: string | null) {
  if (!timestamp) return 'Never';

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  const diffMs = Date.now() - date.getTime();
  const absMinutes = Math.floor(Math.abs(diffMs) / 60000);

  if (absMinutes < 1) return 'Just now';
  if (absMinutes < 60) return `${absMinutes} minute${absMinutes === 1 ? '' : 's'} ago`;

  const absHours = Math.floor(absMinutes / 60);
  if (absHours < 24) return `${absHours} hour${absHours === 1 ? '' : 's'} ago`;

  const absDays = Math.floor(absHours / 24);
  if (absDays < 7) return `${absDays} day${absDays === 1 ? '' : 's'} ago`;

  return date.toLocaleString();
}

export function SettingsScreen() {
  const feedback = useActionFeedback();
  const theme = useTheme();
  const { user } = useUser();
  const router = useRouter();
  const { signOut, isLoaded, isSignedIn } = useAuth();

  async function handleSignOut() {
    /* Clear first: a cached `me` re-rendering against a dead session is
       what made this look frozen rather than merely slow. */
    queryClient.clear();
    await signOut();
    /* The redirect above catches this too, but only once Clerk's state has
       propagated. Navigating explicitly means the screen never has a frame
       to render signed-out. */
    router.replace('/sign-in');
  }
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { openUserProfile } = useClerk();
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const deleteAccount = useMutation({
    mutationFn: () => apiClient.del('/me'),
    onSuccess: async () => {
      /* Signing out is what actually gets the user off the screen: the
         account is gone, so every query behind this one would 401. The
         cache is cleared first so nothing re-renders with a dead user. */
      setConfirmingDelete(false);
      queryClient.clear();
      await signOut();
    },
    onError: () =>
      feedback.report('Could not delete your account. Nothing was removed — try again.')(),
  });
  const [workoutReminders, setWorkoutReminders] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get<User>('/me'),
  });

  const updateUnits = useMutation({
    mutationFn: (preferredUnits: PreferredUnits) => apiClient.patch<User>('/me', { preferredUnits }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  
    onError: feedback.report('Could not change units. Try again.'),
  });

  const {
    data: notificationPrefs,
    isLoading: notificationLoading,
    isFetching: notificationFetching,
  } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => apiClient.get<NotificationPreference>('/me/notification-preferences'),
  });

  useEffect(() => {
    if (notificationPrefs) {
      setWorkoutReminders(notificationPrefs.workoutRemindersEnabled);
      setWeeklySummary(notificationPrefs.weeklySummaryEnabled);
    }
  }, [notificationPrefs]);

  const updateNotificationPrefs = useMutation({
    mutationFn: (patch: Partial<NotificationPreference>) =>
      apiClient.patch<NotificationPreference>('/me/notification-preferences', patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-preferences'] }),
    onError: () => {
      if (notificationPrefs) {
        setWorkoutReminders(notificationPrefs.workoutRemindersEnabled);
        setWeeklySummary(notificationPrefs.weeklySummaryEnabled);
      }
    },
  });

  const health = useHealthConnection();
  const syncLoading = health.state === 'loading';
  const syncStatus = useMemo(() => formatHealthStatus(health.state), [health.state]);


  /**
   * Settings is a stack route, not a tab.
   *
   * It used to live in `app/(tabs)/` and inherit that layout's redirect.
   * Moving it out (story 75) left it with no gate at all, so signing out
   * cleared the session and left this screen mounted on top of a dead one —
   * every query 401ing behind a UI that looked frozen. The app had to be
   * force-quit to escape it.
   *
   * Placed below every hook deliberately: an early return above them
   * changes the hook order between renders, which React forbids.
   */
  if (isLoaded && !isSignedIn) return <Redirect href="/sign-in" />;

  return (
    <ScrollView
      style={{ backgroundColor: theme.surface.canvas }}
      contentContainerStyle={styles.content}
    >
      {/* No page title here: the stack header supplies it now, along with
          the back arrow this screen used to lack entirely. Section headings
          still sit above their cards, as web's SettingsPage has them. */}

      <Text style={[styles.sectionHeading, { color: theme.text.primary }]}>Account</Text>
      <Card>
        <SettingsRow label="Email" value={user?.primaryEmailAddress?.emailAddress ?? '—'} />
        {/* Units and Timezone belong to Account on web rather than to a
            separate Preferences section. */}
        {meLoading ? (
          <ActivityIndicator color={theme.action.primary} />
        ) : (
          <>
            <Select
              label="Units"
              value={me?.preferredUnits ?? 'imperial'}
              options={[
                { label: 'Imperial (lb)', value: 'imperial' },
                { label: 'Metric (kg)', value: 'metric' },
              ]}
              onChange={(value) => {
                if (value !== me?.preferredUnits) {
                  updateUnits.mutate(value);
                }
              }}
            />
            <SettingsRow label="Timezone" value={me?.timezone || '—'} />
            {updateUnits.isPending ? (
              <Text style={[styles.helperText, { color: theme.text.secondary }]}>Saving units…</Text>
            ) : null}
          </>
        )}
        <Button label="Manage account → Clerk" variant="secondary" onPress={() => openUserProfile()} />
      </Card>

      {/* One combined section, matching web's "Apple Health & notifications"
          — these were two separate cards on mobile. */}
      <Text style={[styles.sectionHeading, { color: theme.text.primary }]}>Apple Health &amp; notifications</Text>
      <Card>
        {syncLoading ? (
          <ActivityIndicator color={theme.action.primary} />
        ) : (
          <>
            <SettingsRow label="Apple Health" value={syncStatus.label} valueTone={syncStatus.tone} />
            {/* "Last synced" described a server round trip that does not
                happen yet. What is true is when this phone last read your
                data, which is what the Today card is showing. */}
            <SettingsRow label="Last read" value={formatRelativeTime(health.lastSyncedAt?.toISOString() ?? null)} />
          </>
        )}
        {notificationLoading ? (
          <ActivityIndicator color={theme.action.primary} />
        ) : (
          <>
            <View style={styles.toggleRow}>
              <Text style={[styles.rowLabel, { color: theme.text.secondary }]}>Workout reminders</Text>
              <View style={styles.toggleValue}>
                {/* Web states the value in words beside the switch; a switch
                    alone carries its state only in colour and position. */}
                <Text style={[styles.rowValue, { color: theme.text.secondary }]}>
                  {workoutReminders ? 'On' : 'Off'}
                </Text>
                <Switch
                  value={workoutReminders}
                  disabled={updateNotificationPrefs.isPending}
                  onValueChange={(value) => {
                    setWorkoutReminders(value);
                    updateNotificationPrefs.mutate({ workoutRemindersEnabled: value });
                  }}
                  trackColor={{ true: theme.action.primary }}
                />
              </View>
            </View>
            <View style={styles.toggleRow}>
              <Text style={[styles.rowLabel, { color: theme.text.secondary }]}>Weekly progress summary</Text>
              <View style={styles.toggleValue}>
                <Text style={[styles.rowValue, { color: theme.text.secondary }]}>
                  {weeklySummary ? 'On' : 'Off'}
                </Text>
                <Switch
                  value={weeklySummary}
                  disabled={updateNotificationPrefs.isPending}
                  onValueChange={(value) => {
                    setWeeklySummary(value);
                    updateNotificationPrefs.mutate({ weeklySummaryEnabled: value });
                  }}
                  trackColor={{ true: theme.action.primary }}
                />
              </View>
            </View>
            {updateNotificationPrefs.isPending || notificationFetching ? (
              <Text style={[styles.helperText, { color: theme.text.secondary }]}>Updating notification preferences…</Text>
            ) : null}
          </>
        )}
      </Card>

      <Text style={[styles.sectionHeading, { color: theme.status.errorText }]}>Danger zone</Text>
      <Card>
        <SettingsRow label="Delete account" value="This cannot be undone" valueTone="destructive" />
        <Button
          label="Delete account"
          variant="destructive"
          onPress={() => setConfirmingDelete(true)}
          testID="open-delete-account"
        />
      </Card>

      <Button
        label="Sign out"
        variant="secondary"
        testID="sign-out"
        onPress={() => void handleSignOut()}
      />

      <DeleteAccountSheet
        visible={confirmingDelete}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => deleteAccount.mutate()}
        busy={deleteAccount.isPending}
      />
      {feedback.node}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[16],
    gap: spacing[16],
  },
  sectionHeading: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
    // Pulls the heading toward the card it labels, against the container's
    // uniform 16pt gap, so it reads as attached rather than free-floating.
    marginBottom: -spacing[8],
  },
  toggleValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[12],
  },
  rowLabel: {
    fontSize: typeScale.body.fontSize,
    flex: 1,
  },
  rowValue: {
    fontSize: typeScale.body.fontSize,
    textAlign: 'right',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[12],
  },
  helperText: {
    fontSize: typeScale.caption.fontSize,
  },
});
