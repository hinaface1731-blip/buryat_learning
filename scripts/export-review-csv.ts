// Выгрузка всех единиц курса в CSV для сверки (вами или носителем).
//
//   npm run review:export            → content/review/units.csv
//
// Редактируемые колонки: buryat, russian, alternatives (через « | »), form (lemma/form),
// translation (для предложений), excluded, verified, comment. Остальные — справочные.

import fs from 'node:fs';
import path from 'node:path';

import { contentPath, readLetters, readSentences, readWords } from './lib/content-io';
import { LIST_SEP, toCsv } from './lib/csv';

export const REVIEW_HEADER = [
  'id',
  'kind',
  'buryat',
  'russian',
  'alternatives',
  'form',
  'translation',
  'lesson',
  'page',
  'book_text',
  'tags',
  'needs_review',
  'review_reasons',
  'possible_typo',
  'typo_candidates',
  'excluded',
  'verified',
  'comment',
];

const yesNo = (b: boolean) => (b ? 'да' : 'нет');

function main() {
  const rows: Record<string, string>[] = [];
  for (const w of readWords()) {
    rows.push({
      id: w.id,
      kind: 'word',
      buryat: w.buryat,
      russian: w.russian,
      alternatives: w.alternatives.join(LIST_SEP),
      form: w.form ?? '',
      lesson: w.source.lesson?.toString() ?? w.source.section ?? '',
      page: w.source.page?.toString() ?? '',
      book_text: `${w.origin.buryat} — ${w.origin.russian}`,
      tags: w.tags.join(LIST_SEP),
      needs_review: yesNo(w.needs_review),
      review_reasons: w.review_reasons.join(LIST_SEP),
      possible_typo: yesNo(w.possible_typo),
      typo_candidates: w.typo_candidates.join(LIST_SEP),
      excluded: yesNo(w.excluded),
      verified: yesNo(w.verified),
      comment: w.comment,
    });
  }
  for (const s of readSentences()) {
    rows.push({
      id: s.id,
      kind: 'sentence',
      buryat: s.buryat,
      translation: s.translation ?? '',
      lesson: s.source.lesson?.toString() ?? '',
      page: s.source.page?.toString() ?? '',
      book_text: `${s.origin} (${s.source.section ?? ''})`,
      tags: s.tags.join(LIST_SEP),
      needs_review: yesNo(s.translation === null),
      excluded: yesNo(s.excluded),
      verified: yesNo(s.verified),
      comment: s.comment,
    });
  }
  for (const l of readLetters()) {
    rows.push({
      id: l.id,
      kind: 'letter',
      buryat: [l.upper, l.lower].filter(Boolean).join(' '),
      russian: l.name,
      page: l.source.page?.toString() ?? '',
      needs_review: yesNo(l.needs_image_check),
      review_reasons: l.needs_image_check ? 'сверить с картинкой стр. 1' : '',
      verified: yesNo(l.verified),
    });
  }
  const out = contentPath(path.join('review', 'units.csv'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, toCsv(REVIEW_HEADER, rows));
  console.log(`Записано ${rows.length} строк: ${path.relative(process.cwd(), out)}`);
}

if (require.main === module) main();
