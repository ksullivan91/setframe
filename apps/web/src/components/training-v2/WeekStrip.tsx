import styled from 'styled-components';
import type { WeekStripDay } from '@setframe/domain';
import { training } from '@setframe/design-tokens';

/**
 * The seven-day strip on the Training overview.
 *
 * Geometry from `Explore/Mobile/Training 7 · Set up, and training`
 * (Figma 146:709): seven 42px chips with a 6px gap sum to 330, exactly the
 * card's inner width, so the strip is flush with everything above and below
 * it rather than centred inside a wider box.
 *
 * **State never rides on colour alone.** Every chip carries a caption naming
 * the workout, or the word "Rest", so the strip is readable without
 * distinguishing a green tint from a grey one.
 *
 * Day order comes from `buildWeekStrip`, which derives it from the product's
 * own `WEEK_START_DAY` rather than hard-coding one — see
 * `packages/domain/src/training-overview.ts`.
 */

const Strip = styled.div`
  display: flex;
  gap: ${training.weekStrip.dayGap}px;
`;

const Day = styled.button`
  flex: 0 0 ${training.weekStrip.dayWidth}px;
  width: ${training.weekStrip.dayWidth}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${training.weekStrip.labelGap}px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.action.primary};
    outline-offset: 2px;
    border-radius: ${training.weekStrip.chipRadius}px;
  }
`;

const Chip = styled.span<{ $state: WeekStripDay['state'] }>`
  width: ${training.weekStrip.chipSize}px;
  height: ${training.weekStrip.chipSize}px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${training.weekStrip.chipRadius}px;
  font-size: ${training.weekStrip.dayLetterSize}px;
  font-weight: 600;
  /* A 20% success wash for done, solid accent for today, sunken for
     everything else. The literal alpha is deliberate: a bound colour at
     full opacity would make a trained day read as loudly as today. */
  background: ${({ theme, $state }) =>
    $state === 'done'
      ? theme.status.success + '33'
      : $state === 'today'
        ? theme.action.primary
        : theme.surface.sunken};
  color: ${({ theme, $state }) =>
    $state === 'today' ? theme.action.primaryText : theme.text.primary};
`;

const Caption = styled.span`
  font-size: ${training.weekStrip.workoutNameSize}px;
  color: ${({ theme }) => theme.text.secondary};
  max-width: ${training.weekStrip.dayWidth}px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export interface WeekStripProps {
  days: readonly WeekStripDay[];
  onSelectDay?: (day: WeekStripDay) => void;
}

export function WeekStrip({ days, onSelectDay }: WeekStripProps) {
  return (
    <Strip role="list" aria-label="This week">
      {days.map((day) => (
        <Day
          key={day.localDate}
          role="listitem"
          type="button"
          onClick={() => onSelectDay?.(day)}
          /* The letter alone is ambiguous — two days read "T" — so the
             accessible name carries the full day and what is on it. */
          aria-label={`${day.dayName}, ${day.caption}`}
          aria-current={day.state === 'today' ? 'date' : undefined}
          data-testid={`week-day-${day.localDate}`}
          data-state={day.state}
        >
          <Chip $state={day.state} aria-hidden="true">
            {day.letter}
          </Chip>
          <Caption>{day.caption}</Caption>
        </Day>
      ))}
    </Strip>
  );
}
