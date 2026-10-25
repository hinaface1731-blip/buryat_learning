import { DEGRADE_MAP } from '@/lib/buryat';

export type CheckResult = 'correct' | 'almost' | 'wrong';

/** Регистр, пробелы и знаки препинания не влияют на ответ. ё не заменяется на е. */
export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[.,!?;:"«»„“”()[\]—–\-…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ответ получен из ожидаемого заменой части особых букв ү→у, ө→о, һ→х
 * (и ничем больше). Обратная замена (у→ү) допуском не считается.
 */
export function isDegradedForm(input: string, expected: string): boolean {
  const a = [...input];
  const b = [...expected];
  if (a.length !== b.length || input === expected) return false;
  return b.every((ch, i) => a[i] === ch || DEGRADE_MAP[ch] === a[i]);
}

export type CheckOptions = {
  /** Нормализованные бурятские написания всех слов курса: «почти верно» не даётся, если ответ — другое слово. */
  courseForms: ReadonlySet<string>;
  /** minimal_pair_choose и т.п.: допуск выключен. */
  strict?: boolean;
};

/** Проверка бурятского ответа против одного или нескольких допустимых написаний. */
export function checkBuryat(input: string, expected: string | readonly string[], opts: CheckOptions): CheckResult {
  const answer = normalizeAnswer(input);
  const targets = (typeof expected === 'string' ? [expected] : expected).map(normalizeAnswer);
  if (!answer) return 'wrong';
  if (targets.includes(answer)) return 'correct';
  if (opts.strict) return 'wrong';
  if (opts.courseForms.has(answer)) return 'wrong'; // хүн ≠ хун: ответ — другое слово курса
  return targets.some((t) => isDegradedForm(answer, t)) ? 'almost' : 'wrong';
}

/** Проверка русского ответа: основной перевод или любая альтернатива. */
export function checkRussian(input: string, accepted: readonly string[]): CheckResult {
  const answer = normalizeAnswer(input);
  if (!answer) return 'wrong';
  return accepted.map(normalizeAnswer).includes(answer) ? 'correct' : 'wrong';
}

export function buildCourseForms(buryatForms: Iterable<string>): Set<string> {
  const set = new Set<string>();
  for (const f of buryatForms) set.add(normalizeAnswer(f));
  return set;
}
