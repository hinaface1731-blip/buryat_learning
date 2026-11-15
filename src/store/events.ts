import eventsJson from '../../content/events.json';

import { addDays, diffDays, type DateKey } from '@/lib/dates';

// Сезонные события: Сагаалган (дата по лунному календарю — таблицей), День Байкала (правило).
// Событие идёт days дней с даты начала; в это время на «Пути» — баннер и тематическая тренировка.

export type SeasonEvent = { id: string; title: string; description: string; days: number; wordIds: string[]; badge: string; start?: Record<string, DateKey>; rule?: 'second-sunday-september' };

export const EVENTS = eventsJson as SeasonEvent[];

function secondSundayOfSeptember(year: number): DateKey {
  const first = new Date(year, 8, 1, 12);
  const firstSunday = 1 + ((7 - first.getDay()) % 7);
  return `${year}-09-${String(firstSunday + 7).padStart(2, '0')}`;
}

/** Дата начала события в году; для Дня Байкала — неделя, которая заканчивается самим праздником. */
export function eventStart(e: SeasonEvent, year: number): DateKey | null {
  if (e.rule === 'second-sunday-september') return addDays(secondSundayOfSeptember(year), -(e.days - 1));
  return e.start?.[String(year)] ?? null;
}

/** Идущее сейчас событие и ключ его сезона (id-год) — по нему засчитывается участие. */
export function activeEvent(today: DateKey, events: SeasonEvent[] = EVENTS): { event: SeasonEvent; season: string; daysLeft: number } | null {
  const year = Number(today.slice(0, 4));
  for (const event of events) {
    for (const y of [year, year - 1]) {
      const start = eventStart(event, y);
      if (!start) continue;
      const day = diffDays(today, start);
      if (day >= 0 && day < event.days) return { event, season: `${event.id}-${y}`, daysLeft: event.days - day };
    }
  }
  return null;
}
