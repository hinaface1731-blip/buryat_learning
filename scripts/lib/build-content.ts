import { foreignChars, singleSwapVariants, translit } from '../../src/lib/buryat';
import type { MinimalPair, PairContrast, Sentence, Source, Word } from '../../src/content/schema';

import { sensitiveTags } from './sensitive';
import type { ParsedTextbook, RawPair, RawWord } from './textbook-parser';

// Превращает разобранный текст книги в единицы курса и сливает их с уже существующим
// контентом так, чтобы правки ревьюера (verified, перевод, form, excluded, comment) не терялись.

export type WordWithOrigin = Word;

const BOOK = 'bxr-textbook' as const;

function stripTrailing(s: string): string {
  return s.replace(/[.;,]\s*$/, '').trim();
}

/** Делит перевод по «,» и «;» вне скобок. */
export function splitGloss(gloss: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of gloss) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => stripTrailing(s.trim())).filter(Boolean);
}

const MARKER_RE = /усил|част\.|частиц|указ\.|местоим|пад\.|связка|соответ\.|посл\.|анат\./i;

export function reviewReasons(w: { buryat: string; gloss: string; splitLine?: boolean }): string[] {
  const reasons: string[] = [];
  if (/[()]/.test(w.gloss)) reasons.push('скобки в переводе');
  if (MARKER_RE.test(w.gloss)) reasons.push('помета в переводе');
  if (w.gloss.length > 40) reasons.push('перевод длиннее 40 символов');
  const foreign = foreignChars(w.buryat.replace(/[()]/g, ''));
  if (foreign.length) reasons.push(`символы вне алфавита: ${foreign.join(' ')}`);
  if (/[A-Za-zΑ-Ωα-ω]/.test(w.gloss)) reasons.push('латиница/греческие буквы в переводе');
  if (/[үөһ]/i.test(w.gloss)) reasons.push('перевод не на русском');
  if (w.splitLine) reasons.push('две пары в одной строке книги');
  return reasons;
}

function key(buryat: string, russian: string): string {
  return `${buryat.toLowerCase()}|${russian.toLowerCase()}`;
}

function sourceOf(w: RawWord): Source {
  return {
    book: BOOK,
    page: w.page,
    ...(w.lesson !== undefined ? { lesson: w.lesson } : {}),
    ...(w.section ? { section: w.section } : {}),
  };
}

/** Новый id, не занятый ни существующими, ни уже выданными. */
function allocateId(base: string, taken: Set<string>): string {
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

export function buildWords(parsed: ParsedTextbook, existing: WordWithOrigin[]): { words: WordWithOrigin[]; added: number; orphans: string[] } {
  // 1. Склейка дублей внутри книги.
  type Acc = { raw: RawWord; buryat: string; russian: string; alternatives: string[]; also: Source[]; splitLine: boolean };
  const acc = new Map<string, Acc>();
  for (const raw of parsed.words) {
    const buryat = stripTrailing(raw.buryat.replace(/\s+/g, ' '));
    const [russian, ...alternatives] = splitGloss(raw.gloss);
    if (!buryat || !russian) continue;
    const k = key(buryat, raw.gloss.trim());
    const prev = acc.get(k);
    if (prev) {
      prev.also.push(sourceOf(raw));
      continue;
    }
    acc.set(k, { raw, buryat, russian, alternatives, also: [], splitLine: !!raw.splitLine });
  }

  // 2. Флаги, теги, слияние с существующими по исходному тексту книги.
  const existingByOrigin = new Map(existing.map((w) => [key(w.origin.buryat, w.origin.russian), w]));
  const taken = new Set(existing.map((w) => w.id));
  const seenOrigins = new Set<string>();
  const result: WordWithOrigin[] = [];
  let added = 0;

  for (const [k, a] of acc) {
    seenOrigins.add(k);
    const source: Source = { ...sourceOf(a.raw), ...(a.also.length ? { also: a.also } : {}) };
    const prev = existingByOrigin.get(k);
    const lessonTag = a.raw.lesson !== undefined ? `lesson-${a.raw.lesson}` : 'intro';
    const autoTags = [lessonTag, ...(a.buryat.includes(' ') ? ['phrase'] : []), ...sensitiveTags(a.buryat, a.raw.gloss)];
    const reasons = reviewReasons({ buryat: a.buryat, gloss: a.raw.gloss, splitLine: a.splitLine });
    if (prev) {
      // Ручные поля не трогаем; обновляем только ссылку на источник и автоматические пометки непроверенных.
      result.push({
        ...prev,
        source,
        tags: [...new Set([...prev.tags, ...autoTags])],
        ...(prev.verified ? {} : { needs_review: reasons.length > 0, review_reasons: reasons }),
      });
      continue;
    }
    added++;
    const isSensitive = autoTags.includes('dated') || autoTags.includes('sensitive');
    result.push({
      id: allocateId(translit(a.buryat), taken),
      kind: 'word',
      buryat: a.buryat,
      russian: a.russian,
      alternatives: a.alternatives,
      source,
      tags: autoTags,
      verified: false,
      needs_review: reasons.length > 0,
      review_reasons: reasons,
      possible_typo: false,
      typo_candidates: [],
      form: null,
      excluded: isSensitive,
      comment: '',
      origin: { buryat: a.buryat, russian: a.raw.gloss.trim() },
    });
  }

  // Единицы, которых больше нет в разборе книги (или добавленные носителем), сохраняются.
  const orphans: string[] = [];
  for (const w of existing) {
    if (seenOrigins.has(key(w.origin.buryat, w.origin.russian))) continue;
    if (w.source.book === BOOK) orphans.push(w.id);
    result.push(w);
  }

  markPossibleTypos(result, parsed.readingTokens);
  return { words: result, added, orphans };
}

/**
 * Возможная опечатка ү/у, ө/о, һ/х:
 * а) есть другое слово курса, отличающееся одной такой заменой, с пересекающимся переводом;
 * б) в текстах упражнений того же урока слово встречается только в «заменённом» написании.
 */
const specialCount = (s: string) => (s.match(/[үөһ]/gi) ?? []).length;

export function markPossibleTypos(words: Word[], readingTokens: Map<number, Set<string>>): void {
  const meanings = (w: Word) => new Set([w.russian, ...w.alternatives].map((m) => m.toLowerCase()));
  const byText = new Map<string, Word[]>();
  for (const w of words) {
    const t = w.buryat.toLowerCase();
    byText.set(t, [...(byText.get(t) ?? []), w]);
  }
  for (const w of words) {
    if (w.verified) continue;
    const candidates = new Set<string>();
    const text = w.buryat.toLowerCase();
    const mine = meanings(w);
    // В книге опечатки теряют особые буквы (ү→у), поэтому подозреваем написание, где их меньше.
    for (const v of singleSwapVariants(text)) {
      for (const other of byText.get(v) ?? []) {
        if (specialCount(other.buryat) <= specialCount(text)) continue;
        if ([...meanings(other)].some((m) => mine.has(m))) candidates.add(other.buryat);
      }
    }
    const lesson = w.source.lesson;
    const tokens = lesson !== undefined ? readingTokens.get(lesson) : undefined;
    if (tokens) {
      for (const token of text.split(/\s+/)) {
        if (tokens.has(token)) continue;
        for (const v of singleSwapVariants(token)) {
          if (tokens.has(v) && specialCount(v) > specialCount(token)) candidates.add(`${v} (текст урока)`);
        }
      }
    }
    w.possible_typo = candidates.size > 0;
    w.typo_candidates = [...candidates];
  }
}

export type SentenceWithOrigin = Sentence;

export function buildSentences(parsed: ParsedTextbook, existing: SentenceWithOrigin[]): SentenceWithOrigin[] {
  const existingByOrigin = new Map(existing.map((s) => [s.origin, s]));
  const counters = new Map<string, number>();
  const seen = new Set<string>();
  const result: SentenceWithOrigin[] = [];
  const taken = new Set(existing.map((s) => s.id));
  for (const raw of parsed.sentences) {
    if (seen.has(raw.buryat)) continue;
    seen.add(raw.buryat);
    const blockId = `l${raw.lesson}-${raw.blockKey}`;
    const n = (counters.get(blockId) ?? 0) + 1;
    counters.set(blockId, n);
    const source: Source = { book: BOOK, page: raw.page, lesson: raw.lesson, section: raw.block };
    const tags = [`lesson-${raw.lesson}`, ...raw.tags, ...sensitiveTags(raw.buryat)];
    const prev = existingByOrigin.get(raw.buryat);
    if (prev) {
      result.push({ ...prev, source, tags: [...new Set([...prev.tags, ...tags])] });
      continue;
    }
    result.push({
      id: allocateId(`s-${blockId}-${n}`, taken),
      kind: 'sentence',
      buryat: raw.buryat,
      translation: null,
      needs_translation: true,
      source,
      tags,
      verified: false,
      excluded: tags.includes('dated') || tags.includes('sensitive'),
      comment: '',
      origin: raw.buryat,
    });
  }
  for (const s of existing) if (!seen.has(s.origin)) result.push(s);
  return result;
}

const SOFT: [string, string][] = [
  ['юу', 'уу'],
  ['ёо', 'оо'],
  ['яа', 'аа'],
  ['еэ', 'ээ'],
];

export function classifyContrast(a: string, b: string): PairContrast {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.length === short.length + 1) {
    for (let i = 0; i < long.length; i++) {
      if (long.slice(0, i) + long.slice(i + 1) === short && (long[i] === long[i - 1] || long[i] === long[i + 1])) return 'length';
    }
  }
  if (SOFT.some(([soft, hard]) => a.replace(soft, hard) === b || b.replace(soft, hard) === a)) return 'soft';
  if (a.length === b.length) {
    const diff = [...a].filter((ch, i) => ch !== b[i]);
    if (diff.length === 1) return 'quality';
  }
  return 'other';
}

const lookupKey = (s: string) => s.toLowerCase().replace(/[()\s]/g, '');

export function buildPairs(rawPairs: RawPair[], words: Word[], existing: MinimalPair[]): MinimalPair[] {
  const verifiedById = new Map(existing.map((p) => [p.id, p.verified]));
  const byText = new Map<string, Word[]>();
  for (const w of words) {
    const k = lookupKey(w.buryat);
    byText.set(k, [...(byText.get(k) ?? []), w]);
  }
  const resolve = (text: string, gloss: string | undefined, lesson: number | undefined): Word | undefined => {
    const options = (byText.get(lookupKey(text)) ?? []).filter((w) => !w.excluded);
    if (gloss) {
      const g = splitGloss(gloss)[0]?.toLowerCase();
      return options.find((w) => w.russian.toLowerCase() === g) ?? options[0];
    }
    return options.find((w) => w.source.lesson === lesson) ?? options[0];
  };

  const taken = new Set<string>();
  const result: MinimalPair[] = [];
  const seen = new Set<string>();
  for (const p of rawPairs) {
    const dedupe = `${p.a}|${p.b}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const wa = resolve(p.a, p.aGloss, p.lesson);
    const wb = resolve(p.b, p.bGloss, p.lesson);
    const reasons: string[] = [];
    if (!wa) reasons.push(`нет перевода для «${p.a}»`);
    if (!wb) reasons.push(`нет перевода для «${p.b}»`);
    for (const w of [wa, wb]) {
      if (w?.review_reasons.includes('помета в переводе')) reasons.push(`«${w.buryat}» — служебное слово/помета`);
      if (w?.review_reasons.includes('перевод не на русском')) reasons.push(`«${w.buryat}» — перевод не на русском`);
    }
    if (wa && wb && wa.russian.toLowerCase() === wb.russian.toLowerCase()) reasons.push('одинаковый перевод');
    const contrast = classifyContrast(lookupKey(p.a), lookupKey(p.b));
    if (p.expectSoft && contrast !== 'soft') reasons.push('в таблице «твёрдое — мягкое», но различие не в мягкости: проверить написание');
    const id = allocateId(`mp-${translit(p.a)}-${translit(p.b)}`, taken);
    result.push({
      id,
      a: wa?.id ?? null,
      b: wb?.id ?? null,
      a_text: p.a,
      b_text: p.b,
      contrast,
      source: { book: BOOK, page: p.page, ...(p.lesson ? { lesson: p.lesson } : {}), section: p.section },
      usable: reasons.length === 0,
      reasons,
      verified: verifiedById.get(id) ?? false,
    });
  }
  return result;
}
