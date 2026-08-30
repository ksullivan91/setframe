import { useState } from 'react';
import styled from 'styled-components';
import type { DayType } from '@setframe/schemas';
import { workoutEditor } from '@setframe/design-tokens';

/**
 * What a schedule row's chevron opens.
 *
 * Figma: `Explore/Mobile/Training 6 · Assign a day` (156:708).
 *
 * **Multi-select, not single.** `program_schedule_slot` has no unique
 * constraint on `(programVersionId, dayIndex)` and carries a `sortOrder`, so
 * several workouts can share a day. Designing this as single-select would
 * have ruled out two-a-days the data model already allows.
 *
 * **Rest clears the day.** `dayTypeId` is `NOT NULL`, so Rest cannot be a
 * slot pointing at nothing — choosing it deletes the day's slots. That is why
 * it sits below a divider: it is a different kind of action from the four
 * above it.
 *
 * **No Save button.** Selecting writes immediately and the row behind
 * updates. The sheet is a picker, not a form.
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
  padding: ${workoutEditor.sheet.paddingTop}px 0
    max(${workoutEditor.sheet.paddingBottom}px, env(safe-area-inset-bottom));
  background: ${({ theme }) => theme.surface.raised};
  border-radius: 16px 16px 0 0;
`;

const GrabberRow = styled.div`
  display: flex;
  justify-content: center;
  padding-bottom: 8px;
`;

const Grabber = styled.span`
  width: ${workoutEditor.sheet.grabberWidth}px;
  height: ${workoutEditor.sheet.grabberHeight}px;
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

const Subtitle = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Option = styled.button<{ $selected: boolean; $tall?: boolean }>`
  width: 100%;
  min-height: ${({ $tall }) => ($tall ? 62 : 58)}px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: ${({ $tall }) => ($tall ? 14 : 12)}px 16px;
  border: none;
  text-align: left;
  cursor: pointer;
  background: ${({ theme, $selected }) =>
    $selected ? theme.action.primary + '0F' : 'transparent'};
`;

const Check = styled.span<{ $selected: boolean }>`
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: ${({ theme, $selected }) => ($selected ? theme.action.primary : 'transparent')};
  border: ${({ theme, $selected }) => ($selected ? 'none' : `1px solid ${theme.border.default}`)};
  color: ${({ theme }) => theme.action.primaryText};
`;

const OptionText = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const OptionName = styled.span`
  font-size: 15px;
  font-weight: 500;
  color: ${({ theme }) => theme.text.primary};
`;

const OptionMeta = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Hint = styled.p`
  margin: 0;
  padding: 4px 16px 12px;
  font-size: 12px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Divider = styled.hr`
  margin: 0;
  border: none;
  border-top: 1px solid ${({ theme }) => theme.surface.sunken};
`;

const Foot = styled.p`
  margin: 0;
  padding: 8px 16px 0;
  font-size: 12px;
  color: ${({ theme }) => theme.text.secondary};
`;

export interface AssignDaySheetProps {
  dayIndex: number;
  dayName: string;
  dayTypes: readonly DayType[];
  selectedIds: readonly string[];
  onClose: () => void;
  onChange: (dayTypeIds: string[]) => void;
}

export function AssignDaySheet({
  dayName,
  dayTypes,
  selectedIds,
  onClose,
  onChange,
}: AssignDaySheetProps) {
  const [selected, setSelected] = useState<string[]>([...selectedIds]);

  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : [...selected, id];
    setSelected(next);
    /* Writes immediately — the sheet is a picker, not a form. */
    onChange(next);
  };

  const clear = () => {
    setSelected([]);
    onChange([]);
  };

  return (
    <Scrim onClick={onClose} data-testid="assign-day-scrim">
      <Sheet
        role="dialog"
        aria-modal="true"
        aria-label={`Assign ${dayName}`}
        onClick={(event) => event.stopPropagation()}
        data-testid="assign-day-sheet"
      >
        <GrabberRow>
          <Grabber aria-hidden="true" />
        </GrabberRow>

        <Header>
          <Title>{dayName}</Title>
          <Subtitle>What you train every {dayName}</Subtitle>
        </Header>

        {dayTypes.map((dayType) => {
          const index = selected.indexOf(dayType.id);
          return (
            <Option
              key={dayType.id}
              type="button"
              $selected={index !== -1}
              onClick={() => toggle(dayType.id)}
              aria-pressed={index !== -1}
              data-testid={`assign-option-${dayType.id}`}
            >
              {/* The check becomes a number once more than one is chosen —
                  several workouts on a day run in the order picked. */}
              <Check $selected={index !== -1}>
                {index !== -1 && selected.length > 1 ? index + 1 : ''}
              </Check>
              <OptionText>
                <OptionName>{dayType.name}</OptionName>
                <OptionMeta>
                  {dayType.exerciseCount != null
                    ? `${dayType.exerciseCount} exercises`
                    : 'Workout'}
                </OptionMeta>
              </OptionText>
            </Option>
          );
        })}

        <Hint>
          Pick more than one to train twice in a day. They run in the order you choose them.
        </Hint>

        <Divider />
        {/* Below the divider because it is a different KIND of action:
            dayTypeId is NOT NULL, so Rest deletes the day's slots rather
            than assigning anything to it. */}
        <Option
          type="button"
          $selected={selected.length === 0}
          $tall
          onClick={clear}
          data-testid="assign-rest"
        >
          <Check $selected={selected.length === 0} />
          <OptionText>
            <OptionName>Rest</OptionName>
            <OptionMeta>Clears whatever is on this day</OptionMeta>
          </OptionText>
        </Option>

        <Foot>
          Changes every {dayName} in this plan. To change one date only, use “Changes to specific
          days”.
        </Foot>
      </Sheet>
    </Scrim>
  );
}
