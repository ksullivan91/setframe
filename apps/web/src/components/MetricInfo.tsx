import { useEffect, useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/typeScale';

/**
 * "What does this mean?" affordance for a metric.
 *
 * Implemented as a disclosure rather than a hover tooltip on purpose. Hover
 * does not exist on touch, and WCAG 1.4.13 (Content on Hover or Focus)
 * requires that such content be dismissible, hoverable and persistent — all
 * three of which a plain `title`/CSS hover tooltip fails. A button that
 * toggles a panel satisfies the requirement on every input method: pointer,
 * touch, keyboard and screen reader alike.
 *
 * The panel deliberately carries three things: what the metric is, how it is
 * calculated, and where it falls down. The limitation is not optional
 * garnish — every estimate we show has one, and presenting an estimate
 * without its caveat claims a precision we do not have.
 */

const Wrapper = styled.span`
  position: relative;
  display: inline-flex;
  align-items: center;
`;

const Trigger = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* 24px visual target inside a 44px hit area via the pseudo-element below. */
  width: 20px;
  height: 20px;
  padding: 0;
  margin-left: ${spacing[4]}px;
  border-radius: 999px;
  border: 1px solid ${(p) => p.theme.border.default};
  background: transparent;
  color: ${(p) => p.theme.text.secondary};
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;

  &::after {
    content: '';
    position: absolute;
    inset: -12px;
  }

  &:hover,
  &:focus-visible {
    color: ${(p) => p.theme.action.primary};
    border-color: ${(p) => p.theme.action.primary};
  }
`;

const Panel = styled.div`
  position: absolute;
  z-index: 20;
  top: calc(100% + ${spacing[8]}px);
  left: 0;
  width: min(280px, calc(100vw - 32px));
  padding: ${spacing[12]}px;
  border-radius: 12px;
  border: 1px solid ${(p) => p.theme.border.default};
  background: ${(p) => p.theme.surface.raised};
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.primary};
  text-align: left;
  white-space: normal;
  display: grid;
  gap: ${spacing[8]}px;
`;

const PanelHeading = styled.strong`
  display: block;
  color: ${(p) => p.theme.text.primary};
`;

const PanelDetail = styled.span`
  display: block;
  color: ${(p) => p.theme.text.secondary};
`;

const PanelLimitation = styled.span`
  display: block;
  color: ${(p) => p.theme.text.secondary};
  border-left: 2px solid ${(p) => p.theme.border.default};
  padding-left: ${spacing[8]}px;
`;

export interface MetricInfoProps {
  label: string;
  explanation: string;
  calculation?: string | null;
  limitation?: string | null;
}

export function MetricInfo({ label, explanation, calculation, limitation }: MetricInfoProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        // Focus must come back to the trigger, or a keyboard user is
        // dropped at the top of the document.
        triggerRef.current?.focus();
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  return (
    <Wrapper ref={wrapperRef}>
      <Trigger
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`What does ${label} mean?`}
        data-testid="metric-info-trigger"
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </Trigger>
      {open ? (
        <Panel id={panelId} role="note" data-testid="metric-info-panel">
          <PanelHeading>{label}</PanelHeading>
          <span>{explanation}</span>
          {calculation ? <PanelDetail>{calculation}</PanelDetail> : null}
          {limitation ? <PanelLimitation>{limitation}</PanelLimitation> : null}
        </Panel>
      ) : null}
    </Wrapper>
  );
}
