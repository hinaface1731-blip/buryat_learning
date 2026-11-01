import type { PairContrast } from '@/content/schema';
import { DEGRADE_MAP } from '@/lib/buryat';

import { isDegradedForm, normalizeAnswer } from './check';

// Обратная связь называет конкретную причину ошибки, а не одну общую фразу.

/** Какие особые буквы потеряны в ответе: «һ, а не х». */
function lostLetters(input: string, expected: string): string[] {
  const a = [...input];
  const out = new Set<string>();
  [...expected].forEach((ch, i) => {
    if (a[i] !== ch && DEGRADE_MAP[ch] === a[i]) out.add(`${ch}, а не ${a[i]}`);
  });
  return [...out];
}

const collapseDoubles = (s: string) => s.replace(/([аоуэиүө])\1/g, '$1');

export function explainTyped(input: string, expected: string, courseForms: ReadonlySet<string>): string | undefined {
  const a = normalizeAnswer(input);
  const b = normalizeAnswer(expected);
  if (a === b || !a) return undefined;
  if (isDegradedForm(a, b)) {
    const letters = lostLetters(a, b);
    if (courseForms.has(a)) return `«${a}» — другое слово: особая буква меняет смысл. Здесь нужна ${letters.join('; ')}.`;
    return `Здесь нужна буква ${letters.join('; ')}.`;
  }
  if (a !== b && collapseDoubles(a) === collapseDoubles(b)) return 'Проверьте долготу гласного: одна буква или две — это разные слова.';
  return undefined;
}

export function explainPair(contrast: PairContrast): string {
  switch (contrast) {
    case 'length':
      return 'Эти слова различаются только долготой гласного.';
    case 'soft':
      return 'Различие — в мягкости: например, уу и юу, аа и яа.';
    case 'quality':
      return 'Эти слова различаются одним гласным.';
    default:
      return 'Слова похожи, но значат разное.';
  }
}

export const EXPLAIN_MATCH = 'Часть пар сначала была сопоставлена неверно. Эти слова вернутся в повторении.';
export const EXPLAIN_ORDER = 'Слова верные? Тогда проверьте их порядок.';
export const EXPLAIN_ROWS = 'Ряд определяем по гласным слова. Посмотрите на правильные ответы.';
export const EXPLAIN_RETRY = 'Это задание уже встречалось. Ничего страшного: слово вернётся в повторении.';
