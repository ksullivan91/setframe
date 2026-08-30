import styled from 'styled-components';
import { workoutEditor } from '@setframe/design-tokens';

/**
 * What the SET chip opens.
 *
 * Figma: `Screen/Mobile/WorkoutLoggerV2 — Set type sheet` (123:377).
 *
 * The chip was inert, which made the only route to changing a set's type or
 * deleting it unreachable — the two mutations v1 had that v2 lost.
 *
 * Every option writes immediately and optimistically; there is no Save.
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

const Option = styled.button<{ $selected: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border: none;
  text-align: left;
  cursor: pointer;
  background: ${({ theme, $selected }) =>
    $selected ? theme.action.primary + '0F' : 'transparent'};
`;

const Chip = styled.span<{ $tint?: string }>`
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  background: ${({ theme, $tint }) => $tint ?? theme.surface.sunken};
  color: ${({ theme }) => theme.text.primary};
`;

const OptionText = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const Name = styled.span`
  font-size: 15px;
  font-weight: 500;
  color: ${({ theme }) => theme.text.primary};
`;

const Desc = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Check = styled.span`
  flex: 0 0 20px;
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.action.primary};
`;

const Divider = styled.hr`
  margin: 0;
  border: none;
  border-top: 1px solid ${({ theme }) => theme.surface.sunken};
`;

const Delete = styled.button`
  width: 100%;
  padding: 16px;
  border: none;
  background: none;
  text-align: left;
  font-size: 15px;
  font-weight: 500;
  color: ${({ theme }) => theme.status.error};
  cursor: pointer;
`;

/** Only the types the logger actually renders a chip for. */
export const SET_TYPE_OPTIONS = [
  { value: 'working', label: 'Working set', chip: '', desc: 'Counts toward volume and the completed-set count.' },
  { value: 'warmup', label: 'Warm-up', chip: 'W', desc: 'Excluded from the completed-set count and from PRs.' },
  { value: 'top', label: 'Top set', chip: 'T', desc: 'The heaviest set for this exercise today.' },
  { value: 'backoff', label: 'Backoff', chip: 'B', desc: 'Lighter volume work following a top set.' },
  { value: 'drop', label: 'Drop set', chip: 'D', desc: 'Continues the previous set at a reduced load.' },
  { value: 'failure', label: 'Failure', chip: 'F', desc: 'Taken to technical failure.' },
] as const;

export interface SetTypeSheetProps {
  exerciseName: string;
  /** The number or letter the chip currently shows. */
  setLabel: string;
  currentType: string;
  onClose: () => void;
  onSelect: (setType: string) => void;
  onDelete: () => void;
}

export function SetTypeSheet({
  exerciseName,
  setLabel,
  currentType,
  onClose,
  onSelect,
  onDelete,
}: SetTypeSheetProps) {
  return (
    <Scrim onClick={onClose} data-testid="set-type-scrim">
      <Sheet
        role="dialog"
        aria-modal="true"
        aria-label="Set type"
        onClick={(event) => event.stopPropagation()}
        data-testid="set-type-sheet"
      >
        <GrabberRow>
          <Grabber aria-hidden="true" />
        </GrabberRow>
        <Header>
          <Title>Set type</Title>
          <Context>
            Set {setLabel} · {exerciseName}
          </Context>
        </Header>

        {SET_TYPE_OPTIONS.map((option) => (
          <Option
            key={option.value}
            type="button"
            $selected={option.value === currentType}
            aria-pressed={option.value === currentType}
            onClick={() => onSelect(option.value)}
            data-testid={`set-type-${option.value}`}
          >
            <Chip aria-hidden="true">{option.chip || setLabel}</Chip>
            <OptionText>
              <Name>{option.label}</Name>
              <Desc>{option.desc}</Desc>
            </OptionText>
            <Check aria-hidden="true">{option.value === currentType ? '✓' : ''}</Check>
          </Option>
        ))}

        <Divider />
        <Delete type="button" onClick={onDelete} data-testid="set-type-delete">
          Delete set {setLabel}
        </Delete>
      </Sheet>
    </Scrim>
  );
}
