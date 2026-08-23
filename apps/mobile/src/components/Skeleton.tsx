import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '@setframe/design-tokens';

/**
 * Shared reduced-motion flag. Mirrors the web design system, where every
 * animation is wrapped in a `prefers-reduced-motion` guard — the platforms
 * should not disagree about whether motion is acceptable.
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduced(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduced;
}

/**
 * Skeleton — the mobile counterpart to the web `Skeleton`, used in place of
 * a bare spinner so a loading screen keeps the shape of the content it is
 * about to show.
 *
 * React Native has no gradient primitive without a dependency, so this
 * pulses opacity rather than sweeping a shimmer. The effect reads the same
 * at a glance and costs nothing extra.
 */
export function Skeleton({
  height = 16,
  width = '100%',
  rounded = false,
  style,
  ...rest
}: ViewProps & { height?: number; width?: number | `${number}%`; rounded?: boolean }) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(0.7);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          height,
          width,
          borderRadius: rounded ? 999 : radius.small,
          backgroundColor: theme.surface.sunken,
          opacity: pulse,
        },
        style,
      ]}
      {...rest}
    />
  );
}

/** Vertical stack for grouping skeleton bars, matching web's SkeletonStack. */
export function SkeletonStack({ children, gap = spacing[8], style, ...rest }: ViewProps & { gap?: number }) {
  return (
    <View style={[styles.stack, { gap }, style]} {...rest}>
      {children}
    </View>
  );
}

/**
 * FadeIn — wraps content that has just replaced a Skeleton so the swap reads
 * as a transition instead of a pop. The rise is deliberately small: loaded
 * content should settle, not slide in.
 */
export function FadeIn({ children, style, ...rest }: ViewProps) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion]);

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }],
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: {
    flexDirection: 'column',
  },
});
