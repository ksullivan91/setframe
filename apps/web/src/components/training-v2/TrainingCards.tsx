import type { ReactNode } from 'react';
import styled from 'styled-components';
import { training } from '@setframe/design-tokens';

/**
 * The card shell and rows shared by every block on the Training overview.
 *
 * Geometry from Figma 146:709: a 358px card (390 - 2*16) with 14px padding,
 * leaving 330px of usable width, and a 16px radius. Shared rather than
 * repeated per block so the three cards cannot drift apart.
 */

export const Card = styled.section`
  width: ${training.cardWidth}px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: ${training.cardRowGap}px;
  padding: ${training.cardPadding}px;
  border-radius: ${training.cardRadius}px;
  background: ${({ theme }) => theme.surface.raised};
`;

export const CardLabel = styled.h2`
  margin: 0;
  font-size: ${training.labelSize}px;
  font-weight: 500;
  letter-spacing: ${training.labelLetterSpacingPercent / 100}em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.text.disabled};
`;

export const CardHeadRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

/** A text-styled action in a card header ("+ New", "Edit schedule"). */
export const CardAction = styled.button`
  border: none;
  background: none;
  padding: 0;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.action.primary};
  cursor: pointer;
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.action.primary};
    outline-offset: 2px;
  }
`;

const Row = styled.button<{ $divided: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${training.workoutRow.gap}px;
  padding: ${training.workoutRow.paddingY}px 0;
  border: none;
  border-top: ${({ $divided, theme }) =>
    $divided ? `1px solid ${theme.border.subtle}` : 'none'};
  background: none;
  text-align: left;
  cursor: pointer;
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.action.primary};
    outline-offset: -2px;
  }
`;

const RowLeft = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const NameRow = styled.span`
  display: flex;
  align-items: center;
  gap: ${training.workoutRow.nameGap}px;
  min-width: 0;
`;

const Name = styled.span`
  font-size: ${training.workoutRow.nameSize}px;
  font-weight: 500;
  color: ${({ theme }) => theme.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Meta = styled.span`
  font-size: ${training.workoutRow.metaSize}px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Chevron = styled.span`
  flex: 0 0 auto;
  font-size: ${training.workoutRow.chevronSize}px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.secondary};
`;

const Pill = styled.span`
  flex: 0 0 auto;
  padding: ${training.workoutRow.pillPaddingY}px ${training.workoutRow.pillPaddingX}px;
  border-radius: ${training.workoutRow.pillRadius}px;
  font-size: ${training.workoutRow.pillLabelSize}px;
  font-weight: 600;
  background: ${({ theme }) => theme.action.accentSubtle};
  color: ${({ theme }) => theme.action.primary};
`;

export interface ListRowProps {
  name: string;
  meta: string;
  /** Renders the "Next up" pill. A readout, not a control. */
  badge?: string;
  /** The first row in a list has no rule above it. */
  divided: boolean;
  onClick?: () => void;
  testId?: string;
}

/**
 * One tappable row — a workout, a plan, a day.
 *
 * **The whole row is the target, not just the chevron**, per the interaction
 * spec. The chevron is decoration; making it the only hit area is the mistake
 * this replaces.
 */
export function ListRow({ name, meta, badge, divided, onClick, testId }: ListRowProps) {
  return (
    <Row type="button" $divided={divided} onClick={onClick} data-testid={testId}>
      <RowLeft>
        <NameRow>
          <Name>{name}</Name>
          {badge ? <Pill>{badge}</Pill> : null}
        </NameRow>
        <Meta>{meta}</Meta>
      </RowLeft>
      <Chevron aria-hidden="true">›</Chevron>
    </Row>
  );
}

export function CardBlock({ children }: { children: ReactNode }) {
  return <Card>{children}</Card>;
}
