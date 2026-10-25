import type { VowelRowId, VowelRows } from '@/content/schema';

// Подсказка ряда гласных для categorize по таблице учебника (стр. 5) и правилу урока 5:
// ряд слова определяется первым однозначным гласным. Буквы, которые источник относит
// к разным рядам (vowelRows.ambiguous), ряд не определяют. Результат — непроверенная
// автоподсказка: в интерфейсе она помечается как verified:false.

const VOWEL_LETTERS = new Set('аоуяеёюэүөиы');

type Grapheme = { text: string; row: VowelRowId | 'ambiguous' };

function graphemeTable(rows: VowelRows): Map<string, VowelRowId | 'ambiguous'> {
  const table = new Map<string, VowelRowId | 'ambiguous'>();
  for (const row of rows.rows) {
    for (const g of [...row.short, ...row.long, ...row.diphthongs]) {
      const prev = table.get(g);
      table.set(g, prev && prev !== row.id ? 'ambiguous' : row.id);
    }
  }
  for (const g of rows.ambiguous) table.set(g, 'ambiguous');
  return table;
}

export function vowelGraphemes(word: string, rows: VowelRows): Grapheme[] {
  const table = graphemeTable(rows);
  const maxLen = Math.max(...[...table.keys()].map((k) => k.length));
  const s = word.toLowerCase();
  const out: Grapheme[] = [];
  let i = 0;
  while (i < s.length) {
    if (!VOWEL_LETTERS.has(s[i])) {
      i++;
      continue;
    }
    let matched = false;
    for (let len = maxLen; len >= 1; len--) {
      const g = s.slice(i, i + len);
      const row = table.get(g);
      if (row) {
        out.push({ text: g, row });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out.push({ text: s[i], row: 'ambiguous' });
      i++;
    }
  }
  return out;
}

/** back / front / neutral или null, если по таблице ряд определить нельзя. */
export function vowelRowOf(word: string, rows: VowelRows): VowelRowId | null {
  if (word.includes(' ')) return null; // словосочетания не классифицируем
  const gs = vowelGraphemes(word, rows);
  if (gs.length === 0) return null;
  const decisive = gs.filter((g) => g.row === 'back' || g.row === 'front');
  const kinds = new Set(decisive.map((g) => g.row));
  if (kinds.size > 1) return null; // нарушение сингармонизма (заимствование?) — не угадываем
  if (kinds.size === 1) return decisive[0].row as VowelRowId;
  if (gs.every((g) => g.row === 'neutral')) return 'neutral';
  return null;
}
