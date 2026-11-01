// Импорт разговорного маршрута из content/templates/dialogue-route.csv.
// Реплики добавляются в words.json (правки из CSV сверки сохраняются), сцены — в dialogues.json.
//
//   npm run import:dialogues

import fs from 'node:fs';

import { contentPath, readLetters, readPairs, readSentences, readWords, writeJson } from './lib/content-io';
import { buildCourse } from './lib/course-builder';
import { parseCsv } from './lib/csv';
import { buildRoute } from './lib/dialogue-route';

function main() {
  // Строка «урока» содержит title и scene только в первой реплике — остальные наследуют.
  const rows = parseCsv(fs.readFileSync(contentPath('templates/dialogue-route.csv'), 'utf8'));
  const { words, lessons, added, errors } = buildRoute(rows, readWords());
  if (errors.length) {
    errors.forEach((e) => console.error(e));
    process.exit(1);
  }
  const dialogues = lessons.map((l) => l.dialogue);
  const routeMeta = lessons.map(({ n, title, skill, wordIds, dialogue }) => ({ n, title, skill, wordIds, dialogueId: dialogue.id }));
  writeJson('words.json', words);
  writeJson('dialogues.json', dialogues);
  writeJson('route.json', routeMeta);
  writeJson('course.json', buildCourse({ words, pairs: readPairs(), sentences: readSentences(), letters: readLetters(), route: routeMeta }));
  console.log(`Уроков маршрута: ${lessons.length}, новых реплик: ${added}, реплик всего: ${words.filter((w) => w.tags.includes('route')).length}`);
}

main();
