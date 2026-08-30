import styled from 'styled-components';

/**
 * What an exercise's `⋯` opens.
 *
 * Figma: `Screen/Mobile/WorkoutLoggerV2 — Exercise actions` (124:439).
 *
 * The control existed and did nothing. **Only actions that are actually
 * wired appear here** — the design also lists Replace exercise and Reorder
 * exercises, and shipping those as rows that do nothing would repeat exactly
 * the defect this fixes. They are tracked, not faked.
 */

const Scrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
`;

const Sheet = styled.div`
  width: 100%;
  max-height: 90dvh;
  overflow-y: auto;
  padding: 10px 0 max(24px, env(safe-area-inset-bottom));
  background: ${({ theme }) => theme.surface.raised};
  border-radius: 16px 16px 0 0;
`;

const GrabberRow = styled.div`
  display: flex;
  justify-content: center;
  padding-bottom: 8px;
`;

const Grabber = styled.span`
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: ${({ theme }) => theme.border.default};
`;

const Header = styled.header`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 16px 12px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.primary};
`;

const Context = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Action = styled.button<{ $destructive?: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
`;

const ActionText = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const Label = styled.span<{ $destructive?: boolean }>`
  font-size: 15px;
  font-weight: 500;
  color: ${({ theme, $destructive }) => ($destructive ? theme.status.error : theme.text.primary)};
`;

const Sub = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Chevron = styled.span`
  flex: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.secondary};
`;

const Toggle = styled.span<{ $on: boolean }>`
  flex: 0 0 46px;
  width: 46px;
  height: 26px;
  padding: 3px;
  border-radius: 999px;
  display: flex;
  justify-content: ${({ $on }) => ($on ? 'flex-end' : 'flex-start')};
  background: ${({ theme, $on }) => ($on ? theme.action.primary : theme.surface.sunken)};
`;

const Knob = styled.span`
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #ffffff;
`;

const Divider = styled.hr`
  margin: 0;
  border: none;
  border-top: 1px solid ${({ theme }) => theme.surface.sunken};
`;

export interface ExerciseActionsSheetProps {
  exerciseName: string;
  context: string;
  rpeVisible: boolean;
  onClose: () => void;
  onViewHistory: () => void;
  onToggleRpe: () => void;
  onRemove: () => void;
}

export function ExerciseActionsSheet({
  exerciseName,
  context,
  rpeVisible,
  onClose,
  onViewHistory,
  onToggleRpe,
  onRemove,
}: ExerciseActionsSheetProps) {
  return (
    <Scrim onClick={onClose} data-testid="exercise-actions-scrim">
      <Sheet
        role="dialog"
        aria-modal="true"
        aria-label={`${exerciseName} actions`}
        onClick={(event) => event.stopPropagation()}
        data-testid="exercise-actions-sheet"
      >
        <GrabberRow>
          <Grabber aria-hidden="true" />
        </GrabberRow>
        <Header>
          <Title>{exerciseName}</Title>
          <Context>{context}</Context>
        </Header>

        <Action type="button" onClick={onViewHistory} data-testid="exercise-action-history">
          <ActionText>
            <Label>View history</Label>
            <Sub>Every session you have logged for this exercise</Sub>
          </ActionText>
          <Chevron aria-hidden="true">›</Chevron>
        </Action>

        <Action
          type="button"
          onClick={onToggleRpe}
          aria-pressed={rpeVisible}
          data-testid="exercise-action-rpe"
        >
          <ActionText>
            <Label>Show RPE column</Label>
            <Sub>Adds an optional RPE field to every set here</Sub>
          </ActionText>
          <Toggle $on={rpeVisible} aria-hidden="true">
            <Knob />
          </Toggle>
        </Action>

        <Divider />
        <Action type="button" onClick={onRemove} data-testid="exercise-action-remove">
          <ActionText>
            <Label $destructive>Remove exercise</Label>
            <Sub>Takes it out of today&apos;s session. Your plan is unchanged.</Sub>
          </ActionText>
        </Action>
      </Sheet>
    </Scrim>
  );
}
