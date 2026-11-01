import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Platform, type StyleProp, type ViewStyle } from 'react-native';

// Короткие анимации интерфейса. Анимированный API из React Native работает и в Expo Go, и в вебе.
// Если в системе включено «Уменьшение движения», всё появляется сразу.

/** В вебе нативного драйвера нет. */
export const NATIVE_DRIVER = Platform.OS !== 'web';

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** Появление: вырастает из маленького (герой, награда) или всплывает снизу (реплика, итог ответа). */
export function Appear({ children, kind = 'rise', delay = 0, style }: { children: ReactNode; kind?: 'rise' | 'pop'; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim =
      kind === 'pop'
        ? Animated.spring(t, { toValue: 1, delay, friction: 5, tension: 120, useNativeDriver: NATIVE_DRIVER })
        : Animated.timing(t, { toValue: 1, delay, duration: 220, useNativeDriver: NATIVE_DRIVER });
    anim.start();
    return () => anim.stop();
  }, [t, kind, delay]);
  if (reduce) return <Animated.View style={style}>{children}</Animated.View>;
  const transform = kind === 'pop' ? [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] : [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }];
  return <Animated.View style={[style, { opacity: t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }), transform }]}>{children}</Animated.View>;
}

/** Масштаб при нажатии и реакция на ответ: верный подпрыгивает, неверный вздрагивает. */
export function usePressMotion(reaction?: 'bounce' | 'shake' | null) {
  const reduce = useReduceMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const [shift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduce || !reaction) return;
    const anim =
      reaction === 'bounce'
        ? Animated.sequence([
            Animated.timing(scale, { toValue: 1.04, duration: 110, useNativeDriver: NATIVE_DRIVER }),
            Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: NATIVE_DRIVER }),
          ])
        : Animated.sequence([6, -6, 4, -4, 0].map((toValue) => Animated.timing(shift, { toValue, duration: 50, useNativeDriver: NATIVE_DRIVER })));
    anim.start();
    return () => anim.stop();
  }, [reaction, reduce, scale, shift]);

  const to = (toValue: number) => {
    if (!reduce) Animated.spring(scale, { toValue, friction: 6, tension: 300, useNativeDriver: NATIVE_DRIVER }).start();
  };
  return {
    style: { transform: [{ scale }, { translateX: shift }] },
    onPressIn: () => to(0.97),
    onPressOut: () => to(1),
  };
}
