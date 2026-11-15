// Что носителю проверить первым: короткий список по убыванию риска.
//
//   npm run review:priority   → content/review/priority.csv
//
// Порядок: машинный перевод → реплики диалогов → записи с низким сходством при проверке →
// черновые переводы предложений → подозрения на опечатку. Правки вносятся через общий units.csv.

import fs from 'node:fs';
import path from 'node:path';

import { contentPath, readCourse, readSentences, readWords } from './lib/content-io';
import { parseCsv, toCsv } from './lib/csv';

type Row = { rank: string; reason: string; id: string; buryat: string; russian: string; where: string };

function main() {
  const used = new Set(readCourse().units.flatMap((u) => u.lessons.flatMap((l) => [...l.wordIds, ...l.sentenceIds])));
  const words = readWords().filter((w) => !w.excluded && !w.verified);
  const rows: Row[] = [];
  const seen = new Set<string>();
  const add = (rank: number, reason: string, id: string, buryat: string, russian: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    rows.push({ rank: String(rank), reason, id, buryat, russian, where: used.has(id) ? 'в уроках' : 'только в словаре' });
  };

  for (const w of words) if (w.source.book === 'translator') add(1, 'машинный перевод', w.id, w.buryat, w.russian);
  for (const w of words) if (w.tags.includes('route') || w.tags.includes('phrase')) add(2, 'реплика диалога', w.id, w.buryat, w.russian);

  const clipsFile = contentPath('templates/audio-clips.csv');
  if (fs.existsSync(clipsFile)) {
    const byId = new Map(words.map((w) => [w.id, w]));
    for (const r of parseCsv(fs.readFileSync(clipsFile, 'utf8'))) {
      const w = byId.get(r.id);
      const score = Number(/сходство ([\d.]+)/.exec(r.comment)?.[1] ?? 1);
      if (w && r.status !== 'skip' && score < 0.8) add(3, `запись: послушать, то ли слово (сходство ${score})`, w.id, w.buryat, w.russian);
    }
  }

  for (const s of readSentences()) if (!s.excluded && !s.verified && s.translation && s.comment.includes('перевод — черновик')) add(4, 'черновой перевод предложения', s.id, s.buryat, s.translation);
  for (const w of words) if (w.possible_typo) add(5, `возможна опечатка: ${w.typo_candidates.join(', ')}`, w.id, w.buryat, w.russian);

  // Внутри уровня — сначала то, что видят в уроках.
  rows.sort((a, b) => Number(a.rank) - Number(b.rank) || (a.where === b.where ? 0 : a.where === 'в уроках' ? -1 : 1));
  const out = path.join(contentPath('review'), 'priority.csv');
  fs.writeFileSync(out, '﻿' + toCsv(['rank', 'reason', 'id', 'buryat', 'russian', 'where'], rows));
  const counts = [1, 2, 3, 4, 5].map((r) => rows.filter((x) => x.rank === String(r)).length);
  console.log(`priority.csv: ${rows.length} строк (по уровням: ${counts.join(' / ')})`);
}

main();
