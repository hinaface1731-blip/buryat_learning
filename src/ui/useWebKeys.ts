import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Горячие клавиши в веб-версии (на телефоне ничего не делает).
 * Нажатия внутри полей ввода передаются только для Enter.
 */
export function useWebKeys(handler: (key: string) => void, enabled = true): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (typing && e.key !== 'Enter') return;
      ref.current(e.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

/** «1»…«9» → индекс варианта или null. */
export function optionIndex(key: string, count: number): number | null {
  const n = Number(key);
  return Number.isInteger(n) && n >= 1 && n <= count ? n - 1 : null;
}
