import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { dateKey } from '@/lib/dates';
import type { Grade } from '@/srs/sm2';

import {
  completeLesson,
  completeListening,
  completeReview,
  goalDaysFromXp,
  initialProgress,
  joinEvent,
  loseHeart,
  type DailyGoal,
  type ProgressState,
} from './logic';
import { allQuestsDone } from './quests';
import { useSessionStore } from './session-store';

export type ThemePref = 'system' | 'light' | 'dark';

export type Settings = {
  onboarded: boolean;
  dailyGoal: DailyGoal;
  heartsEnabled: boolean;
  theme: ThemePref;
  /** Пометка «не проверено» на единицах с verified:false. В dev-сборке видна всегда. */
  showUnverified: boolean;
  /** Имя в профиле: хранится только на устройстве, может быть пустым. */
  name: string;
  /** Ключ аватара из src/ui/Avatar.tsx. */
  avatar: string;
  /** Звуки интерфейса: ответ, конец урока, награда. */
  sound: boolean;
  /** Час ежедневного напоминания (локальное уведомление) или null — выключено. */
  reminderHour: number | null;
  /** «Путь» картой Бурятии или списком глав. */
  pathView: 'map' | 'list';
};

const initialSettings: Settings = {
  name: '',
  avatar: 'seal',
  onboarded: false,
  dailyGoal: 20,
  heartsEnabled: false,
  theme: 'system',
  showUnverified: false,
  sound: true,
  reminderHour: null,
  pathView: 'map',
};

type AppState = {
  settings: Settings;
  progress: ProgressState;
  updateSettings: (patch: Partial<Settings>) => void;
  finishLesson: (r: { lessonId: string; accuracy: number; xp: number; grades: Record<string, Grade> }) => void;
  finishReview: (r: { xp: number; grades: Record<string, Grade> }) => void;
  spendHeart: () => void;
  finishListening: (lessonId: string) => void;
  finishEvent: (season: string) => void;
  resetProgress: () => void;
};

export const STORE_KEY = 'buryat-mvp/v1';

/** После каждого занятия: если все задания дня выполнены, день отмечается для достижения. */
function withQuests(p: ProgressState, goal: number): ProgressState {
  const today = dateKey();
  return !p.questDays[today] && allQuestsDone(p, today, goal) ? { ...p, questDays: { ...p.questDays, [today]: true } } : p;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: initialSettings,
      progress: initialProgress(dateKey()),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      finishLesson: (r) => set((s) => ({ progress: withQuests(completeLesson(s.progress, r, dateKey(), s.settings.dailyGoal), s.settings.dailyGoal) })),
      finishReview: (r) => set((s) => ({ progress: withQuests(completeReview(s.progress, r, dateKey(), s.settings.dailyGoal), s.settings.dailyGoal) })),
      finishEvent: (season) => set((s) => ({ progress: joinEvent(s.progress, season, dateKey()) })),
      spendHeart: () => set((s) => ({ progress: loseHeart(s.progress, dateKey()) })),
      finishListening: (lessonId) => set((s) => ({ progress: withQuests(completeListening(s.progress, lessonId, dateKey(), s.settings.dailyGoal), s.settings.dailyGoal) })),
      // Сброс прогресса не трогает настройки (цель, тема), кроме онбординга.
      resetProgress: () => set((s) => ({ progress: initialProgress(dateKey()), settings: { ...s.settings, onboarded: false } })),
    }),
    {
      name: STORE_KEY,
      version: 7,
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
