import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/getTheme';

export type SyncStatus = 'synced' | 'syncing' | 'needs_attention';

/**
 * `SyncStatusPill` per style guide §6 — synced / syncing / needs-
 * attention, backed by `integration_sync_state.status`
 * (docs/data-model.md §6). "needs_attention" uses a distinct caution
 * color ("Health access needed") rather than a generic error, per the
 * master spec's "show actionable status" rule.
 */
export function SyncStatusPill({ status }: { status: SyncStatus }) {
  const theme = useTheme();
  const config = {
    synced: { label: 'Synced', color: theme.status.successText, Icon: CheckCircle2 },
    syncing: { label: 'Updating health data…', color: theme.text.secondary, Icon: RefreshCw },
    needs_attention: { label: 'Health access needed', color: theme.status.caution, Icon: AlertTriangle },
  }[status];

  return (
    <View style={[styles.pill, { backgroundColor: theme.surface.sunken }]}>
      <config.Icon size={14} color={config.color} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[12],
  },
  label: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
  },
});
