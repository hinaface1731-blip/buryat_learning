import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SessionState } from '@/engine/session';

// Незавершённые занятия: очередь, позиция и ответы. Отдельно от прогресса, потому что пишется
// после каждого шага и весит заметно больше.

export const REVIEW_SESSION_KEY = 'review';

export type SavedSession = {
  /** Отпечаток контента: после обновления курса старую очередь не продолжаем. */
  stamp: string;
  savedAt: number;
  session: SessionState;
};

type State = {
  saved: Record<string, SavedSession>;
  save: (key: string, session: SessionState, stamp: string) => void;
  clear: (key: string) => void;
  clearAll: () => void;
};

export const useSessionStore = create<State>()(
  persist(
    (set) => ({
      saved: {},
      save: (key, session, stamp) => set((s) => ({ saved: { ...s.saved, [key]: { stamp, savedAt: Date.now(), session } } })),
      clear: (key) =>
        set((s) => {
          const { [key]: _removed, ...saved } = s.saved;
          return { saved };
        }),
      clearAll: () => set({ saved: {} }),
    }),
    { name: 'buryat-mvp/sessions', version: 1, storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ saved: s.saved }) },
  ),
);

/** Самый свежий незавершённый урок (не повторение). */
export function latestSavedLesson(saved: Record<string, SavedSession>, stamp: string): string | null {
  const lessons = Object.entries(saved).filter(([key, s]) => key !== REVIEW_SESSION_KEY && s.stamp === stamp);
  lessons.sort(([, a], [, b]) => b.savedAt - a.savedAt);
  return lessons[0]?.[0] ?? null;
}
