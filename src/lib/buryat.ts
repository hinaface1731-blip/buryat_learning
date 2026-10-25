// Общие операции над бурятским написанием. Используются и приложением, и скриптами импорта.

/** Строчные буквы бурятского алфавита (стр. 1 учебника). */
export const BURYAT_LETTERS = 'абвгдеёжзийклмноөпрстуүфхһцчшщъыьэюя';

const LETTER_SET = new Set(BURYAT_LETTERS);

/** Пары «особая буква → русская замена», которые проверка ответа допускает как «почти верно». */
export const DEGRADE_MAP: Record<string, string> = { ү: 'у', ө: 'о', һ: 'х' };

const SWAP_MAP: Record<string, string> = { ү: 'у', у: 'ү', ө: 'о', о: 'ө', һ: 'х', х: 'һ' };

/** Заменяет ү→у, ө→о, һ→х (как пишет человек без бурятской раскладки). */
export function degrade(s: string): string {
  let out = '';
  for (const ch of s) out += DEGRADE_MAP[ch] ?? ch;
  return out;
}

/** Все написания, отличающиеся ровно одной заменой ү↔у, ө↔о, һ↔х. */
export function singleSwapVariants(word: string): string[] {
  const chars = [...word];
  const out: string[] = [];
  chars.forEach((ch, i) => {
    const swap = SWAP_MAP[ch];
    if (!swap) return;
    const copy = [...chars];
    copy[i] = swap;
    out.push(copy.join(''));
  });
  return out;
}

/** Символы, которых нет в бурятском алфавите (латиница, греческая Γ и т.п.), кроме пробела, дефиса и апострофа. */
export function foreignChars(s: string): string[] {
  const bad = new Set<string>();
  for (const ch of s.toLowerCase()) {
    if (LETTER_SET.has(ch) || ch === ' ' || ch === '-' || ch === '’' || ch === "'") continue;
    bad.add(ch);
  }
  return [...bad];
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'ye', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', ө: 'oe', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ү: 'ue', ф: 'f', х: 'kh', һ: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** Латинский slug для id и имён аудиофайлов: һүн → huen, хүн → khuen. */
export function translit(s: string): string {
  let out = '';
  for (const ch of s.toLowerCase().normalize('NFC')) {
    if (ch in TRANSLIT) out += TRANSLIT[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else out += '-';
  }
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'x';
}
