import { useEffect, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import type { SessionField } from '@setframe/domain';

/**
 * One logged set, as a row in a table.
 *
 * Geometry is read straight off `SetRow/Mobile` (Figma node 96:57) and is
 * load-bearing rather than decorative — the columns must line up across every
 * row of an exercise whatever state each row is in, so the widths below are
 * fixed and the PR badge gets a reserved slot rather than appearing inline.
 * See docs/design/workout-logging-table.md §2.1.
 *
 *     4 + (34 + 74 + 24 + 70 + 70 + 24) + (5 x 6 gaps) + 4 = 334
 *
 * The row commits itself on blur; there is no save control. The mark on the
 * right *reports* the result of that write and is only interactive in the
 * error state, where it becomes retry. Building it as a checkbox is the most
 * likely way to get this component wrong.
 */

export const SET_ROW_WIDTH = 334;
export const SET_ROW_HEIGHT = 44;
export const COLUMN_WIDTHS = {
  setChip: 34,
  previous: 74,
  prSlot: 24,
  input: 70,
  mark: 24,
} as const;
export const COLUMN_GAP = 6;
export const ROW_PADDING_X = 4;

export type SetRowStatus = 'empty' | 'pending' | 'saved' | 'pr' | 'error';

export interface SetRowValues {
  weight: string;
  reps: string;
  duration: string;
  distance: string;
  rpe: string;
}

const Row = styled.div<{ $status: SetRowStatus }>`
  display: flex;
  align-items: center;
  gap: ${COLUMN_GAP}px;
  padding: 0 ${ROW_PADDING_X}px;
  width: ${SET_ROW_WIDTH}px;
  max-width: 100%;
  height: ${SET_ROW_HEIGHT}px;
  border-radius: 10px;
  /* Tints are literal low-alpha washes, not theme tokens: a token would paint
     at full opacity and drown the row. Figma carries the same literals. */
  background: ${({ $status, theme }) =>
    $status === 'saved' || $status === 'pr'
      ? theme.status.success + '1F'
      : $status === 'error'
        ? theme.action.destructive + '1A'
        : 'transparent'};
  transition: background-color 180ms ease-out;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const SetChip = styled.button`
  flex: 0 0 ${COLUMN_WIDTHS.setChip}px;
  width: ${COLUMN_WIDTHS.setChip}px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: ${({ theme }) => theme.surface.sunken};
  color: ${({ theme }) => theme.text.primary};
  font-size: 14px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  padding: 0;
`;

const PreviousCell = styled.button`
  flex: 0 0 ${COLUMN_WIDTHS.previous}px;
  width: ${COLUMN_WIDTHS.previous}px;
  height: ${SET_ROW_HEIGHT}px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  padding: 0;
  color: ${({ theme }) => theme.text.primary};
  font-size: 13px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  cursor: pointer;

  &:disabled {
    color: ${({ theme }) => theme.text.disabled};
    cursor: default;
  }
`;

/* Reserved in every row, occupied only on a PR — otherwise a record would
   shove PREVIOUS, LB and REPS out of line with the rows around it. */
const PrSlot = styled.div`
  flex: 0 0 ${COLUMN_WIDTHS.prSlot}px;
  width: ${COLUMN_WIDTHS.prSlot}px;
  height: ${SET_ROW_HEIGHT}px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const PrBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${COLUMN_WIDTHS.prSlot}px;
  height: 16px;
  border-radius: 999px;
  background: ${({ theme }) => theme.action.primary};
  color: ${({ theme }) => theme.action.primaryText};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.02em;
`;

const ValueInput = styled.input<{ $filled: boolean }>`
  flex: 0 0 ${COLUMN_WIDTHS.input}px;
  width: ${COLUMN_WIDTHS.input}px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.border.default};
  background: ${({ theme }) => theme.surface.canvas};
  text-align: center;
  font-variant-numeric: tabular-nums;
  /* 16px is not a style choice: below it iOS Safari zooms the viewport on
     focus and never zooms back. Story 28. */
  font-size: 16px;
  padding: 0;
  color: ${({ theme, $filled }) => ($filled ? theme.text.primary : theme.text.disabled)};
  font-weight: ${({ $filled }) => ($filled ? 600 : 400)};

  &::placeholder {
    color: ${({ theme }) => theme.text.disabled};
    font-weight: 400;
  }

  &:focus {
    outline: none;
    border: 2px solid ${({ theme }) => theme.action.primary};
  }
`;

const markBase = css`
  flex: 0 0 ${COLUMN_WIDTHS.mark}px;
  width: ${COLUMN_WIDTHS.mark}px;
  height: ${COLUMN_WIDTHS.mark}px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  padding: 0;
`;

const MarkReadout = styled.span<{ $status: SetRowStatus }>`
  ${markBase};
  border: 1.5px solid
    ${({ theme, $status }) =>
      $status === 'saved' || $status === 'pr' ? theme.status.success : theme.border.default};
  background: ${({ theme, $status }) =>
    $status === 'saved' || $status === 'pr' ? theme.surface.raised : 'transparent'};
  color: ${({ theme }) => theme.status.success};
`;

const MarkRetry = styled.button`
  ${markBase};
  border: 1.5px solid ${({ theme }) => theme.action.destructive};
  background: transparent;
  color: ${({ theme }) => theme.action.destructive};
  font-size: 12px;
  cursor: pointer;
`;

const PendingRing = styled.span`
  ${markBase};
  border: 1.5px solid ${({ theme }) => theme.border.default};
  border-top-color: ${({ theme }) => theme.action.primary};
  animation: spin 800ms linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export interface SetRowV2Props {
  setId: string;
  /** Display label for the SET chip — a number, or "W" for a warm-up. */
  label: string;
  status: SetRowStatus;
  values: SetRowValues;
  /** Placeholder targets, shown in placeholder tone until the user types. */
  targets: Partial<SetRowValues>;
  /** Last session's value for this set index, already formatted. */
  previous: string | null;
  /** Visible value columns, in order, from the prescription definition. */
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
  const [draft, setDraft] = useState<SetRowValues>(values);
  const rowRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef<SetRowValues>(values);

  /* Server values win whenever they change underneath us — a PR recompute or
     another device's edit — but only when the user is not mid-edit in this
     row, or we would yank the field out from under them. */
  useEffect(() => {
    const active = rowRef.current?.contains(document.activeElement);
    if (active) return;
    setDraft(values);
    committedRef.current = values;
  }, [values]);

  /**
   * Blur commits, but only when focus has actually left the ROW — moving from
   * weight to reps is still inside it, and committing there would fire two
   * writes for one set and briefly paint a half-filled row as saved.
   */
  const handleBlur = () => {
    window.setTimeout(() => {
      if (rowRef.current?.contains(document.activeElement)) return;
      const unchanged = (Object.keys(draft) as (keyof SetRowValues)[]).every(
        (k) => draft[k] === committedRef.current[k],
      );
      if (unchanged) return;
      committedRef.current = draft;
      onCommit(draft);
    }, 0);
  };

  const set = (field: keyof SetRowValues) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((prev) => ({ ...prev, [field]: event.target.value }));

  return (
    <Row
      ref={rowRef}
      $status={status}
      onBlur={handleBlur}
      data-testid={'set-row-' + setId}
      data-status={status}
      role="group"
      aria-label={
        'Set ' + label + (previous ? ', previous ' + previous : ', no previous') + ', ' + exerciseName
      }
    >
      <SetChip type="button" onClick={onOpenSetType} aria-label={'Set type for set ' + label}>
        {label}
      </SetChip>

      <PreviousCell
        type="button"
        onClick={onCopyPrevious}
        disabled={!previous}
        aria-label={previous ? 'Use last session, ' + previous : 'No previous session'}
      >
        {previous ?? '—'}
      </PreviousCell>

      <PrSlot>{status === 'pr' ? <PrBadge aria-label="Personal record">PR</PrBadge> : null}</PrSlot>

      {fields.map((field) => (
        <ValueInput
          key={field}
          type="text"
          inputMode="decimal"
          value={draft[field]}
          placeholder={targets[field] ?? ''}
          $filled={draft[field] !== ''}
          onChange={set(field)}
          onFocus={(event) => event.currentTarget.select()}
          aria-label={fieldLabel(field) + ', set ' + label + ', ' + exerciseName}
          data-testid={'set-input-' + field + '-' + setId}
        />
      ))}

      {status === 'error' ? (
        <MarkRetry type="button" onClick={onRetry} aria-label={'Retry saving set ' + label}>
          ↻
        </MarkRetry>
      ) : status === 'pending' ? (
        <PendingRing aria-label={'Saving set ' + label} />
      ) : (
        <MarkReadout $status={status} aria-hidden={status !== 'saved' && status !== 'pr'}>
          {status === 'saved' || status === 'pr' ? '✓' : ''}
        </MarkReadout>
      )}
    </Row>
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
