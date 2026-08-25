import { useId, useRef, useSyncExternalStore, useEffect } from 'react';
import styled from 'styled-components';
import {
  FloatingPortal,
  arrow,
  autoUpdate,
  flip,
  limitShift,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
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
 *
 * Story 46 — help is anchored to the control that opened it, at every
 * width. Story 30 hand-rolled the positioning and, in solving a real
 * right-edge overflow bug, introduced four regressions: below 768px the
 * panel became a card centred in the viewport (visually unrelated to its
 * trigger, and appearing "near the top of the document" when the trigger
 * was far down the page); a full-viewport `Backdrop` swallowed the first
 * tap on any *other* trigger, so switching help took two taps; the panel
 * was `position: fixed` but not portalled, so any future ancestor with a
 * transform/filter/contain would silently re-anchor it; and `role="note"`
 * described ancillary prose rather than a disclosure.
 *
 * Positioning is delegated to `@floating-ui/react` rather than hand-rolled
 * a second time. Flip/shift/arrow/auto-update across four viewport edges is
 * exactly the class of geometry problem that looks simple and is not — the
 * regressions above are the evidence. Floating UI is headless: it computes
 * coordinates and nothing else, so every colour, radius and type size below
 * still comes from `packages/design-tokens`.
 *
 * Dismissal is `useDismiss`, which listens on the document rather than
 * rendering a backdrop element. That is what makes one-tap switching work:
 * with nothing overlaying the page, a tap on trigger B closes panel A
 * (outside-press) *and* opens panel B (click) in the same gesture.
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
/** Side length of the (unrotated) caret square. */
const ARROW_SIZE = 10;
/**
 * How far the caret actually reaches once rotated 45°. A square projects
 * half its *diagonal* from its centre, not half its side, so the gap the
 * panel leaves for it is `side / √2` ≈ 7.07px rather than the 10px side
 * length. Pinning the caret at `-ARROW_SIZE / 2` puts its centre exactly on
 * the panel edge, so this is precisely the distance from that edge to the
 * caret's apex — and therefore exactly the offset that makes the apex meet
 * the trigger with no hairline gap.
 */
const ARROW_REACH = ARROW_SIZE * Math.SQRT1_2;

type Side = 'top' | 'bottom' | 'left' | 'right';

/** Which panel edge the caret hangs off, given the side the panel sits on. */
const CARET_EDGE: Record<Side, 'top' | 'bottom' | 'left' | 'right'> = {
  bottom: 'top',
  top: 'bottom',
  left: 'right',
  right: 'left',
};

/**
 * The visible half of the rotated square, per placement side. Corners are
 * listed in the unrotated box's own coordinates; after rotate(45deg) the
 * kept vertex is the one that points back at the trigger.
 */
const CARET_CLIP: Record<Side, string> = {
  // keeps top-left → apex points up
  bottom: 'polygon(0 0, 100% 0, 0 100%)',
  // keeps bottom-right → apex points down
  top: 'polygon(100% 0, 100% 100%, 0 100%)',
  // keeps top-right → apex points right
  left: 'polygon(0 0, 100% 0, 100% 100%)',
  // keeps bottom-left → apex points left
  right: 'polygon(0 0, 0 100%, 100% 100%)',
};

const Wrapper = styled.span`
  display: inline-flex;
  align-items: center;
`;

const Trigger = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* 20px visual target inside a 44px hit area via the pseudo-element below. */
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

/**
 * Deliberately does not scroll: the caret is positioned half outside this
 * box, and any `overflow` value other than `visible` establishes a clipping
 * context that would silently erase it. Scrolling lives on `PanelScroll`
 * inside instead.
 */
const Panel = styled.div`
  z-index: 20;
  box-sizing: border-box;
  /* Column flex plus a min-height:0 scroll child is what lets the inner
     region shrink and scroll inside the max-height the size middleware
     applies above. A percentage max-height on the child would resolve
     against this box's auto height and silently do nothing. */
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid ${(p) => p.theme.border.default};
  background: ${(p) => p.theme.surface.raised};
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.primary};
  text-align: left;
  white-space: normal;

  /* The panel is the answer to a question the user just asked, so it should
     register as arriving rather than blinking into place.

     Opacity only — deliberately NOT transform. Floating UI positions this
     element with transform: translate(x, y), and an animation declaration
     outranks the inline style it is animating, so any transform keyframe
     interpolates from the portal origin at the top-left of <body> to the
     anchored position: on a trigger scrolled far down the page, the panel
     visibly flies across the viewport on every open. */
  animation: metric-info-in 120ms ease-out;

  @keyframes metric-info-in {
    from {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const PanelScroll = styled.div`
  padding: ${spacing[12]}px;
  border-radius: inherit;
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
  display: grid;
  gap: ${spacing[8]}px;
`;

/**
 * The caret is what makes "this panel belongs to that button" legible at a
 * glance once `shift()` has slid the panel sideways to stay on screen — the
 * panel's own edge no longer lines up with the trigger, but the caret still
 * points straight at it.
 */
const Caret = styled.div`
  position: absolute;
  width: ${ARROW_SIZE}px;
  height: ${ARROW_SIZE}px;
  transform: rotate(45deg);
  background: ${(p) => p.theme.surface.raised};
  border: 1px solid ${(p) => p.theme.border.default};
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
  const headingId = useId();
  const arrowRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { refs, floatingStyles, context, middlewareData, placement } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(ARROW_REACH),
      flip({ padding: VIEWPORT_MARGIN }),
      shift({ padding: VIEWPORT_MARGIN, limiter: limitShift() }),
      arrow({ element: arrowRef, padding: 12 }),
      // `size` reports the space actually left after flip/shift settle, so
      // long help scrolls inside the panel rather than running off-screen.
      // Written straight to the node instead of through React state:
      // `autoUpdate` re-runs this on every scroll and resize frame, and a
      // setState per frame would re-render the panel continuously while the
      // page moves — and risks a reposition/render feedback loop.
      size({
        padding: VIEWPORT_MARGIN,
        apply({ availableHeight, elements }) {
          // No floor. Clamping to a minimum would push the panel back past
          // the margin whenever neither side has that much room (a short
          // landscape phone, or a trigger near the vertical centre of a
          // very short viewport) — reinstating exactly the off-screen
          // overflow this middleware is here to prevent. `flip` has already
          // picked the roomier side; if that is still small, a scrollable
          // short panel beats one hanging off the screen.
          elements.floating.style.maxHeight = `${availableHeight}px`;
        },
      }),
    ],
  });

  // `useDismiss` binds document-level listeners instead of rendering a
  // backdrop element. No overlay means trigger B stays hit-testable while
  // panel A is open, which is what makes A → B switching a single tap.
  const dismiss = useDismiss(context, { outsidePress: true, escapeKey: true });
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  // Escape should hand focus back to the trigger, or a keyboard user is
  // stranded at the top of the document. Outside-clicks deliberately do not,
  // since the pointer has already moved the user's attention elsewhere.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') triggerRef.current?.focus();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const side = placement.split('-')[0] as Side;

  return (
    <Wrapper>
      <Trigger
        ref={(node) => {
          refs.setReference(node);
          triggerRef.current = node;
        }}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        // The panel is portalled to the end of <body>, so a virtual cursor
        // swiping forward from this trigger no longer walks into the help
        // text — and `aria-controls` is not a jump most screen readers
        // offer. Describing the trigger by the panel is what keeps the
        // limitation reachable, and that caveat is the whole reason the
        // panel carries three parts rather than one.
        aria-describedby={open ? panelId : undefined}
        aria-label={`What does ${label} mean?`}
        data-testid="metric-info-trigger"
        {...getReferenceProps({ onClick: () => setOpen(!open) })}
      >
        ?
      </Trigger>
      {open ? (
        <FloatingPortal>
          <Panel
            ref={refs.setFloating}
            id={panelId}
            role="group"
            aria-labelledby={headingId}
            data-testid="metric-info-panel"
            data-placement={placement}
            style={{
              ...floatingStyles,
              width: `min(${PANEL_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))`,
            }}
            {...getFloatingProps()}
          >
            <Caret
              ref={arrowRef}
              data-testid="metric-info-caret"
              style={{
                left: middlewareData.arrow?.x != null ? `${middlewareData.arrow.x}px` : '',
                top: middlewareData.arrow?.y != null ? `${middlewareData.arrow.y}px` : '',
                // Pin the caret's centre on the panel edge nearest the
                // trigger, then keep only the half that sticks out — the
                // hidden half's borders would otherwise draw a line across
                // the panel's own fill.
                //
                // rotate(45deg) maps the square's corners to compass
                // points: top-left → top, top-right → right,
                // bottom-right → bottom, bottom-left → left. Each polygon
                // below keeps the three corners forming the half that
                // contains the vertex pointing at the trigger.
                [CARET_EDGE[side]]: `${-ARROW_SIZE / 2}px`,
                clipPath: CARET_CLIP[side],
              }}
            />
            <PanelScroll>
              <PanelHeading id={headingId}>{label}</PanelHeading>
              <span>{explanation}</span>
              {calculation ? <PanelDetail>{calculation}</PanelDetail> : null}
              {limitation ? <PanelLimitation>{limitation}</PanelLimitation> : null}
            </PanelScroll>
          </Panel>
        </FloatingPortal>
      ) : null}
    </Wrapper>
  );
}
