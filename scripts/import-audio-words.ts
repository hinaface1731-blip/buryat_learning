// Слова аудиоуроков: content/templates/audio-words.csv → words.json, audio-clips.csv, course.json.
//
//   npm run import:audio-words   затем   npm run audio:cut

import fs from 'node:fs';

import { contentPath, readJson, readLetters, readPairs, readSentences, readWords, writeJson } from './lib/content-io';
import { importAudioWords } from './lib/audio-words';
import { buildCourse, type RouteMeta } from './lib/course-builder';
import { parseCsv, toCsv } from './lib/csv';
import type { ThematicScenes } from './lib/dialogue-route';

const CLIPS = contentPath('templates/audio-clips.csv');
const CLIP_HEADER = ['id', 'file', 'start', 'end', 'status', 'comment'];

function main() {
  const rows = parseCsv(fs.readFileSync(contentPath('templates/audio-words.csv'), 'utf8'));
  const { words, clips, added, reused, errors } = importAudioWords(rows, readWords());
  if (errors.length) {
    errors.forEach((e) => console.error(e));
    process.exit(1);
  }
  // Клип, уже проверенный раньше, не перезаписываем: у слова одна запись. Отбракованный заменяем новым.
  const all = parseCsv(fs.readFileSync(CLIPS, 'utf8'));
  const known = new Set(all.filter((r) => r.status !== 'skip').map((r) => r.id));
  const fresh = clips.filter((c) => !known.has(c.id) && (known.add(c.id), true));
  const replaced = new Set(fresh.map((c) => c.id));
  const old = all.filter((r) => !replaced.has(r.id));
  fs.writeFileSync(CLIPS, toCsv(CLIP_HEADER, [...old, ...fresh]));
  writeJson('words.json', words);
  const route = readJson('route.json') as RouteMeta[];
  const scenes = readJson('thematic-scenes.json') as ThematicScenes;
  writeJson('course.json', buildCourse({ words, pairs: readPairs(), sentences: readSentences(), letters: readLetters(), route, scenes }));
  console.log(`Слов аудиокурса: ${clips.length} (новых ${added}, уже были в курсе ${reused}), новых клипов: ${fresh.length}`);
}

main();
