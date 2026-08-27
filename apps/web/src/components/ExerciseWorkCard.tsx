import type { ReactNode } from 'react';
import { Disclosure, DisclosurePanel, Button as RacButton } from 'react-aria-components';
import styled from 'styled-components';
import { ChevronDown } from 'lucide-react';
import { radius, spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/typeScale';

/**
 * One exercise, as a unit of work during a session.
 *
 * Story 42.2. Named for the domain rather than the primitive, deliberately:
 * this is not "the accordion". Calling it that is what led to three rounds of
 * styling an interaction model that was wrong underneath.
 *
 * ### Why a disclosure and not an accordion
 *
 * The WAI-ARIA accordion pattern expects the header to *be* a heading
 * containing the trigger button. This card's header is not that — it holds
 * quick-log inputs, a status line, and an overflow menu alongside the trigger.
 * The W3C disclosure-card guidance covers exactly this shape, and says nested
 * interactive controls must not toggle the disclosure.
 *
 * That distinction is not academic. The previous implementation activated an
 * exercise whenever focus landed anywhere inside its card, so tabbing into a
 * quick-log field expanded the whole editor — the specific complaint that
 * "Claude is doing too much here". Quick-log fields had to opt out with
 * `stopPropagation`, which is a workaround for a primitive that was wrong.
 *
 * ### Why React Aria
 *
 * It gives a dedicated trigger with correct `aria-expanded`/`aria-controls`
 * wiring, keyboard semantics, and — the reason it beats Radix here —
 * *controlled* expansion, which is what lets opening one exercise close the
 * previous one. We take its semantics and state, never its visuals.
 */

const Card = styled.div<{ $tone: 'neutral' | 'complete' }>`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
  padding: ${spacing[16]}px;
  border-radius: ${radius.large}px;
  border: 1px solid
    ${(p) => (p.$tone === 'complete' ? p.theme.status.success : p.theme.border.subtle)};
  background: ${(p) =>
    p.$tone === 'complete' ? p.theme.status.successSubtle : p.theme.surface.raised};
  /* The card sits in a grid; without this a wide child can widen the track.
     Charts already taught this lesson the expensive way. */
  min-width: 0;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  min-width: 0;
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
  min-width: 0;
`;

const Name = styled.h2`
  margin: 0;
  font-size: ${typeScale.sectionTitle.fontSize}px;
  font-weight: ${typeScale.sectionTitle.fontWeight};
  overflow-wrap: anywhere;
`;

const Meta = styled.p`
  margin: 0;
  font-size: ${typeScale.compactBody.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[4]}px;
  flex: none;
`;

/**
 * The one control that toggles detail. Always rendered, in a fixed slot, so
 * "can this be opened?" never depends on the card's state (story 42A).
 */
const Trigger = styled(RacButton)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* 44px: this is used mid-workout, one-handed. */
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: ${radius.full}px;
  background: transparent;
  color: ${(p) => p.theme.text.primary};
  cursor: pointer;

  svg {
    transition: transform 160ms ease-out;
  }
  &[aria-expanded='true'] svg {
    transform: rotate(180deg);
  }
  @media (prefers-reduced-motion: reduce) {
    svg {
      transition: none;
    }
  }

  &[data-focus-visible] {
    outline: 2px solid ${(p) => p.theme.action.primary};
    outline-offset: 2px;
  }
`;

/** The detail surface. Neutral and editable even when the exercise is done. */
const Panel = styled(DisclosurePanel)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
  min-width: 0;
`;

export interface ExerciseWorkCardProps {
  /** Stable id, used as the disclosure's key in a group. */
  id: string;
  name: string;
  /** e.g. "Planned: 3 × 8" — intent, never actuals. */
  planLabel?: ReactNode;
  /** e.g. "0 of 3 sets complete". */
  progressLabel?: ReactNode;
  /** Leading status element — the completion check, when complete. */
  status?: ReactNode;
  /** Overflow menu. Rendered beside the trigger; never toggles it. */
  actions?: ReactNode;
  /**
   * What was achieved, once there is something to show. Sits under the header
   * and above the fast path, so a finished exercise reads as a record without
   * the detail panel having to be open.
   */
  summary?: ReactNode;
  /** The fast path. Stays usable while details are collapsed. */
  quickLog?: ReactNode;
  /** For scrolling a newly-active card into view. */
  containerRef?: (node: HTMLDivElement | null) => void;
  /** The escape hatch: per-set editing. */
  children?: ReactNode;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  tone?: 'neutral' | 'complete';
  testId?: string;
}

export function ExerciseWorkCard({
  id,
  name,
  planLabel,
  progressLabel,
  status,
  actions,
  summary,
  quickLog,
  containerRef,
  children,
  expanded,
  onExpandedChange,
  tone = 'neutral',
  testId,
}: ExerciseWorkCardProps) {
  return (
    <Disclosure id={id} isExpanded={expanded} onExpandedChange={onExpandedChange}>
      <Card $tone={tone} data-testid={testId} ref={containerRef}>
        <HeaderRow>
          {status}
          <TitleBlock>
            <Name>{name}</Name>
            {planLabel ? <Meta>{planLabel}</Meta> : null}
            {progressLabel ? <Meta>{progressLabel}</Meta> : null}
          </TitleBlock>
          <Actions>
            {actions}
            {/* React Aria wires aria-expanded/aria-controls and the keyboard
                behaviour; the accessible name is ours, and deliberately keeps
                the wording the product already uses everywhere else. A new
                primitive is not a reason to rename a control the user has
                already learned. */}
            <Trigger slot="trigger" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${name}`}>
              <ChevronDown size={18} aria-hidden="true" />
            </Trigger>
          </Actions>
        </HeaderRow>

        {summary}

        {/* Outside the panel on purpose: the fast path must work without
            opening anything, which is the whole point of the card. */}
        {quickLog}

        <Panel>{children}</Panel>
      </Card>
    </Disclosure>
  );
}
