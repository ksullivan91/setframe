import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * The forward/backward motion between steps of a flow.
 *
 * Mirrors the Figma prototype's Smart Animate without imitating it: the
 * chrome and the action bar are rendered by the scaffold and never
 * unmount, so only the body moves. Forward, the new step rises into
 * place; backward, it settles down from above. The direction is the whole
 * point — a step that always enters the same way gives no sense of
 * having gone back.
 *
 * React Native's own Animated rather than reanimated, which is a native
 * module: adding one would mean a prebuild and a new binary before anyone
 * could see a 200ms fade.
 */
const DISTANCE = 10;
const DURATION = 200;

export function useStepTransition(index: number) {
  const progress = useRef(new Animated.Value(1)).current;
  const previous = useRef(index);

  /* Set during render, not in the effect: the effect runs after the new
     step has already painted, so reading the direction there would apply
     it a frame late. */
  const goingBack = index < previous.current;
  const from = goingBack ? -DISTANCE : DISTANCE;

  useEffect(() => {
    previous.current = index;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [index, progress]);

  return {
    opacity: progress,
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) },
    ],
  };
}

