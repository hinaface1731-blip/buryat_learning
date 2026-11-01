// Отчёт о состоянии контента. Падает (exit 1), если контент не проходит схемы или есть битые ссылки.
//
//   npm run validate:content

import fs from 'node:fs';
import path from 'node:path';

import { buildContent } from '../src/content/load';

import { contentPath, ROOT } from './lib/content-io';
import { isTeachable } from './lib/course-builder';

const read = (f: string) => JSON.parse(fs.readFileSync(contentPath(f), 'utf8'));

function main() {
  let c;
  try {
    c = buildContent({
      course: read('course.json'),
      words: read('words.json'),
      sentences: read('sentences.json'),
      minimalPairs: read('minimal-pairs.json'),
      letters: read('alphabet.json'),
      notes: read('notes.json'),
      vowelRows: read('vowel-rows.json'),
      dialogues: read('dialogues.json'),
    });
  } catch (e) {
    console.error('Контент не проходит проверку:\n', e instanceof Error ? e.message : e);
    process.exit(1);
  }
  const audioDir = path.join(ROOT, 'assets', 'audio');
  const audio = new Set(fs.readdirSync(audioDir).filter((f) => f.endsWith('.m4a')).map((f) => f.replace(/\.m4a$/, '')));
  const inCourse = new Set(c.course.units.flatMap((u) => u.lessons.flatMap((l) => l.wordIds)));

  const w = c.words;
  const pct = (n: number) => `${n} (${Math.round((n / Math.max(1, w.length)) * 100)}%)`;
  const rows: [string, string | number][] = [
    ['Слов всего', w.length],
    ['  в уроках', inCourse.size],
    ['  не верифицировано', pct(w.filter((x) => !x.verified).length)],
    ['  needs_review', pct(w.filter((x) => x.needs_review).length)],
    ['  possible_typo', pct(w.filter((x) => x.possible_typo).length)],
    ['  исключено (dated/sensitive/вручную)', w.filter((x) => x.excluded).length],
    ['  не годятся для уроков до сверки', w.filter((x) => !x.excluded && !isTeachable(x)).length],
    ['  form не указан', w.filter((x) => x.form === null).length],
    ['  без аудио', pct(w.filter((x) => !audio.has(x.id)).length)],
    ['Предложений', c.sentences.length],
    ['  без перевода', c.sentences.filter((s) => s.translation === null).length],
    ['  не верифицировано', c.sentences.filter((s) => !s.verified).length],
    ['Минимальных пар', c.minimalPairs.length],
    ['  годных для упражнения', c.minimalPairs.filter((p) => p.usable).length],
    ['Букв алфавита', c.letters.length],
    ['  ждут сверки по картинке', c.letters.filter((l) => l.needs_image_check).length],
    ['Карточек «Что нужно знать»', c.notes.length],
    ['  не верифицировано', c.notes.filter((n) => !n.verified).length],
    ['Таблица гласных verified', c.vowelRows.verified ? 'да' : 'нет'],
    ['Юнитов', c.course.units.length],
    ['  закрытых (ждут слов носителя)', c.course.units.filter((u) => u.locked).length],
    ['Уроков', c.course.units.reduce((n, u) => n + u.lessons.length, 0)],
    ['Аудиофайлов', audio.size],
  ];
  const width = Math.max(...rows.map((r) => r[0].length));
  for (const [k, v] of rows) console.log(`${k.padEnd(width)}  ${v}`);
  const unknownAudio = [...audio].filter((id) => !c.wordById.has(id));
  if (unknownAudio.length) console.log(`\nАудио без слова в курсе: ${unknownAudio.join(', ')}`);
}

main();
