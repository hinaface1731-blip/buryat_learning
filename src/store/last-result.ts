import { create } from 'zustand';

/** Итог последней сессии для экрана результата (не сохраняется между запусками). */
export type LastResult = {
  kind: 'lesson' | 'review';
  lessonId?: string;
  title: string;
  accuracy: number;
  xp: number;
  /** id единиц с ошибками — уйдут в «Повторение». */
  mistakes: string[];
  outOfHearts: boolean;
  practice: boolean;
  /** Точность не ниже порога: материал освоен, а не просто пройден. */
  mastered: boolean;
};

export const useLastResult = create<{ result: LastResult | null; set: (r: LastResult) => void }>()((set) => ({
  result: null,
  set: (result) => set({ result }),
}));
