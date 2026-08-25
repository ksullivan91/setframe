import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, typeScale } from '../theme/getTheme';
import { Sheet } from './Sheet';

/**
 * "What does this mean?" affordance for a metric — the mobile counterpart of
 * the web `MetricInfo`.
 *
 * A hover tooltip does not exist on touch, so this is a tap-triggered
 * disclosure: a button opens a bottom sheet that is dismissible and
 * announced to VoiceOver via `accessibilityState.expanded`. The panel carries
 * three things on purpose — what the metric is, how it is calculated, and
 * where it falls down — because presenting an estimate without its caveat
 * claims a precision we do not have.
 *
 * Story 30 — the panel used to be an in-flow `position: 'absolute', left: 0,
 * width: 264` View, which could sit off the edge of a narrow screen with no
 * way to scroll it back into view. It's now the shared `Sheet` primitive
 * (Story 20) — a real RN `Modal`, safe-area-aware and inherently viewport-
 * bound by construction.
 *
 * Story 46 rebuilt the *web* counterpart into a properly anchored popover,
 * because on web the previous fix had drifted into a card centred in the
 * viewport with no visual relationship to the trigger that opened it. This
 * native screen deliberately does not follow it, and the divergence is the
 * decision rather than an oversight:
 *
 *   - Story 46's own escalation path ends at "use a deliberate mobile help
 *     sheet/bottom sheet" once content cannot sit cleanly beside a trigger,
 *     which on a phone-width screen is the normal case, not the exception.
 *   - The same story warns against hand-rolling naive absolute positioning
 *     where a mature overlay primitive exists. On web that primitive is
 *     Floating UI; here it is `Sheet`. React Native has no equivalent
 *     collision-detection/portal ecosystem, so an "anchored" popover over a
 *     ScrollView would be exactly the hand-rolled geometry the story
 *     cautions about — and the web regressions it was written to fix are
 *     evidence of how that goes.
 *   - A modal bottom sheet is already the platform-standard, VoiceOver-
 *     legible way to present this on iOS.
 *
 * The consequence worth stating plainly: because the sheet is modal, a
 * second trigger is not reachable until this one is dismissed, so web's
 * "switch help in a single tap" does not apply here. That is inherent to
 * modal presentation and is the accepted trade for the points above.
 */

// Only one panel open at a time, across every MetricInfo instance on the
// screen — mirrors the web version's module-level singleton.
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

export interface MetricInfoProps {
  label: string;
  explanation: string;
  calculation?: string | null;
  limitation?: string | null;
}

export function MetricInfo({ label, explanation, calculation, limitation }: MetricInfoProps) {
  const theme = useTheme();
  const [open, setOpen] = useExclusiveOpen();

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={`What does ${label} mean?`}
        accessibilityState={{ expanded: open }}
        hitSlop={12}
        testID="metric-info-trigger"
        onPress={() => setOpen(!open)}
        style={[styles.trigger, { borderColor: open ? theme.action.primary : theme.border.default }]}
      >
        <Text style={[styles.triggerText, { color: open ? theme.action.primary : theme.text.secondary }]}>
          ?
        </Text>
      </Pressable>

      <Sheet visible={open} onRequestClose={() => setOpen(false)} dismissOnBackdropPress maxHeightPercent={60}>
        {/* `accessible` collapses the three parts into one VoiceOver
            utterance on purpose: the caveat is not optional reading, and a
            user swiping element-by-element could otherwise land on the
            explanation and never reach the limitation. No live region —
            presenting the modal already announces it, and a live region on
            top of that reads the panel twice. */}
        <View accessible testID="metric-info-panel" style={styles.panelContent}>
          <Text accessibilityRole="header" style={[styles.heading, { color: theme.text.primary }]}>
            {label}
          </Text>
          <Text style={[styles.detail, { color: theme.text.secondary }]}>{explanation}</Text>
          {calculation ? (
            <Text style={[styles.detail, { color: theme.text.secondary }]}>{calculation}</Text>
          ) : null}
          {limitation ? (
            <Text
              style={[
                styles.limitation,
                { color: theme.text.secondary, borderLeftColor: theme.border.default },
              ]}
            >
              {limitation}
            </Text>
          ) : null}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginLeft: spacing[4],
  },
  trigger: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  panelContent: {
    gap: spacing[8],
  },
  heading: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '700',
  },
  detail: {
    fontSize: typeScale.caption.fontSize,
  },
  limitation: {
    fontSize: typeScale.caption.fontSize,
    borderLeftWidth: 2,
    paddingLeft: spacing[8],
  },
});
