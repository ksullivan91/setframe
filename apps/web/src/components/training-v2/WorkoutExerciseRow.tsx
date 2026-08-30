import styled from 'styled-components';
import { training, workoutEditor } from '@setframe/design-tokens';

/**
 * One exercise inside the workout editor.
 *
 * Figma: `Explore/Mobile/Training 3 · Build a workout` (147:708). A 334px row
 * inside a 358px card — the card's padding is 12, narrower than an overview
 * card's 14, which is what makes those two numbers meet.
 *
 * The illustration tile is here because the editor is a **choosing** surface,
 * which is where the teardown said the tile earns its space.
 */

const Row = styled.div<{ $divided: boolean }>`
  display: flex;
  align-items: center;
  gap: ${workoutEditor.row.gap}px;
  height: ${workoutEditor.row.height}px;
  padding: ${workoutEditor.row.paddingY}px 0;
  border-top: ${({ $divided, theme }) => ($divided ? `1px solid ${theme.border.subtle}` : 'none')};
`;

const Grip = styled.span`
  flex: 0 0 ${workoutEditor.row.gripWidth}px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${workoutEditor.row.gripSize}px;
  color: ${({ theme }) => theme.text.disabled};
  cursor: grab;
`;

const Tile = styled.span`
  flex: 0 0 ${workoutEditor.row.tileSize}px;
  width: ${workoutEditor.row.tileSize}px;
  height: ${workoutEditor.row.tileSize}px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${workoutEditor.row.tileRadius}px;
  background: ${({ theme }) => theme.surface.sunken};
  color: ${({ theme }) => theme.text.secondary};
  font-size: 13px;
  font-weight: 600;
`;

const Text = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${workoutEditor.row.textGap}px;
`;

const Name = styled.span`
  font-size: ${workoutEditor.row.nameSize}px;
  font-weight: 500;
  color: ${({ theme }) => theme.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Meta = styled.span`
  font-size: ${workoutEditor.row.metaSize}px;
  color: ${({ theme }) => theme.text.secondary};
`;

const PlanPill = styled.span`
  flex: 0 0 auto;
  padding: ${workoutEditor.row.pillPaddingY}px ${workoutEditor.row.pillPaddingX}px;
  border-radius: ${workoutEditor.row.pillRadius}px;
  background: ${({ theme }) => theme.action.accentSubtle};
  color: ${({ theme }) => theme.action.primary};
  font-size: ${workoutEditor.row.pillLabelSize}px;
  font-weight: 600;
  white-space: nowrap;
`;

const More = styled.button`
  flex: 0 0 ${workoutEditor.row.moreWidth}px;
  width: ${workoutEditor.row.moreWidth}px;
  border: none;
  background: none;
  padding: 0;
  font-size: ${workoutEditor.row.moreSize}px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.secondary};
  cursor: pointer;
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.action.primary};
    outline-offset: 2px;
  }
`;

export interface WorkoutExerciseRowProps {
  exerciseId: string;
  name: string;
  meta: string;
  /** `3 × 8`, or null when nothing is planned — story 19 made targets optional. */
  planLabel: string | null;
  divided: boolean;
  onOpenActions: () => void;
}

export function WorkoutExerciseRow({
  exerciseId,
  name,
  meta,
  planLabel,
  divided,
  onOpenActions,
}: WorkoutExerciseRowProps) {
  return (
    <Row $divided={divided} data-testid={`editor-row-${exerciseId}`}>
      <Grip aria-hidden="true">⠿</Grip>
      <Tile aria-hidden="true">{initials(name)}</Tile>
      <Text>
        <Name>{name}</Name>
        <Meta>{meta}</Meta>
      </Text>
      {/* Absent rather than "—" when nothing is planned: a blank target is
          legitimate (story 19), and a dash reads like a missing value. */}
      {planLabel ? <PlanPill>{planLabel}</PlanPill> : null}
      <More type="button" onClick={onOpenActions} aria-label={`Actions for ${name}`}>
        ⋯
      </More>
    </Row>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

export const EditorCard = styled.section`
  width: ${training.cardWidth}px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  padding: ${workoutEditor.listPaddingY}px ${workoutEditor.listPaddingX}px;
  border-radius: ${workoutEditor.listRadius}px;
  background: ${({ theme }) => theme.surface.raised};
`;
