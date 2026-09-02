import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useKeepFieldVisible } from '../../lib/keyboardAwareScroll';
import type { SessionField } from '@setframe/domain';
import { workoutTable } from '@setframe/design-tokens';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * One logged set, as a row in a table. The React Native counterpart of
 * `apps/web/src/components/workout-v2/SetRowV2.tsx`.
 *
 * Geometry comes from `workoutTable` in @setframe/design-tokens, which both
 * platforms read. The COMPONENT is duplicated per platform by design — the
 * rendering primitives are genuinely different (see CLAUDE.md) — but the
 * numbers are the design contract, and duplicating those would let the two
 * builds drift with nothing failing until someone looked.
 *
 *     4 + (34 + 74 + 24 + 70 + 70 + 24) + (5 x 6 gaps) + 4 = 334
 *
 * The row commits itself on blur. There is no save control, and the mark on
 * the right reports the result rather than causing it.
 */

/* The same shared tokens web reads. Duplicating the component is deliberate
   (different rendering primitives); duplicating the NUMBERS was not. */
export const SET_ROW_WIDTH = workoutTable.rowWidth;
export const SET_ROW_HEIGHT = workoutTable.rowHeight;
export const COLUMN_WIDTHS = workoutTable.columns;
export const COLUMN_GAP = workoutTable.columnGap;
export const ROW_PADDING_X = workoutTable.rowPaddingX;

export type SetRowStatus = 'empty' | 'pending' | 'saved' | 'pr' | 'error';

export interface SetRowValues {
  weight: string;
  reps: string;
  duration: string;
  distance: string;
  rpe: string;
}

export interface SetRowV2Props {
  setId: string;
  label: string;
  status: SetRowStatus;
  values: SetRowValues;
  targets: Partial<SetRowValues>;
  previous: string | null;
  fields: readonly Exclude<SessionField, 'setType'>[];
  exerciseName: string;
  onCommit: (values: SetRowValues) => void;
  onOpenSetType: () => void;
  onCopyPrevious: () => void;
  onRetry: () => void;
}

export function SetRowV2({
  setId,
  label,
  status,
  values,
  targets,
  previous,
  fields,
  exerciseName,
  onCommit,
  onOpenSetType,
  onCopyPrevious,
  onRetry,
}: SetRowV2Props) {
  const theme = useTheme();
  const [draft, setDraft] = useState<SetRowValues>(values);
  const committedRef = useRef<SetRowValues>(values);
  const focusedCount = useRef(0);

  /*
   * Keyed on the VALUES, not the object. The parent builds this prop as an
   * inline literal, so it has a fresh identity on every render; depending on
   * the object meant the effect fired constantly and reset the draft to
   * whatever the server still had — the reported flicker where a field goes
   * blank, shows the old number, then finally the new one.
   */
  const valuesKey = JSON.stringify(values);
  useEffect(() => {
    if (focusedCount.current > 0) return;
    setDraft(values);
    committedRef.current = values;

  }, [valuesKey]);

  /**
   * "Blur" here means focus has left the ROW, not a field. React Native has no
   * DOM containment check, so the row counts its own focused inputs: moving
   * from weight to reps takes the count 1 -> 0 -> 1 within a tick, and only a
   * count that is still zero on the next tick is a real row blur. Committing
   * per field would fire two writes per set and briefly paint a half-filled
   * row as saved.
   */
  const handleFieldBlur = () => {
    focusedCount.current = Math.max(0, focusedCount.current - 1);
    setTimeout(() => {
      if (focusedCount.current > 0) return;
      const unchanged = (Object.keys(draft) as (keyof SetRowValues)[]).every(
        (key) => draft[key] === committedRef.current[key],
      );
      if (unchanged) return;
      committedRef.current = draft;
      onCommit(draft);
    }, 0);
  };

  const tinted =
    status === 'saved' || status === 'pr'
      ? theme.status.success + '1F'
      : status === 'error'
        ? theme.action.destructive + '1A'
        : 'transparent';

  return (
    <View
      style={[styles.row, { backgroundColor: tinted }]}
      accessibilityRole="none"
      accessibilityLabel={
        'Set ' + label + (previous ? ', previous ' + previous : ', no previous') + ', ' + exerciseName
      }
      testID={'set-row-' + setId}
    >
      <Pressable
        onPress={onOpenSetType}
        style={[styles.setChip, { backgroundColor: theme.surface.sunken }]}
        accessibilityRole="button"
        accessibilityLabel={'Set type for set ' + label}
      >
        <Text style={[styles.setChipText, { color: theme.text.primary }]}>{label}</Text>
      </Pressable>

      <Pressable
        onPress={onCopyPrevious}
        disabled={!previous}
        style={styles.previousCell}
        accessibilityRole="button"
        accessibilityLabel={previous ? 'Use last session, ' + previous : 'No previous session'}
      >
        <Text
          style={[styles.previousText, { color: previous ? theme.text.primary : theme.text.disabled }]}
          numberOfLines={1}
        >
          {previous ?? '—'}
        </Text>
      </Pressable>

      {/* Reserved in every row, occupied only on a PR — otherwise a record
          would shove PREVIOUS, LB and REPS out of line with its neighbours. */}
      <View style={styles.prSlot}>
        {status === 'pr' ? (
          <View style={[styles.prBadge, { backgroundColor: theme.action.primary }]}>
            <Text style={[styles.prText, { color: theme.action.primaryText }]}>PR</Text>
          </View>
        ) : null}
      </View>

      {fields.map((field) => (
        <SetField
          key={field}
          field={field}
          draft={draft}
          targets={targets}
          setDraft={setDraft}
          focusedCount={focusedCount}
          handleFieldBlur={handleFieldBlur}
          label={label}
          exerciseName={exerciseName}
          setId={setId}
        />
      ))}

      {status === 'error' ? (
        <Pressable
          onPress={onRetry}
          style={[styles.mark, { borderColor: theme.action.destructive }]}
          accessibilityRole="button"
          accessibilityLabel={'Retry saving set ' + label}
        >
          <Text style={[styles.markGlyph, { color: theme.action.destructive, fontSize: 12 }]}>↻</Text>
        </Pressable>
      ) : (
        <View
          style={[
            styles.mark,
            {
              borderColor:
                status === 'saved' || status === 'pr' ? theme.status.success : theme.border.default,
              backgroundColor:
                status === 'saved' || status === 'pr' ? theme.surface.raised : 'transparent',
            },
          ]}
        >
          {status === 'saved' || status === 'pr' ? (
            <Text style={[styles.markGlyph, { color: theme.status.success }]}>✓</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

/**
 * One numeric field.
 *
 * Its own component so it can hold a ref: `useKeepFieldVisible` needs a
 * handle on the node to measure it against the keyboard, and a ref cannot
 * be created inside the `fields.map` callback.
 */
function SetField({
  field,
  draft,
  targets,
  setDraft,
  focusedCount,
  handleFieldBlur,
  label,
  exerciseName,
  setId,
}: {
  field: Exclude<SessionField, 'setType'>;
  draft: SetRowValues;
  targets: Partial<Record<Exclude<SessionField, 'setType'>, string>>;
  setDraft: (update: (prev: SetRowValues) => SetRowValues) => void;
  focusedCount: { current: number };
  handleFieldBlur: () => void;
  label: string;
  exerciseName: string;
  setId: string;
}) {
  const theme = useTheme();
  const { ref, onFocusKeepVisible } = useKeepFieldVisible();
  const filled = draft[field] !== '';

  return (
    <TextInput
      ref={ref}
      value={draft[field]}
      placeholder={targets[field] ?? ''}
      placeholderTextColor={theme.text.disabled}
      keyboardType="decimal-pad"
      selectTextOnFocus
      onFocus={() => {
        focusedCount.current += 1;
        // Scrolls only if the keyboard is actually covering this row.
        onFocusKeepVisible();
      }}
      onBlur={handleFieldBlur}
      onChangeText={(text) => setDraft((prev) => ({ ...prev, [field]: text }))}
      style={[
        styles.input,
        {
          backgroundColor: theme.surface.canvas,
          borderColor: theme.border.default,
          color: filled ? theme.text.primary : theme.text.disabled,
          fontWeight: filled ? '600' : '400',
        },
      ]}
      accessibilityLabel={fieldLabel(field) + ', set ' + label + ', ' + exerciseName}
      testID={'set-input-' + field + '-' + setId}
    />
  );
}

function fieldLabel(field: Exclude<SessionField, 'setType'>): string {
  switch (field) {
    case 'weight':
      return 'Weight';
    case 'reps':
      return 'Reps';
    case 'duration':
      return 'Duration';
    case 'distance':
      return 'Distance';
    case 'rpe':
      return 'RPE';
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COLUMN_GAP,
    paddingHorizontal: ROW_PADDING_X,
    width: SET_ROW_WIDTH,
    height: SET_ROW_HEIGHT,
    borderRadius: workoutTable.rowRadius,
  },
  setChip: {
    width: COLUMN_WIDTHS.setChip,
    height: workoutTable.setChipSize,
    borderRadius: workoutTable.setChipRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setChipText: { fontSize: 14, fontWeight: '500' },
  previousCell: {
    width: COLUMN_WIDTHS.previous,
    height: SET_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previousText: { fontSize: 13, fontWeight: '400' },
  prSlot: {
    width: COLUMN_WIDTHS.prSlot,
    height: SET_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prBadge: {
    width: COLUMN_WIDTHS.prSlot,
    height: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prText: { fontSize: 9, fontWeight: '600' },
  input: {
    width: COLUMN_WIDTHS.input,
    height: workoutTable.inputHeight,
    borderRadius: workoutTable.inputRadius,
    borderWidth: 1,
    textAlign: 'center',
    /* 16px matches the web build, where it is the iOS Safari zoom threshold.
       Native has no zoom behaviour to avoid, but the two must render the same
       size or the parity screenshots diverge for no design reason. */
    fontSize: workoutTable.inputFontSize,
    padding: 0,
  },
  mark: {
    width: COLUMN_WIDTHS.mark,
    height: COLUMN_WIDTHS.mark,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markGlyph: { fontSize: 13, fontWeight: '600' },
});
