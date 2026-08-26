import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Dimensions, StyleSheet, View, type GestureResponderEvent } from 'react-native';

/**
 * A portal + positioning host for anchored popovers, mounted once at the app
 * root — React Native's answer to web's `FloatingPortal` plus Floating UI's
 * `flip`/`shift` middleware.
 *
 * ## Why this exists
 *
 * `MetricInfo` used to present its help in a modal bottom `Sheet`. The code
 * argued that was a deliberate divergence from web, on the grounds that RN
 * has no collision-detection ecosystem and hand-rolled geometry had already
 * caused four regressions on web. Two things were wrong with that:
 *
 * 1. A modal sheet covers the whole app to show one sentence of help, which
 *    is a heavy answer to a light question and looks nothing like the web
 *    product it is supposed to mirror.
 * 2. Because a modal captures every touch, a second trigger is unreachable
 *    while the first panel is open — so switching help takes two taps. That
 *    is the *exact* bug Story 46 fixed on web by removing the backdrop, and
 *    the mobile file documented it as an accepted trade rather than a defect.
 *
 * ## How single-tap switching works
 *
 * The overlay is `pointerEvents="box-none"`: the container never captures a
 * touch, only its actual panel child does. With nothing overlaying the app,
 * trigger B stays hit-testable while panel A is open, so one tap closes A and
 * opens B — the same property web gets from `useDismiss` binding document
 * listeners instead of rendering a backdrop.
 *
 * Outside-press dismissal uses `onStartShouldSetResponderCapture`, which RN
 * calls on every touch start anywhere below it. Returning `false` means the
 * touch is never claimed and proceeds to whatever was actually pressed, so
 * this is a sniffer rather than an interceptor — the direct analogue of a
 * capture-phase document listener that does not call `preventDefault`.
 *
 * The sniffer ignores touches inside the open panel (so its own content is
 * usable) and inside the anchor that opened it (so that trigger's own
 * `onPress` can toggle it shut rather than being closed here and immediately
 * reopened).
 */

/** Distance from the panel edge to the caret's apex; see `CARET_SIZE`. */
const CARET_SIZE = 10;
const CARET_REACH = CARET_SIZE * Math.SQRT1_2;
const VIEWPORT_MARGIN = 16;
const PANEL_WIDTH = 280;

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where the host actually put the panel, so the caller can draw its caret. */
export interface PopoverPlacement {
  /** Which side of the anchor the panel sits on. */
  side: 'top' | 'bottom';
  /** Caret offset from the panel's left edge, already clamped. */
  caretLeft: number;
}

interface PopoverRequest {
  id: symbol;
  anchor: AnchorRect;
  render: (placement: PopoverPlacement) => ReactNode;
}

interface PopoverContextValue {
  open: (request: PopoverRequest) => void;
  /**
   * Corrects an open popover's anchor once a measurement arrives, without
   * remounting its content. Callers open immediately with a best-effort
   * anchor so a popover can never be blocked by a measurement that is slow
   * or never fires, then refine here.
   */
  setAnchor: (id: symbol, anchor: AnchorRect) => void;
  close: (id: symbol) => void;
  isOpen: (id: symbol) => boolean;
  openId: symbol | null;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

export function usePopoverHost(): PopoverContextValue {
  const context = useContext(PopoverContext);
  if (!context) {
    throw new Error('usePopoverHost must be used inside <PopoverHost>');
  }
  return context;
}

function contains(rect: AnchorRect | null, x: number, y: number): boolean {
  if (!rect) return false;
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

export function PopoverHost({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<PopoverRequest | null>(null);
  /* Measured after the panel lays out. Positioning is a two-pass problem:
     where the panel goes depends on how tall it is, and how tall it is
     depends on the text inside it. Pass one renders it at the preferred
     placement; pass two corrects if it does not fit. */
  const [panelSize, setPanelSize] = useState<{ width: number; height: number } | null>(null);
  const panelRect = useRef<AnchorRect | null>(null);

  const open = useCallback((next: PopoverRequest) => {
    setPanelSize(null);
    panelRect.current = null;
    setRequest(next);
  }, []);

  const setAnchor = useCallback((id: symbol, anchor: AnchorRect) => {
    setRequest((current) => {
      if (!current || current.id !== id) return current;
      if (
        current.anchor.x === anchor.x &&
        current.anchor.y === anchor.y &&
        current.anchor.width === anchor.width &&
        current.anchor.height === anchor.height
      ) {
        return current;
      }
      return { ...current, anchor };
    });
  }, []);

  const close = useCallback((id: symbol) => {
    setRequest((current) => (current && current.id !== id ? current : null));
  }, []);

  const isOpen = useCallback((id: symbol) => request?.id === id, [request]);

  const value = useMemo<PopoverContextValue>(
    () => ({ open, setAnchor, close, isOpen, openId: request?.id ?? null }),
    [open, setAnchor, close, isOpen, request],
  );

  /**
   * Fires on every touch start in the subtree and always returns false, so
   * the touch is never claimed. Closing here rather than from a backdrop is
   * what keeps every other control hit-testable while a panel is open.
   */
  const onTouchCapture = useCallback(
    (event: GestureResponderEvent) => {
      if (!request) return false;
      const { pageX, pageY } = event.nativeEvent;
      const insidePanel = contains(panelRect.current, pageX, pageY);
      // The anchor is excluded so its own onPress decides: tapping the open
      // trigger toggles shut, rather than being closed here and reopened by
      // the press that follows.
      const insideAnchor = contains(request.anchor, pageX, pageY);
      if (!insidePanel && !insideAnchor) setRequest(null);
      return false;
    },
    [request],
  );

  const placement = useMemo(() => {
    if (!request) return null;
    const window = Dimensions.get('window');
    const width = Math.min(PANEL_WIDTH, window.width - VIEWPORT_MARGIN * 2);
    const height = panelSize?.height ?? 0;
    const anchor = request.anchor;

    const below = anchor.y + anchor.height + CARET_REACH;
    const above = anchor.y - CARET_REACH - height;
    const roomBelow = window.height - VIEWPORT_MARGIN - below;
    const roomAbove = anchor.y - CARET_REACH - VIEWPORT_MARGIN;

    /* Flip: prefer below, go above when below cannot hold the panel and above
       genuinely has more room. Before the panel has been measured, `height`
       is 0 and this resolves to "below", which is the preferred placement —
       so the first frame is already right in the common case. */
    const side: 'top' | 'bottom' =
      height > 0 && roomBelow < height && roomAbove > roomBelow ? 'top' : 'bottom';

    // Shift: start aligned to the anchor, then clamp inside the margins.
    const rawX = anchor.x;
    const x = Math.min(
      Math.max(rawX, VIEWPORT_MARGIN),
      Math.max(window.width - VIEWPORT_MARGIN - width, VIEWPORT_MARGIN),
    );
    const y = side === 'bottom' ? below : Math.max(above, VIEWPORT_MARGIN);

    /* No floor on the height cap. Clamping to a minimum would push the panel
       back past the margin whenever neither side has that much room — a short
       landscape screen, or an anchor near the vertical centre — reinstating
       exactly the off-screen overflow this is here to prevent. */
    const maxHeight = Math.max(side === 'bottom' ? roomBelow : roomAbove, 0);

    /* The caret points at the anchor's centre even after the panel has been
       shifted sideways, which is what keeps "this panel belongs to that
       button" legible. Clamped so it cannot slide off the panel's own
       rounded corners. */
    const anchorCentre = anchor.x + anchor.width / 2;
    const caretLeft = Math.min(
      Math.max(anchorCentre - x - CARET_SIZE / 2, 12),
      Math.max(width - CARET_SIZE - 12, 12),
    );

    return { x, y, width, side, maxHeight, caretLeft };
  }, [request, panelSize]);

  return (
    <PopoverContext.Provider value={value}>
      <View
        style={styles.root}
        onStartShouldSetResponderCapture={onTouchCapture}
        collapsable={false}
      >
        {children}
        {request && placement ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="popover-overlay">
            <View
              testID="popover-panel"
              pointerEvents="box-none"
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                if (!panelSize || Math.abs(panelSize.height - height) > 1) {
                  setPanelSize({ width, height });
                }
                panelRect.current = { x: placement.x, y: placement.y, width, height };
              }}
              style={[
                styles.panel,
                {
                  left: placement.x,
                  top: placement.y,
                  width: placement.width,
                  maxHeight: placement.maxHeight,
                },
              ]}
            >
              {request.render({ side: placement.side, caretLeft: placement.caretLeft })}
            </View>
          </View>
        ) : null}
      </View>
    </PopoverContext.Provider>
  );
}

export const popoverGeometry = {
  CARET_SIZE,
  CARET_REACH,
  VIEWPORT_MARGIN,
  PANEL_WIDTH,
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  panel: {
    position: 'absolute',
  },
});
