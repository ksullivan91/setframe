import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type TextInput,
} from 'react-native';

/**
 * Keeps the field you are typing in — and the row after it — above the
 * keyboard.
 *
 * The session screen's ScrollView did not respond to the keyboard at all:
 * content simply ended behind it, so on the last exercise you typed blind
 * and no amount of scrolling revealed the rows underneath.
 *
 * Nothing here lifts a row out of the page. There is no modal, no popover,
 * no floating copy of the input — the rows stay exactly where they are in
 * the document. Two ordinary scroll-view mechanisms do the work:
 *
 * - `automaticallyAdjustKeyboardInsets` makes iOS add a content inset the
 *   height of the keyboard *while it is open*, and remove it when it
 *   closes. That is what makes the last rows reachable at all, and it is
 *   the native alternative to padding the bottom of the page forever.
 * - `keepVisible` scrolls the focused field up only when it is actually
 *   covered, leaving `CLEARANCE` below it so the next set is visible and
 *   tappable rather than flush against the keyboard's top edge.
 */

/** Row height plus the gap, so the set below the focused one is on screen. */
const CLEARANCE = 56;

interface KeyboardAware {
  keepVisible: (ref: { current: TextInput | null }) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const Context = createContext<KeyboardAware | null>(null);

export function KeyboardAwareScrollProvider({
  children,
  scrollRef,
}: {
  children: ReactNode;
  scrollRef: { current: ScrollView | null };
}) {
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);

  useEffect(() => {
    /* `willShow` on iOS so the measurement below races the animation
       rather than trailing it — measuring after the keyboard has landed
       makes the row visibly jump. */
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        keyboardTop.current = event.endCoordinates.screenY;
      },
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        keyboardTop.current = null;
      },
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
  }, []);

  const keepVisible = useCallback(
    (ref: { current: TextInput | null }) => {
      const node = ref.current;
      const scroller = scrollRef.current;
      if (!node || !scroller) return;
      /* Deferred a frame: on the first focus of a session the keyboard
         frame is not known yet, and measuring immediately would compare
         against a full-height window and decide nothing is covered. */
      requestAnimationFrame(() => {
        node.measureInWindow((_x, y, _width, height) => {
          if (!Number.isFinite(y) || !Number.isFinite(height)) return;
          const covered = keyboardTop.current ?? Dimensions.get('window').height;
          const wanted = y + height + CLEARANCE;
          // Only when it is genuinely covered — scrolling on every focus
          // would yank the page around for fields that were already fine.
          if (wanted <= covered) return;
          scroller.scrollTo({ y: scrollY.current + (wanted - covered), animated: true });
        });
      });
    },
    [scrollRef],
  );

  const value = useMemo(() => ({ keepVisible, onScroll }), [keepVisible, onScroll]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** ScrollView props. Spread onto the scroller the provider was given. */
export function useKeyboardAwareScrollProps() {
  const aware = useContext(Context);
  return {
    onScroll: aware?.onScroll,
    scrollEventThrottle: 16,
    automaticallyAdjustKeyboardInsets: true,
    // Swipe the keyboard away over the list, rather than hunting for Done.
    keyboardDismissMode: 'interactive' as const,
  };
}

/**
 * A ref for a field, plus the focus handler that keeps it visible.
 *
 * No-ops without a provider, so a screen that has not adopted this keeps
 * its current behaviour instead of crashing.
 */
export function useKeepFieldVisible() {
  const aware = useContext(Context);
  const ref = useRef<TextInput | null>(null);
  const onFocusKeepVisible = useCallback(() => {
    aware?.keepVisible(ref);
  }, [aware]);
  return { ref, onFocusKeepVisible };
}
