import { View, Text, StyleSheet } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/getTheme';

export type BadgeTone = 'accent' | 'success' | 'caution' | 'error' | 'neutral';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

/**
 * Generic pill Badge/Chip per style guide §5 (SetRow PR badge pattern)
 * and §12 (sync-status pills). Tone maps to Semantic/Status/* or
 * Semantic/Action/AccentSubtle.
 */
export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const theme = useTheme();
  const { background, textColor } = toneColors(theme, tone);
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

/**
 * `SetRow`'s trophy PR badge, per style guide §17 ("Lucide trophy icon
 * badge... marking it as the PR-achieving set") and §9 (Session Summary
 * highlighted PR card). Distinct component from the generic `Badge`
 * since it always pairs an icon + fixed "PR" semantics rather than
 * arbitrary label/tone.
 */
export function PrBadge({ label = 'PR' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.pill, styles.prPill, { backgroundColor: theme.action.accentSubtle }]}>
      <Trophy size={14} color={theme.action.primary} />
      <Text style={[styles.label, { color: theme.action.primary }]}>{label}</Text>
    </View>
  );
}

function toneColors(theme: ReturnType<typeof useTheme>, tone: BadgeTone) {
  switch (tone) {
    case 'accent':
      return { background: theme.action.accentSubtle, textColor: theme.action.primary };
    case 'success':
      return { background: theme.action.accentSubtle, textColor: theme.status.success };
    case 'caution':
      return { background: theme.action.accentSubtle, textColor: theme.status.caution };
    case 'error':
      return { background: theme.action.accentSubtle, textColor: theme.status.error };
    default:
      return { background: theme.surface.sunken, textColor: theme.text.secondary };
  }
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[12],
  },
  prPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  label: {
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.lineHeight,
    fontWeight: '600',
  },
});
