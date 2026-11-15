import type { Card } from '@/srs/sm2';

import { initialProgress, type ProgressState } from './logic';
import { progressSchema } from './progress-schema';

// Слияние прогресса двух устройств (синхронизация, импорт из файла). Ничего не теряется:
// XP по дням и сделанное — по максимуму, карточка повторения — та, что повторяли позже.

const later = <T extends string | null | undefined>(a: T, b: T) => ((a ?? '') >= (b ?? '') ? a : b);

function mergeRecord<V>(a: Record<string, V>, b: Record<string, V>, pick: (x: V, y: V) => V): Record<string, V> {
  const out: Record<string, V> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? pick(out[k], v) : v;
  return out;
}

function newerCard(a: Card, b: Card): Card {
  if ((a.lastReviewed ?? '') !== (b.lastReviewed ?? '')) return later(a.lastReviewed, b.lastReviewed) === a.lastReviewed ? a : b;
  return a.reps >= b.reps ? a : b;
}

export function mergeProgress(a: ProgressState, b: ProgressState, today: string): ProgressState {
  const base = initialProgress(today);
  const x = { ...base, ...a };
  const y = { ...base, ...b };
  return {
    xpByDate: mergeRecord(x.xpByDate, y.xpByDate, Math.max),
    goalMetDays: { ...x.goalMetDays, ...y.goalMetDays },
    completedLessons: mergeRecord(x.completedLessons, y.completedLessons, (p, q) => ({ bestAccuracy: Math.max(p.bestAccuracy, q.bestAccuracy), lastCompleted: later(p.lastCompleted, q.lastCompleted) })),
    cards: mergeRecord(x.cards, y.cards, newerCard),
    // Сердечки — сегодняшние на этом устройстве: тратить их второй раз из-за синхронизации незачем.
    hearts: x.hearts.date === y.hearts.date ? { count: Math.min(x.hearts.count, y.hearts.count), date: x.hearts.date } : later(x.hearts.date, y.hearts.date) === x.hearts.date ? x.hearts : y.hearts,
    listened: mergeRecord(x.listened, y.listened, (p, q) => (p <= q ? p : q)),
    questDays: { ...x.questDays, ...y.questDays },
    events: mergeRecord(x.events, y.events, (p, q) => (p <= q ? p : q)),
  };
}

/** Файл прогресса: версия формата, дата выгрузки и сам прогресс. */
export type ProgressFile = { app: 'buryat-mvp'; version: 1; exportedAt: string; progress: ProgressState };

export function exportProgress(progress: ProgressState, now = new Date()): string {
  const file: ProgressFile = { app: 'buryat-mvp', version: 1, exportedAt: now.toISOString(), progress };
  return JSON.stringify(file);
}

/** Разбор файла прогресса. Возвращает ошибку по-русски, если это не наш файл. */
export function parseProgressFile(text: string): { progress: ProgressState } | { error: string } {
  if (text.length > 10 * 1024 * 1024) return { error: 'Файл слишком большой. Максимум — 10 МБ.' };
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, '').trim());
  } catch {
    return { error: 'Это не похоже на файл прогресса: текст должен начинаться с {.' };
  }
  const f = data as Partial<ProgressFile>;
  if (f?.app !== 'buryat-mvp' || f.version !== 1 || typeof f.progress !== 'object' || f.progress === null) return { error: 'Файл не от этого приложения или из более новой версии.' };
  const parsed = progressSchema.safeParse(f.progress);
  if (!parsed.success) return { error: 'Файл повреждён: проверьте даты, XP и карточки повторения. Текущий прогресс не изменён.' };
  return { progress: parsed.data };
}
