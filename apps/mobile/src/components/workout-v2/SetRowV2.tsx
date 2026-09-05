import { useRef } from 'react';
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
  /** Every keystroke. The store decides what reaches the network, and when. */
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

  /**
   * Fully controlled. The row used to hold its own draft and resync it from
   * props whenever the server's copy changed, which meant every save — and
   * saves refetched the whole session — reset the drafts of every row not
   * currently focused. Typing quickly erased values.
   *
   * The draft now lives in one place for the whole screen (`SetDraftStore`),
   * so the row renders what it is given and reports every keystroke upward.
   * There is nothing here left to go stale.
   */
  const draft = values;
  const focusedCount = useRef(0);

  const handleFieldBlur = () => {
    focusedCount.current = Math.max(0, focusedCount.current - 1);
  };

  /* The card is dark now, so a state reads as a wash over that ground
     rather than a tint on white. Error keeps the strongest one: it is the
     only state that asks the user to do something. */
  const tinted =
    status === 'error'
      ? theme.inverse.danger + '33'
      : status === 'pr'
        ? theme.inverse.accent + '1F'
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
        /* The chip is the row's only always-present colour, so a PR claims
           it — the badge alone is easy to miss at arm's length on a bench. */
        style={[
          styles.setChip,
          { backgroundColor: status === 'pr' ? theme.inverse.accent : theme.inverse.raised },
        ]}
        accessibilityRole="button"
        accessibilityLabel={'Set type for set ' + label}
      >
        <Text style={[styles.setChipText, { color: theme.inverse.text }]}>{label}</Text>
      </Pressable>

      <Pressable
        onPress={onCopyPrevious}
        disabled={!previous}
        style={styles.previousCell}
        accessibilityRole="button"
        accessibilityLabel={previous ? 'Use last session, ' + previous : 'No previous session'}
      >
        <Text
          style={[
            styles.previousText,
            { color: previous ? theme.inverse.textMuted : theme.inverse.textMuted + '80' },
          ]}
          numberOfLines={1}
        >
          {previous ?? '—'}
        </Text>
      </Pressable>

      {/* Reserved in every row, occupied only on a PR — otherwise a record
          would shove PREVIOUS, LB and REPS out of line with its neighbours. */}
      <View style={styles.prSlot}>
        {status === 'pr' ? (
          <View style={[styles.prBadge, { backgroundColor: theme.inverse.accent }]}>
            <Text style={[styles.prText, { color: theme.inverse.text }]}>PR</Text>
          </View>
        ) : null}
      </View>

      {fields.map((field) => (
        <SetField
          key={field}
          field={field}
          draft={draft}
          targets={targets}
          onEdit={onCommit}
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
          style={[styles.mark, { borderColor: theme.inverse.danger }]}
          accessibilityRole="button"
          accessibilityLabel={'Retry saving set ' + label}
        >
          <Text style={[styles.markGlyph, { color: theme.inverse.danger, fontSize: 12 }]}>↻</Text>
        </Pressable>
      ) : (
        <View
          style={[
            styles.mark,
            {
              borderColor:
                status === 'saved' || status === 'pr'
                  ? theme.inverse.success
                  : theme.inverse.textMuted + '40',
              backgroundColor: 'transparent',
            },
          ]}
        >
          {status === 'saved' || status === 'pr' ? (
            <Text style={[styles.markGlyph, { color: theme.inverse.success }]}>✓</Text>
          ) : status === 'pending' ? (
            /* An in-flight save used to render the same bare ring as an
               untouched row, so the one moment the user might wonder whether
               their number landed looked identical to not having typed it.
               A dot rather than a spinner: the save is usually gone within a
               frame or two, and a spinner that flashes reads as an error. */
            <View
              testID={'set-row-pending-' + setId}
              style={[styles.pendingDot, { backgroundColor: theme.inverse.textMuted }]}
            />
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
  onEdit,
  focusedCount,
  handleFieldBlur,
  label,
  exerciseName,
  setId,
}: {
  field: Exclude<SessionField, 'setType'>;
  draft: SetRowValues;
  targets: Partial<Record<Exclude<SessionField, 'setType'>, string>>;
  onEdit: (values: SetRowValues) => void;
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
      placeholderTextColor={theme.inverse.textMuted + '80'}
      keyboardType="decimal-pad"
      selectTextOnFocus
      onFocus={() => {
        focusedCount.current += 1;
        // Scrolls only if the keyboard is actually covering this row.
        onFocusKeepVisible();
      }}
      onBlur={handleFieldBlur}
      onChangeText={(text) => onEdit({ ...draft, [field]: text })}
      style={[
        styles.input,
        {
          /* A well sunk into the card, not a box drawn on it — at a glance
             the row should read as values, and the field edges should not
             compete with the numbers in them. */
          backgroundColor: theme.inverse.surface,
          borderColor: theme.inverse.textMuted + '26',
          color: filled ? theme.inverse.text : theme.inverse.textMuted,
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
  pendingDot: { width: 8, height: 8, borderRadius: 4 },
  markGlyph: { fontSize: 13, fontWeight: '600' },
});
