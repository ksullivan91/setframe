import type { ReactNode } from 'react';
import styled from 'styled-components';
import type { SessionField } from '@setframe/domain';
import { COLUMN_GAP, COLUMN_WIDTHS, ROW_PADDING_X, SET_ROW_WIDTH } from './SetRowV2';

/**
 * One exercise, as a table of set rows.
 *
 * Geometry from `Screen/Mobile/WorkoutLoggerV2 — Active` (Figma 99:2). The
 * number that matters is the card height: a three-set exercise is **264px**,
 * and the completed state is the same 264px. Completion swaps the plan pill
 * for the result pill in the same slot and tints the rows — it must never
 * change the card's height or position, because reflowing the thing the user
 * is looking at is the jarring transition this redesign exists to fix.
 * See docs/design/workout-logging-table.md §6.1.
 */

export const CARD_WIDTH = 358;

/** Column order matches SetRowV2 exactly, or the labels stop sitting over their columns. */
const HEADER_COLUMNS: { key: string; label: string; width: number }[] = [
  { key: 'set', label: 'SET', width: COLUMN_WIDTHS.setChip },
  { key: 'previous', label: 'PREVIOUS', width: COLUMN_WIDTHS.previous },
  { key: 'pr', label: '', width: COLUMN_WIDTHS.prSlot },
];

const Card = styled.section<{ $complete: boolean }>`
  width: ${CARD_WIDTH}px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 16px;
  background: ${({ theme }) => theme.surface.raised};
  /* Completed cards keep the raised surface and take a tinted border. An
     earlier pass gave them a full green gradient, which on the
     workout-complete screen turned every card green and flattened the
     set / exercise / workout reward hierarchy.

     An inset shadow rather than a border, deliberately. Figma strokes default
     to strokeAlign INSIDE, where the stroke overlaps the padding and does not
     consume content width; a CSS border under border-box subtracts from it.
     With a border the card's inner width came out 332 against the design's
     334, and every row and column inherited the 2px error. */
  box-shadow: inset 0 0 0 1px
    ${({ theme, $complete }) => ($complete ? theme.status.success + '73' : theme.border.subtle)};
  transition: border-color 220ms ease-out;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 28px;
`;

const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const Name = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Pill = styled.span<{ $tone: 'plan' | 'up' | 'neutral' | 'down' }>`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  background: ${({ theme, $tone }) =>
    $tone === 'plan'
      ? theme.action.accentSubtle
      : $tone === 'up'
        ? theme.status.success
        : $tone === 'down'
          ? theme.status.caution + '29'
          : theme.status.success + '29'};
  /* Never inverse on the solid green: white on #00c48c measures 2.26:1.
     Dark text on the same fill is 7.98:1. */
  color: ${({ theme, $tone }) => ($tone === 'plan' ? theme.action.primary : theme.text.primary)};
`;

const MoreButton = styled.button`
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.text.disabled};
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
`;

const ColumnHeader = styled.div`
  display: flex;
  gap: ${COLUMN_GAP}px;
  padding: 0 ${ROW_PADDING_X}px;
  width: ${SET_ROW_WIDTH}px;
  max-width: 100%;
  height: 14px;
`;

const ColumnLabel = styled.span<{ $width: number }>`
  flex: 0 0 ${({ $width }) => $width}px;
  width: ${({ $width }) => $width}px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.text.disabled};
`;

const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const AddSet = styled.button`
  width: ${SET_ROW_WIDTH}px;
  max-width: 100%;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: ${({ theme }) => theme.surface.sunken};
  color: ${({ theme }) => theme.action.primary};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
`;

export interface ExerciseTableCardProps {
  exerciseName: string;
  /** Shown while the exercise is unfinished. */
  planLabel: string | null;
  /** Replaces the plan pill, in the same slot, once every planned row is written. */
  resultLabel: string | null;
  resultTone: 'up' | 'neutral' | 'down';
  complete: boolean;
  /** Value columns, in order, from the prescription definition. */
  fields: readonly Exclude<SessionField, 'setType'>[];
  onAddSet: () => void;
  onOpenActions: () => void;
  children: ReactNode;
  testId?: string;
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
  testId,
}: ExerciseTableCardProps) {
  const columns = [
    ...HEADER_COLUMNS,
    ...fields.map((field) => ({ key: field, label: columnLabel(field), width: COLUMN_WIDTHS.input })),
    { key: 'mark', label: '', width: COLUMN_WIDTHS.mark },
  ];

  return (
    <Card $complete={complete} data-testid={testId} data-complete={complete}>
      <Header>
        <TitleGroup>
          <Name>{exerciseName}</Name>
          {complete && resultLabel ? (
            <Pill $tone={resultTone} data-testid="result-pill">
              {resultLabel}
            </Pill>
          ) : planLabel ? (
            <Pill $tone="plan" data-testid="plan-pill">
              {planLabel}
            </Pill>
          ) : null}
        </TitleGroup>
        <MoreButton type="button" onClick={onOpenActions} aria-label={'Actions for ' + exerciseName}>
          ⋯
        </MoreButton>
      </Header>

      <ColumnHeader aria-hidden="true">
        {columns.map((column) => (
          <ColumnLabel key={column.key} $width={column.width}>
            {column.label}
          </ColumnLabel>
        ))}
      </ColumnHeader>

      <Rows>{children}</Rows>

      <AddSet type="button" onClick={onAddSet}>
        + Add set
      </AddSet>
    </Card>
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
