import type { ReactNode } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { ArrowDown, ArrowUp, Check, Minus } from 'lucide-react';
import { radius, spacing } from '@setframe/design-tokens';
import type { CompletedExerciseReadout } from '@setframe/domain';
import { typeScale } from '../theme/typeScale';

/**
 * A finished exercise, as a record of what happened rather than a form.
 *
 * Story 42. The previous completed state was the active card with success
 * colours applied: same header, same chevron and kebab at full weight, plus a
 * `✓ Complete` badge and a dense summary string. It told you the exercise was
 * done without making that feel like anything, and it took up as much room as
 * an exercise you still had to do.
 *
 * This is a different component mode, not a variant. Completion is carried by
 * *structure* — a circled check leading the card, the editor gone, figures in
 * place of inputs — so the state is legible even before colour registers, and
 * the workout visibly shrinks as it progresses.
 *
 * The whole card is the reopen affordance. Mid-workout the user is standing,
 * possibly one-handed, and a small chevron is a poor target; the card is a
 * large one, and the kebab sits above it for the actions that are not
 * "let me look at that again".
 */

const settle = keyframes`
  from { transform: scale(0.985); opacity: 0.85; }
  to   { transform: scale(1); opacity: 1; }
`;

const drawCheck = keyframes`
  from { transform: scale(0.6); opacity: 0; }
  60%  { transform: scale(1.06); opacity: 1; }
  to   { transform: scale(1); opacity: 1; }
`;

const Surface = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
  animation: ${settle} 220ms ease-out;

  /* Reduced motion removes the movement, never the meaning: the layout,
     the check and the colour are all still there instantly. */
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

/**
 * The reopen target. A `button` rather than a click handler on a div, so it
 * is keyboard-reachable and announces its expanded state — and it wraps only
 * the summary, never the kebab, because nesting interactive controls inside a
 * button is invalid and makes the menu unreachable by keyboard.
 */
const ReopenButton = styled.button`
  display: flex;
  align-items: flex-start;
  gap: ${spacing[12]}px;
  width: 100%;
  padding: 0;
  /* The kebab is absolutely positioned over the card's top-right; this keeps
     a long exercise name from running underneath it. */
  padding-right: ${spacing[32]}px;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  color: inherit;
  border-radius: ${radius.small}px;

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.action.primary};
    outline-offset: 3px;
  }
`;

const CheckCircle = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: ${radius.full}px;
  background: ${(p) => p.theme.status.success};
  color: ${(p) => p.theme.action.primaryText};
  /* A soft ring rather than a hard border, so the mark reads as a stamp on
     the card instead of another bounded box inside it. */
  box-shadow: 0 0 0 4px ${(p) => p.theme.status.successSubtle};
  animation: ${drawCheck} 260ms cubic-bezier(0.2, 0.8, 0.3, 1);

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
  min-width: 0;
`;

const Name = styled.span`
  font-size: ${typeScale.sectionTitle.fontSize}px;
  font-weight: ${typeScale.sectionTitle.fontWeight};
  color: ${(p) => p.theme.text.primary};
  overflow-wrap: anywhere;
`;

const CaptionRow = styled.span`
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
  flex-wrap: wrap;
  font-size: ${typeScale.compactBody.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

/**
 * "Completed" survives only here, as metadata beside the set count — never as
 * a headline competing with the exercise name.
 */
const PrPill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px ${spacing[8]}px;
  border-radius: ${radius.full}px;
  background: ${(p) => p.theme.status.success};
  color: ${(p) => p.theme.action.primaryText};
  font-size: ${typeScale.caption.fontSize}px;
  font-weight: 700;
  letter-spacing: 0.04em;
`;

/**
 * Figures on their own raised tiles, the way the Workout Complete card does
 * it. Wrapping rather than scrolling: three short tiles fit a 320px viewport,
 * and a horizontally scrolling strip hides figures behind a gesture nobody
 * discovers mid-set.
 */
const MetricRow = styled.dl`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: ${spacing[8]}px;
  margin: 0;
`;

const MetricTile = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
  padding: ${spacing[8]}px ${spacing[12]}px;
  border-radius: ${radius.small}px;
  background: ${(p) => p.theme.surface.raised};
  min-width: 0;
`;

const MetricLabel = styled.dt`
  margin: 0;
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const MetricValue = styled.dd`
  margin: 0;
  /* numericWorkoutSet (18px), not numericMetric (24px): this token exists for
     exactly this notation — the style guide cites "275 × 5" as its reason —
     and at 24px a three-tile row wraps "195 lb × 6" onto two lines at 390px,
     which is where this card is actually read. Tabular figures either way. */
  font-size: ${typeScale.numericWorkoutSet.fontSize}px;
  font-weight: ${typeScale.numericWorkoutSet.fontWeight};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: ${(p) => p.theme.text.primary};
  overflow-wrap: anywhere;
`;

const Comparison = styled.p<{ $direction: 'up' | 'down' | 'same' }>`
  display: flex;
  align-items: center;
  gap: ${spacing[4]}px;
  margin: 0;
  font-size: ${typeScale.compactBody.fontSize}px;
  ${(p) =>
    p.$direction === 'up'
      ? css`
          color: ${p.theme.status.success};
          font-weight: 600;
        `
      : css`
          /* A regression is information, not an alarm. Rendering it in the
             error colour would punish a deload the user chose. */
          color: ${p.theme.text.secondary};
        `}
`;

/* No shared visually-hidden utility exists in this app — Button.tsx keeps a
   private one — so this declares its own rather than reaching into another
   component's internals. */
const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

/** Top-right, over the card, so actions stay reachable but stop competing. */
const ActionSlot = styled.div`
  position: absolute;
  top: 0;
  right: 0;
`;

export interface CompletedExerciseCardProps {
  name: string;
  readout: CompletedExerciseReadout;
  setCountLabel: string;
  /** Toggles the exercise open or closed. */
  onReopen: () => void;
  /**
   * Whether the exercise is currently expanded beneath this card.
   *
   * Story 42A — once the parent workout is complete the card stays put in
   * both states rather than handing over to the editing header, so this drives
   * the disclosure's direction and its announced state.
   */
  expanded?: boolean;
  /**
   * The right-hand slot: the overflow menu during an active workout, the
   * disclosure chevron once the workout is complete. One fixed position, so
   * status (the check, on the left) and navigation never trade places.
   */
  actions?: ReactNode;
  testId?: string;
}

export function CompletedExerciseCard({
  name,
  readout,
  setCountLabel,
  onReopen,
  expanded = false,
  actions,
  testId,
}: CompletedExerciseCardProps) {
  const { metrics, comparison, isPersonalRecord } = readout;
  const ComparisonIcon =
    comparison?.direction === 'up' ? ArrowUp : comparison?.direction === 'down' ? ArrowDown : Minus;

  return (
    <Surface data-testid={testId}>
      <ReopenButton
        type="button"
        onClick={onReopen}
        aria-expanded={expanded}
        /* Names the state and the affordance together, so a screen-reader
           user gets the completion — which is otherwise carried by an icon
           and a colour — and knows the card does something. */
        aria-label={`${name}, completed, ${setCountLabel}. ${expanded ? 'Collapse' : 'Reopen to see sets'}.`}
      >
        <CheckCircle aria-hidden="true">
          <Check size={20} strokeWidth={3} />
        </CheckCircle>
        <TitleBlock>
          <Name>{name}</Name>
          <CaptionRow>
            <span>{setCountLabel}</span>
            {isPersonalRecord ? <PrPill>PR</PrPill> : null}
          </CaptionRow>
        </TitleBlock>
      </ReopenButton>

      {metrics.length ? (
        <MetricRow data-testid={testId ? `${testId}-metrics` : undefined}>
          {metrics.map((metric) => (
            <MetricTile key={metric.key}>
              <MetricLabel>{metric.label}</MetricLabel>
              <MetricValue>{metric.value}</MetricValue>
            </MetricTile>
          ))}
        </MetricRow>
      ) : null}

      {comparison ? (
        <Comparison $direction={comparison.direction}>
          <ComparisonIcon size={14} aria-hidden="true" />
          {/* The visible label is compact; assistive tech gets the spelled-out
              version so it never has to read a bare "+60 lb vs last". */}
          <span aria-hidden="true">{comparison.label}</span>
          <VisuallyHidden>{comparison.accessibleLabel}</VisuallyHidden>
        </Comparison>
      ) : null}

      {/* Focus stops here. The page activates an exercise when focus lands
          anywhere inside its card, so without this, opening the overflow menu
          would reopen the exercise and unmount the menu in the same gesture —
          the control would look broken. The chevron in the active header
          guards itself the same way. */}
      {actions ? <ActionSlot onFocus={(event) => event.stopPropagation()}>{actions}</ActionSlot> : null}
    </Surface>
  );
}
