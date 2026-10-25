// Генерирует src/audio/audioIndex.ts со статическими require для assets/audio/{id}.m4a.
// Metro не умеет динамический require, поэтому индекс нужно пересобирать после добавления записей.
//
//   npm run audio:index

import fs from 'node:fs';
import path from 'node:path';

import { readWords, ROOT } from './lib/content-io';

const AUDIO_DIR = path.join(ROOT, 'assets', 'audio');
const OUT = path.join(ROOT, 'src', 'audio', 'audioIndex.ts');

function main() {
  const files = fs.readdirSync(AUDIO_DIR).filter((f) => f.endsWith('.m4a')).sort();
  const known = new Set(readWords().map((w) => w.id));
  const unknown = files.filter((f) => !known.has(f.replace(/\.m4a$/, '')));
  const lines = files.map((f) => `  ${JSON.stringify(f.replace(/\.m4a$/, ''))}: require('../../assets/audio/${f}'),`);
  const src = `// Сгенерировано scripts/build-audio-index.ts — не редактировать вручную.
// Записи носителя: assets/audio/{id слова}.m4a, затем \`npm run audio:index\`.

export const audioIndex: Record<string, number> = {
${lines.join('\n')}
};
`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, src);
  console.log(`Аудиофайлов в индексе: ${files.length}`);
  if (unknown.length) console.log(`Внимание: нет слова с таким id: ${unknown.join(', ')}`);
}

main();
