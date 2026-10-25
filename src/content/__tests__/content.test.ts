import { buildContent, rawContent } from '../load';

describe('контент курса', () => {
  it('проходит схемы и не содержит битых ссылок', () => {
    expect(() => buildContent(rawContent)).not.toThrow();
  });

  it('алфавит содержит 36 букв и помечен для сверки по картинке', () => {
    const { letters } = buildContent(rawContent);
    expect(letters).toHaveLength(36);
    expect(letters.every((l) => l.needs_image_check && !l.verified)).toBe(true);
    expect(letters.filter((l) => l.special).map((l) => l.lower)).toEqual(['ө', 'ү', 'һ']);
  });

  it('находит ссылку на несуществующее слово', () => {
    const raw = {
      ...rawContent,
      course: {
        id: 'x',
        title: 'x',
        units: [
          {
            id: 'u',
            title: 'u',
            description: '',
            locked: false,
            lessons: [
              { id: 'l', title: 'l', noteIds: [], wordIds: ['nope'], minimalPairIds: [], letterIds: [], sentenceIds: [], categorize: false },
            ],
          },
        ],
      },
    };
    expect(() => buildContent(raw)).toThrow(/нет nope/);
  });
});
