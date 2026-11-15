import { z } from 'zod';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const date = new Date(s + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s;
});
const id = z.string().regex(/^[a-z0-9-]+$/);
const count = z.number().int().nonnegative();
const card = z.object({
  ease: z.number().min(1.3), interval: count, reps: count, lapses: count,
  due: day, lastReviewed: day.nullable(),
});

// Старые выгрузки дополняются пустой историей новых функций; неверные поля отклоняются целиком.
export const progressSchema = z.object({
  xpByDate: z.record(day, count),
  cards: z.record(id, card),
  completedLessons: z.record(id, z.object({ bestAccuracy: z.number().min(0).max(1), lastCompleted: day })).default({}),
  goalMetDays: z.record(day, z.literal(true)).default({}),
  hearts: z.object({ count: count.max(5), date: day }),
  listened: z.record(id, day).default({}),
  questDays: z.record(day, z.literal(true)).default({}),
  events: z.record(id, day).default({}),
});
