import { achievementsOf, bestStreak, isUnitDone, newlyUnlocked } from '../achievements';
import { completeLesson, initialProgress, type ProgressState } from '../logic';

const today = '2026-11-02';
const units = [
  { id: 'route', title: 'Разговоры', badge: 'badge-speech', lessons: [{ id: 'a' }, { id: 'b' }] },
  { id: 'u1', title: 'Буквы', lessons: [{ id: 'c' }] },
];
const finish = (s: ProgressState, lessonId: string, accuracy = 1) => completeLesson(s, { lessonId, accuracy, xp: 15, grades: { [`w-${lessonId}`]: 'correct' } }, today, 20);
const get = (s: ProgressState, id: string) => achievementsOf(s, units).find((a) => a.id === id)!;

describe('bestStreak', () => {
  it('находит самую длинную серию, даже если она уже оборвалась', () => {
    expect(bestStreak({})).toBe(0);
    expect(bestStreak({ '2026-10-01': true, '2026-10-02': true, '2026-10-03': true, '2026-10-20': true })).toBe(3);
  });
  it('считает через границу месяца', () => {
    expect(bestStreak({ '2026-10-31': true, '2026-11-01': true })).toBe(2);
  });
});

describe('achievementsOf', () => {
  it('новый ученик: ничего не получено, каждое достижение можно получить', () => {
    const list = achievementsOf(initialProgress(today), units);
    expect(list.some((a) => a.unlocked)).toBe(false);
    for (const a of list) expect(a.target).toBeGreaterThan(0);
  });

  it('глава засчитывается, только когда пройдены все её уроки', () => {
    let s = finish(initialProgress(today), 'a');
    expect(isUnitDone(units[0], s)).toBe(false);
    expect(get(s, 'chapter-route').unlocked).toBe(false);
    s = finish(s, 'b');
    expect(isUnitDone(units[0], s)).toBe(true);
    expect(get(s, 'chapter-route').unlocked).toBe(true);
  });

  it('главы без значка собираются в одно достижение', () => {
    expect(get(initialProgress(today), 'chapter-sounds').target).toBe(1);
    expect(achievementsOf(initialProgress(today), units).some((a) => a.id === 'chapter-u1')).toBe(false);
    expect(get(finish(initialProgress(today), 'c'), 'chapter-sounds').unlocked).toBe(true);
  });

  it('«без ошибок» требует точности 100%', () => {
    expect(get(finish(initialProgress(today), 'a', 0.9), 'perfect').unlocked).toBe(false);
    expect(get(finish(initialProgress(today), 'a', 1), 'perfect').unlocked).toBe(true);
  });

  it('значение не выходит за цель', () => {
    const s = { ...initialProgress(today), xpByDate: { [today]: 5000 } };
    expect(get(s, 'xp-100').value).toBe(100);
  });
});

describe('newlyUnlocked', () => {
  it('показывает только то, что появилось этим занятием', () => {
    const start = initialProgress(today);
    const one = finish(start, 'a');
    expect(newlyUnlocked(start, one, units).map((a) => a.id)).toEqual(['first-lesson', 'perfect']);
    expect(newlyUnlocked(one, finish(one, 'a'), units)).toEqual([]);
  });
});
