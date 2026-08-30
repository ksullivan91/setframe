import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { training } from '@setframe/design-tokens';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Card shell and rows shared by every block on the mobile Training overview.
 * Counterpart of `apps/web/src/components/training-v2/TrainingCards.tsx`.
 *
 * A 358px card with 14px padding leaves 330px of usable width — the number
 * the week strip is built to fill exactly.
 */

export function Card({ children, testID }: { children: ReactNode; testID?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface.raised }]} testID={testID}>
      {children}
    </View>
  );
}

export function CardLabel({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.label, { color: theme.text.disabled }]}>{children}</Text>;
}

export function CardHeadRow({ children }: { children: ReactNode }) {
  return <View style={styles.headRow}>{children}</View>;
}

export function CardAction({ label, onPress }: { label: string; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Text style={[styles.action, { color: theme.action.primary }]}>{label}</Text>
    </Pressable>
  );
}

export interface ListRowProps {
  name: string;
  meta: string;
  /** The "Next up" pill — a readout, not a control. */
  badge?: string;
  divided: boolean;
  onPress?: () => void;
  testID?: string;
}

/**
 * One tappable row. **The whole row is the target, not just the chevron** —
 * the chevron is decoration.
 */
export function ListRow({ name, meta, badge, divided, onPress, testID }: ListRowProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      style={[
        styles.row,
        divided && { borderTopWidth: 1, borderTopColor: theme.border.subtle },
      ]}
    >
      <View style={styles.rowLeft}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: theme.text.primary }]} numberOfLines={1}>
            {name}
          </Text>
          {badge ? (
            <View style={[styles.pill, { backgroundColor: theme.action.accentSubtle }]}>
              <Text style={[styles.pillLabel, { color: theme.action.primary }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.meta, { color: theme.text.secondary }]}>{meta}</Text>
      </View>
      <Text style={[styles.chevron, { color: theme.text.secondary }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: training.cardWidth,
    maxWidth: '100%',
    padding: training.cardPadding,
    borderRadius: training.cardRadius,
    gap: training.cardRowGap,
  },
  label: {
    fontSize: training.labelSize,
    fontWeight: '500',
    letterSpacing: training.labelSize * (training.labelLetterSpacingPercent / 100),
    textTransform: 'uppercase',
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  action: { fontSize: 12, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: training.workoutRow.gap,
    paddingVertical: training.workoutRow.paddingY,
  },
  rowLeft: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: training.workoutRow.nameGap },
  name: { fontSize: training.workoutRow.nameSize, fontWeight: '500', flexShrink: 1 },
  meta: { fontSize: training.workoutRow.metaSize },
  chevron: { fontSize: training.workoutRow.chevronSize, fontWeight: '600' },
  pill: {
    paddingHorizontal: training.workoutRow.pillPaddingX,
    paddingVertical: training.workoutRow.pillPaddingY,
    borderRadius: training.workoutRow.pillRadius,
  },
  pillLabel: { fontSize: training.workoutRow.pillLabelSize, fontWeight: '600' },
});
