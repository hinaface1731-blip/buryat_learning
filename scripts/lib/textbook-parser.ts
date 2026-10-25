import type { PageText } from './pdf-text';

// Детерминированный разбор текста «Учебника бурятского языка» (bxr-textbook.pdf).
// Ничего не исправляет: только раскладывает текст книги по структурам и отмечает
// сомнительные места. Решения о правке принимает человек через CSV.

export type RawWord = {
  buryat: string;
  gloss: string;
  rawLine: string;
  page: number;
  lesson?: number;
  section?: string;
  /** Строка «слово — перевод слово — перевод» разобрана на две пары. */
  splitLine?: boolean;
};

export type RawSentence = {
  buryat: string;
  page: number;
  lesson: number;
  /** «упр. 5», «текст «Намарай эхин»», «мин. пара «гэр — гар»». */
  block: string;
  blockKey: string;
  tags: string[];
};

export type RawPair = {
  a: string;
  b: string;
  aGloss?: string;
  bGloss?: string;
  page: number;
  lesson?: number;
  section: string;
  rawLine: string;
  /** Таблица «твёрдое — мягкое» (§8б): пара обязана различаться только мягкостью. */
  expectSoft?: boolean;
};

export type ParsedTextbook = {
  words: RawWord[];
  sentences: RawSentence[];
  pairs: RawPair[];
  /** Все бурятские словоформы из текстов упражнений урока — для поиска опечаток в глоссарии. */
  readingTokens: Map<number, Set<string>>;
  lessonTitles: Map<number, string>;
};

const LESSON_RE = /^(.+?)\s+хэшээл[.:]\s*(.+?урок)\.?\s*$/i;
const EXERCISE_RE = /^Упражнение\s*№?\s*(\d+)?/;
const WORDS_RE = /^Слова\s*:?\s*$/;
const GRAMMAR_RE = /^Грам+атика\s*:/;
const TASK_RE = /^Задание/;
// «слово — перевод»: длинное или короткое тире, пробел после тире может отсутствовать («гахай –свинья»).
const PAIR_LINE_RE = /^(.+?)\s+[—–]\s*(.+)$/;
const INTRO_SECTION_RE = /^(\d{1,2})\.\s+[А-ЯЁ]/;
const BURYAT_WORD = '[а-яёүөһ]+';
const INTRO_PAIR_RE = new RegExp(`(${BURYAT_WORD})\\s*\\(([^)]+)\\)\\s+и\\s+(${BURYAT_WORD})\\s*\\(([^)]+)\\)`, 'gi');
const INTRO_COLUMN_PAIR_RE = new RegExp(`^(${BURYAT_WORD})\\s*\\(([^)]+)\\);?\\s{3,}(${BURYAT_WORD})\\s*\\(([^)]+)\\);?\\s*$`, 'i');
const MIN_PAIR_LINE_RE = /^([^\s:—–-][^:—–]*?)\s*[—–-]\s*([^:]+?)\s*:\s*(.*)$/;

const RU_STOPWORDS = /(^|[\s"«(])(в|на|не|и|с|по|из|что|как|для|или|это|слова|слов|букв[уы]?|текст[а-я]*|гласн[а-я]+|выпишите|переведите|вспомните|прочитать|урок[а-я]*)(?=$|[\s.,:;!?»)"])/gi;

/** Строка на русском (инструкция, правило), а не бурятский текст. */
export function looksRussian(line: string): boolean {
  const hits = line.match(RU_STOPWORDS)?.length ?? 0;
  const hasBuryatLetters = /[үөһ]/i.test(line);
  return hits >= 2 || (hits >= 1 && !hasBuryatLetters);
}

function cleanLine(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim();
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Разбор строки глоссария. Две пары в одной строке («эдеэн — еда баян — богатый») делятся по последнему слову перед вторым тире. */
export function parseGlossaryLine(line: string): { buryat: string; gloss: string; splitLine?: boolean }[] | null {
  const parts = line.split(/\s+[—–]\s*/);
  if (parts.length < 2) return null;
  if (parts.length === 2) {
    const [buryat, gloss] = parts.map(cleanLine);
    if (!buryat || !gloss) return null;
    return [{ buryat, gloss }];
  }
  if (parts.length === 3) {
    const middle = parts[1].trim().split(/\s+/);
    if (middle.length < 2) return null;
    const secondBuryat = middle.pop()!;
    return [
      { buryat: cleanLine(parts[0]), gloss: middle.join(' '), splitLine: true },
      { buryat: secondBuryat, gloss: cleanLine(parts[2]), splitLine: true },
    ];
  }
  return null;
}

/** Абзац упражнения → отдельные предложения. */
export function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+(?=[А-ЯЁҮӨҺΓ"«—(])/)
    .map(cleanLine)
    .filter((s) => s.length > 0);
}

/** Перечень слов через запятую («һаалишан, һаалта, һаба, …»), а не связный текст. */
export function isWordList(paragraph: string): boolean {
  const body = paragraph.replace(/[.]\s*$/, '');
  if (/[.!?]/.test(body)) return false;
  const items = body.split(',').map((s) => s.trim());
  return items.length >= 4 && items.every((s) => s.split(/\s+/).length <= 3);
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[а-яёүөһ]+/g) ?? []).filter((t) => t.length > 1);
}

type Mode = 'none' | 'exercise' | 'words' | 'grammar' | 'task' | 'text';

export function parseTextbook(pages: PageText[], opts: { maxLesson: number; introLastPage: number }): ParsedTextbook {
  const words: RawWord[] = [];
  const sentences: RawSentence[] = [];
  const pairs: RawPair[] = [];
  const readingTokens = new Map<number, Set<string>>();
  const lessonTitles = new Map<number, string>();

  let lesson = 0; // 0 — введение
  let introSection: string | undefined;
  // `as Mode`: режим меняется внутри setMode, TS не должен сужать тип до 'none'.
  let mode = 'none' as Mode;
  /** Режим, в который вернуться после блока «Слова:» (упражнение может продолжаться: «2) на е. …»). */
  let contentMode = 'none' as Mode;
  let minimalPairExample = false;
  let exercise: number | undefined;
  let textTitle: string | undefined;
  let textCount = 0;
  let awaitingTopic = false;
  let paragraph: { lines: string[]; page: number } | null = null;
  const introText: { text: string; page: number; section?: string }[] = [];
  let done = false;

  const blockInfo = (): { block: string; blockKey: string } =>
    mode === 'text' && textTitle
      ? { block: `текст «${textTitle}»`, blockKey: `t${textCount}` }
      : { block: `упр. ${exercise ?? '?'}`, blockKey: `e${exercise ?? 0}` };

  const flushParagraph = () => {
    if (!paragraph || lesson === 0) {
      paragraph = null;
      return;
    }
    const text = cleanLine(paragraph.lines.join(' ').replace(/-\s+(?=[а-яёүөһ])/g, ''));
    const page = paragraph.page;
    paragraph = null;
    if (!text) return;
    const tokens = readingTokens.get(lesson) ?? new Set<string>();
    readingTokens.set(lesson, tokens);
    tokenize(text).forEach((t) => tokens.add(t));
    if (isWordList(text)) return;
    const { block, blockKey } = blockInfo();
    for (let s of splitSentences(text)) {
      s = s.replace(/^\d\)\s*на\s+\S+?[.:]\s*/i, '');
      const tags: string[] = [];
      if (/\((посл\.?|оньһон үгэ)\)/i.test(s)) {
        tags.push('proverb');
        s = cleanLine(s.replace(/\((посл\.?|оньһон үгэ)\)/gi, ''));
      }
      if (mode === 'text') tags.push('text');
      if (minimalPairExample) tags.push('minimal-pair-example');
      if (!s || looksRussian(s) || !/[а-яёүөһ]/i.test(s)) continue;
      sentences.push({ buryat: s, page, lesson, block, blockKey, tags });
    }
  };

  const setMode = (m: Mode) => {
    flushParagraph();
    mode = m;
    if (m === 'exercise' || m === 'text' || m === 'none') contentMode = m;
  };

  for (const { page, lines } of pages) {
    if (done) break;
    for (const rawLine of lines) {
      const line = cleanLine(rawLine);
      if (!line || /^\d+$/.test(line)) continue;

      const lessonMatch = line.match(LESSON_RE);
      if (lessonMatch) {
        setMode('none');
        lesson += 1;
        if (lesson > opts.maxLesson) {
          done = true;
          break;
        }
        exercise = undefined;
        textTitle = undefined;
        awaitingTopic = true;
        continue;
      }

      if (lesson === 0) {
        if (page > opts.introLastPage) continue;
        const sec = line.match(INTRO_SECTION_RE);
        if (sec && line.length < 90) introSection = `§${sec[1]}`;
        const col = rawLine.trim().match(INTRO_COLUMN_PAIR_RE);
        if (col) {
          pairs.push({ a: col[1], aGloss: col[2], b: col[3], bGloss: col[4], page, section: introSection ?? '', rawLine: line, expectSoft: true });
          continue;
        }
        introText.push({ text: rawLine, page, section: introSection });
        continue;
      }

      if (awaitingTopic) {
        awaitingTopic = false;
        if (!EXERCISE_RE.test(line) && !GRAMMAR_RE.test(line)) {
          lessonTitles.set(lesson, line);
          continue;
        }
      }

      const ex = line.match(EXERCISE_RE);
      if (ex) {
        setMode('exercise');
        exercise = ex[1] ? Number(ex[1]) : (exercise ?? 0) + 1;
        textTitle = undefined;
        continue;
      }
      if (WORDS_RE.test(line)) {
        setMode('words');
        continue;
      }
      if (GRAMMAR_RE.test(line)) {
        setMode('grammar');
        continue;
      }
      if (TASK_RE.test(line)) {
        setMode('task');
        continue;
      }

      if (mode === 'words') {
        const parsed = PAIR_LINE_RE.test(line) ? parseGlossaryLine(line) : null;
        if (parsed) {
          for (const p of parsed) words.push({ ...p, rawLine: line, page, lesson });
          continue;
        }
        mode = contentMode;
      }

      // Заголовок текста для чтения: короткая строка с заглавной буквы без точки и тире.
      if (line.length < 40 && /^[А-ЯЁҮӨҺ]/.test(line) && !/[.—–:!?]/.test(line) && !looksRussian(line)) {
        setMode('text');
        textTitle = line;
        textCount += 1;
        continue;
      }

      if (mode === 'grammar' || mode === 'task') continue;

      if (mode === 'exercise' && lesson === 3) {
        const mp = line.match(MIN_PAIR_LINE_RE);
        if (mp && mp[1].split(/\s+/).length <= 2 && mp[2].split(/\s+/).length <= 2) {
          flushParagraph();
          const a = lowerFirst(cleanLine(mp[1]));
          const b = lowerFirst(cleanLine(mp[2]));
          pairs.push({ a, b, page, lesson, section: `упр. ${exercise}`, rawLine: line });
          paragraph = { lines: [mp[3]], page };
          const tokens = readingTokens.get(lesson) ?? new Set<string>();
          readingTokens.set(lesson, tokens);
          tokenize(`${a} ${b}`).forEach((t) => tokens.add(t));
          minimalPairExample = true;
          flushParagraph();
          minimalPairExample = false;
          continue;
        }
      }

      if (mode === 'exercise' || mode === 'text') {
        if (!paragraph) paragraph = { lines: [], page };
        paragraph.lines.push(line);
      }
    }
  }
  flushParagraph();

  // Минимальные пары «ула (подошва) и уула (гора)» в §7–8 введения.
  const bySection = new Map<string, { text: string; page: number }>();
  for (const t of introText) {
    if (!t.section) continue;
    const cur = bySection.get(t.section);
    if (cur) cur.text += ' ' + t.text;
    else bySection.set(t.section, { text: t.text, page: t.page });
  }
  for (const section of ['§7', '§8']) {
    const entry = bySection.get(section);
    if (!entry) continue;
    const text = cleanLine(entry.text);
    for (const m of text.matchAll(INTRO_PAIR_RE)) {
      // Страница: ищем, на какой странице начинается фрагмент.
      const pageOf = introText.find((t) => t.section === section && cleanLine(t.text).includes(m[1]))?.page ?? entry.page;
      pairs.push({ a: m[1], aGloss: m[2], b: m[3], bGloss: m[4], page: pageOf, section, rawLine: m[0] });
    }
  }
  // Слова с переводом из пар введения — тоже единицы курса.
  for (const p of pairs) {
    if (p.lesson !== undefined) continue;
    if (p.aGloss) words.push({ buryat: p.a, gloss: p.aGloss, rawLine: p.rawLine, page: p.page, section: p.section });
    if (p.bGloss) words.push({ buryat: p.b, gloss: p.bGloss, rawLine: p.rawLine, page: p.page, section: p.section });
  }

  return { words, sentences, pairs, readingTokens, lessonTitles };
}
