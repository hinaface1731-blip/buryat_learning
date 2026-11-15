import { getContent } from '@/content/load';
import { buildPools } from '@/engine/pool';
import { buildWords, buildDialogue, buildGrammar, buildListening, buildMistakes, buildSpeaking, weakIds } from '@/engine/practice';
import type { Card } from '@/srs/sm2';

const content = getContent();
const pools = buildPools(content);
const someAudio = new Set([...pools.itemById.keys()].slice(0, 12));
const card = (over: Partial<Card>): Card => ({ ease: 2.5, interval: 1, reps: 1, lapses: 0, due: '2026-01-01', lastReviewed: null, ...over });
const opts = (cards: Record<string, Card> = {}) => ({ hasAudio: (id: string) => someAudio.has(id), cards, seed: 7 });

describe('Практикум', () => {
  it('аудирование и произношение — только по словам с записью', () => {
    const listen = buildListening(pools, opts());
    expect(listen.length).toBeGreaterThan(0);
    expect(listen.every((e) => e.type === 'listen_and_choose' && someAudio.has(e.item.id))).toBe(true);
    const speak = buildSpeaking(pools, opts());
    expect(speak.every((e) => e.type === 'speak_repeat' && someAudio.has(e.item.id))).toBe(true);
    expect(buildSpeaking(pools, { ...opts(), hasAudio: () => false })).toEqual([]);
  });

  it('сначала тренирует уже знакомые слова', () => {
    const known = [...someAudio][5];
    const first = buildSpeaking(pools, opts({ [known]: card({}) }))[0];
    expect(first.type === 'speak_repeat' && first.item.id).toBe(known);
  });

  it('грамматика: правило и задания на пары или ряды', () => {
    const g = buildGrammar(content, pools, opts());
    expect(g[0].type).toBe('note');
    expect(g.some((e) => e.type === 'minimal_pair_choose' || e.type === 'categorize')).toBe(true);
  });

  it('ошибки: только слабые карточки, самые трудные первыми', () => {
    const [a, b, c] = [...pools.itemById.keys()];
    const cards = { [a]: card({ lapses: 1 }), [b]: card({ lapses: 3 }), [c]: card({}) };
    expect(weakIds(cards)).toEqual([b, a]);
    const ex = buildMistakes(content, pools, opts(cards));
    expect(ex).toHaveLength(2);
  });

  it('диалог: варианты ответа — реплики, а не отдельные слова', () => {
    const [scene] = buildDialogue('d-route-1', content, pools, opts());
    expect(scene.type).toBe('dialogue');
    if (scene.type !== 'dialogue') return;
    const learner = scene.lines.filter((l) => l.role === 'learner');
    expect(learner.length).toBeGreaterThan(0);
    const phrases = new Set([...pools.itemById.values()].filter((it) => it.kind === 'word' && it.word.tags.includes('phrase')).map((it) => it.buryat));
    for (const l of learner) for (const o of l.options) expect(phrases.has(o)).toBe(true);
  });
});

describe('Тренировка словаря', () => {
  it('можно заниматься до появления карточек к повторению', () => {
    const queue = buildWords(content, pools, opts());
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.length).toBeLessThanOrEqual(10);
    expect(new Set(queue.map((e) => e.key)).size).toBe(queue.length);
  });
  it('пустые и неизвестные подборки не подменяются случайными словами', () => {
    expect(buildWords(content, pools, opts(), { collection: 'missing' })).toEqual([]);
    expect(buildWords(content, pools, opts(), { query: 'zzzznotaword' })).toEqual([]);
    expect(buildWords(content, pools, opts(), { learnedOnly: true })).toEqual([]);
    expect(buildWords(content, pools, { ...opts(), hasAudio: () => false }, { collection: 'audio' })).toEqual([]);
  });
  it('освоенные слова и выбранная тема ограничивают задания', () => {
    const unit = content.course.units.find((u) => !u.locked && u.lessons.some((l) => l.wordIds.some((id) => pools.itemById.has(id))))!;
    const id = unit.lessons.flatMap((l) => l.wordIds).find((id) => pools.itemById.has(id))!;
    const queue = buildWords(content, pools, opts({ [id]: card({ reps: 2 }) }), { collection: unit.id, learnedOnly: true });
    expect(queue).toHaveLength(1);
    const ex = queue[0];
    expect('item' in ex ? ex.item.id : ex.type === 'build_sentence' ? ex.sentence.id : null).toBe(id);
  });
});
