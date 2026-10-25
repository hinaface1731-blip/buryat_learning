import { buildPairs, buildWords, classifyContrast, splitGloss } from '../build-content';
import { isWordList, looksRussian, parseGlossaryLine, parseTextbook, splitSentences } from '../textbook-parser';

// Фикстуры — строки из «Учебника бурятского языка» (стр. 4, 9–10, 15).
const pages = [
  {
    page: 4,
    lines: [
      '8. Долгие гласные',
      'От краткости и долготы гласных в бурятском языке зависит смысл слов. Например: на у-уу:',
      'ула (подошва) и уула (гора); на а-аа: ула (подошва) и улаа (подвода); зан (нрав) и заан (слон); дара',
      '(давить) и даара (мерзнуть);',
      'халуун (горячий, жаркий);   халюун (выдра);',
      'рроо (вошел);   орёо (сложный);',
      '4',
    ],
  },
  {
    page: 9,
    lines: [
      'Нэгэдэхи хэшээл. Первый урок',
      'Специфические звуки алфавита, обозначенные в буквах һ, ү, өө, н (нг)',
      'Упражнение № 2. Чтение буквы у',
      'Үнеэн, хүбүун, үбгэн, нүхэр, үдэр, үхибүүн, үгэ, гүрөөһэн, хүбшэ, үндэр, түхэреэн, түрэл,',
      'хүзүүн, түүхэ, түгсүүл, үлэн, үүлэн, үүдэн, үбэл',
      'Слова:',
      'унеэн — корова',
      'хүбүүн — мальчик',
      'һолонго — хорек; радуга',
      '9',
      'удэр — день',
      'хузүүн — шея',
      'Упражнение № 5. Чтение переднеязычного н',
      'Хара нохой. Һонин ном. Хүйтэн намар.',
      'Слова:',
      'хара — черный',
      'эдеэн — еда баян — богатый',
      'Хоёрдохи хэшээл. Второй урок',
      'Йотированные гласные',
      'Упражнение № 2. На йотированные яа, ёо, еэ, юу',
      '3) на еэ: Эжы үнеэгээ эдеэлүүлбэ. Айл зайха албатай, архи ууха ажалтай (посл).',
      'Слова:',
      'үнеэн — корова',
      'Гурбадахи хэшээл. Третий урок',
      'Краткие и долгие гласные',
      'Упражнение № 1. На краткие гласные первых слогов',
      'гэр — гар: Шэнэ гэр. Гар барилсаха.',
      'хүн — хун: Бэрхэ хүн. Хун шубуун.',
      'Слова:',
      'гэр — дом',
      'гар — рука',
      'хүн — человек',
      'һан — усилит. частица при глагол.',
      'Дүрбэдэхи хэшээл. Четвертый урок',
      'Дифтонги',
      'Слова:',
      'хун — человек',
      'Табадахи хэшээл. Пятый урок',
      'Слова:',
      'сай — чай',
    ],
  },
];

const parse = () => parseTextbook(pages, { maxLesson: 4, introLastPage: 8 });

describe('parseTextbook', () => {
  it('разбирает только блоки «Слова:» уроков 1–4 и пары введения', () => {
    const r = parse();
    const glossary = r.words.filter((w) => w.lesson !== undefined).map((w) => `${w.lesson}:${w.buryat}—${w.gloss}`);
    expect(glossary).toEqual([
      '1:унеэн—корова',
      '1:хүбүүн—мальчик',
      '1:һолонго—хорек; радуга',
      '1:удэр—день',
      '1:хузүүн—шея',
      '1:хара—черный',
      '1:эдеэн—еда',
      '1:баян—богатый',
      '2:үнеэн—корова',
      '3:гэр—дом',
      '3:гар—рука',
      '3:хүн—человек',
      '3:һан—усилит. частица при глагол.',
      '4:хун—человек',
    ]);
    expect(r.words.some((w) => w.buryat === 'сай')).toBe(false); // урок 5 — вне MVP
  });

  it('находит минимальные пары в упражнениях урока 3 и во введении', () => {
    const r = parse();
    expect(r.pairs.map((p) => `${p.a}/${p.b}`)).toEqual(
      expect.arrayContaining(['гэр/гар', 'хүн/хун', 'ула/уула', 'ула/улаа', 'зан/заан', 'дара/даара', 'халуун/халюун', 'рроо/орёо']),
    );
    expect(r.pairs.find((p) => p.a === 'дара')?.aGloss).toBe('давить');
  });

  it('предложения импортируются без перевода, перечни слов — нет', () => {
    const r = parse();
    const texts = r.sentences.map((s) => s.buryat);
    expect(texts).toEqual(expect.arrayContaining(['Хара нохой.', 'Эжы үнеэгээ эдеэлүүлбэ.', 'Шэнэ гэр.']));
    expect(texts.some((t) => t.startsWith('Үнеэн, хүбүун'))).toBe(false);
    const proverb = r.sentences.find((s) => s.buryat.startsWith('Айл зайха'));
    expect(proverb?.tags).toContain('proverb');
    expect(proverb?.buryat).toBe('Айл зайха албатай, архи ууха ажалтай.');
  });

  it('собирает словоформы текстов урока для поиска опечаток', () => {
    expect(parse().readingTokens.get(1)?.has('үдэр')).toBe(true);
  });
});

describe('buildWords', () => {
  const build = () => buildWords(parse(), []).words;

  it('отмечает возможные опечатки, не исправляя их', () => {
    const words = build();
    const byText = (t: string) => words.find((w) => w.buryat === t)!;
    expect(byText('удэр').possible_typo).toBe(true);
    expect(byText('удэр').typo_candidates).toEqual(['үдэр (текст урока)']);
    expect(byText('хузүүн').possible_typo).toBe(true);
    expect(byText('унеэн').possible_typo).toBe(true);
    expect(byText('хун').possible_typo).toBe(true);
    expect(byText('хүн').possible_typo).toBe(false);
    expect(byText('үнеэн').possible_typo).toBe(false);
  });

  it('делит перевод на основной и альтернативы и ставит needs_review', () => {
    const words = build();
    const holongo = words.find((w) => w.buryat === 'һолонго')!;
    expect(holongo.russian).toBe('хорек');
    expect(holongo.alternatives).toEqual(['радуга']);
    expect(words.find((w) => w.buryat === 'һан')!.review_reasons).toContain('помета в переводе');
    expect(words.find((w) => w.buryat === 'эдеэн')!.review_reasons).toContain('две пары в одной строке книги');
    expect(words.every((w) => !w.verified)).toBe(true);
  });

  it('повторный импорт сохраняет правки ревьюера и id', () => {
    const first = build();
    const edited = first.map((w) => (w.buryat === 'удэр' ? { ...w, buryat: 'үдэр', verified: true, comment: 'носитель' } : w));
    const second = buildWords(parse(), edited).words;
    const w = second.find((x) => x.origin.buryat === 'удэр')!;
    expect(w).toMatchObject({ buryat: 'үдэр', verified: true, comment: 'носитель', id: 'uder' });
    expect(second).toHaveLength(first.length);
  });

  it('id стабильны и уникальны (хун/хүн не сливаются)', () => {
    const ids = build().map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['khuen', 'khun', 'unyeen', 'uenyeen']));
  });
});

describe('buildPairs', () => {
  it('годна только пара с переводами обеих сторон и без служебных слов', () => {
    const parsed = parse();
    const { words } = buildWords(parsed, []);
    const pairs = buildPairs(parsed.pairs, words, []);
    const get = (a: string, b: string) => pairs.find((p) => p.a_text === a && p.b_text === b)!;
    expect(get('гэр', 'гар').usable).toBe(true);
    expect(get('зан', 'заан').usable).toBe(true);
    expect(get('халуун', 'халюун')).toMatchObject({ usable: true, contrast: 'soft' });
    expect(get('рроо', 'орёо').usable).toBe(false);
    expect(get('хүн', 'хун').usable).toBe(false);
  });
});

describe('вспомогательные правила', () => {
  it('parseGlossaryLine', () => {
    expect(parseGlossaryLine('гахай –свинья')).toEqual([{ buryat: 'гахай', gloss: 'свинья' }]);
    expect(parseGlossaryLine('просто текст')).toBeNull();
  });
  it('splitGloss не режет внутри скобок', () => {
    expect(splitGloss('содержание (на иждивении, уходе), поддержка')).toEqual(['содержание (на иждивении, уходе)', 'поддержка']);
  });
  it('splitSentences / isWordList / looksRussian', () => {
    expect(splitSentences('Хара нохой. Һонин ном.')).toEqual(['Хара нохой.', 'Һонин ном.']);
    expect(isWordList('һаалишан, һаалта, һаба, модон һаба, һабар')).toBe(true);
    expect(isWordList('Хүн бүхэн түрэһэн эхэтэй, турэлхи хэлэтэй.')).toBe(false);
    expect(looksRussian('Вспомните слова на букву "өө"')).toBe(true);
    expect(looksRussian('Манай нютагта ехэ нуур бии.')).toBe(false);
  });
  it('classifyContrast', () => {
    expect(classifyContrast('зан', 'заан')).toBe('length');
    expect(classifyContrast('гэр', 'гар')).toBe('quality');
    expect(classifyContrast('харуу', 'харюу')).toBe('soft');
  });
});
