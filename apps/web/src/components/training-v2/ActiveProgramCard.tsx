import styled from 'styled-components';
import type { BlockProgress } from '@setframe/domain';
import { training } from '@setframe/design-tokens';
import { Card, CardLabel } from './TrainingCards';

/**
 * "Your plan" — what you are following, and how far through it you are.
 *
 * Geometry from Figma 146:709. The progress bar is the piece of information
 * the old page never showed at all: `cycle_length_weeks` has always been in
 * the schema, and nothing in the product ever said "week 3 of 8".
 */

const Row = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
`;

const Left = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const Name = styled.h3`
  margin: 0;
  font-size: ${training.activeProgram.nameSize}px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Meta = styled.p`
  margin: 0;
  font-size: ${training.activeProgram.metaSize}px;
  color: ${({ theme }) => theme.text.secondary};
`;

const ChangeButton = styled.button`
  flex: 0 0 auto;
  height: ${training.activeProgram.buttonHeight}px;
  padding: 0 ${training.activeProgram.buttonPaddingX}px;
  border: none;
  border-radius: ${training.activeProgram.buttonRadius}px;
  background: ${({ theme }) => theme.surface.sunken};
  color: ${({ theme }) => theme.text.primary};
  font-size: ${training.activeProgram.buttonLabelSize}px;
  font-weight: 500;
  cursor: pointer;
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.action.primary};
    outline-offset: 2px;
  }
`;

const Track = styled.div`
  width: 100%;
  height: ${training.activeProgram.trackHeight}px;
  border-radius: ${training.activeProgram.trackRadius}px;
  background: ${({ theme }) => theme.surface.sunken};
  overflow: hidden;
`;

const Fill = styled.div<{ $ratio: number }>`
  width: ${({ $ratio }) => Math.round($ratio * 100)}%;
  height: 100%;
  border-radius: ${training.activeProgram.trackRadius}px;
  background: ${({ theme }) => theme.action.primary};
`;

export interface ActiveProgramCardProps {
  programName: string;
  meta: string;
  progress: BlockProgress;
  onChange?: () => void;
}

export function ActiveProgramCard({
  programName,
  meta,
  progress,
  onChange,
}: ActiveProgramCardProps) {
  return (
    <Card data-testid="active-program-card">
      <CardLabel>Your plan</CardLabel>
      <Row>
        <Left>
          <Name>{programName}</Name>
          <Meta>{meta}</Meta>
        </Left>
        <ChangeButton type="button" onClick={onChange} data-testid="change-program">
          Change
        </ChangeButton>
      </Row>
      {/* Perpetual mode has no bar at all. A plan that repeats forever has
          nothing to be part-way through, and drawing it as either empty or
          full would assert something untrue. */}
      {progress.ratio == null ? null : (
        <Track
          role="progressbar"
          aria-label={progress.label}
          aria-valuenow={progress.currentWeek ?? undefined}
          aria-valuemin={1}
          data-testid="block-progress"
        >
          <Fill $ratio={progress.ratio} />
        </Track>
      )}
    </Card>
  );
}
