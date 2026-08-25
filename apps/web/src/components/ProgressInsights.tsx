import styled from 'styled-components';
import { spacing } from '@setframe/design-tokens';
import type { OverviewInsight } from '@setframe/domain';
import { typeScale } from '../theme/typeScale';

/**
 * The "what's changed" strip at the top of Progress.
 *
 * Story 51. Every sentence here comes from `describeInsight` in
 * `packages/domain` — this component chooses no words of its own, so web and
 * mobile cannot describe the same payload differently, and the rules about
 * what may be claimed live next to the maths that justifies them rather than
 * in a renderer.
 *
 * It renders nothing at all when there is nothing worth saying. That is the
 * point of the story, not a degenerate case: an "insight" that restates the
 * number already printed below it is worse than silence, so an empty list
 * yields `null` rather than a card explaining that there is no insight.
 *
 * Nothing here is coloured by direction. A user deliberately gaining weight
 * is succeeding when the number rises, and this component has no access to
 * their goal — the same reasoning that keeps the body-weight chart unvalenced.
 * See docs/research/body-weight-display-psychology.md.
 */

const Wrapper = styled.section`
  display: grid;
  gap: ${spacing[8]}px;
  padding: ${spacing[12]}px ${spacing[16]}px;
  border-radius: 12px;
  border: 1px solid ${(p) => p.theme.border.default};
  background: ${(p) => p.theme.surface.raised};
`;

const Heading = styled.h2`
  margin: 0;
  font-size: ${typeScale.caption.fontSize}px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${(p) => p.theme.text.secondary};
`;

const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: ${spacing[8]}px;
`;

const Item = styled.li`
  display: flex;
  align-items: baseline;
  gap: ${spacing[8]}px;
  font-size: ${typeScale.body.fontSize}px;
  color: ${(p) => p.theme.text.primary};
`;

const Label = styled.span`
  flex: none;
  font-weight: 600;
  color: ${(p) => p.theme.text.secondary};
`;

/**
 * The whole sentence is the target, not a separate "view chart" affordance —
 * the insight and its evidence are one idea, and splitting them into two
 * controls doubles the tab stops for no gain.
 */
const FocusButton = styled.button`
  flex: 1;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;

  &:hover,
  &:focus-visible {
    color: ${(p) => p.theme.action.primary};
  }
`;

const Sentence = styled.span`
  flex: 1;
`;

const Caveat = styled.span`
  display: block;
  margin-top: ${spacing[4]}px;
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

/**
 * Data-quality flags the reader deserves to see stated. Only the ones that
 * change how much weight a sentence should carry are surfaced; the rest stay
 * machine-readable for a future prompt-builder.
 */
function caveatFor(insight: OverviewInsight['insight']): string | null {
  if (insight.dataQuality.includes('sparse_previous_period')) {
    return 'Based on few readings last period, so treat the comparison loosely.';
  }
  if (insight.dataQuality.includes('sparse_current_period')) {
    return 'Based on few readings so far this period.';
  }
  return null;
}

export interface ProgressInsightsProps {
  insights: OverviewInsight[];
  /**
   * Focus the chart backing an insight. Optional: without it the sentences
   * render as plain text rather than as buttons that go nowhere.
   */
  onFocus?: (insight: OverviewInsight) => void;
}

export function ProgressInsights({ insights, onFocus }: ProgressInsightsProps) {
  if (insights.length === 0) return null;

  return (
    <Wrapper aria-labelledby="progress-insights-heading" data-testid="progress-insights">
      <Heading id="progress-insights-heading">What&rsquo;s changed</Heading>
      <List>
        {insights.map((item) => {
          const caveat = caveatFor(item.insight);
          const body = (
            <>
              {item.sentence}
              {caveat ? <Caveat>{caveat}</Caveat> : null}
            </>
          );
          return (
            <Item key={item.metric} data-testid={`progress-insight-${item.metric}`}>
              <Label>{item.label}</Label>
              {onFocus ? (
                <FocusButton type="button" onClick={() => onFocus(item)}>
                  {body}
                </FocusButton>
              ) : (
                <Sentence>{body}</Sentence>
              )}
            </Item>
          );
        })}
      </List>
    </Wrapper>
  );
}
