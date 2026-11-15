import { getContent } from '@/content/load';

import { currentPlaceId, PLACES, placeStates } from '../world';

const units = getContent().course.units;

describe('Бурятский мир', () => {
  it('каждая открытая глава курса — ровно в одном месте карты', () => {
    const open = units.filter((u) => !u.locked && u.lessons.length > 0).map((u) => u.id);
    const placed = PLACES.flatMap((p) => p.units);
    for (const id of open) expect(placed.filter((x) => x === id)).toHaveLength(1);
  });

  it('места на карте — в её пределах', () => {
    for (const p of PLACES) {
      expect(p.x).toBeGreaterThan(0.05);
      expect(p.x).toBeLessThan(0.95);
      expect(p.y).toBeGreaterThan(0.1);
      expect(p.y).toBeLessThan(0.95);
    }
  });

  it('прогресс места и где стоит нерпёнок', () => {
    const states = placeStates(units, {});
    expect(states.every((s) => s.done === 0 && s.total > 0)).toBe(true);
    expect(currentPlaceId(states, 'route-l1')).toBe('ulan-ude');
    expect(currentPlaceId(states, 'u2-l1')).toBe('ivolga');
    expect(currentPlaceId(states, null)).toBe(states[0].place.id);
  });
});

  it('не путает завершение с освоением и предлагает закрепить слабые уроки', () => {
    const state = placeStates(units, {})[0];
    const lessons = state.units.flatMap((u) => u.lessons);
    const completed = Object.fromEntries(lessons.map((l, i) => [l.id, { bestAccuracy: i === 0 ? 0.5 : 1 }]));
    const updated = placeStates(units, completed)[0];
    expect(updated.done).toBe(updated.total);
    expect(updated.mastered).toBe(updated.total - 1);
    expect(updated.nextLesson).toBe(lessons[0].id);
  });
