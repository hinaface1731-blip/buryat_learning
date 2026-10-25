// Список слов для записи носителем, по приоритету: Ү, Ө, Һ → долгие гласные → минимальные пары.
//
//   npm run audio:checklist   → content/review/audio-checklist.csv

import fs from 'node:fs';
import path from 'node:path';

import { contentPath, readCourse, readPairs, readWords, ROOT } from './lib/content-io';
import { toCsv } from './lib/csv';

const LONG_RE = /аа|оо|уу|ээ|ии|үү|өө|яа|ёо|еэ|юу|ы/;

function main() {
  const words = readWords();
  const inCourse = new Set(readCourse().units.flatMap((u) => u.lessons.flatMap((l) => l.wordIds)));
  const inPairs = new Set(readPairs().filter((p) => p.usable).flatMap((p) => [p.a, p.b]).filter(Boolean) as string[]);
  const audioDir = path.join(ROOT, 'assets', 'audio');
  const recorded = new Set(fs.readdirSync(audioDir).filter((f) => f.endsWith('.m4a')).map((f) => f.replace(/\.m4a$/, '')));

  const rows = words
    .filter((w) => inCourse.has(w.id) || inPairs.has(w.id))
    .map((w) => {
      const reasons: string[] = [];
      let priority = 0;
      const b = w.buryat.toLowerCase();
      for (const [ch, label] of [['ү', 'Ү'], ['ө', 'Ө'], ['һ', 'Һ']] as const) {
        if (b.includes(ch)) {
          priority += 3;
          reasons.push(label);
        }
      }
      if (LONG_RE.test(b)) {
        priority += 2;
        reasons.push('долгий гласный');
      }
      if (inPairs.has(w.id)) {
        priority += 3;
        reasons.push('минимальная пара');
      }
      return { w, priority, reasons };
    })
    .sort((a, b) => b.priority - a.priority || a.w.buryat.localeCompare(b.w.buryat, 'ru'));

  const out = contentPath(path.join('review', 'audio-checklist.csv'));
  fs.writeFileSync(
    out,
    toCsv(
      ['id', 'buryat', 'russian', 'file', 'priority', 'reason', 'recorded', 'verified'],
      rows.map(({ w, priority, reasons }) => ({
        id: w.id,
        buryat: w.buryat,
        russian: w.russian,
        file: `assets/audio/${w.id}.m4a`,
        priority: String(priority),
        reason: reasons.join(', '),
        recorded: recorded.has(w.id) ? 'да' : 'нет',
        verified: w.verified ? 'да' : 'нет',
      })),
    ),
  );
  console.log(`Слов к записи: ${rows.length} (уже записано ${rows.filter((r) => recorded.has(r.w.id)).length}): ${path.relative(process.cwd(), out)}`);
}

main();
