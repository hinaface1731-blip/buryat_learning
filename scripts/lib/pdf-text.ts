import fs from 'node:fs';
import path from 'node:path';

export type PageText = { page: number; lines: string[] };

type Item = { str: string; x: number; y: number; width: number; height: number };

/**
 * Достаёт текст PDF построчно: элементы группируются по координате y, внутри строки
 * сортируются по x; большой разрыв по x превращается в несколько пробелов
 * (как у pdftotext -layout), чтобы колонки не слипались.
 */
export async function extractPdfText(pdfPath: string): Promise<PageText[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: false }).promise;
  const pages: PageText[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items: Item[] = [];
    for (const it of tc.items) {
      if (!('str' in it) || it.str === '') continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, height: it.height || 10 });
    }
    pages.push({ page: p, lines: itemsToLines(items) });
  }
  return pages;
}

export function itemsToLines(items: Item[]): string[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Item[][] = [];
  for (const it of sorted) {
    const row = rows[rows.length - 1];
    const tol = Math.max(2, it.height * 0.4);
    if (row && Math.abs(row[0].y - it.y) <= tol) row.push(it);
    else rows.push([it]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    let line = '';
    let end: number | null = null;
    for (const it of row) {
      if (end !== null) {
        const gap = it.x - end;
        const charW = it.width / Math.max(1, it.str.length);
        if (gap > charW * 3) line += '   ';
        else if (gap > charW * 0.25 && !line.endsWith(' ') && !it.str.startsWith(' ')) line += ' ';
      }
      line += it.str;
      end = it.x + it.width;
    }
    return line.replace(/\s+$/, '');
  });
}

/** Текст из кеша content/sources/.extracted, иначе извлечение и запись кеша. */
export async function loadPdfText(pdfPath: string, cacheDir: string): Promise<PageText[]> {
  const cacheFile = path.join(cacheDir, path.basename(pdfPath).replace(/\.pdf$/i, '.json'));
  const stat = fs.statSync(pdfPath);
  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) return cached.pages;
  }
  const pages = await extractPdfText(pdfPath);
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify({ size: stat.size, mtimeMs: stat.mtimeMs, pages }, null, 1));
  return pages;
}
