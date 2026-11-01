// Импорт «Учебника бурятского языка» (content/sources/bxr-textbook.pdf) в JSON курса.
// Детерминированный: одинаковый PDF и одинаковый words.json дают одинаковый результат.
// Повторный запуск не трогает правки ревьюера (сливается по исходной строке книги).
//
//   npm run import:textbook

import fs from 'node:fs';
import path from 'node:path';

import { buildPairs, buildSentences, buildWords } from './lib/build-content';
import { contentPath, readLetters, readPairs, readSentences, readWords, SOURCES, writeJson } from './lib/content-io';
import { buildCourse, type RouteMeta } from './lib/course-builder';
import { loadPdfText } from './lib/pdf-text';
import { parseTextbook } from './lib/textbook-parser';

const PDF = path.join(SOURCES, 'bxr-textbook.pdf');
// MVP: уроки 1–4 и введение (стр. 1–8; пары берутся из §7–8).
const MAX_LESSON = 4;
const INTRO_LAST_PAGE = 8;

async function main() {
  if (!fs.existsSync(PDF)) {
    console.error(`Нет файла ${PDF}. Положите учебник в content/sources/ (см. content/SOURCES.md).`);
    process.exit(1);
  }
  const pages = await loadPdfText(PDF, path.join(SOURCES, '.extracted'));
  const parsed = parseTextbook(pages, { maxLesson: MAX_LESSON, introLastPage: INTRO_LAST_PAGE });

  const { words, added, orphans } = buildWords(parsed, readWords());
  const sentences = buildSentences(parsed, readSentences());
  const pairs = buildPairs(parsed.pairs, words, readPairs());
  const route: RouteMeta[] = JSON.parse(fs.readFileSync(contentPath('route.json'), 'utf8'));
  const course = buildCourse({ words, pairs, sentences, letters: readLetters(), route });

  writeJson('words.json', words);
  writeJson('sentences.json', sentences);
  writeJson('minimal-pairs.json', pairs);
  writeJson('course.json', course);

  const count = (pred: (w: (typeof words)[number]) => boolean) => words.filter(pred).length;
  console.log(`Строк глоссария в книге: ${parsed.words.length}`);
  console.log(`Слов: ${words.length} (новых ${added}); needs_review ${count((w) => w.needs_review)}, possible_typo ${count((w) => w.possible_typo)}, excluded ${count((w) => w.excluded)}`);
  console.log(`Предложений: ${sentences.length} (без перевода ${sentences.filter((s) => s.translation === null).length})`);
  console.log(`Минимальных пар: ${pairs.length} (годных ${pairs.filter((p) => p.usable).length})`);
  console.log(`Юнитов: ${course.units.length}, уроков: ${course.units.reduce((n, u) => n + u.lessons.length, 0)}`);
  if (orphans.length) console.log(`Не найдены в книге при этом импорте (оставлены как есть): ${orphans.join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
