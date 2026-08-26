import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, typeScale } from '../theme/getTheme';
import {
  popoverGeometry,
  usePopoverHost,
  type AnchorRect,
  type PopoverPlacement,
} from './PopoverHost';

/**
 * "What does this mean?" affordance for a metric — the mobile counterpart of
 * the web `MetricInfo`, and now genuinely its counterpart rather than a
 * different interaction wearing the same name.
 *
 * A hover tooltip does not exist on touch, so this is a tap-triggered
 * disclosure. The panel carries three things on purpose — what the metric is,
 * how it is calculated, and where it falls down — because presenting an
 * estimate without its caveat claims a precision we do not have.
 *
 * ## What changed, and why the previous reasoning was wrong
 *
 * This used to open a modal bottom `Sheet`, and the file argued that was a
 * deliberate divergence: RN has no Floating-UI-equivalent, Story 46 warns
 * against hand-rolling popover geometry, and a bottom sheet is iOS-standard.
 * Two of those premises did not survive contact with the result.
 *
 * - Covering the entire app to show one sentence of help is a heavy answer to
 *   a light question, and looks nothing like the web product this is meant to
 *   mirror. "Platform-standard" describes sheets used for *tasks*, not for a
 *   tooltip.
 * - A modal captures every touch, so a second trigger was unreachable while
 *   the first panel was open and switching help took two taps. The old file
 *   recorded that as an accepted trade — but it is precisely the defect
 *   Story 46 fixed on web by deleting the backdrop, so accepting it here made
 *   the two platforms behave differently in the one way the user notices.
 *
 * The geometry now lives in `PopoverHost` (mounted once at the app root),
 * which does the flip/shift/caret work Floating UI does on web. That is still
 * hand-rolled geometry — the honest counterweight to this change — but it is
 * hand-rolled *once*, in one reviewable place with its own tests, rather than
 * per call site, which is the failure mode Story 46 actually warned about.
 */

export interface MetricInfoProps {
  label: string;
  explanation: string;
  calculation?: string | null;
  limitation?: string | null;
}

export function MetricInfo({ label, explanation, calculation, limitation }: MetricInfoProps) {
  const theme = useTheme();
  const host = usePopoverHost();
  const id = useRef(Symbol('metric-info')).current;
  const triggerRef = useRef<View>(null);
  /** Last successful measurement, reused so a reopen never starts from zero. */
  const lastAnchor = useRef<AnchorRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [open, setOpen] = useState(false);

  // The host owns which popover is showing, so a second trigger opening its
  // own panel implicitly closes this one. Mirror that back into local state
  // rather than tracking it separately and letting the two disagree.
  const hostOpen = host.openId === id;
  useEffect(() => {
    if (!hostOpen && open) setOpen(false);
  }, [hostOpen, open]);

  /* Close on unmount only — via a ref, deliberately not `[host, id]`.
     The context value's identity changes on every host state update, so a
     `host` dependency makes this cleanup run as part of the very render that
     opens the panel, closing it again in the same tick. The panel then never
     appears at all, which is exactly what happened before this was pinned. */
  const closeRef = useRef(host.close);
  closeRef.current = host.close;
  useEffect(() => () => closeRef.current(id), [id]);

  const renderPanel = useCallback(
    (placement: PopoverPlacement) => (
      <View
        /* `accessible` collapses the parts into one VoiceOver utterance on
           purpose: the caveat is not optional reading, and a user swiping
           element-by-element could otherwise land on the explanation and
           never reach the limitation. */
        accessible
        accessibilityRole="alert"
        testID="metric-info-panel"
        style={[
          styles.panel,
          {
            backgroundColor: theme.surface.raised,
            borderColor: theme.border.default,
          },
        ]}
      >
        {/* The caret is what makes "this panel belongs to that button"
            legible once the panel has been shifted sideways to stay on
            screen: the panel edge no longer lines up with the trigger, but
            the caret still points at it. */}
        <View
          testID="metric-info-caret"
          style={[
            styles.caret,
            {
              backgroundColor: theme.surface.raised,
              borderColor: theme.border.default,
              left: placement.caretLeft,
              ...(placement.side === 'bottom'
                ? { top: -popoverGeometry.CARET_SIZE / 2, borderBottomWidth: 0, borderRightWidth: 0 }
                : { bottom: -popoverGeometry.CARET_SIZE / 2, borderTopWidth: 0, borderLeftWidth: 0 }),
            },
          ]}
        />
        <ScrollView
          style={styles.panelScroll}
          contentContainerStyle={styles.panelContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.heading, { color: theme.text.primary }]}>{label}</Text>
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
        </ScrollView>
      </View>
    ),
    [theme, label, explanation, calculation, limitation],
  );

  const toggle = useCallback(() => {
    if (hostOpen) {
      host.close(id);
      setOpen(false);
      return;
    }

    /* Open first, measure second. Gating the open on `measureInWindow`'s
       callback means a measurement that is slow, or that never fires because
       the node is detached, silently swallows the tap — the control looks
       broken rather than degraded. Opening immediately with the last known
       anchor guarantees the panel appears; the host clamps any anchor into
       the viewport, so even a zero rect yields a readable panel. */
    host.open({ id, anchor: lastAnchor.current, render: renderPanel });
    setOpen(true);

    // Window coordinates, so the anchor is right regardless of how far the
    // enclosing ScrollView has been scrolled.
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const anchor = { x, y, width, height };
      lastAnchor.current = anchor;
      host.setAnchor(id, anchor);
    });
  }, [host, id, hostOpen, renderPanel]);

  return (
    <View style={styles.wrapper} ref={triggerRef} collapsable={false}>
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={`What does ${label} mean?`}
        accessibilityState={{ expanded: hostOpen }}
        hitSlop={12}
        testID="metric-info-trigger"
        onPress={toggle}
        style={[
          styles.trigger,
          { borderColor: hostOpen ? theme.action.primary : theme.border.default },
        ]}
      >
        <Text
          style={[
            styles.triggerText,
            { color: hostOpen ? theme.action.primary : theme.text.secondary },
          ]}
        >
          ?
        </Text>
      </Pressable>
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
  panel: {
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  panelScroll: {
    borderRadius: 12,
  },
  panelContent: {
    padding: spacing[12],
    gap: spacing[8],
  },
  caret: {
    position: 'absolute',
    width: popoverGeometry.CARET_SIZE,
    height: popoverGeometry.CARET_SIZE,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
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
