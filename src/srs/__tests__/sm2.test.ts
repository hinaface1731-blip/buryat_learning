import { completeLesson, initialProgress, loseHeart, heartsToday, streak, addXp } from '@/store/logic';

import { dueIds, newCard, review } from '../sm2';

const D = '2026-10-25';

describe('SM-2', () => {
  it('интервалы 1 → 6 → interval·ease при верных ответах', () => {
    let c = newCard(D);
    c = review(c, 'correct', D);
    expect(c).toMatchObject({ reps: 1, interval: 1, due: '2026-10-26' });
    c = review(c, 'correct', '2026-10-26');
    expect(c).toMatchObject({ reps: 2, interval: 6, due: '2026-11-01' });
    const ease = c.ease;
    c = review(c, 'correct', '2026-11-01');
    expect(c.interval).toBe(Math.round(6 * (ease + 0.1)));
  });

  it('ошибка сбрасывает карточку и снижает лёгкость, но не ниже 1.3', () => {
    let c = review(review(newCard(D), 'correct', D), 'correct', D);
    c = review(c, 'wrong', D);
    expect(c).toMatchObject({ reps: 0, interval: 1, lapses: 1, due: '2026-10-26' });
    for (let i = 0; i < 20; i++) c = review(c, 'wrong', D);
    expect(c.ease).toBeCloseTo(1.3);
  });

  it('«почти верно» засчитывается, но лёгкость падает', () => {
    const c = review(newCard(D), 'almost', D);
    expect(c.reps).toBe(1);
    expect(c.ease).toBeLessThan(2.5);
  });

  it('dueIds: только просроченные, самые старые первыми', () => {
    const cards = {
      a: { ...newCard('2026-10-20') },
      b: { ...newCard('2026-10-24') },
      c: { ...newCard('2026-10-30') },
    };
    expect(dueIds(cards, D)).toEqual(['a', 'b']);
  });
});

describe('прогресс', () => {
  it('урок даёт XP за день и карточки SRS', () => {
    const s = completeLesson(initialProgress(D), { lessonId: 'u2-l1', accuracy: 0.9, xp: 25, grades: { huen: 'correct', gar: 'wrong' } }, D);
    expect(s.xpByDate[D]).toBe(25);
    expect(s.cards.huen.due).toBe('2026-10-26');
    expect(s.cards.gar.lapses).toBe(1);
    expect(s.completedLessons['u2-l1'].bestAccuracy).toBe(0.9);
  });

  it('серия считает дни с выполненной целью и не рвётся до конца сегодняшнего дня', () => {
    let s = initialProgress(D);
    s = addXp(s, 20, '2026-10-22');
    s = addXp(s, 20, '2026-10-23');
    s = addXp(s, 20, '2026-10-24');
    expect(streak(s, 20, D)).toBe(3); // сегодня ещё не занимались
    s = addXp(s, 10, D);
    expect(streak(s, 20, D)).toBe(3); // цель не добрана
    s = addXp(s, 10, D);
    expect(streak(s, 20, D)).toBe(4);
    expect(streak(s, 20, '2026-10-27')).toBe(0); // пропуск дня
  });

  it('сердечки: 5 в день, восстанавливаются на следующий день', () => {
    let s = initialProgress(D);
    s = loseHeart(loseHeart(s, D), D);
    expect(heartsToday(s, D)).toBe(3);
    expect(heartsToday(s, '2026-10-26')).toBe(5);
  });
});
