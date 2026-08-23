import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing, typeScale } from '../theme/getTheme';

/**
 * "What does this mean?" affordance for a metric — the mobile counterpart of
 * the web `MetricInfo`.
 *
 * A hover tooltip does not exist on touch, so this is a tap-triggered
 * disclosure: a button toggles an inline panel that is dismissible and
 * announced to VoiceOver via `accessibilityState.expanded`. The panel carries
 * three things on purpose — what the metric is, how it is calculated, and
 * where it falls down — because presenting an estimate without its caveat
 * claims a precision we do not have.
 */

export interface MetricInfoProps {
  label: string;
  explanation: string;
  calculation?: string | null;
  limitation?: string | null;
}

export function MetricInfo({ label, explanation, calculation, limitation }: MetricInfoProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={`What does ${label} mean?`}
        accessibilityState={{ expanded: open }}
        hitSlop={12}
        testID="metric-info-trigger"
        onPress={() => setOpen((value) => !value)}
        style={[styles.trigger, { borderColor: open ? theme.action.primary : theme.border.default }]}
      >
        <Text style={[styles.triggerText, { color: open ? theme.action.primary : theme.text.secondary }]}>
          ?
        </Text>
      </Pressable>

      {open ? (
        <View
          accessible
          accessibilityLiveRegion="polite"
          testID="metric-info-panel"
          style={[
            styles.panel,
            { backgroundColor: theme.surface.raised, borderColor: theme.border.default },
          ]}
        >
          <Text style={[styles.heading, { color: theme.text.primary }]}>{label}</Text>
          <Text style={[styles.detail, { color: theme.text.secondary }]}>{explanation}</Text>
          {calculation ? (
            <Text style={[styles.detail, { color: theme.text.secondary }]}>{calculation}</Text>
          ) : null}
          {limitation ? (
            <Text
              style={[
                styles.limitation,
                { color: theme.text.secondary, borderLeftColor: theme.border.default },
              ]}
            >
              {limitation}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginLeft: spacing[4],
  },
  trigger: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  panel: {
    position: 'absolute',
    top: 28,
    left: 0,
    zIndex: 20,
    width: 264,
    padding: spacing[12],
    borderRadius: radius.large,
    borderWidth: 1,
    gap: spacing[8],
  },
  heading: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '700',
  },
  detail: {
    fontSize: typeScale.caption.fontSize,
  },
  limitation: {
    fontSize: typeScale.caption.fontSize,
    borderLeftWidth: 2,
    paddingLeft: spacing[8],
  },
});
