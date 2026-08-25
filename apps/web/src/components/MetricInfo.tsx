import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import styled from 'styled-components';
import { spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';

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
 *
 * Story 30 — the panel used to be `position: absolute; left: 0`, so a
 * trigger anywhere near the right edge of a narrow viewport pushed it past
 * the edge and widened `document.scrollWidth`. It now measures the trigger,
 * the panel's own rendered height, and the viewport at open-time, and
 * clamps: `position: fixed` in viewport coordinates, horizontally and
 * vertically clamped to stay fully on-screen (both the top and the
 * available height, not just the top — a panel positioned on-screen but
 * taller than the remaining space reproduces the same off-screen bug on
 * the vertical axis), and flipped above the trigger when there isn't room
 * below. Below the tablet breakpoint it becomes a centered floating card
 * instead of an anchored popover, per the story's explicit guidance for
 * constrained widths.
 */

// Only one panel open at a time, across every MetricInfo instance on the
// page — a module-level singleton is the simplest way to coordinate
// unrelated component instances without threading a shared provider
// through every screen that uses this.
let openId: symbol | null = null;
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useExclusiveOpen(): [boolean, (next: boolean) => void] {
  const id = useRef(Symbol('metric-info')).current;
  const isOpen = useSyncExternalStore(
    subscribe,
    () => openId === id,
    () => false,
  );
  function setOpen(next: boolean) {
    openId = next ? id : openId === id ? null : openId;
    notify();
  }
  useEffect(
    () => () => {
      if (openId === id) {
        openId = null;
        notify();
      }
    },
    [id],
  );
  return [isOpen, setOpen];
}

const VIEWPORT_MARGIN = 16;
const PANEL_WIDTH = 280;
/* Matches theme/breakpoints.ts `mq.tablet` (768px) — the panel switches
   from an anchored popover to a centered card below this width. */
const TABLET_BREAKPOINT = 768;

interface Position {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  centered: boolean;
}

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

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 19;

  ${mq.tablet} {
    display: none;
  }
`;

const Panel = styled.div<{ $position: Position }>`
  position: fixed;
  z-index: 20;
  top: ${(p) => p.$position.top}px;
  left: ${(p) => p.$position.left}px;
  width: min(${(p) => p.$position.width}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px));
  max-height: ${(p) => p.$position.maxHeight}px;
  overflow-y: auto;
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
  const [open, setOpen] = useExclusiveOpen();
  const panelId = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  // Measure the trigger, the panel's own rendered height, and the viewport
  // at open-time (and on resize/scroll while open), so every clamp below is
  // computed against real geometry rather than a guessed constant. The
  // first `place()` call runs before the panel has ever painted, so
  // `panelRef.current` is null and `measuredHeight` falls back to the
  // available space; the very next frame's call (after that first paint)
  // re-measures against the panel's real height and corrects the position,
  // with no visible flash since both happen inside the same
  // layout-effect/rAF pass before the browser presents a frame.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    let frame: number | null = null;

    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const narrow = viewportWidth < TABLET_BREAKPOINT;
      const width = Math.min(PANEL_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2);
      const measuredHeight = panelRef.current?.getBoundingClientRect().height ?? 0;

      if (narrow) {
        // A centered floating card reads more reliably than an anchored
        // popover on a screen this constrained — see the story's own
        // "prefer a centered floating card... when an anchored popover
        // cannot fit cleanly" guidance.
        const maxHeight = viewportHeight - VIEWPORT_MARGIN * 2;
        const height = Math.min(measuredHeight || maxHeight, maxHeight);
        setPosition({
          top: Math.max(VIEWPORT_MARGIN, (viewportHeight - height) / 2),
          left: (viewportWidth - width) / 2,
          width,
          maxHeight,
          centered: true,
        });
        return;
      }

      const left = Math.min(Math.max(rect.left, VIEWPORT_MARGIN), viewportWidth - width - VIEWPORT_MARGIN);
      const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_MARGIN;
      const spaceAbove = rect.top - VIEWPORT_MARGIN;
      const opensUpward = measuredHeight > spaceBelow && spaceAbove > spaceBelow;
      const top = opensUpward ? Math.max(VIEWPORT_MARGIN, rect.top - 8 - Math.min(measuredHeight || spaceAbove, spaceAbove)) : rect.bottom + 8;
      const maxHeight = Math.max(opensUpward ? spaceAbove : spaceBelow, VIEWPORT_MARGIN);
      setPosition({ top, left, width, maxHeight, centered: false });
    }

    // Throttled to one pending recompute per animation frame: unthrottled,
    // a fast trackpad/momentum scroll (or a nested scroll container, which
    // `capture: true` also catches) fires many scroll events per second,
    // each forcing a synchronous layout read + re-render.
    function schedulePlace() {
      if (frame != null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        place();
      });
    }

    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', schedulePlace);
    window.addEventListener('scroll', schedulePlace, true);
    return () => {
      cancelAnimationFrame(raf);
      if (frame != null) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedulePlace);
      window.removeEventListener('scroll', schedulePlace, true);
    };
  }, [open, explanation, calculation, limitation]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        onClick={() => setOpen(!open)}
      >
        ?
      </Trigger>
      {open ? (
        <>
          {position?.centered ? <Backdrop onClick={() => setOpen(false)} /> : null}
          <Panel
            ref={panelRef}
            id={panelId}
            role="note"
            data-testid="metric-info-panel"
            $position={position ?? { top: -9999, left: -9999, width: PANEL_WIDTH, maxHeight: 400, centered: false }}
            style={position ? undefined : { visibility: 'hidden' }}
          >
            <PanelHeading>{label}</PanelHeading>
            <span>{explanation}</span>
            {calculation ? <PanelDetail>{calculation}</PanelDetail> : null}
            {limitation ? <PanelLimitation>{limitation}</PanelLimitation> : null}
          </Panel>
        </>
      ) : null}
    </Wrapper>
  );
}
