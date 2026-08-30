import styled from 'styled-components';
import { training } from '@setframe/design-tokens';

/**
 * The empty Training page — the outermost empty state, and the one the
 * teardown's biggest structural finding lives in.
 *
 * Figma: `Explore/Mobile/Training 1 · No plan yet` (148:708).
 *
 * The teardown, verbatim: *"Setframe requires a program before Today has
 * anything to offer. Our novice journey currently lands on 'Set up your
 * training' — correct, and a wall."*
 *
 * Three routes out, **live ones first, then what does not exist yet**. This
 * is not a card inside a page; it *is* the page, because it is the one empty
 * state someone can meet before they have ever succeeded at anything.
 */

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${training.cardGap}px;
`;

const Option = styled.section<{ $primary?: boolean }>`
  width: ${training.cardWidth}px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border-radius: ${training.cardRadius}px;
  background: ${({ theme }) => theme.surface.raised};
  box-shadow: ${({ theme, $primary }) =>
    $primary ? `inset 0 0 0 1px ${theme.action.primary}` : 'none'};
`;

const Title = styled.h2`
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.primary};
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const Body2 = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Cta = styled.button<{ $primary?: boolean }>`
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: ${({ theme, $primary }) =>
    $primary ? theme.action.primary : theme.surface.sunken};
  color: ${({ theme, $primary }) =>
    $primary ? theme.action.primaryText : theme.action.primary};
  &:disabled {
    color: ${({ theme }) => theme.text.disabled};
    cursor: default;
  }
`;

const Note = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.text.disabled};
`;

/**
 * "Coming soon", in the logger's caution treatment: amber at 16% under dark
 * text. Amber as a *foreground* is the contrast failure already fixed once on
 * the PR badge.
 */
const ComingSoon = styled.span`
  flex: 0 0 auto;
  padding: 3px 8px;
  border-radius: 999px;
  background: ${({ theme }) => theme.status.caution + '29'};
  color: ${({ theme }) => theme.text.primary};
  font-size: 11px;
  font-weight: 600;
`;

export interface NoPlanRoutesProps {
  onJustStart: () => void;
  onBuildYourOwn: () => void;
  busy?: boolean;
}

export function NoPlanRoutes({ onJustStart, onBuildYourOwn, busy }: NoPlanRoutesProps) {
  return (
    <Body data-testid="no-plan-routes">
      <Option $primary>
        <Title>Just start training</Title>
        <Body2>
          Log today&apos;s session now and pick exercises as you go. Nothing to set up first.
        </Body2>
        <Cta $primary type="button" onClick={onJustStart} disabled={busy} data-testid="just-start">
          Start a workout
        </Cta>
        <Note>
          Afterwards you can save it as a reusable workout in one tap — it is a real session either
          way.
        </Note>
      </Option>

      <Option>
        <Title>Build your own</Title>
        <Body2>
          Set up a program week by week. Best if you already know what you want to run.
        </Body2>
        <Cta type="button" onClick={onBuildYourOwn} data-testid="build-your-own">
          Guided setup
        </Cta>
      </Option>

      <Option>
        <TitleRow>
          <Title>Start from a template</Title>
          <ComingSoon>Coming soon</ComingSoon>
        </TitleRow>
        <Body2>
          Upper/Lower, Push Pull Legs, Full Body 3-day. Real workouts with exercises and targets
          already filled in, which you can change.
        </Body2>
        {/* Disabled deliberately: the starter templates do not exist yet, and
            an enabled control that leads nowhere is the defect the badge
            exists to prevent. */}
        <Cta type="button" disabled data-testid="browse-templates">
          Browse templates
        </Cta>
      </Option>
    </Body>
  );
}
