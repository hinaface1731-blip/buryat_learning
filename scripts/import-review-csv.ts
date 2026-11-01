// Обратная загрузка CSV после сверки.
//
//   npm run review:import                          показать изменения из content/review/units.csv
//   npm run review:import -- --apply               применить
//   npm run review:import -- --file путь.csv --apply
//   npm run review:import -- --thematic --apply    слова носителя из content/templates/thematic-words.csv
//
// После применения курс пересобирается: подтверждённые слова попадают в уроки,
// исключённые — уходят из них.

import fs from 'node:fs';
import path from 'node:path';

import { contentPath, readLetters, readPairs, readSentences, readWords, writeJson } from './lib/content-io';
import { buildCourse, type RouteMeta } from './lib/course-builder';
import type { ThematicScenes } from './lib/dialogue-route';
import { parseCsv } from './lib/csv';
import { applyReviewRows, applyThematicRows } from './lib/review-merge';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main() {
  const apply = process.argv.includes('--apply');
  const thematic = process.argv.includes('--thematic');
  const file = arg('--file') ?? contentPath(thematic ? 'templates/thematic-words.csv' : 'review/units.csv');
  if (!fs.existsSync(file)) {
    console.error(`Нет файла ${file}`);
    process.exit(1);
  }
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  let words = readWords();
  let sentences = readSentences();
  let letters = readLetters();
  let errors: string[];

  if (thematic) {
    const r = applyThematicRows(words, rows);
    words = r.words;
    errors = r.errors;
    console.log(`Новых слов от носителя: ${r.added.length}`);
    r.added.forEach((w) => console.log(`  + ${w.id}: ${w.buryat} — ${w.russian} [${w.tags.join(', ')}]`));
  } else {
    const r = applyReviewRows({ words, sentences, letters }, rows);
    ({ words, sentences, letters, errors } = r);
    console.log(`Изменений: ${r.changes.length}`);
    for (const c of r.changes) console.log(`  ${c.id}.${c.field}: «${c.from}» → «${c.to}»`);
  }
  if (errors.length) {
    console.log(`\nОшибки (эти строки не применены):`);
    errors.forEach((e) => console.log(`  ${e}`));
  }
  if (!apply) {
    console.log(`\nЭто предпросмотр. Чтобы записать: npm run review:import -- ${thematic ? '--thematic ' : ''}--apply`);
    return;
  }
  writeJson('words.json', words);
  writeJson('sentences.json', sentences);
  writeJson('alphabet.json', letters);
  const route: RouteMeta[] = JSON.parse(fs.readFileSync(contentPath('route.json'), 'utf8'));
  const scenes: ThematicScenes = JSON.parse(fs.readFileSync(contentPath('thematic-scenes.json'), 'utf8'));
  writeJson('course.json', buildCourse({ words, sentences, letters, pairs: readPairs(), route, scenes }));
  console.log(`\nЗаписано (${path.relative(process.cwd(), file)}). Курс пересобран.`);
}

main();
