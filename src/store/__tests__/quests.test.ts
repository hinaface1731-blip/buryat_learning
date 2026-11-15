import { activeEvent, eventStart, type SeasonEvent } from '../events';
import { completeListening, initialProgress, joinEvent, LISTEN_XP } from '../logic';
import { allQuestsDone, dailyQuests, weekStart, weeklyChallenge, weeksWon, WEEKLY_XP } from '../quests';

const today = '2026-11-12'; // четверг

describe('задания дня', () => {
  it('три задания, первое — набрать XP; набор одинаковый в течение дня', () => {
    const q = dailyQuests(initialProgress(today), today, 20);
    expect(q).toHaveLength(3);
    expect(q[0]).toMatchObject({ id: 'xp', target: 30, value: 0, done: false });
    expect(new Set(q.map((x) => x.id)).size).toBe(3);
    expect(dailyQuests(initialProgress(today), today, 20).map((x) => x.id)).toEqual(q.map((x) => x.id));
  });

  it('урок и «два урока» не попадают в один день', () => {
    for (let d = 1; d <= 28; d++) {
      const day = `2026-02-${String(d).padStart(2, '0')}`;
      const ids = dailyQuests(initialProgress(day), day, 20).map((x) => x.id);
      expect(ids.filter((id) => id.startsWith('lesson')).length).toBeLessThanOrEqual(1);
    }
  });

  it('прогресс считается из сегодняшних данных', () => {
    const p = { ...initialProgress(today), xpByDate: { [today]: 40, '2026-11-11': 100 } };
    expect(dailyQuests(p, today, 20)[0]).toMatchObject({ value: 30, done: true });
    expect(allQuestsDone(initialProgress(today), today, 20)).toBe(false);
  });
});

describe('недельное испытание', () => {
  it('неделя с понедельника', () => {
    expect(weekStart(today)).toBe('2026-11-09');
    expect(weekStart('2026-11-09')).toBe('2026-11-09');
    expect(weekStart('2026-11-15')).toBe('2026-11-09');
  });

  it('XP за неделю и число выигранных недель', () => {
    const p = { ...initialProgress(today), xpByDate: { '2026-11-09': 100, [today]: 60, '2026-11-08': 200, '2026-10-01': 10 } };
    expect(weeklyChallenge(p, today)).toMatchObject({ value: WEEKLY_XP, done: true, daysLeft: 4 });
    expect(weeksWon(p)).toBe(2);
  });
});

describe('прослушивание и события', () => {
  it('XP за аудиоурок — только в первый раз', () => {
    const once = completeListening(initialProgress(today), 'fm-01', today, 20);
    expect(once.xpByDate[today]).toBe(LISTEN_XP);
    expect(completeListening(once, 'fm-01', today, 20)).toBe(once);
  });

  const sagaalgan: SeasonEvent = { id: 's', title: 'С', description: '', days: 15, wordIds: [], badge: 'b', start: { '2026': '2026-02-18' } };
  const baikal: SeasonEvent = { id: 'b', title: 'Б', description: '', days: 7, wordIds: [], badge: 'b', rule: 'second-sunday-september' };

  it('дата по таблице и по правилу', () => {
    expect(eventStart(sagaalgan, 2026)).toBe('2026-02-18');
    expect(eventStart(sagaalgan, 2031)).toBeNull();
    expect(eventStart(baikal, 2026)).toBe('2026-09-07'); // неделя до 13 сентября
  });

  it('событие идёт days дней; участие засчитывается раз за сезон', () => {
    expect(activeEvent('2026-02-17', [sagaalgan])).toBeNull();
    expect(activeEvent('2026-02-18', [sagaalgan])).toMatchObject({ season: 's-2026', daysLeft: 15 });
    expect(activeEvent('2026-03-04', [sagaalgan])).toMatchObject({ daysLeft: 1 });
    expect(activeEvent('2026-03-05', [sagaalgan])).toBeNull();
    expect(activeEvent('2026-09-13', [baikal])).toMatchObject({ season: 'b-2026', daysLeft: 1 });
    const joined = joinEvent(initialProgress(today), 's-2026', today);
    expect(joinEvent(joined, 's-2026', '2026-11-13')).toBe(joined);
  });
});
