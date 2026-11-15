import type { Word } from '../../../src/content/schema';
import { buildConversations } from '../conversations';

const word = { id: 'sayn-bayna', kind: 'word', buryat: 'Сайн байна!', russian: 'Здравствуйте!', alternatives: [], source: { book: 'zugaa' }, tags: [], verified: false, needs_review: false, review_reasons: [], possible_typo: false, typo_candidates: [], form: null, excluded: false, comment: '', origin: { buryat: '', russian: '' } } as Word;
const row = (step: number, role: string, buryat: string, verdict = '', explain = '', extra: Record<string, string> = {}) => ({ conv: 'c', title: '', scene: '', art: '', step: String(step), role, buryat, russian: 'перевод', verdict, explain, ...extra });

describe('buildConversations', () => {
  it('шаги, варианты и привязка к слову курса', () => {
    const { conversations, errors, manual } = buildConversations(
      [row(1, 'say', 'Сайн байна!', '', '', { title: 'Т', scene: 'С' }), row(1, 'option', 'Сайн байна!', 'correct'), row(1, 'option', 'Баяртай!', 'wrong', 'Это прощание'), row(1, 'reply', 'Мэндэ!')],
      [word],
    );
    expect(errors).toEqual([]);
    expect(conversations[0].steps[0].say.wordId).toBe('sayn-bayna');
    expect(conversations[0].steps[0].options).toHaveLength(2);
    expect(conversations[0].steps[0].reply?.buryat).toBe('Мэндэ!');
    expect(manual).toEqual(['Баяртай!', 'Мэндэ!']);
  });

  it('ошибки: нет верного варианта, неверный без объяснения, шаг без say', () => {
    const { errors } = buildConversations([row(1, 'say', 'А', '', '', { title: 'Т' }), row(1, 'option', 'Б', 'wrong'), row(2, 'option', 'В', 'correct')], []);
    expect(errors.some((e) => e.includes('объяснение'))).toBe(true);
    expect(errors.some((e) => e.includes('начинаться с say'))).toBe(true);
    expect(errors.some((e) => e.includes('нет верного'))).toBe(true);
  });
});
