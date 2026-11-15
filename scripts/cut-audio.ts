// Нарезает записи слов из длинных аудиоуроков по content/templates/audio-clips.csv,
// чистит шум и выравнивает громкость, кладёт assets/audio/{id}.m4a и пересобирает индекс.
// Нужен ffmpeg в PATH. Исходники assets/audio/urok-*.mp3 в git не попадают.
//
//   npm run audio:cut              — нарезать всё, что ещё не нарезано
//   npm run audio:cut -- --force   — нарезать заново (после правки времени в CSV)

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { readWords, ROOT } from './lib/content-io';
import { parseCsv } from './lib/csv';

const AUDIO_DIR = path.join(ROOT, 'assets', 'audio');
const CSV = path.join(ROOT, 'content', 'templates', 'audio-clips.csv');

// Запас по краям: распознавание режет впритык и съедает начало и конец слова.
const PAD_BEFORE = 0.12;
const PAD_AFTER = 0.2;

// Срез низкого гула и подавление шума — на фрагменте с «разгоном» (lead секунд до него,
// чтобы шумоподавитель успел оценить фон), затем обрезка, ровная громкость и мягкие края без щелчков.
function filters(lead: number, duration: number): string {
  return [
    'highpass=f=80',
    'afftdn=nr=12:nf=-40:tn=1',
    `atrim=start=${lead.toFixed(3)}`,
    'asetpts=PTS-STARTPTS',
    'loudnorm=I=-18:TP=-2:LRA=7',
    'afade=t=in:d=0.03',
    `afade=t=out:st=${Math.max(0, duration - 0.06).toFixed(3)}:d=0.06`,
  ].join(',');
}

function main() {
  const force = process.argv.includes('--force');
  const known = new Set(readWords().map((w) => w.id));
  const all = parseCsv(fs.readFileSync(CSV, 'utf8'));
  // Отбракованный клип не должен остаться в индексе от прошлой нарезки.
  for (const r of all) if (r.status === 'skip') fs.rmSync(path.join(AUDIO_DIR, `${r.id}.m4a`), { force: true });
  const rows = all.filter((r) => r.status !== 'skip');
  let cut = 0;
  const problems: string[] = [];
  for (const r of rows) {
    if (!known.has(r.id)) problems.push(`${r.id}: нет такого слова`);
    const src = path.join(AUDIO_DIR, r.file);
    const dst = path.join(AUDIO_DIR, `${r.id}.m4a`);
    if (!fs.existsSync(src)) {
      problems.push(`${r.id}: нет исходника ${r.file}`);
      continue;
    }
    if (fs.existsSync(dst) && !force) continue;
    const start = Math.max(0, Number(r.start) - PAD_BEFORE);
    const duration = Number(r.end) + PAD_AFTER - start;
    if (!(duration > 0.2 && duration < 8)) {
      problems.push(`${r.id}: странная длина ${duration.toFixed(2)} с`);
      continue;
    }
    const lead = Math.min(1, start);
    execFileSync('ffmpeg', [
      ...['-v', 'error', '-y', '-ss', (start - lead).toFixed(3), '-t', (duration + lead).toFixed(3), '-i', src],
      ...['-af', filters(lead, duration), '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '64k', dst],
    ]);
    cut++;
  }
  console.log(`Нарезано: ${cut}, всего в списке: ${rows.length}`);
  if (problems.length) console.log(`Проблемы:\n  ${problems.join('\n  ')}`);
  execFileSync('npx', ['tsx', path.join(ROOT, 'scripts', 'build-audio-index.ts')], { stdio: 'inherit', shell: true });
}

main();
