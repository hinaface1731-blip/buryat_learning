import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { dateKey } from '@/lib/dates';
import type { Grade } from '@/srs/sm2';

import {
  completeLesson,
  completeReview,
  goalDaysFromXp,
  initialProgress,
  loseHeart,
  type DailyGoal,
  type ProgressState,
} from './logic';
import { useSessionStore } from './session-store';

export type ThemePref = 'system' | 'light' | 'dark';

export type Settings = {
  onboarded: boolean;
  dailyGoal: DailyGoal;
  heartsEnabled: boolean;
  theme: ThemePref;
  /** Пометка «не проверено» на единицах с verified:false. В dev-сборке видна всегда. */
  showUnverified: boolean;
};

const initialSettings: Settings = {
  onboarded: false,
  dailyGoal: 20,
  heartsEnabled: false,
  theme: 'system',
  showUnverified: false,
};

type AppState = {
  settings: Settings;
  progress: ProgressState;
  updateSettings: (patch: Partial<Settings>) => void;
  finishLesson: (r: { lessonId: string; accuracy: number; xp: number; grades: Record<string, Grade> }) => void;
  finishReview: (r: { xp: number; grades: Record<string, Grade> }) => void;
  spendHeart: () => void;
  resetProgress: () => void;
};

export const STORE_KEY = 'buryat-mvp/v1';

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: initialSettings,
      progress: initialProgress(dateKey()),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      finishLesson: (r) => set((s) => ({ progress: completeLesson(s.progress, r, dateKey(), s.settings.dailyGoal) })),
      finishReview: (r) => set((s) => ({ progress: completeReview(s.progress, r, dateKey(), s.settings.dailyGoal) })),
      spendHeart: () => set((s) => ({ progress: loseHeart(s.progress, dateKey()) })),
      // Сброс прогресса не трогает настройки (цель, тема), кроме онбординга.
      resetProgress: () => set((s) => ({ progress: initialProgress(dateKey()), settings: { ...s.settings, onboarded: false } })),
    }),
    {
      name: STORE_KEY,
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ settings: s.settings, progress: s.progress }),
      // Будущие версии схемы стора мигрируются здесь; неизвестное — к значениям по умолчанию.
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<Pick<AppState, 'settings' | 'progress'>>;
        if (version < 1) return { settings: initialSettings, progress: initialProgress(dateKey()) };
        const settings = { ...initialSettings, ...p.settings };
        const progress = { ...initialProgress(dateKey()), ...p.progress };
        if (version < 2) progress.goalMetDays = goalDaysFromXp(progress.xpByDate, settings.dailyGoal);
        return { settings, progress };
      },
    },
  ),
);

/** true после восстановления состояния из AsyncStorage. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const a = useAppStore.persist.onFinishHydration(onChange);
      const b = useSessionStore.persist.onFinishHydration(onChange);
      return () => {
        a();
        b();
      };
    },
    () => useAppStore.persist.hasHydrated() && useSessionStore.persist.hasHydrated(),
    () => false, // статическая сборка веба: состояние появляется только в браузере
  );
}
