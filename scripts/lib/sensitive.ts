// Слова и предложения из советского быта или про алкоголь: помечаются тегом и не попадают
// в курс по умолчанию. Список проверяется по русскому переводу и по бурятскому тексту.

export const SENSITIVE_RULES: { tag: 'dated' | 'sensitive'; re: RegExp }[] = [
  { tag: 'dated', re: /колхоз|совхоз|трактор|комбайн|бригад|пятилетк/i },
  { tag: 'sensitive', re: /водк|спиртн|пьян|выпивш|нетрезв/i },
  { tag: 'sensitive', re: /(^|[^а-яёүөһ])архи([^а-яёүөһ]|$)/i },
];

export function sensitiveTags(...texts: string[]): string[] {
  const tags = new Set<string>();
  for (const { tag, re } of SENSITIVE_RULES) {
    if (texts.some((t) => re.test(t))) tags.add(tag);
  }
  return [...tags];
}
