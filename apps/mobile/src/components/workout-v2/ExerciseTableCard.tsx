import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SessionField } from '@setframe/domain';
import { workoutTable } from '@setframe/design-tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { COLUMN_GAP, COLUMN_WIDTHS, ROW_PADDING_X, SET_ROW_WIDTH } from './SetRowV2';

/**
 * One exercise, as a table of set rows. Counterpart of
 * `apps/web/src/components/workout-v2/ExerciseTableCard.tsx`.
 *
 * A three-set exercise is 264px, and the completed state is the same 264px —
 * completion swaps the plan pill for the result pill in the same slot and
 * tints the rows, and must never change the card's height or position.
 * See docs/design/workout-logging-table.md §6.1.
 */

export const CARD_WIDTH = workoutTable.cardWidth;

export interface ExerciseTableCardProps {
  exerciseName: string;
  planLabel: string | null;
  resultLabel: string | null;
  resultTone: 'up' | 'neutral' | 'down';
  complete: boolean;
  fields: readonly Exclude<SessionField, 'setType'>[];
  onAddSet: () => void;
  onOpenActions: () => void;
  children: ReactNode;
  testID?: string;
}

export function ExerciseTableCard({
  exerciseName,
  planLabel,
  resultLabel,
  resultTone,
  complete,
  fields,
  onAddSet,
  onOpenActions,
  children,
  testID,
}: ExerciseTableCardProps) {
  const theme = useTheme();

  const columns = [
    { key: 'set', label: 'SET', width: COLUMN_WIDTHS.setChip },
    { key: 'previous', label: 'PREVIOUS', width: COLUMN_WIDTHS.previous },
    { key: 'pr', label: '', width: COLUMN_WIDTHS.prSlot },
    ...fields.map((field) => ({ key: field, label: columnLabel(field), width: COLUMN_WIDTHS.input })),
    { key: 'mark', label: '', width: COLUMN_WIDTHS.mark },
  ];

  const pillBackground =
    !complete || !resultLabel
      ? theme.action.accentSubtle
      : resultTone === 'up'
        ? theme.status.success
        : resultTone === 'down'
          ? theme.status.caution + '29'
          : theme.status.success + '29';

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: theme.surface.raised,
          /* Completed keeps the raised surface and takes a tinted border. A
             full green fill here turned every card green on the
             workout-complete screen and flattened the reward hierarchy. */
          borderColor: complete ? theme.status.success + '73' : theme.border.subtle,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <Text style={[styles.name, { color: theme.text.primary }]} numberOfLines={1}>
            {exerciseName}
          </Text>
          {complete && resultLabel ? (
            <View style={[styles.pill, { backgroundColor: pillBackground }]} testID="result-pill">
              {/* Never inverse on the solid green: white on #00c48c is 2.26:1,
                  dark text on the same fill is 7.98:1. */}
              <Text style={[styles.pillText, { color: theme.text.primary }]}>{resultLabel}</Text>
            </View>
          ) : planLabel ? (
            <View style={[styles.pill, { backgroundColor: theme.action.accentSubtle }]} testID="plan-pill">
              <Text style={[styles.pillText, { color: theme.action.primary }]}>{planLabel}</Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={onOpenActions}
          style={styles.more}
          accessibilityRole="button"
          accessibilityLabel={'Actions for ' + exerciseName}
        >
          <Text style={[styles.moreGlyph, { color: theme.text.secondary }]}>⋯</Text>
        </Pressable>
      </View>

      <View style={styles.columnHeader}>
        {columns.map((column) => (
          <Text
            key={column.key}
            style={[styles.columnLabel, { width: column.width, color: theme.text.secondary }]}
          >
            {column.label}
          </Text>
        ))}
      </View>

      <View style={styles.rows}>{children}</View>

      <Pressable
        onPress={onAddSet}
        style={[styles.addSet, { backgroundColor: theme.surface.sunken }]}
        accessibilityRole="button"
      >
        <Text style={[styles.addSetText, { color: theme.action.primary }]}>+ Add set</Text>
      </Pressable>
    </View>
  );
}

function columnLabel(field: Exclude<SessionField, 'setType'>): string {
  switch (field) {
    case 'weight':
      return 'LB';
    case 'reps':
      return 'REPS';
    case 'duration':
      return 'TIME';
    case 'distance':
      return 'DISTANCE';
    case 'rpe':
      return 'RPE';
  }
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 28 },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  name: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '600' },
  more: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  moreGlyph: { fontSize: 18, fontWeight: '600' },
  columnHeader: {
    flexDirection: 'row',
    gap: COLUMN_GAP,
    paddingHorizontal: ROW_PADDING_X,
    width: SET_ROW_WIDTH,
    height: 14,
  },
  columnLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.6, textAlign: 'center' },
  rows: { gap: 4 },
  addSet: {
    width: SET_ROW_WIDTH,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetText: { fontSize: 13, fontWeight: '500' },
});
