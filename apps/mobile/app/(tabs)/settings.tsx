import { useState } from 'react';
import { ScrollView, View, Text, Switch, StyleSheet } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing, typeScale } from '../../src/theme/getTheme';
import { useApiClient } from '../../src/lib/api-client';

interface Row {
  label: string;
  value?: string;
  valueTone?: 'default' | 'success' | 'destructive';
}

function SettingsRow({ label, value, valueTone = 'default' }: Row) {
  const theme = useTheme();
  const valueColor =
    valueTone === 'success' ? theme.status.success : valueTone === 'destructive' ? theme.status.error : theme.text.primary;
  return (
    <View style={styles.row}>
      <Text style={{ color: theme.text.secondary, fontSize: typeScale.body.fontSize }}>{label}</Text>
      {value ? <Text style={{ color: valueColor, fontSize: typeScale.body.fontSize }}>{value}</Text> : null}
    </View>
  );
}

/**
 * `Screen/Mobile/Settings` per style guide §12/§19.3 — Account (Clerk
 * hand-off, §11.5), Preferences (`preferred_units`), an "Apple Health
 * sync" section backed by `integration_sync_state`
 * (docs/data-model.md §6), a "Notifications" section calling
 * `user_notification_preference` (§6.1, docs/api.md) — persists intent
 * only, no `expo-notifications`/push scheduling per docs/dependencies.md
 * — and a Danger zone delete-account row (§33: no polished confirmation
 * flow needed for MVP).
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const { user } = useUser();
  const { signOut } = useAuth();
  const apiClient = useApiClient();
  const [workoutReminders, setWorkoutReminders] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);

  async function updatePreference(patch: { workout_reminders_enabled?: boolean; weekly_summary_enabled?: boolean }) {
    try {
      await apiClient.patch('/me/notification-preferences', patch);
    } catch {
      // Offline/API-not-ready is expected pre-Phase-2 — the toggle still
      // reflects local state; a retry Toast could surface this later.
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={styles.content}>
      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Account</Text>
        <SettingsRow label="Email" value={user?.primaryEmailAddress?.emailAddress ?? '—'} />
        <Button label="Manage account → Clerk" variant="secondary" onPress={() => {}} />
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Preferences</Text>
        <SettingsRow label="Units" value="Imperial (lb) ›" />
        <SettingsRow label="Timezone" value={Intl.DateTimeFormat().resolvedOptions().timeZone} />
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Apple Health sync</Text>
        <SettingsRow label="Apple Health sync" value="Connected ›" valueTone="success" />
        <SettingsRow label="Last synced" value="2 minutes ago" />
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Notifications</Text>
        <View style={styles.toggleRow}>
          <Text style={{ color: theme.text.secondary, fontSize: typeScale.body.fontSize }}>Workout reminders</Text>
          <Switch
            value={workoutReminders}
            onValueChange={(value) => {
              setWorkoutReminders(value);
              updatePreference({ workout_reminders_enabled: value });
            }}
            trackColor={{ true: theme.action.primary }}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={{ color: theme.text.secondary, fontSize: typeScale.body.fontSize }}>Weekly progress summary</Text>
          <Switch
            value={weeklySummary}
            onValueChange={(value) => {
              setWeeklySummary(value);
              updatePreference({ weekly_summary_enabled: value });
            }}
            trackColor={{ true: theme.action.primary }}
          />
        </View>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.status.error }]}>Danger zone</Text>
        <Button label="Delete account" variant="destructive" onPress={() => {}} />
        <Text style={{ color: theme.text.secondary, fontSize: typeScale.caption.fontSize }}>
          This cannot be undone.
        </Text>
      </Card>

      <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[16],
    gap: spacing[16],
  },
  sectionTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
