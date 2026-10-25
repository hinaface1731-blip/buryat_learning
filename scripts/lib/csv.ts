// Минимальный CSV (RFC 4180): запятая, кавычки, переносы внутри кавычек. Пишем UTF-8 с BOM — так Excel
// открывает кириллицу и ү/ө/һ без мастера импорта.

export function toCsv(header: string[], rows: Record<string, string>[]): string {
  const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [header.join(','), ...rows.map((r) => header.map((h) => esc(r[h] ?? '')).join(','))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, '');
  // Excel в русской локали сохраняет с «;» — определяем разделитель по заголовку.
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

export function parseBool(v: string | undefined): boolean | undefined {
  const s = (v ?? '').trim().toLowerCase();
  if (['true', '1', 'да', 'yes', 'y', '+'].includes(s)) return true;
  if (['false', '0', 'нет', 'no', 'n', '-', ''].includes(s)) return false;
  return undefined;
}

export const LIST_SEP = ' | ';
export const splitList = (v: string) =>
  v
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
