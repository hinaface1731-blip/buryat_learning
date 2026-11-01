// Импорт разговорного маршрута из content/templates/dialogue-route.csv.
// Реплики добавляются в words.json (правки из CSV сверки сохраняются), сцены — в dialogues.json.
//
//   npm run import:dialogues

import fs from 'node:fs';

import { contentPath, readLetters, readPairs, readSentences, readWords, writeJson } from './lib/content-io';
import { buildCourse } from './lib/course-builder';
import { parseCsv } from './lib/csv';
import { buildRoute, buildThematicScenes } from './lib/dialogue-route';

function main() {
  // Строка «урока» содержит title и scene только в первой реплике — остальные наследуют.
  const rows = parseCsv(fs.readFileSync(contentPath('templates/dialogue-route.csv'), 'utf8'));
  const route = buildRoute(rows, readWords());
  const thematicRows = parseCsv(fs.readFileSync(contentPath('templates/thematic-scenes.csv'), 'utf8'));
  const thematic = buildThematicScenes(thematicRows, route.words);
  const errors = [...route.errors, ...thematic.errors];
  if (errors.length) {
    errors.forEach((e) => console.error(e));
    process.exit(1);
  }
  const { words, scenes } = thematic;
  const routeMeta = route.lessons.map(({ n, title, skill, wordIds, dialogue }) => ({ n, title, skill, wordIds, dialogueId: dialogue.id }));
  writeJson('words.json', words);
  writeJson('dialogues.json', [...route.lessons.map((l) => l.dialogue), ...thematic.dialogues]);
  writeJson('route.json', routeMeta);
  writeJson('thematic-scenes.json', scenes);
  writeJson('course.json', buildCourse({ words, pairs: readPairs(), sentences: readSentences(), letters: readLetters(), route: routeMeta, scenes }));
  console.log(`Уроков маршрута: ${route.lessons.length}, сцен в главах: ${thematic.dialogues.length}, новых реплик: ${route.added + thematic.added}`);
}

main();
